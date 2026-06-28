-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 039 — Campo codigo_ambev na tabela unidades
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS codigo_ambev TEXT;

UPDATE public.unidades SET codigo_ambev = '77200'  WHERE codigo = 'MATRIZ';
UPDATE public.unidades SET codigo_ambev = '188300' WHERE codigo = 'FILIAL_LP';
UPDATE public.unidades SET codigo_ambev = '98450'  WHERE codigo = 'FILIAL_AB';
