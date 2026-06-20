-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 025 — Produto substituto na anomalia
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

ALTER TABLE public.anomalias
  ADD COLUMN IF NOT EXISTS substituto_codigo       TEXT,
  ADD COLUMN IF NOT EXISTS substituto_descricao    TEXT,
  ADD COLUMN IF NOT EXISTS substituto_qtde_pallets NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS substituto_qtde_caixas  INTEGER;
