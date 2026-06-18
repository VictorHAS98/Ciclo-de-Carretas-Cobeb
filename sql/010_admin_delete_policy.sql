-- Módulo 10: Policy de DELETE para admins em profiles
-- Execute no Supabase Studio (SQL Editor)

-- Permite que admins excluam qualquer profile (exceto o próprio)
CREATE POLICY "admin_pode_deletar_profiles"
ON profiles FOR DELETE
USING (is_admin());
