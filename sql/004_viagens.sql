-- Módulo 4: Viagens e Tarefas
-- Rodar no Supabase Studio > SQL Editor

-- ── Trigger de updated_at (recriação segura) ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Funções auxiliares de perfil ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_motorista()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND perfil = 'motorista' AND ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conferente()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND perfil = 'conferente' AND ativo = true
  );
$$;

-- ── Função para vincular pedidos a viagem (contorna RLS de pedidos) ───────────

CREATE OR REPLACE FUNCTION public.vincular_pedidos_viagem(
  p_viagem_id       UUID,
  p_numeros_pedido  BIGINT[]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Garante que o chamador é dono da viagem
  IF NOT EXISTS (
    SELECT 1 FROM public.viagens
    WHERE id = p_viagem_id AND motorista_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado: viagem não pertence ao motorista autenticado';
  END IF;

  UPDATE public.pedidos
  SET viagem_id = p_viagem_id
  WHERE numero_pedido = ANY(p_numeros_pedido);
END;
$$;

-- ── Tabela viagens ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.viagens (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id          UUID        NOT NULL REFERENCES public.profiles(id),
  carreta_id            UUID        NOT NULL REFERENCES public.carretas(id),
  cavalo_id             UUID        NOT NULL REFERENCES public.cavalos(id),
  unidade_descarga_id   UUID        NOT NULL REFERENCES public.unidades(id),
  horario_agendado      TEXT,                          -- "HH:MM" inserido pelo motorista
  status                TEXT        NOT NULL DEFAULT 'iniciada'
                        CHECK (status IN ('iniciada','em_transito','na_fabrica','retornando','concluida')),
  dt_saida_revenda      TIMESTAMPTZ,
  dt_chegada_fabrica    TIMESTAMPTZ,
  dt_saida_fabrica      TIMESTAMPTZ,
  dt_chegada_revenda    TIMESTAMPTZ,
  numero_nf             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_viagens_updated_at
  BEFORE UPDATE ON public.viagens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.viagens ENABLE ROW LEVEL SECURITY;

-- Motoristas: ver e gerenciar suas próprias viagens
CREATE POLICY "motoristas veem proprias viagens"
  ON public.viagens FOR SELECT TO authenticated
  USING (is_motorista() AND motorista_id = auth.uid());

CREATE POLICY "motoristas criam viagens"
  ON public.viagens FOR INSERT TO authenticated
  WITH CHECK (is_motorista() AND motorista_id = auth.uid());

CREATE POLICY "motoristas atualizam propria viagem"
  ON public.viagens FOR UPDATE TO authenticated
  USING  (is_motorista() AND motorista_id = auth.uid())
  WITH CHECK (is_motorista() AND motorista_id = auth.uid());

-- Admins: ver todas as viagens
CREATE POLICY "admins veem todas viagens"
  ON public.viagens FOR SELECT TO authenticated
  USING (is_admin());

-- Índices
CREATE INDEX IF NOT EXISTS idx_viagens_motorista  ON public.viagens(motorista_id);
CREATE INDEX IF NOT EXISTS idx_viagens_status     ON public.viagens(status);
CREATE INDEX IF NOT EXISTS idx_viagens_unidade    ON public.viagens(unidade_descarga_id);

-- ── Tabela tarefas ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tarefas (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id       UUID        NOT NULL REFERENCES public.viagens(id),
  unidade_id      UUID        NOT NULL REFERENCES public.unidades(id),
  numero_nf       TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','em_andamento','concluida')),
  conferente_id   UUID        REFERENCES public.profiles(id),  -- quem assumiu
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_tarefas_updated_at
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

-- Conferentes veem tarefas da sua unidade
CREATE POLICY "conferentes veem tarefas da unidade"
  ON public.tarefas FOR SELECT TO authenticated
  USING (
    is_conferente() AND
    unidade_id = (SELECT unidade_id FROM public.profiles WHERE id = auth.uid())
  );

-- Admins veem todas as tarefas
CREATE POLICY "admins veem todas tarefas"
  ON public.tarefas FOR SELECT TO authenticated
  USING (is_admin());

-- Motoristas criam tarefas ao chegar na revenda
CREATE POLICY "motoristas criam tarefas"
  ON public.tarefas FOR INSERT TO authenticated
  WITH CHECK (
    is_motorista() AND
    EXISTS (
      SELECT 1 FROM public.viagens
      WHERE id = viagem_id AND motorista_id = auth.uid()
    )
  );

-- Conferentes atualizam tarefas da sua unidade (pegar/concluir)
CREATE POLICY "conferentes atualizam tarefas"
  ON public.tarefas FOR UPDATE TO authenticated
  USING (
    is_conferente() AND
    unidade_id = (SELECT unidade_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    is_conferente() AND
    unidade_id = (SELECT unidade_id FROM public.profiles WHERE id = auth.uid())
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_tarefas_viagem   ON public.tarefas(viagem_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_unidade  ON public.tarefas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_status   ON public.tarefas(status);

-- ── Motoristas podem buscar pedidos (para o wizard) ───────────────────────────

CREATE POLICY "motoristas podem buscar pedidos"
  ON public.pedidos FOR SELECT TO authenticated
  USING (is_motorista());
