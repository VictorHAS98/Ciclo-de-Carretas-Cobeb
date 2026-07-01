-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 042 — Grade de Horários de Atendimento por Revenda
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── 1. Tabela grade_horarios (estado vigente) ─────────────────────────────────
--    Uma linha por (revenda, tipo_dia, bloco). Editável; nunca deletar.
--    A estrutura (revendas + blocos) é pré-cadastrada via seed/trigger abaixo.

CREATE TABLE IF NOT EXISTS public.grade_horarios (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  revenda_id         UUID        NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  tipo_dia           TEXT        NOT NULL CHECK (tipo_dia IN ('SEMANA', 'SÁBADO', 'DOMINGO')),
  bloco              TEXT        NOT NULL,
  bloco_ordem        SMALLINT    NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'OK' CHECK (status IN ('OK', 'CRÍTICO')),
  motivo_criticidade TEXT        CHECK (
    motivo_criticidade IN (
      'TROCA DE TURNO', 'INTERVALO ALMOÇO', 'INTERVALO JANTA',
      'IMPACTO HISTOGRAMA CARREGAMENTO', 'IMPACTO HISTOGRAMA DESCARGA', 'SEM ESCALA'
    )
  ),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by         UUID        REFERENCES public.profiles(id),
  UNIQUE (revenda_id, tipo_dia, bloco),
  CONSTRAINT chk_motivo_critico CHECK (
    status <> 'CRÍTICO' OR motivo_criticidade IS NOT NULL
  )
);

ALTER TABLE public.grade_horarios ENABLE ROW LEVEL SECURITY;

-- ── 2. Tabela grade_horarios_log (auditoria imutável) ─────────────────────────
--    Gerada pelo frontend a cada publicação. Nunca deletar linhas.

CREATE TABLE IF NOT EXISTS public.grade_horarios_log (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  revenda_id         UUID        NOT NULL REFERENCES public.unidades(id),
  revenda_nome       TEXT        NOT NULL,
  tipo_dia           TEXT        NOT NULL,
  bloco              TEXT        NOT NULL,
  status_anterior    TEXT,
  motivo_anterior    TEXT,
  status_novo        TEXT        NOT NULL,
  motivo_novo        TEXT,
  publicado_por      UUID        NOT NULL REFERENCES public.profiles(id),
  publicado_por_nome TEXT        NOT NULL,
  publicado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.grade_horarios_log ENABLE ROW LEVEL SECURITY;

-- ── 3. Trigger updated_at ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_grade_updated_at ON public.grade_horarios;
CREATE TRIGGER trg_grade_updated_at
  BEFORE UPDATE ON public.grade_horarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

-- ── 4. Índices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_grade_revenda_tipo
  ON public.grade_horarios (revenda_id, tipo_dia, bloco_ordem);

CREATE INDEX IF NOT EXISTS idx_grade_log_revenda
  ON public.grade_horarios_log (revenda_id, publicado_em DESC);

-- ── 5. RLS — grade_horarios ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin lê grade" ON public.grade_horarios;
CREATE POLICY "admin lê grade"
  ON public.grade_horarios FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin atualiza grade" ON public.grade_horarios;
CREATE POLICY "admin atualiza grade"
  ON public.grade_horarios FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin insere grade" ON public.grade_horarios;
CREATE POLICY "admin insere grade"
  ON public.grade_horarios FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- ── 6. RLS — grade_horarios_log ──────────────────────────────────────────────

DROP POLICY IF EXISTS "admin lê log grade" ON public.grade_horarios_log;
CREATE POLICY "admin lê log grade"
  ON public.grade_horarios_log FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin insere log grade" ON public.grade_horarios_log;
CREATE POLICY "admin insere log grade"
  ON public.grade_horarios_log FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- ── 7. Seed inicial ───────────────────────────────────────────────────────────
--    Gera 36 linhas (3 tipos × 12 blocos) para cada revenda ativa existente.
--    ON CONFLICT DO NOTHING garante idempotência.

DO $$
DECLARE
  v_blocos TEXT[] := ARRAY[
    '00:00-02:00', '02:00-04:00', '04:00-06:00', '06:00-08:00',
    '08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00',
    '16:00-18:00', '18:00-20:00', '20:00-22:00', '22:00-23:59'
  ];
  v_tipos TEXT[] := ARRAY['SEMANA', 'SÁBADO', 'DOMINGO'];
BEGIN
  INSERT INTO public.grade_horarios (revenda_id, tipo_dia, bloco, bloco_ordem)
  SELECT
    u.id,
    t.tipo_dia,
    b.bloco,
    b.ord::SMALLINT
  FROM public.unidades u
  CROSS JOIN UNNEST(v_tipos) AS t(tipo_dia)
  CROSS JOIN UNNEST(v_blocos) WITH ORDINALITY AS b(bloco, ord)
  WHERE u.tipo = 'revenda'
    AND u.ativo = true
  ON CONFLICT (revenda_id, tipo_dia, bloco) DO NOTHING;
END;
$$;

-- ── 8. Trigger: auto-seed ao criar nova revenda ───────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_seed_grade_nova_revenda()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_blocos TEXT[] := ARRAY[
    '00:00-02:00', '02:00-04:00', '04:00-06:00', '06:00-08:00',
    '08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00',
    '16:00-18:00', '18:00-20:00', '20:00-22:00', '22:00-23:59'
  ];
  v_tipos TEXT[] := ARRAY['SEMANA', 'SÁBADO', 'DOMINGO'];
BEGIN
  IF NEW.tipo = 'revenda' THEN
    INSERT INTO public.grade_horarios (revenda_id, tipo_dia, bloco, bloco_ordem)
    SELECT
      NEW.id,
      t.tipo_dia,
      b.bloco,
      b.ord::SMALLINT
    FROM UNNEST(v_tipos) AS t(tipo_dia)
    CROSS JOIN UNNEST(v_blocos) WITH ORDINALITY AS b(bloco, ord)
    ON CONFLICT (revenda_id, tipo_dia, bloco) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_grade_nova_revenda ON public.unidades;
CREATE TRIGGER trg_seed_grade_nova_revenda
  AFTER INSERT ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.fn_seed_grade_nova_revenda();
