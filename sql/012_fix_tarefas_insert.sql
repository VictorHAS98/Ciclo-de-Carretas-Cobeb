-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 012 — Policy INSERT de motoristas em tarefas
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Garante que motoristas possam inserir tarefas nas próprias viagens.
-- Usa motorista_owns_viagem() (SECURITY DEFINER, criada em 009)
-- para evitar recursão com a policy de conferentes em viagens.
DROP POLICY IF EXISTS "motoristas inserem tarefas" ON public.tarefas;
CREATE POLICY "motoristas inserem tarefas"
  ON public.tarefas FOR INSERT TO authenticated
  WITH CHECK (
    is_motorista() AND motorista_owns_viagem(viagem_id)
  );
