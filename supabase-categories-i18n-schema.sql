-- Article categories and Romanian/English/German content support.
-- Run this entire file once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS article_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_ro TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_de TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE article_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categories are publicly readable" ON article_categories;
DROP POLICY IF EXISTS "Authenticated users can create categories" ON article_categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON article_categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON article_categories;

CREATE POLICY "Categories are publicly readable" ON article_categories FOR SELECT USING (TRUE);
CREATE POLICY "Authenticated users can create categories" ON article_categories FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Authenticated users can update categories" ON article_categories FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Authenticated users can delete categories" ON article_categories FOR DELETE TO authenticated USING (TRUE);

INSERT INTO article_categories (slug, name_ro, name_en, name_de) VALUES
  ('integrare', 'Integrare', 'Integration', 'Integration'),
  ('timp-liber', 'Timp liber', 'Leisure', 'Freizeit')
ON CONFLICT (slug) DO UPDATE SET
  name_ro = EXCLUDED.name_ro,
  name_en = EXCLUDED.name_en,
  name_de = EXCLUDED.name_de;

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES article_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS content_en TEXT,
  ADD COLUMN IF NOT EXISTS title_de TEXT,
  ADD COLUMN IF NOT EXISTS content_de TEXT;

CREATE INDEX IF NOT EXISTS idx_articles_category_id ON articles(category_id);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS title_de TEXT,
  ADD COLUMN IF NOT EXISTS description_de TEXT;
