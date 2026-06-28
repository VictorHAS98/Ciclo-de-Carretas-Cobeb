-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 041 — Rastreamento GPS dos motoristas
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── 1. Colunas de posição em viagens ─────────────────────────────────────────

ALTER TABLE public.viagens
  ADD COLUMN IF NOT EXISTS motorista_lat          DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS motorista_lng          DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS motorista_last_seen_at TIMESTAMPTZ;

-- ── 2. Garantir que aguardando_conferencia está no CHECK ──────────────────────
-- (caso o constraint original não inclua esse status)

ALTER TABLE public.viagens
  DROP CONSTRAINT IF EXISTS viagens_status_check;

ALTER TABLE public.viagens
  ADD CONSTRAINT viagens_status_check
  CHECK (status IN (
    'iniciada',
    'em_transito',
    'na_fabrica',
    'retornando',
    'aguardando_conferencia',
    'concluida'
  ));

-- ── 3. Atualizar get_painel_viagens para incluir posição e fábrica destino ────
-- DROP necessário porque a assinatura de retorno mudou (novos campos)

DROP FUNCTION IF EXISTS public.get_painel_viagens();

CREATE OR REPLACE FUNCTION public.get_painel_viagens()
RETURNS TABLE (
  id                    UUID,
  status                TEXT,
  horario_agendado      TEXT,
  placa_carreta         TEXT,
  placa_cavalo          TEXT,
  motorista_nome        TEXT,
  numero_nf             TEXT,
  total_pedidos         BIGINT,
  produtos              JSONB,
  motorista_lat         DECIMAL,
  motorista_lng         DECIMAL,
  motorista_last_seen_at TIMESTAMPTZ,
  fab_lat               DECIMAL,
  fab_lng               DECIMAL,
  fab_nome              TEXT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH meu_perfil AS (
    SELECT unidade_id, acesso_total FROM public.profiles WHERE id = auth.uid()
  ),
  viagens_ativas AS (
    SELECT v.id, v.status, v.horario_agendado, v.carreta_id, v.cavalo_id,
           v.motorista_id, v.created_at,
           v.motorista_lat, v.motorista_lng, v.motorista_last_seen_at
    FROM public.viagens v, meu_perfil mp
    WHERE v.status <> 'concluida'
      AND (
        mp.acesso_total = true
        OR (mp.unidade_id IS NOT NULL AND v.unidade_descarga_id = mp.unidade_id)
      )
  ),
  prods AS (
    SELECT
      p.viagem_id,
      jsonb_agg(
        jsonb_build_object(
          'descricao',    p.descricao,
          'qtde_pallets', p.qtde_pallets,
          'qtde_skus',    p.qtde_skus,
          'embalagem',    p.embalagem
        ) ORDER BY p.descricao
      ) AS lista,
      COUNT(*) AS total
    FROM public.pedidos p
    WHERE p.viagem_id IN (SELECT id FROM viagens_ativas)
    GROUP BY p.viagem_id
  ),
  tarefa_unica AS (
    SELECT DISTINCT ON (viagem_id) viagem_id, numero_nf
    FROM public.tarefas
    ORDER BY viagem_id, created_at DESC
  ),
  fabrica_destino AS (
    SELECT DISTINCT ON (p.viagem_id)
      p.viagem_id,
      u.latitude  AS fab_lat,
      u.longitude AS fab_lng,
      u.nome      AS fab_nome
    FROM public.pedidos p
    JOIN public.unidades u
      ON u.codigo_ambev = p.codigo_fabrica
     AND u.tipo = 'fabrica'
    WHERE p.viagem_id IN (SELECT id FROM viagens_ativas)
    ORDER BY p.viagem_id
  )
  SELECT
    v.id,
    v.status,
    v.horario_agendado,
    cr.placa                           AS placa_carreta,
    ca.placa                           AS placa_cavalo,
    mp.nome                            AS motorista_nome,
    t.numero_nf,
    COALESCE(pr.total, 0)             AS total_pedidos,
    COALESCE(pr.lista, '[]'::jsonb)   AS produtos,
    v.motorista_lat,
    v.motorista_lng,
    v.motorista_last_seen_at,
    fd.fab_lat,
    fd.fab_lng,
    fd.fab_nome
  FROM viagens_ativas v
  LEFT JOIN public.carretas    cr ON cr.id = v.carreta_id
  LEFT JOIN public.cavalos     ca ON ca.id = v.cavalo_id
  LEFT JOIN public.profiles    mp ON mp.id = v.motorista_id
  LEFT JOIN tarefa_unica       t  ON t.viagem_id = v.id
  LEFT JOIN prods              pr ON pr.viagem_id = v.id
  LEFT JOIN fabrica_destino    fd ON fd.viagem_id = v.id
  ORDER BY
    CASE v.status
      WHEN 'retornando'             THEN 1
      WHEN 'aguardando_conferencia' THEN 2
      WHEN 'na_fabrica'             THEN 3
      WHEN 'em_transito'            THEN 4
      WHEN 'iniciada'               THEN 5
      ELSE 6
    END,
    v.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_painel_viagens() TO authenticated;

-- ── 4. Índice para posição ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_viagens_posicao
  ON public.viagens(motorista_lat, motorista_lng)
  WHERE motorista_lat IS NOT NULL;
