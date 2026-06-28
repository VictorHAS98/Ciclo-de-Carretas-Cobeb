-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 038 — Colunas codigo_revenda e codigo_fabrica em pedidos
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS codigo_revenda TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS codigo_fabrica TEXT;

CREATE INDEX IF NOT EXISTS idx_pedidos_cod_revenda ON public.pedidos(codigo_revenda);
CREATE INDEX IF NOT EXISTS idx_pedidos_cod_fabrica ON public.pedidos(codigo_fabrica);
