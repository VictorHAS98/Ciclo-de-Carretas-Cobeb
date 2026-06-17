-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 006 — Correções de Ciclo e RLS
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── 1. Adicionar status 'aguardando_conferencia' na tabela viagens ─────────────
-- PostgreSQL nomeia automaticamente constraints inline como tablename_colname_check
ALTER TABLE public.viagens DROP CONSTRAINT IF EXISTS viagens_status_check;
ALTER TABLE public.viagens
  ADD CONSTRAINT viagens_status_check
  CHECK (status IN (
    'iniciada',
    'em_transito',
    'na_fabrica',
    'retornando',
    'aguardando_conferencia',
    'concluida'
  ));

-- ── 2. Adicionar campo dt_saida_entrega (5ª etapa: saída após entrega da NF) ──
ALTER TABLE public.viagens
  ADD COLUMN IF NOT EXISTS dt_saida_entrega TIMESTAMPTZ;

-- ── 3. Conferentes podem ver pedidos das viagens da sua unidade ────────────────
DROP POLICY IF EXISTS "conferentes veem pedidos das viagens" ON public.pedidos;
CREATE POLICY "conferentes veem pedidos das viagens"
  ON public.pedidos FOR SELECT TO authenticated
  USING (
    is_conferente() AND
    viagem_id IN (
      SELECT t.viagem_id FROM public.tarefas t
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.unidade_id = p.unidade_id
    )
  );
