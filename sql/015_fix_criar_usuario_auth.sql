-- Script 015: corrige criar_usuario_auth e redefinir_senha_usuario
-- Execute no Supabase Studio > SQL Editor

-- ── DIAGNÓSTICO: verifique se o Leandro existe e se a senha bate ─────────────
-- (opcional, rode antes para entender o estado atual)
--
-- SELECT id, email, email_confirmed_at, banned_until, deleted_at,
--   (encrypted_password = crypt('SENHA_AQUI', encrypted_password)) AS senha_correta
-- FROM auth.users WHERE email = 'leandro.alves@cobeb.com.br';

-- ── 1. Corrigir criar_usuario_auth ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION criar_usuario_auth(
  p_email TEXT,
  p_senha TEXT,
  p_nome  TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, extensions, public
AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  INSERT INTO auth.users (
    id, instance_id,
    aud, role,
    email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    p_email,
    crypt(p_senha, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nome', p_nome),
    false,
    '', '', '', ''
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

-- ── 2. Corrigir redefinir_senha_usuario ───────────────────────────────────────
CREATE OR REPLACE FUNCTION redefinir_senha_usuario(
  p_user_id UUID,
  p_nova_senha TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, extensions, public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE auth.users
  SET encrypted_password = crypt(p_nova_senha, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;
