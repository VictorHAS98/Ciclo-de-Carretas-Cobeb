-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 029 — NRI no admin: cascade delete + badge no CheckRecebimento
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Atualiza excluir_viagens para também deletar nri_emissoes
-- antes de deletar tarefas (seguindo a mesma ordem já existente)

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
   WHERE tarefa_id IN (SELECT id FROM public.tarefas WHERE viagem_id = ANY(p_ids));

  DELETE FROM public.conferencia_itens
   WHERE tarefa_id IN (SELECT id FROM public.tarefas WHERE viagem_id = ANY(p_ids));

  -- Remove emissões de NRI vinculadas às tarefas
  DELETE FROM public.nri_emissoes
   WHERE tarefa_id IN (SELECT id FROM public.tarefas WHERE viagem_id = ANY(p_ids));

  DELETE FROM public.tarefas WHERE viagem_id = ANY(p_ids);

  UPDATE public.pedidos SET viagem_id = NULL WHERE viagem_id = ANY(p_ids);

  DELETE FROM public.viagens
   WHERE id = ANY(p_ids)
     AND status IN ('concluida', 'aguardando_conferencia');

  RETURN v_count;
END;
$$;
