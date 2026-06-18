-- Módulo 12: Função RPC para excluir usuário (admin only)
-- Execute no Supabase Studio (SQL Editor)

CREATE OR REPLACE FUNCTION excluir_usuario(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Só admins podem excluir
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Apaga o auth user — CASCADE apaga o profile automaticamente
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
