-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 017 — Permite admins excluírem anomalias individualmente
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

DROP POLICY IF EXISTS "admins excluem anomalias" ON public.anomalias;
CREATE POLICY "admins excluem anomalias"
  ON public.anomalias FOR DELETE TO authenticated
  USING (public.is_admin());
