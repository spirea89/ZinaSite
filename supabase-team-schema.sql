-- Founder profiles and images for the public Team page.
-- Run this entire file once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role_en TEXT NOT NULL,
  role_ro TEXT,
  role_de TEXT,
  bio_en TEXT NOT NULL,
  bio_ro TEXT,
  bio_de TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members are publicly readable" ON team_members;
DROP POLICY IF EXISTS "Authenticated users can create team members" ON team_members;
DROP POLICY IF EXISTS "Authenticated users can update team members" ON team_members;
DROP POLICY IF EXISTS "Authenticated users can delete team members" ON team_members;

CREATE POLICY "Team members are publicly readable" ON team_members FOR SELECT USING (TRUE);
CREATE POLICY "Authenticated users can create team members" ON team_members FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Authenticated users can update team members" ON team_members FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Authenticated users can delete team members" ON team_members FOR DELETE TO authenticated USING (TRUE);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('team-media', 'team-media', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = TRUE, file_size_limit = 5242880, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Team media is publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload team media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update team media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete team media" ON storage.objects;

CREATE POLICY "Team media is publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'team-media');
CREATE POLICY "Authenticated users can upload team media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'team-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Authenticated users can update team media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'team-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'team-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Authenticated users can delete team media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'team-media' AND (storage.foldername(name))[1] = auth.uid()::text);
