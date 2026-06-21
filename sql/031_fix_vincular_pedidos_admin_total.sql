-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 031 — Permitir admin_total vincular pedidos e ver resumo de viagem
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── vincular_pedidos_viagem ───────────────────────────────────────────────────
-- Atualiza a verificação de segurança para aceitar admin_total,
-- que pode ter criado a viagem com motorista_id diferente de auth.uid()

CREATE OR REPLACE FUNCTION public.vincular_pedidos_viagem(
  p_viagem_id       UUID,
  p_numeros_pedido  BIGINT[]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT (
    is_admin_total()
    OR EXISTS (
      SELECT 1 FROM public.viagens
      WHERE id = p_viagem_id AND motorista_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: viagem não pertence ao motorista autenticado';
  END IF;

  UPDATE public.pedidos
  SET viagem_id = p_viagem_id
  WHERE numero_pedido = ANY(p_numeros_pedido);
END;
$$;

-- ── get_resumo_viagem ─────────────────────────────────────────────────────────
-- Mesma lógica: permite admin_total consultar o resumo de qualquer viagem

CREATE OR REPLACE FUNCTION public.get_resumo_viagem(p_viagem_id UUID)
RETURNS TABLE(
  paletes_esperados NUMERIC,
  paletes_recebidos NUMERIC,
  total_anomalias   INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT
    (SELECT COALESCE(SUM(qtde_pallets), 0)
       FROM public.pedidos
      WHERE viagem_id = p_viagem_id)                                   AS paletes_esperados,
    (SELECT COALESCE(SUM(ci.qtde_recebida), 0)
       FROM public.conferencia_itens ci
       JOIN public.tarefas t ON t.id = ci.tarefa_id
      WHERE t.viagem_id = p_viagem_id)                                 AS paletes_recebidos,
    (SELECT COUNT(*)::INTEGER
       FROM public.anomalias a
       JOIN public.tarefas t ON t.id = a.tarefa_id
      WHERE t.viagem_id = p_viagem_id)                                 AS total_anomalias
  WHERE (
    is_admin_total()
    OR EXISTS (
      SELECT 1 FROM public.viagens
       WHERE id = p_viagem_id AND motorista_id = auth.uid()
    )
  );
$$;

-- ── motorista_owns_viagem ─────────────────────────────────────────────────────
-- Permite admin_total "possuir" qualquer viagem para fins de policy de tarefas

CREATE OR REPLACE FUNCTION public.motorista_owns_viagem(p_viagem_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT (
    is_admin_total()
    OR EXISTS (
      SELECT 1 FROM public.viagens
       WHERE id = p_viagem_id AND motorista_id = auth.uid()
    )
  );
$$;
