-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 045 — Cascade delete em agendamentos ao excluir viagem
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Remove a FK existente e recria com ON DELETE CASCADE.
-- Assim, ao excluir uma viagem, todos os agendamentos vinculados
-- são removidos automaticamente (sem bloquear a exclusão).

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_viagem_id_fkey;

ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_viagem_id_fkey
    FOREIGN KEY (viagem_id)
    REFERENCES public.viagens(id)
    ON DELETE CASCADE;
