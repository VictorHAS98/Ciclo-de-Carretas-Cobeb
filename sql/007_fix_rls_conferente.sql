-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 007 — RLS para conferentes em viagens e pedidos
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── Função auxiliar SECURITY DEFINER (evita recursão no RLS) ─────────────────
-- Retorna a unidade_id do usuário autenticado, bypassando RLS de profiles
CREATE OR REPLACE FUNCTION public.get_my_unidade_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT unidade_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ── Conferentes: SELECT em viagens das suas tarefas ───────────────────────────
-- Sem essa policy, o join viagem:viagens(...) em tarefas retorna null,
-- e tarefa.viagem.id fica undefined, bloqueando toda a conferência.
DROP POLICY IF EXISTS "conferentes veem viagens das tarefas" ON public.viagens;
CREATE POLICY "conferentes veem viagens das tarefas"
  ON public.viagens FOR SELECT TO authenticated
  USING (
    is_conferente() AND
    id IN (
      SELECT viagem_id FROM public.tarefas
      WHERE unidade_id = get_my_unidade_id()
    )
  );

-- ── Atualizar policy de pedidos para usar a mesma função ─────────────────────
DROP POLICY IF EXISTS "conferentes veem pedidos das viagens" ON public.pedidos;
CREATE POLICY "conferentes veem pedidos das viagens"
  ON public.pedidos FOR SELECT TO authenticated
  USING (
    is_conferente() AND
    viagem_id IS NOT NULL AND
    viagem_id IN (
      SELECT viagem_id FROM public.tarefas
      WHERE unidade_id = get_my_unidade_id()
    )
  );
