-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 046 — Tornar unidade_descarga_id nullable em viagens
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- A unidade de descarga agora é definida quando o motorista registra
-- a Saída da Revenda, e não mais no wizard de criação da viagem.
-- Por isso, a coluna precisa aceitar NULL durante a criação inicial.

ALTER TABLE public.viagens
  ALTER COLUMN unidade_descarga_id DROP NOT NULL;
