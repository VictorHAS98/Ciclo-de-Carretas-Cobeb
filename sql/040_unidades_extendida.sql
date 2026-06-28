-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 040 — Cadastro de Unidades (revendas + fábricas)
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── 1. Estender tabela unidades ───────────────────────────────────────────────

ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS tipo          TEXT        NOT NULL DEFAULT 'revenda'
                                         CHECK (tipo IN ('revenda', 'fabrica')),
  ADD COLUMN IF NOT EXISTS endereco      TEXT,
  ADD COLUMN IF NOT EXISTS latitude      DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS longitude     DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS raio_geofence INTEGER     NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

-- ── 2. Marcar as 3 revendas existentes ───────────────────────────────────────

UPDATE public.unidades SET tipo = 'revenda' WHERE tipo = 'revenda'; -- idempotente

-- ── 3. Trigger updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_unidades_updated_at
  BEFORE UPDATE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

-- ── 4. RLS: admin_total pode criar e editar unidades ─────────────────────────

DROP POLICY IF EXISTS "admin_total gerencia unidades" ON public.unidades;
CREATE POLICY "admin_total gerencia unidades"
  ON public.unidades
  FOR ALL
  TO authenticated
  USING    (is_admin_total())
  WITH CHECK (is_admin_total());

-- ── 5. Migrar fábricas a partir dos pedidos existentes ───────────────────────
-- Usa ON CONFLICT (codigo) para ser idempotente

INSERT INTO public.unidades (nome, codigo, cidade, tipo, codigo_ambev)
SELECT DISTINCT
  TRIM(SPLIT_PART(p.fabrica, ' - ', 2))  AS nome,
  'FAB_' || p.codigo_fabrica             AS codigo,
  TRIM(SPLIT_PART(p.fabrica, ' - ', 2))  AS cidade,
  'fabrica'                              AS tipo,
  p.codigo_fabrica                       AS codigo_ambev
FROM public.pedidos p
WHERE p.codigo_fabrica IS NOT NULL
  AND p.codigo_fabrica <> ''
  AND TRIM(SPLIT_PART(p.fabrica, ' - ', 2)) <> ''
ON CONFLICT (codigo) DO NOTHING;

-- ── 6. Índice em tipo ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_unidades_tipo ON public.unidades(tipo);
