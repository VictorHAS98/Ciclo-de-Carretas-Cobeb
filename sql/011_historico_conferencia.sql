-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 011 — Ampliar exclusão de histórico para viagens em conferência
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Substitui a função do script 010 para aceitar também
-- viagens com status='aguardando_conferencia' (em conferência ou já conferidas).
CREATE OR REPLACE FUNCTION public.excluir_viagens(p_ids UUID[])
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.viagens
   WHERE id = ANY(p_ids)
     AND status IN ('concluida', 'aguardando_conferencia');

  IF v_count = 0 THEN RETURN 0; END IF;

  DELETE FROM public.anomalias
   WHERE tarefa_id IN (
     SELECT id FROM public.tarefas WHERE viagem_id = ANY(p_ids)
   );

  DELETE FROM public.conferencia_itens
   WHERE tarefa_id IN (
     SELECT id FROM public.tarefas WHERE viagem_id = ANY(p_ids)
   );

  DELETE FROM public.tarefas WHERE viagem_id = ANY(p_ids);

  UPDATE public.pedidos SET viagem_id = NULL WHERE viagem_id = ANY(p_ids);

  DELETE FROM public.viagens
   WHERE id = ANY(p_ids)
     AND status IN ('concluida', 'aguardando_conferencia');

  RETURN v_count;
END;
$$;
