-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 037 — Campo furo_puxada nas manutenções
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── 1. Adicionar coluna às tabelas de manutenção ───────────────────────────────

ALTER TABLE public.manutencoes_carretas
  ADD COLUMN IF NOT EXISTS furo_puxada BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.manutencoes_cavalos
  ADD COLUMN IF NOT EXISTS furo_puxada BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Atualizar função registrar_manutencao ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.registrar_manutencao(
  p_carreta_id   UUID,
  p_tipo         TEXT,
  p_motivo       TEXT,
  p_observacoes  TEXT,
  p_dt_entrada   TIMESTAMPTZ,
  p_furo_puxada  BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT is_admin_total() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.manutencoes_carretas
    WHERE carreta_id = p_carreta_id AND status = 'em_manutencao'
  ) THEN
    RAISE EXCEPTION 'Carreta já possui manutenção ativa';
  END IF;

  INSERT INTO public.manutencoes_carretas (
    carreta_id, tipo, motivo, observacoes, responsavel_id, dt_entrada, furo_puxada
  ) VALUES (
    p_carreta_id, p_tipo, p_motivo, p_observacoes, auth.uid(), p_dt_entrada, p_furo_puxada
  )
  RETURNING id INTO v_id;

  UPDATE public.carretas
    SET em_manutencao = TRUE
  WHERE id = p_carreta_id;

  RETURN v_id;
END;
$$;

-- ── 3. Atualizar função registrar_manutencao_cavalo ────────────────────────────

CREATE OR REPLACE FUNCTION public.registrar_manutencao_cavalo(
  p_cavalo_id    UUID,
  p_tipo         TEXT,
  p_motivo       TEXT,
  p_observacoes  TEXT,
  p_dt_entrada   TIMESTAMPTZ,
  p_furo_puxada  BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT is_admin_total() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.manutencoes_cavalos
    WHERE cavalo_id = p_cavalo_id AND status = 'em_manutencao'
  ) THEN
    RAISE EXCEPTION 'Cavalo já possui manutenção ativa';
  END IF;

  INSERT INTO public.manutencoes_cavalos (
    cavalo_id, tipo, motivo, observacoes, responsavel_id, dt_entrada, furo_puxada
  ) VALUES (
    p_cavalo_id, p_tipo, p_motivo, p_observacoes, auth.uid(), p_dt_entrada, p_furo_puxada
  )
  RETURNING id INTO v_id;

  UPDATE public.cavalos
    SET em_manutencao = TRUE
  WHERE id = p_cavalo_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_manutencao(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_manutencao_cavalo(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN) TO authenticated;
