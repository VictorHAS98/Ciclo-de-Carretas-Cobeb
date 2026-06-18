-- Módulo 11: garante ON DELETE CASCADE em profiles.id → auth.users
-- Execute no Supabase Studio (SQL Editor)
-- Quando o auth user for deletado, o profile é deletado automaticamente.

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
