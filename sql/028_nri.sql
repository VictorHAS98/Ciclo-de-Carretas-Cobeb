-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 028 — Módulo NRI (Nota de Recebimento Interno)
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── Sequencial global de NRIs ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nri_sequencial (
  id            INT  PRIMARY KEY DEFAULT 1,
  ultimo_numero INT  NOT NULL DEFAULT 0,
  CONSTRAINT chk_nri_single_row CHECK (id = 1)
);

INSERT INTO public.nri_sequencial (id, ultimo_numero)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.nri_sequencial ENABLE ROW LEVEL SECURITY;
-- Acesso apenas pela função SECURITY DEFINER abaixo (ninguém acessa diretamente)

-- ── Log de emissões ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nri_emissoes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id       UUID        REFERENCES public.tarefas(id),
  numero_nf       TEXT        NOT NULL,
  operador        TEXT,
  conferente      TEXT,
  turno           TEXT,
  total_nris      INT         NOT NULL,
  primeiro_numero INT         NOT NULL,
  ultimo_numero   INT         NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nri_emissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins veem nri_emissoes"
  ON public.nri_emissoes FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "conferentes inserem nri_emissoes"
  ON public.nri_emissoes FOR INSERT TO authenticated
  WITH CHECK (is_conferente());

-- ── Função atômica: reserva lote de números sequenciais ──────────────────────

CREATE OR REPLACE FUNCTION public.get_next_nri_batch(p_quantidade INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_first INT;
BEGIN
  UPDATE public.nri_sequencial
  SET ultimo_numero = ultimo_numero + p_quantidade
  WHERE id = 1
  RETURNING ultimo_numero - p_quantidade + 1 INTO v_first;
  RETURN v_first;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_nri_batch(INT) TO authenticated;

-- ── Policy SELECT em produtos_catalogo para conferentes ───────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'produtos_catalogo'
      AND policyname = 'conferentes veem produtos_catalogo'
  ) THEN
    CREATE POLICY "conferentes veem produtos_catalogo"
      ON public.produtos_catalogo FOR SELECT TO authenticated
      USING (is_conferente());
  END IF;
END;
$$;
