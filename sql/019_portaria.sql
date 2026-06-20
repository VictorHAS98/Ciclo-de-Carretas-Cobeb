-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 019 — Módulo Portaria
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- 1. Adiciona o valor ao enum (só adiciona se ainda não existe)
ALTER TYPE public.perfil_tipo ADD VALUE IF NOT EXISTS 'portaria';

-- 2. Função SECURITY DEFINER para RLS
CREATE OR REPLACE FUNCTION public.is_portaria()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND perfil = 'portaria' AND ativo = true
  );
$$;

-- 3. Portaria pode ver o próprio perfil (já coberto pela pol_profiles_select_own)
--    Garante que admins vejam perfis de portaria (já coberto pela policy de admin)
--    Nenhuma policy extra necessária se a policy de admin já usa is_admin().
