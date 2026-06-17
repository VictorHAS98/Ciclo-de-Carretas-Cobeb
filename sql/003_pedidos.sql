-- Módulo 3: Tabela de pedidos importados da BASE Ambev
-- Rodar no Supabase Studio > SQL Editor

CREATE TABLE IF NOT EXISTS public.pedidos (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  data_puxada     DATE          NOT NULL,
  revenda         TEXT          NOT NULL,
  unidade_id      UUID          REFERENCES public.unidades(id) ON DELETE SET NULL,
  fabrica         TEXT          NOT NULL,
  numero_pedido   BIGINT        NOT NULL,
  placa           TEXT,
  cod_produto     TEXT          NOT NULL,
  descricao       TEXT          NOT NULL,
  embalagem       TEXT,
  curva           TEXT,
  qtde_pallets    NUMERIC(10,3) DEFAULT 0,
  qtde_skus       INTEGER       DEFAULT 0,
  arquivo_origem  TEXT          NOT NULL,   -- ex: "BASE_16-06-2026"
  viagem_id       UUID,                     -- FK para viagens (módulo futuro)
  importado_em    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  importado_por   UUID          REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Qualquer admin pode visualizar todos os pedidos
CREATE POLICY "admins podem ver pedidos"
  ON public.pedidos
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Apenas admin_total pode importar (INSERT)
CREATE POLICY "admin_total pode inserir pedidos"
  ON public.pedidos
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_total());

-- Apenas admin_total pode deletar (necessário para re-importação)
CREATE POLICY "admin_total pode deletar pedidos"
  ON public.pedidos
  FOR DELETE
  TO authenticated
  USING (is_admin_total());

-- Apenas admin_total pode atualizar (para vincular viagem futuramente)
CREATE POLICY "admin_total pode atualizar pedidos"
  ON public.pedidos
  FOR UPDATE
  TO authenticated
  USING (is_admin_total())
  WITH CHECK (is_admin_total());

-- Índices para filtros e consultas
CREATE INDEX IF NOT EXISTS idx_pedidos_arquivo_origem ON public.pedidos(arquivo_origem);
CREATE INDEX IF NOT EXISTS idx_pedidos_numero_pedido  ON public.pedidos(numero_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_unidade_id     ON public.pedidos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_puxada    ON public.pedidos(data_puxada);
CREATE INDEX IF NOT EXISTS idx_pedidos_fabrica        ON public.pedidos(fabrica);
CREATE INDEX IF NOT EXISTS idx_pedidos_viagem_id      ON public.pedidos(viagem_id);
