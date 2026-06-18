-- Módulo 9: CPF para motoristas
-- Execute no Supabase Studio (SQL Editor)

-- Adiciona coluna cpf na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Índice único para CPF (apenas onde preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique
  ON profiles(cpf) WHERE cpf IS NOT NULL;
