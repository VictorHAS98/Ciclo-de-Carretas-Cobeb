-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 048 — Painel: motorista_lat/lng + fab coords para o mapa
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Adiciona motorista_lat, motorista_lng (posição GPS do caminhão)
-- e fab_lat, fab_lng, fab_nome (coordenadas da fábrica via pedidos)
-- para que o MapaRealtime possa renderizar os marcadores de caminhão.

DROP FUNCTION IF EXISTS public.get_painel_viagens();

CREATE OR REPLACE FUNCTION public.get_painel_viagens()
RETURNS TABLE (
  id                      UUID,
  status                  TEXT,
  horario_agendado        TEXT,
  placa_carreta           TEXT,
  placa_cavalo            TEXT,
  motorista_nome          TEXT,
  numero_nf               TEXT,
  total_pedidos           BIGINT,
  produtos                JSONB,
  motorista_last_seen_at  TIMESTAMPTZ,
  motorista_lat           DECIMAL,
  motorista_lng           DECIMAL,
  agendamento_bloco       TEXT,
  agendamento_data        DATE,
  agendamento_tipo_dia    TEXT,
  fab_nome                TEXT,
  fab_lat                 DECIMAL,
  fab_lng                 DECIMAL
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH meu_perfil AS (
    SELECT unidade_id, acesso_total FROM public.profiles WHERE id = auth.uid()
  ),
  viagens_ativas AS (
    SELECT
      v.id, v.status, v.horario_agendado,
      v.carreta_id, v.cavalo_id, v.motorista_id, v.created_at,
      v.motorista_last_seen_at, v.motorista_lat, v.motorista_lng
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
  agend AS (
    SELECT DISTINCT ON (viagem_id)
      viagem_id, bloco, data_agendamento, tipo_dia
    FROM public.agendamentos
    WHERE status <> 'cancelado'
    ORDER BY viagem_id, created_at DESC
  ),
  fab AS (
    SELECT DISTINCT ON (p.viagem_id)
      p.viagem_id,
      u.nome      AS fab_nome,
      u.latitude  AS fab_lat,
      u.longitude AS fab_lng
    FROM public.pedidos p
    JOIN public.unidades u
      ON u.codigo_ambev = p.codigo_fabrica AND u.tipo = 'fabrica'
    WHERE p.viagem_id IN (SELECT id FROM viagens_ativas)
      AND p.codigo_fabrica IS NOT NULL
    ORDER BY p.viagem_id, p.created_at ASC
  )
  SELECT
    v.id,
    v.status,
    v.horario_agendado,
    cr.placa                         AS placa_carreta,
    ca.placa                         AS placa_cavalo,
    pf.nome                          AS motorista_nome,
    t.numero_nf,
    COALESCE(pr.total, 0)           AS total_pedidos,
    COALESCE(pr.lista, '[]'::jsonb)  AS produtos,
    v.motorista_last_seen_at,
    v.motorista_lat,
    v.motorista_lng,
    ag.bloco                         AS agendamento_bloco,
    ag.data_agendamento              AS agendamento_data,
    ag.tipo_dia                      AS agendamento_tipo_dia,
    f.fab_nome,
    f.fab_lat,
    f.fab_lng
  FROM viagens_ativas v
  LEFT JOIN public.carretas  cr ON cr.id = v.carreta_id
  LEFT JOIN public.cavalos   ca ON ca.id = v.cavalo_id
  LEFT JOIN public.profiles  pf ON pf.id = v.motorista_id
  LEFT JOIN tarefa_unica     t  ON t.viagem_id = v.id
  LEFT JOIN prods            pr ON pr.viagem_id = v.id
  LEFT JOIN agend            ag ON ag.viagem_id = v.id
  LEFT JOIN fab              f  ON f.viagem_id  = v.id
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
