-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 009 — Corrigir recursão infinita em tarefas
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- O script 008 criou um ciclo de RLS:
--   tarefas (policy motorista) → viagens (query direta)
--   viagens (policy conferente, script 007) → tarefas
-- → infinite recursion detected in policy for relation "tarefas"
--
-- Correção: usar SECURITY DEFINER para o check de viagens,
-- igual ao padrão já aplicado em get_my_unidade_id().

CREATE OR REPLACE FUNCTION public.motorista_owns_viagem(p_viagem_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.viagens
     WHERE id = p_viagem_id AND motorista_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "motoristas veem tarefas das proprias viagens" ON public.tarefas;
CREATE POLICY "motoristas veem tarefas das proprias viagens"
  ON public.tarefas FOR SELECT TO authenticated
  USING (
    is_motorista() AND motorista_owns_viagem(viagem_id)
  );
