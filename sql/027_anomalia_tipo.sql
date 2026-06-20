-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 027 — Tipo de anomalia (qualidade / inversao)
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

ALTER TABLE public.anomalias
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'qualidade'
  CHECK (tipo IN ('qualidade', 'inversao'));
