-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 005 — Módulo de Conferência
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── Conferentes podem ver perfis de motoristas (nome nas tarefas) ─────────────
DROP POLICY IF EXISTS "conferentes veem motoristas" ON public.profiles;
CREATE POLICY "conferentes veem motoristas"
  ON public.profiles FOR SELECT TO authenticated
  USING (is_conferente() AND perfil = 'motorista');

-- ── Storage bucket para fotos de anomalias ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('anomalias-fotos', 'anomalias-fotos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "conferentes upload fotos anomalias" ON storage.objects;
CREATE POLICY "conferentes upload fotos anomalias"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anomalias-fotos' AND is_conferente());

DROP POLICY IF EXISTS "conferentes update fotos anomalias" ON storage.objects;
CREATE POLICY "conferentes update fotos anomalias"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'anomalias-fotos' AND is_conferente());

-- ── Tabela: conferencia_itens ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conferencia_itens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id       UUID        NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  pedido_id       UUID        NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  qtde_recebida   NUMERIC(10,2),
  data_validade   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tarefa_id, pedido_id)
);

ALTER TABLE public.conferencia_itens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER trg_conf_itens_updated_at
  BEFORE UPDATE ON public.conferencia_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_conf_itens_tarefa ON public.conferencia_itens(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_conf_itens_pedido ON public.conferencia_itens(pedido_id);

-- Conferentes: gerenciar itens da sua unidade
DROP POLICY IF EXISTS "conferentes gerenciam conf_itens" ON public.conferencia_itens;
CREATE POLICY "conferentes gerenciam conf_itens"
  ON public.conferencia_itens FOR ALL TO authenticated
  USING (
    is_conferente() AND
    EXISTS (
      SELECT 1 FROM public.tarefas t
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = tarefa_id AND t.unidade_id = p.unidade_id
    )
  )
  WITH CHECK (
    is_conferente() AND
    EXISTS (
      SELECT 1 FROM public.tarefas t
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = tarefa_id AND t.unidade_id = p.unidade_id
    )
  );

-- Admins: ver todos
DROP POLICY IF EXISTS "admins veem conf_itens" ON public.conferencia_itens;
CREATE POLICY "admins veem conf_itens"
  ON public.conferencia_itens FOR SELECT TO authenticated
  USING (is_admin());

-- ── Tabela: anomalias ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.anomalias (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id       UUID        NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  pedido_id       UUID        REFERENCES public.pedidos(id),
  unidade_id      UUID        NOT NULL REFERENCES public.unidades(id),
  conferente_id   UUID        NOT NULL REFERENCES public.profiles(id),
  descricao       TEXT        NOT NULL,
  fotos           TEXT[]      NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.anomalias ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_anomalias_tarefa   ON public.anomalias(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_anomalias_unidade  ON public.anomalias(unidade_id);
CREATE INDEX IF NOT EXISTS idx_anomalias_created  ON public.anomalias(created_at DESC);

-- Conferentes: inserir anomalias da sua unidade
DROP POLICY IF EXISTS "conferentes inserem anomalias" ON public.anomalias;
CREATE POLICY "conferentes inserem anomalias"
  ON public.anomalias FOR INSERT TO authenticated
  WITH CHECK (
    is_conferente() AND
    unidade_id = (SELECT unidade_id FROM public.profiles WHERE id = auth.uid()) AND
    conferente_id = auth.uid()
  );

-- Conferentes: ver anomalias da sua unidade
DROP POLICY IF EXISTS "conferentes veem anomalias" ON public.anomalias;
CREATE POLICY "conferentes veem anomalias"
  ON public.anomalias FOR SELECT TO authenticated
  USING (
    is_conferente() AND
    unidade_id = (SELECT unidade_id FROM public.profiles WHERE id = auth.uid())
  );

-- Admins: ver todas
DROP POLICY IF EXISTS "admins veem anomalias" ON public.anomalias;
CREATE POLICY "admins veem anomalias"
  ON public.anomalias FOR SELECT TO authenticated
  USING (is_admin());
