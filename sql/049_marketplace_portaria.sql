-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 049 — Entrada manual marketplace na portaria
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── 1. portaria_atendimentos: aceitar entradas sem viagem ─────────────────────

ALTER TABLE public.portaria_atendimentos
  ALTER COLUMN viagem_id DROP NOT NULL,
  ALTER COLUMN numero_nf DROP NOT NULL;

ALTER TABLE public.portaria_atendimentos
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'normal'
  CHECK (tipo IN ('normal', 'marketplace'));

-- ── 2. tarefas: aceitar tarefas marketplace (sem viagem/NF) ──────────────────

ALTER TABLE public.tarefas
  ALTER COLUMN viagem_id DROP NOT NULL,
  ALTER COLUMN numero_nf DROP NOT NULL;

ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS tipo               TEXT NOT NULL DEFAULT 'normal'
    CHECK (tipo IN ('normal', 'marketplace')),
  ADD COLUMN IF NOT EXISTS placa_cavalo       TEXT,
  ADD COLUMN IF NOT EXISTS placa_carreta      TEXT,
  ADD COLUMN IF NOT EXISTS portaria_atendimento_id UUID
    REFERENCES public.portaria_atendimentos(id);

-- ── 3. nri_emissoes: numero_nf nullable para NRI sem NF (marketplace) ─────────

ALTER TABLE public.nri_emissoes
  ALTER COLUMN numero_nf DROP NOT NULL;

-- ── 4. Função SECURITY DEFINER: portaria cria entrada marketplace + tarefa ────

CREATE OR REPLACE FUNCTION public.criar_entrada_marketplace(
  p_placa_cavalo  TEXT,
  p_placa_carreta TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_porteiro_id UUID;
  v_unidade_id  UUID;
  v_atend_id    UUID;
BEGIN
  SELECT id, unidade_id
  INTO   v_porteiro_id, v_unidade_id
  FROM   public.profiles
  WHERE  id = auth.uid() AND perfil = 'portaria' AND ativo = true;

  IF v_unidade_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não é portaria ativa ou não tem unidade definida';
  END IF;

  INSERT INTO public.portaria_atendimentos (
    unidade_id, placa_cavalo, placa_carreta,
    dt_entrada, status, porteiro_id, tipo
  ) VALUES (
    v_unidade_id, p_placa_cavalo, p_placa_carreta,
    NOW(), 'em_atendimento', v_porteiro_id, 'marketplace'
  ) RETURNING id INTO v_atend_id;

  INSERT INTO public.tarefas (
    unidade_id, tipo, placa_cavalo, placa_carreta,
    portaria_atendimento_id, status
  ) VALUES (
    v_unidade_id, 'marketplace', p_placa_cavalo, p_placa_carreta,
    v_atend_id, 'pendente'
  );

  RETURN v_atend_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_entrada_marketplace(TEXT, TEXT) TO authenticated;
