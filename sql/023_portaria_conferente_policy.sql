-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 023 — Conferente pode ver portaria_atendimentos da sua unidade
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

CREATE POLICY "conferente ve portaria da sua unidade"
  ON public.portaria_atendimentos FOR SELECT TO authenticated
  USING (
    is_conferente() AND
    unidade_id = get_my_unidade_id()
  );
