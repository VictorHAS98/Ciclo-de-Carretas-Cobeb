-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 020 — Módulo Portaria: tabela portaria_atendimentos
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS public.portaria_atendimentos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id       UUID        NOT NULL REFERENCES public.viagens(id) ON DELETE CASCADE,
  unidade_id      UUID        NOT NULL REFERENCES public.unidades(id),
  numero_nf       TEXT        NOT NULL,
  placa_cavalo    TEXT,
  placa_carreta   TEXT,
  dt_entrada      TIMESTAMPTZ,
  dt_saida        TIMESTAMPTZ,
  porteiro_id     UUID        REFERENCES public.profiles(id),
  status          TEXT        NOT NULL DEFAULT 'aguardando'
                  CHECK (status IN ('aguardando','em_atendimento','concluido')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_portaria_updated_at
  BEFORE UPDATE ON public.portaria_atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.portaria_atendimentos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_portaria_viagem   ON public.portaria_atendimentos(viagem_id);
CREATE INDEX IF NOT EXISTS idx_portaria_unidade  ON public.portaria_atendimentos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_portaria_status   ON public.portaria_atendimentos(status);

-- Portaria: ver atendimentos da sua unidade
CREATE POLICY "portaria ve atendimentos da unidade"
  ON public.portaria_atendimentos FOR SELECT TO authenticated
  USING (
    is_portaria() AND
    unidade_id = get_my_unidade_id()
  );

-- Portaria: registrar entrada e saída (update)
CREATE POLICY "portaria atualiza atendimentos"
  ON public.portaria_atendimentos FOR UPDATE TO authenticated
  USING  (is_portaria() AND unidade_id = get_my_unidade_id())
  WITH CHECK (is_portaria() AND unidade_id = get_my_unidade_id());

-- Motoristas: criar ao registrar chegada na revenda
CREATE POLICY "motoristas criam portaria atendimento"
  ON public.portaria_atendimentos FOR INSERT TO authenticated
  WITH CHECK (
    is_motorista() AND
    EXISTS (
      SELECT 1 FROM public.viagens
      WHERE id = viagem_id AND motorista_id = auth.uid()
    )
  );

-- Admins: ver todos
CREATE POLICY "admins veem portaria atendimentos"
  ON public.portaria_atendimentos FOR SELECT TO authenticated
  USING (is_admin());
