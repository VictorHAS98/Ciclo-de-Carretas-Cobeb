-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 013 — Liberação manual de motorista pelo admin
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Marca a tarefa da viagem como 'concluida', desbloqueando a 5ª etapa
-- no app do motorista. Se a tarefa não existir (falha na criação),
-- ela é criada já concluída aproveitando os dados da viagem.
CREATE OR REPLACE FUNCTION public.liberar_motorista(p_viagem_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_unidade_id UUID;
  v_numero_nf  TEXT;
  v_tarefa_id  UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT unidade_descarga_id, numero_nf
    INTO v_unidade_id, v_numero_nf
    FROM public.viagens
   WHERE id = p_viagem_id AND status = 'aguardando_conferencia';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Viagem não encontrada ou não está aguardando conferência';
  END IF;

  SELECT id INTO v_tarefa_id
    FROM public.tarefas
   WHERE viagem_id = p_viagem_id
   LIMIT 1;

  IF v_tarefa_id IS NULL THEN
    INSERT INTO public.tarefas (viagem_id, unidade_id, numero_nf, status)
    VALUES (p_viagem_id, v_unidade_id, v_numero_nf, 'concluida');
  ELSE
    UPDATE public.tarefas SET status = 'concluida' WHERE id = v_tarefa_id;
  END IF;
END;
$$;
