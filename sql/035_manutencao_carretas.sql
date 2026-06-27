-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 035 — Módulo de Manutenção de Carretas
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── 1. Campo em_manutencao na tabela carretas ──────────────────────────────────
--    Flag sincronizada pelas funções abaixo; não alterar manualmente.

ALTER TABLE public.carretas
  ADD COLUMN IF NOT EXISTS em_manutencao BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Tabela manutencoes_carretas ─────────────────────────────────────────────
--    Registro imutável: nunca deletar linhas.
--    Campos de data TIMESTAMPTZ para cálculos de intervalo (MTTR, tempo parado).

CREATE TABLE IF NOT EXISTS public.manutencoes_carretas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  carreta_id     UUID        NOT NULL REFERENCES public.carretas(id),
  tipo           TEXT        NOT NULL CHECK (tipo IN ('preventiva', 'corretiva')),
  motivo         TEXT        NOT NULL CHECK (motivo IN ('pneu', 'freio', 'eletrica', 'funilaria', 'outros')),
  observacoes    TEXT,
  responsavel_id UUID        NOT NULL REFERENCES public.profiles(id),
  dt_entrada     TIMESTAMPTZ NOT NULL,
  dt_retorno     TIMESTAMPTZ,                   -- preenchido ao dar baixa
  status         TEXT        NOT NULL DEFAULT 'em_manutencao'
                             CHECK (status IN ('em_manutencao', 'finalizada')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.manutencoes_carretas ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_manutencoes_updated_at ON public.manutencoes_carretas;
CREATE TRIGGER trg_manutencoes_updated_at
  BEFORE UPDATE ON public.manutencoes_carretas
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ── 3. Índices ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_manutencoes_carreta ON public.manutencoes_carretas(carreta_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_status  ON public.manutencoes_carretas(status);
CREATE INDEX IF NOT EXISTS idx_manutencoes_entrada ON public.manutencoes_carretas(dt_entrada);

-- ── 4. RLS policies ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "pol_manutencoes_select" ON public.manutencoes_carretas;
CREATE POLICY "pol_manutencoes_select"
  ON public.manutencoes_carretas FOR SELECT TO authenticated
  USING (is_admin() = TRUE);

DROP POLICY IF EXISTS "pol_manutencoes_insert" ON public.manutencoes_carretas;
CREATE POLICY "pol_manutencoes_insert"
  ON public.manutencoes_carretas FOR INSERT TO authenticated
  WITH CHECK (is_admin_total() = TRUE);

DROP POLICY IF EXISTS "pol_manutencoes_update" ON public.manutencoes_carretas;
CREATE POLICY "pol_manutencoes_update"
  ON public.manutencoes_carretas FOR UPDATE TO authenticated
  USING  (is_admin_total() = TRUE)
  WITH CHECK (is_admin_total() = TRUE);

-- ── 5. Função: registrar_manutencao ───────────────────────────────────────────
--    Insere o registro e seta carretas.em_manutencao = TRUE atomicamente.

CREATE OR REPLACE FUNCTION public.registrar_manutencao(
  p_carreta_id   UUID,
  p_tipo         TEXT,
  p_motivo       TEXT,
  p_observacoes  TEXT,
  p_dt_entrada   TIMESTAMPTZ
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
    carreta_id, tipo, motivo, observacoes, responsavel_id, dt_entrada
  ) VALUES (
    p_carreta_id, p_tipo, p_motivo, p_observacoes, auth.uid(), p_dt_entrada
  )
  RETURNING id INTO v_id;

  UPDATE public.carretas
    SET em_manutencao = TRUE
  WHERE id = p_carreta_id;

  RETURN v_id;
END;
$$;

-- ── 6. Função: dar_baixa_manutencao ───────────────────────────────────────────
--    Finaliza o registro (dt_retorno = NOW()) e seta em_manutencao = FALSE.

CREATE OR REPLACE FUNCTION public.dar_baixa_manutencao(
  p_manutencao_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_carreta_id UUID;
BEGIN
  IF NOT is_admin_total() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.manutencoes_carretas
    SET status = 'finalizada', dt_retorno = NOW()
  WHERE id = p_manutencao_id AND status = 'em_manutencao'
  RETURNING carreta_id INTO v_carreta_id;

  IF v_carreta_id IS NULL THEN
    RAISE EXCEPTION 'Manutenção não encontrada ou já finalizada';
  END IF;

  UPDATE public.carretas
    SET em_manutencao = FALSE
  WHERE id = v_carreta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_manutencao(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dar_baixa_manutencao(UUID) TO authenticated;
