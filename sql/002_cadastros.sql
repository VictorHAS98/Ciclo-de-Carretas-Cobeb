-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 002 — Módulo de Cadastros
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ================================================================
-- FUNÇÕES SECURITY DEFINER (evitam recursão no RLS)
-- ================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND perfil = 'admin' AND ativo = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION is_admin_total()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT COALESCE(
    (SELECT acesso_total FROM profiles
     WHERE id = auth.uid() AND perfil = 'admin' AND ativo = TRUE),
    FALSE
  );
$$;

-- ================================================================
-- ATUALIZAR PROFILES — novo campo e novas políticas
-- ================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);

-- Admins visualizam todos os profiles (motoristas, conferentes etc.)
DROP POLICY IF EXISTS "pol_profiles_admin_select_all" ON profiles;
CREATE POLICY "pol_profiles_admin_select_all"
  ON profiles FOR SELECT TO authenticated
  USING (is_admin() = TRUE);

-- Somente admin_total insere novos profiles
DROP POLICY IF EXISTS "pol_profiles_admin_insert" ON profiles;
CREATE POLICY "pol_profiles_admin_insert"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (is_admin_total() = TRUE);

-- Somente admin_total atualiza profiles
DROP POLICY IF EXISTS "pol_profiles_admin_update" ON profiles;
CREATE POLICY "pol_profiles_admin_update"
  ON profiles FOR UPDATE TO authenticated
  USING (is_admin_total() = TRUE)
  WITH CHECK (is_admin_total() = TRUE);

-- ================================================================
-- TABELA: carretas
-- ================================================================

CREATE TABLE IF NOT EXISTS carretas (
  id         UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  placa      VARCHAR(8)     NOT NULL UNIQUE,
  tipo       motorista_tipo NOT NULL,
  ativo      BOOLEAN        DEFAULT TRUE,
  created_at TIMESTAMPTZ    DEFAULT NOW(),
  updated_at TIMESTAMPTZ    DEFAULT NOW()
);

ALTER TABLE carretas ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_carretas_updated_at ON carretas;
CREATE TRIGGER trg_carretas_updated_at
  BEFORE UPDATE ON carretas
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

DROP POLICY IF EXISTS "pol_carretas_select" ON carretas;
CREATE POLICY "pol_carretas_select"
  ON carretas FOR SELECT TO authenticated
  USING (is_admin() = TRUE);

DROP POLICY IF EXISTS "pol_carretas_insert" ON carretas;
CREATE POLICY "pol_carretas_insert"
  ON carretas FOR INSERT TO authenticated
  WITH CHECK (is_admin_total() = TRUE);

DROP POLICY IF EXISTS "pol_carretas_update" ON carretas;
CREATE POLICY "pol_carretas_update"
  ON carretas FOR UPDATE TO authenticated
  USING (is_admin_total() = TRUE)
  WITH CHECK (is_admin_total() = TRUE);

-- ================================================================
-- TABELA: cavalos
-- ================================================================

CREATE TABLE IF NOT EXISTS cavalos (
  id         UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  placa      VARCHAR(8)     NOT NULL UNIQUE,
  tipo       motorista_tipo NOT NULL,
  ativo      BOOLEAN        DEFAULT TRUE,
  created_at TIMESTAMPTZ    DEFAULT NOW(),
  updated_at TIMESTAMPTZ    DEFAULT NOW()
);

ALTER TABLE cavalos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_cavalos_updated_at ON cavalos;
CREATE TRIGGER trg_cavalos_updated_at
  BEFORE UPDATE ON cavalos
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

DROP POLICY IF EXISTS "pol_cavalos_select" ON cavalos;
CREATE POLICY "pol_cavalos_select"
  ON cavalos FOR SELECT TO authenticated
  USING (is_admin() = TRUE);

DROP POLICY IF EXISTS "pol_cavalos_insert" ON cavalos;
CREATE POLICY "pol_cavalos_insert"
  ON cavalos FOR INSERT TO authenticated
  WITH CHECK (is_admin_total() = TRUE);

DROP POLICY IF EXISTS "pol_cavalos_update" ON cavalos;
CREATE POLICY "pol_cavalos_update"
  ON cavalos FOR UPDATE TO authenticated
  USING (is_admin_total() = TRUE)
  WITH CHECK (is_admin_total() = TRUE);
