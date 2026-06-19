-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 018 — Adiciona campo lote na tabela anomalias
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

ALTER TABLE public.anomalias
  ADD COLUMN IF NOT EXISTS lote TEXT;
