-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 022 — Soft delete em portaria_atendimentos
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Colunas de soft delete
ALTER TABLE public.portaria_atendimentos
  ADD COLUMN IF NOT EXISTS excluido_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS excluido_por  UUID REFERENCES public.profiles(id);

-- Atualiza policy SELECT da portaria para ignorar excluídos
DROP POLICY IF EXISTS "portaria ve atendimentos da unidade" ON public.portaria_atendimentos;
CREATE POLICY "portaria ve atendimentos da unidade"
  ON public.portaria_atendimentos FOR SELECT TO authenticated
  USING (
    is_portaria() AND
    unidade_id = get_my_unidade_id() AND
    excluido_em IS NULL
  );

-- Admin pode atualizar (soft delete via UPDATE)
DROP POLICY IF EXISTS "admins atualizam portaria atendimentos" ON public.portaria_atendimentos;
CREATE POLICY "admins atualizam portaria atendimentos"
  ON public.portaria_atendimentos FOR UPDATE TO authenticated
  USING  (is_admin())
  WITH CHECK (is_admin());
