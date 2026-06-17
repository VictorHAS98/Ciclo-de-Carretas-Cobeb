-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 014 — Remover todas as policies INSERT de tarefas e recriar segura
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- O erro de recursão persiste porque existe uma policy INSERT antiga
-- (criada no script 004, provavelmente com subquery direta em viagens)
-- sendo avaliada junto com a nova. O Postgres aplica todas as policies
-- com OR, então basta uma recursiva para travar.
--
-- Solução: dropar TODAS as INSERT policies de tarefas via loop
-- (independente do nome original) e recriar apenas a safe.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'tarefas' AND cmd = 'INSERT'
  LOOP
    EXECUTE 'DROP POLICY ' || quote_ident(r.policyname) || ' ON public.tarefas';
  END LOOP;
END $$;

-- Única policy de INSERT para motoristas — usa SECURITY DEFINER
-- para evitar recursão com a policy de conferentes em viagens.
CREATE POLICY "motoristas inserem tarefas"
  ON public.tarefas FOR INSERT TO authenticated
  WITH CHECK (
    is_motorista() AND motorista_owns_viagem(viagem_id)
  );
