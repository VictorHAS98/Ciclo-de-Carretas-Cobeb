-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 008 — Resumo de Viagem e Bloqueio por Conferência
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── Motoristas podem ver tarefas das próprias viagens ─────────────────────────
-- Necessário para polling do status de conferência no app do motorista.
DROP POLICY IF EXISTS "motoristas veem tarefas das proprias viagens" ON public.tarefas;
CREATE POLICY "motoristas veem tarefas das proprias viagens"
  ON public.tarefas FOR SELECT TO authenticated
  USING (
    is_motorista() AND
    EXISTS (
      SELECT 1 FROM public.viagens v
      WHERE v.id = viagem_id AND v.motorista_id = auth.uid()
    )
  );

-- ── Função: get_resumo_viagem ─────────────────────────────────────────────────
-- Retorna totais de paletes e anomalias para o resumo pós-viagem.
-- SECURITY DEFINER: acessa conferencia_itens e anomalias sem policy específica.
-- Só retorna dados se auth.uid() for o motorista da viagem (segurança).
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
      WHERE viagem_id = p_viagem_id)                                             AS paletes_esperados,
    (SELECT COALESCE(SUM(ci.qtde_recebida), 0)
       FROM public.conferencia_itens ci
       JOIN public.tarefas t ON t.id = ci.tarefa_id
      WHERE t.viagem_id = p_viagem_id)                                           AS paletes_recebidos,
    (SELECT COUNT(*)::INTEGER
       FROM public.anomalias a
       JOIN public.tarefas t ON t.id = a.tarefa_id
      WHERE t.viagem_id = p_viagem_id)                                           AS total_anomalias
  WHERE EXISTS (
    SELECT 1 FROM public.viagens
     WHERE id = p_viagem_id AND motorista_id = auth.uid()
  );
$$;
