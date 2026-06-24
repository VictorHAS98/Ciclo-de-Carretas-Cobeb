-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 033 — Painel de Veículos (Operador Empilhadeira)
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Função SECURITY DEFINER: retorna viagens ativas da unidade do operador
-- Ordenadas por urgência: retornando > aguardando_conferencia > na_fabrica > em_transito > iniciada
CREATE OR REPLACE FUNCTION public.get_painel_viagens()
RETURNS TABLE (
  id               UUID,
  status           TEXT,
  horario_agendado TEXT,
  placa_carreta    TEXT,
  placa_cavalo     TEXT,
  motorista_nome   TEXT,
  numero_nf        TEXT,
  total_pedidos    BIGINT,
  produtos         JSONB
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH minha_unidade AS (
    SELECT unidade_id FROM public.profiles WHERE id = auth.uid()
  ),
  viagens_ativas AS (
    SELECT v.id, v.status, v.horario_agendado, v.carreta_id, v.cavalo_id, v.motorista_id, v.created_at
    FROM public.viagens v
    JOIN minha_unidade mu ON v.unidade_descarga_id = mu.unidade_id
    WHERE v.status <> 'concluida'
      AND mu.unidade_id IS NOT NULL
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
  )
  SELECT
    v.id,
    v.status,
    v.horario_agendado,
    cr.placa                        AS placa_carreta,
    ca.placa                        AS placa_cavalo,
    mp.nome                         AS motorista_nome,
    t.numero_nf,
    COALESCE(pr.total, 0)          AS total_pedidos,
    COALESCE(pr.lista, '[]'::jsonb) AS produtos
  FROM viagens_ativas v
  LEFT JOIN public.carretas  cr ON cr.id = v.carreta_id
  LEFT JOIN public.cavalos   ca ON ca.id = v.cavalo_id
  LEFT JOIN public.profiles  mp ON mp.id = v.motorista_id
  LEFT JOIN tarefa_unica     t  ON t.viagem_id = v.id
  LEFT JOIN prods            pr ON pr.viagem_id = v.id
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

-- ================================================================
-- OPCIONAL — Realtime (atualização instantânea sem polling)
-- Se quiser updates em tempo real, habilite no Supabase Studio:
--   Table Editor > viagens > Enable Realtime (toggle)
-- ================================================================
