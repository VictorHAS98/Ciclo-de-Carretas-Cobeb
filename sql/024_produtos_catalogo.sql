-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 024 — Tabela de catálogo de produtos Ambev
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS public.produtos_catalogo (
  codigo              TEXT          PRIMARY KEY,
  descricao           TEXT,
  tipo_marca          TEXT,
  linha_marca         TEXT,
  embalagem           TEXT,
  marca               TEXT,
  peso_bruto          NUMERIC(10,3),
  fator               NUMERIC(10,4),
  grupo               TEXT,
  ean                 TEXT,
  caixas_pallet       NUMERIC(10,2),
  nr_fator_conversao  NUMERIC(10,4),
  codigo_sap          TEXT,
  ncm                 TEXT,
  subtipo             TEXT,
  arquivo_origem      TEXT,
  importado_em        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  importado_por       UUID          REFERENCES public.profiles(id)
);

ALTER TABLE public.produtos_catalogo ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_prod_catalogo_codigo    ON public.produtos_catalogo(codigo);
CREATE INDEX IF NOT EXISTS idx_prod_catalogo_descricao ON public.produtos_catalogo(descricao);
CREATE INDEX IF NOT EXISTS idx_prod_catalogo_ean       ON public.produtos_catalogo(ean);

-- Admins podem visualizar
CREATE POLICY "admins veem produtos_catalogo"
  ON public.produtos_catalogo FOR SELECT TO authenticated
  USING (is_admin());

-- Admin total pode inserir/atualizar
CREATE POLICY "admin_total insere produtos_catalogo"
  ON public.produtos_catalogo FOR INSERT TO authenticated
  WITH CHECK (is_admin_total());

CREATE POLICY "admin_total atualiza produtos_catalogo"
  ON public.produtos_catalogo FOR UPDATE TO authenticated
  USING  (is_admin_total())
  WITH CHECK (is_admin_total());

CREATE POLICY "admin_total deleta produtos_catalogo"
  ON public.produtos_catalogo FOR DELETE TO authenticated
  USING (is_admin_total());
