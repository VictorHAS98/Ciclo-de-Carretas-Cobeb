-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 016 — Corrige bucket e políticas de Storage para fotos de anomalias
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- Garante que o bucket existe e está configurado como público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'anomalias-fotos',
  'anomalias-fotos',
  true,
  10485760,  -- 10 MB por arquivo
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- Remove políticas antigas e recria limpas
DROP POLICY IF EXISTS "conferentes upload fotos anomalias"  ON storage.objects;
DROP POLICY IF EXISTS "conferentes update fotos anomalias"  ON storage.objects;
DROP POLICY IF EXISTS "publico le fotos anomalias"          ON storage.objects;
DROP POLICY IF EXISTS "admins gerenciam fotos anomalias"    ON storage.objects;

-- Conferentes: INSERT (upload de novas fotos)
CREATE POLICY "conferentes upload fotos anomalias"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'anomalias-fotos'
    AND public.is_conferente()
  );

-- Conferentes: UPDATE (upsert substitui arquivo existente)
CREATE POLICY "conferentes update fotos anomalias"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'anomalias-fotos'
    AND public.is_conferente()
  )
  WITH CHECK (
    bucket_id = 'anomalias-fotos'
    AND public.is_conferente()
  );

-- Leitura pública (bucket já é public=true, mas política explícita garante)
CREATE POLICY "publico le fotos anomalias"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'anomalias-fotos');

-- Admins: DELETE (para exclusão de viagens que cascateia)
CREATE POLICY "admins gerenciam fotos anomalias"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'anomalias-fotos'
    AND public.is_admin()
  );
