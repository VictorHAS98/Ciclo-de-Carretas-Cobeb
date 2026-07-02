-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 044 — Módulo de Agendamento de Horário de Chegada
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── 1. Tabela agendamentos ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agendamentos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id        UUID        NOT NULL UNIQUE REFERENCES public.viagens(id),
  revenda_id       UUID        NOT NULL REFERENCES public.unidades(id),
  grade_id         UUID        NOT NULL REFERENCES public.grade_horarios(id),
  data_agendamento DATE        NOT NULL,
  tipo_dia         TEXT        NOT NULL CHECK (tipo_dia IN ('SEMANA', 'SÁBADO', 'DOMINGO')),
  bloco            TEXT        NOT NULL,
  motorista_id     UUID        NOT NULL REFERENCES public.profiles(id),
  status           TEXT        NOT NULL DEFAULT 'pendente'
                               CHECK (status IN ('pendente', 'cancelado', 'realizado')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_agendamentos_updated_at ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_updated_at
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

-- Índice para contagem de vagas por slot/dia
CREATE INDEX IF NOT EXISTS idx_agendamentos_grade_data
  ON public.agendamentos (grade_id, data_agendamento)
  WHERE status <> 'cancelado';

CREATE INDEX IF NOT EXISTS idx_agendamentos_viagem
  ON public.agendamentos (viagem_id);

-- ── 2. RLS — agendamentos ─────────────────────────────────────────────────────

-- SELECT: qualquer usuário autenticado (necessário para portaria ver via join
--         e para motorista carregar disponibilidade de vagas)
DROP POLICY IF EXISTS "autenticado lê agendamentos" ON public.agendamentos;
CREATE POLICY "autenticado lê agendamentos"
  ON public.agendamentos FOR SELECT TO authenticated USING (true);

-- INSERT: motorista insere o próprio agendamento
DROP POLICY IF EXISTS "motorista insere agendamento" ON public.agendamentos;
CREATE POLICY "motorista insere agendamento"
  ON public.agendamentos FOR INSERT TO authenticated
  WITH CHECK (motorista_id = auth.uid());

-- UPDATE: motorista cancela o próprio; admin pode atualizar qualquer um
DROP POLICY IF EXISTS "motorista atualiza agendamento" ON public.agendamentos;
CREATE POLICY "motorista atualiza agendamento"
  ON public.agendamentos FOR UPDATE TO authenticated
  USING  (motorista_id = auth.uid() OR is_admin())
  WITH CHECK (motorista_id = auth.uid() OR is_admin());

-- ── 3. grade_horarios: ampliar SELECT para todos os autenticados ──────────────
--    Motoristas precisam ler a grade para ver horários disponíveis.

DROP POLICY IF EXISTS "admin lê grade" ON public.grade_horarios;
DROP POLICY IF EXISTS "autenticado lê grade" ON public.grade_horarios;
CREATE POLICY "autenticado lê grade"
  ON public.grade_horarios FOR SELECT TO authenticated USING (true);

-- ── 4. portaria_atendimentos: adicionar FK para agendamento ───────────────────

ALTER TABLE public.portaria_atendimentos
  ADD COLUMN IF NOT EXISTS agendamento_id UUID REFERENCES public.agendamentos(id);

-- ── 5. Função registrar_entrada_portaria (SECURITY DEFINER) ──────────────────
--    Atualiza portaria_atendimentos + cria tarefa para o Conferente.
--    Centraliza a criação da tarefa, que antes ocorria na chegada do motorista.

CREATE OR REPLACE FUNCTION public.registrar_entrada_portaria(
  p_atendimento_id UUID,
  p_porteiro_id    UUID
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_viagem_id  UUID;
  v_unidade_id UUID;
  v_numero_nf  TEXT;
BEGIN
  UPDATE public.portaria_atendimentos
  SET
    dt_entrada  = NOW(),
    porteiro_id = p_porteiro_id,
    status      = 'em_atendimento'
  WHERE id = p_atendimento_id
  RETURNING viagem_id, unidade_id, numero_nf
  INTO v_viagem_id, v_unidade_id, v_numero_nf;

  -- Cria tarefa para o Conferente (idempotente: não duplica se já existir)
  IF NOT EXISTS (
    SELECT 1 FROM public.tarefas WHERE viagem_id = v_viagem_id
  ) THEN
    INSERT INTO public.tarefas (viagem_id, unidade_id, numero_nf)
    VALUES (v_viagem_id, v_unidade_id, v_numero_nf);
  END IF;
END;
$$;
