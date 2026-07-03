-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 047 — Painel: agendamento revenda + GPS no card
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Atualiza get_painel_viagens para:
--   1. Retornar agendamento_bloco / agendamento_data / agendamento_tipo_dia
--      (agendamento de chegada na revenda, tabela agendamentos)
--   2. Retornar motorista_last_seen_at (para sinal GPS no card)
--   3. Manter filtro acesso_total (admin vê todas as unidades)

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
  agendamento_bloco       TEXT,
  agendamento_data        DATE,
  agendamento_tipo_dia    TEXT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH meu_perfil AS (
    SELECT unidade_id, acesso_total FROM public.profiles WHERE id = auth.uid()
  ),
  viagens_ativas AS (
    SELECT v.id, v.status, v.horario_agendado, v.carreta_id, v.cavalo_id, v.motorista_id, v.created_at
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
  rastr AS (
    SELECT DISTINCT ON (motorista_id)
      motorista_id, last_seen_at
    FROM public.rastreamento
    ORDER BY motorista_id, last_seen_at DESC
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
    r.last_seen_at                   AS motorista_last_seen_at,
    ag.bloco                         AS agendamento_bloco,
    ag.data_agendamento              AS agendamento_data,
    ag.tipo_dia                      AS agendamento_tipo_dia
  FROM viagens_ativas v
  LEFT JOIN public.carretas  cr ON cr.id = v.carreta_id
  LEFT JOIN public.cavalos   ca ON ca.id = v.cavalo_id
  LEFT JOIN public.profiles  pf ON pf.id = v.motorista_id
  LEFT JOIN tarefa_unica     t  ON t.viagem_id = v.id
  LEFT JOIN prods            pr ON pr.viagem_id = v.id
  LEFT JOIN agend            ag ON ag.viagem_id = v.id
  LEFT JOIN rastr            r  ON r.motorista_id = v.motorista_id
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
