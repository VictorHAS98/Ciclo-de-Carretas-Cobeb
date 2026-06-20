-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 026 — Data de validade do produto substituto na anomalia
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

ALTER TABLE public.anomalias
  ADD COLUMN IF NOT EXISTS substituto_data_validade DATE;
