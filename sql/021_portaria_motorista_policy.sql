-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 021 — Permite motorista ler portaria_atendimentos da sua viagem
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

CREATE POLICY "motoristas veem portaria da sua viagem"
  ON public.portaria_atendimentos FOR SELECT TO authenticated
  USING (
    is_motorista() AND
    EXISTS (
      SELECT 1 FROM public.viagens
      WHERE id = viagem_id AND motorista_id = auth.uid()
    )
  );
