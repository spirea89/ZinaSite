-- Editable homepage content and media for ZinA.
-- Run this entire file once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS homepage_content (
  id TEXT PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  hero_image_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE homepage_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Homepage is publicly readable" ON homepage_content;
DROP POLICY IF EXISTS "Authenticated users can create homepage content" ON homepage_content;
DROP POLICY IF EXISTS "Authenticated users can update homepage content" ON homepage_content;

CREATE POLICY "Homepage is publicly readable"
  ON homepage_content FOR SELECT
  USING (id = 'home');

CREATE POLICY "Authenticated users can create homepage content"
  ON homepage_content FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND id = 'home');

CREATE POLICY "Authenticated users can update homepage content"
  ON homepage_content FOR UPDATE
  USING (auth.role() = 'authenticated' AND id = 'home')
  WITH CHECK (auth.role() = 'authenticated' AND id = 'home');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'homepage-media',
  'homepage-media',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Homepage media is publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload homepage media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update homepage media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete homepage media" ON storage.objects;

CREATE POLICY "Homepage media is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'homepage-media');

CREATE POLICY "Authenticated users can upload homepage media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'homepage-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can update homepage media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'homepage-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'homepage-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can delete homepage media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'homepage-media' AND (storage.foldername(name))[1] = auth.uid()::text);
