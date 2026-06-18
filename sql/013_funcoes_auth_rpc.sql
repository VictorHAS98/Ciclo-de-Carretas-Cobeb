-- Módulo 13: Funções RPC para operações de auth (SECURITY DEFINER)
-- Substituem supabaseAdmin.auth.admin.* no browser
-- Execute no Supabase Studio (SQL Editor)

-- Habilita pgcrypto (necessário para hash de senha)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Criar usuário ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION criar_usuario_auth(
  p_email TEXT,
  p_senha TEXT,
  p_nome  TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role, aud
  ) VALUES (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_senha, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nome', p_nome),
    false, 'authenticated', 'authenticated'
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at, provider_id
  ) VALUES (
    gen_random_uuid(), v_id,
    jsonb_build_object('sub', v_id::text, 'email', p_email),
    'email', now(), now(), now(), p_email
  );

  RETURN v_id;
END;
$$;

-- ── 2. Redefinir senha ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION redefinir_senha_usuario(
  p_user_id UUID,
  p_nova_senha TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE auth.users
  SET encrypted_password = crypt(p_nova_senha, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- ── 3. Ativar / inativar usuário ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ativar_usuario(
  p_user_id UUID,
  p_ativo   BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE auth.users
  SET banned_until = CASE WHEN p_ativo THEN NULL ELSE '2099-12-31'::timestamptz END,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- excluir_usuario já existe no SQL 012
