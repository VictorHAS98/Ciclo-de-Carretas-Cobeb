-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 036 — Módulo de Manutenção de Cavalos
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── 1. Campo em_manutencao na tabela cavalos ───────────────────────────────────

ALTER TABLE public.cavalos
  ADD COLUMN IF NOT EXISTS em_manutencao BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Tabela manutencoes_cavalos ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.manutencoes_cavalos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cavalo_id      UUID        NOT NULL REFERENCES public.cavalos(id),
  tipo           TEXT        NOT NULL CHECK (tipo IN ('preventiva', 'corretiva')),
  motivo         TEXT        NOT NULL CHECK (motivo IN ('pneu', 'freio', 'eletrica', 'funilaria', 'outros')),
  observacoes    TEXT,
  responsavel_id UUID        NOT NULL REFERENCES public.profiles(id),
  dt_entrada     TIMESTAMPTZ NOT NULL,
  dt_retorno     TIMESTAMPTZ,
  status         TEXT        NOT NULL DEFAULT 'em_manutencao'
                             CHECK (status IN ('em_manutencao', 'finalizada')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.manutencoes_cavalos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_manutencoes_cavalos_updated_at ON public.manutencoes_cavalos;
CREATE TRIGGER trg_manutencoes_cavalos_updated_at
  BEFORE UPDATE ON public.manutencoes_cavalos
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ── 3. Índices ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_man_cavalos_cavalo  ON public.manutencoes_cavalos(cavalo_id);
CREATE INDEX IF NOT EXISTS idx_man_cavalos_status  ON public.manutencoes_cavalos(status);
CREATE INDEX IF NOT EXISTS idx_man_cavalos_entrada ON public.manutencoes_cavalos(dt_entrada);

-- ── 4. RLS policies ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "pol_man_cavalos_select" ON public.manutencoes_cavalos;
CREATE POLICY "pol_man_cavalos_select"
  ON public.manutencoes_cavalos FOR SELECT TO authenticated
  USING (is_admin() = TRUE);

DROP POLICY IF EXISTS "pol_man_cavalos_insert" ON public.manutencoes_cavalos;
CREATE POLICY "pol_man_cavalos_insert"
  ON public.manutencoes_cavalos FOR INSERT TO authenticated
  WITH CHECK (is_admin_total() = TRUE);

DROP POLICY IF EXISTS "pol_man_cavalos_update" ON public.manutencoes_cavalos;
CREATE POLICY "pol_man_cavalos_update"
  ON public.manutencoes_cavalos FOR UPDATE TO authenticated
  USING  (is_admin_total() = TRUE)
  WITH CHECK (is_admin_total() = TRUE);

-- ── 5. Função: registrar_manutencao_cavalo ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.registrar_manutencao_cavalo(
  p_cavalo_id    UUID,
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
    SELECT 1 FROM public.manutencoes_cavalos
    WHERE cavalo_id = p_cavalo_id AND status = 'em_manutencao'
  ) THEN
    RAISE EXCEPTION 'Cavalo já possui manutenção ativa';
  END IF;

  INSERT INTO public.manutencoes_cavalos (
    cavalo_id, tipo, motivo, observacoes, responsavel_id, dt_entrada
  ) VALUES (
    p_cavalo_id, p_tipo, p_motivo, p_observacoes, auth.uid(), p_dt_entrada
  )
  RETURNING id INTO v_id;

  UPDATE public.cavalos
    SET em_manutencao = TRUE
  WHERE id = p_cavalo_id;

  RETURN v_id;
END;
$$;

-- ── 6. Função: dar_baixa_manutencao_cavalo ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.dar_baixa_manutencao_cavalo(
  p_manutencao_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_cavalo_id UUID;
BEGIN
  IF NOT is_admin_total() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.manutencoes_cavalos
    SET status = 'finalizada', dt_retorno = NOW()
  WHERE id = p_manutencao_id AND status = 'em_manutencao'
  RETURNING cavalo_id INTO v_cavalo_id;

  IF v_cavalo_id IS NULL THEN
    RAISE EXCEPTION 'Manutenção não encontrada ou já finalizada';
  END IF;

  UPDATE public.cavalos
    SET em_manutencao = FALSE
  WHERE id = v_cavalo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_manutencao_cavalo(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dar_baixa_manutencao_cavalo(UUID) TO authenticated;
