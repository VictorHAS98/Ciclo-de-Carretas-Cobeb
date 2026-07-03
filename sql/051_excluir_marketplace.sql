-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 051 — Exclusão em cascata de entrada marketplace
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Remove: nri_emissoes → tarefas → portaria_atendimentos (soft delete)
-- Segurança: verifica que o atendimento é marketplace e pertence à
-- unidade do usuário autenticado (portaria ou acesso_total).

CREATE OR REPLACE FUNCTION public.excluir_entrada_marketplace(
  p_atendimento_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_unidade_id UUID;
  v_tarefa_ids UUID[];
BEGIN
  SELECT unidade_id INTO v_unidade_id
  FROM   public.portaria_atendimentos
  WHERE  id = p_atendimento_id
    AND  tipo = 'marketplace'
    AND  excluido_em IS NULL;

  IF v_unidade_id IS NULL THEN
    RAISE EXCEPTION 'Atendimento marketplace não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE  id = auth.uid() AND ativo = true
      AND  (acesso_total = true OR unidade_id = v_unidade_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para excluir este atendimento';
  END IF;

  SELECT ARRAY_AGG(id) INTO v_tarefa_ids
  FROM   public.tarefas
  WHERE  portaria_atendimento_id = p_atendimento_id;

  IF v_tarefa_ids IS NOT NULL THEN
    DELETE FROM public.nri_emissoes WHERE tarefa_id = ANY(v_tarefa_ids);
    DELETE FROM public.tarefas       WHERE id        = ANY(v_tarefa_ids);
  END IF;

  UPDATE public.portaria_atendimentos
  SET    excluido_em = NOW()
  WHERE  id = p_atendimento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_entrada_marketplace(UUID) TO authenticated;
