-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 043 — Adicionar campo de vagas à grade de horários
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── 1. Coluna vagas em grade_horarios ─────────────────────────────────────────
--    Quantidade máxima de caminhões que podem agendar no mesmo bloco/dia.
--    Default 1 para todos os registros existentes.

ALTER TABLE public.grade_horarios
  ADD COLUMN IF NOT EXISTS vagas SMALLINT NOT NULL DEFAULT 1
    CONSTRAINT chk_vagas_positivo CHECK (vagas >= 1);

-- ── 2. Colunas de auditoria de vagas em grade_horarios_log ────────────────────
--    Anuláveis: preenchidas apenas quando o campo vagas for alterado.

ALTER TABLE public.grade_horarios_log
  ADD COLUMN IF NOT EXISTS vagas_anterior SMALLINT,
  ADD COLUMN IF NOT EXISTS vagas_novo     SMALLINT;
