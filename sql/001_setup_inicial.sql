-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 001 — Setup Inicial do Banco de Dados
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Habilitar extensão para criptografia de senhas
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ================================================================
-- TIPOS ENUMERADOS
-- ================================================================

CREATE TYPE perfil_tipo AS ENUM ('admin', 'motorista', 'conferente');
CREATE TYPE motorista_tipo AS ENUM ('FF', 'SPOT');


-- ================================================================
-- TABELA: unidades
-- As 3 unidades da COBEB. Todo registro do sistema referencia
-- uma unidade para que os dados nunca se misturem.
-- ================================================================

CREATE TABLE unidades (
  id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       VARCHAR(100) NOT NULL,
  codigo     VARCHAR(20)  NOT NULL UNIQUE,
  cidade     VARCHAR(100) NOT NULL,
  ativo      BOOLEAN      DEFAULT TRUE,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

INSERT INTO unidades (nome, codigo, cidade) VALUES
  ('COBEB MATRIZ', 'MATRIZ',    'PARÁ DE MINAS'),
  ('COBEB FILIAL', 'FILIAL_LP', 'LAGOA DA PRATA'),
  ('COBEB FILIAL', 'FILIAL_AB', 'ABAETÉ');


-- ================================================================
-- TABELA: profiles
-- Vinculada ao auth.users do Supabase.
-- Um registro por usuário, com todos os dados do perfil.
-- ================================================================

CREATE TABLE profiles (
  id           UUID           REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome         VARCHAR(150)   NOT NULL,
  email        VARCHAR(255)   NOT NULL,
  perfil       perfil_tipo    NOT NULL,
  tipo         motorista_tipo,               -- somente motoristas (FF ou SPOT)
  unidade_id   UUID           REFERENCES unidades(id),  -- nulo apenas para admin com acesso_total
  acesso_total BOOLEAN        DEFAULT FALSE,             -- somente admins
  ativo        BOOLEAN        DEFAULT TRUE,
  created_at   TIMESTAMPTZ    DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    DEFAULT NOW(),

  -- Motorista sempre deve ter tipo definido
  CONSTRAINT chk_motorista_tipo CHECK (
    perfil != 'motorista' OR tipo IS NOT NULL
  ),
  -- Conferente e motorista sempre devem ter unidade
  CONSTRAINT chk_unidade_obrigatoria CHECK (
    perfil = 'admin' OR unidade_id IS NOT NULL
  )
);


-- ================================================================
-- TRIGGER: atualizar updated_at automaticamente em profiles
-- ================================================================

CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;

-- Unidades: qualquer usuário autenticado pode visualizar
CREATE POLICY "pol_unidades_select"
  ON unidades FOR SELECT
  TO authenticated
  USING (TRUE);

-- Profiles: cada usuário vê apenas o próprio perfil
CREATE POLICY "pol_profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);


-- ================================================================
-- USUÁRIO ADMIN INICIAL
-- Email: admin@cobeb.com.br | Senha: Cobeb@2025
-- Acesso total a todas as unidades
-- ================================================================

DO $$
DECLARE
  v_admin_id UUID := gen_random_uuid();
BEGIN

  -- 1. Inserir na tabela de autenticação do Supabase
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_admin_id,
    'authenticated',
    'authenticated',
    'admin@cobeb.com.br',
    crypt('Cobeb@2025', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '', '', '', ''
  );

  -- 2. Registrar a identidade do provedor email
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_admin_id,
    'admin@cobeb.com.br',
    jsonb_build_object('sub', v_admin_id::TEXT, 'email', 'admin@cobeb.com.br'),
    'email',
    NOW(), NOW(), NOW()
  );

  -- 3. Inserir perfil do administrador
  INSERT INTO profiles (id, nome, email, perfil, acesso_total)
  VALUES (v_admin_id, 'Administrador', 'admin@cobeb.com.br', 'admin', TRUE);

  RAISE NOTICE 'Admin criado com sucesso. ID: %', v_admin_id;

END $$;
