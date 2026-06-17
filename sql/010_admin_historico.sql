-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 010 — Exclusão de histórico de viagens (admin)
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Função SECURITY DEFINER para exclusão em cascata de viagens concluídas.
-- Remove na ordem correta: anomalias → conferencia_itens → tarefas
-- → desvincula pedidos → exclui viagens.
-- Só opera em viagens com status='concluida' e valida perfil admin.
CREATE OR REPLACE FUNCTION public.excluir_viagens(p_ids UUID[])
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Garante que apenas viagens concluídas sejam excluídas
  SELECT COUNT(*) INTO v_count
    FROM public.viagens
   WHERE id = ANY(p_ids) AND status = 'concluida';

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

  DELETE FROM public.viagens WHERE id = ANY(p_ids) AND status = 'concluida';

  RETURN v_count;
END;
$$;
