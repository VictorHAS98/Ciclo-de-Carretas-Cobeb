-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 032 — Perfil Operador de Empilhadeira
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- 1. Adiciona o valor ao enum de perfis
ALTER TYPE public.perfil_tipo ADD VALUE IF NOT EXISTS 'empilheira';

-- COMMIT obrigatório: novo valor de enum só fica visível após commitar
COMMIT;

-- 2. Função SECURITY DEFINER para uso em policies RLS
CREATE OR REPLACE FUNCTION public.is_empilheira()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND perfil = 'empilheira' AND ativo = true
  );
$$;

-- 3. Operador pode ler o próprio perfil
--    (já coberto pela policy pol_profiles_select_own existente)
--    Admins já enxergam todos os perfis pela policy de admin existente.
--    Nenhuma policy extra necessária neste script.
