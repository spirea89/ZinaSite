-- Supabase Database Schema for ZinaSite
-- Run this SQL in your Supabase SQL Editor to create the articles table

CREATE TABLE IF NOT EXISTS articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create an index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);

-- Create an index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Allow anonymous read access to published articles" ON articles;
DROP POLICY IF EXISTS "Allow authenticated users to read all articles" ON articles;
DROP POLICY IF EXISTS "Allow authenticated users to insert articles" ON articles;
DROP POLICY IF EXISTS "Allow authenticated users to update articles" ON articles;
DROP POLICY IF EXISTS "Allow authenticated users to delete articles" ON articles;

-- Create a policy that allows anonymous read access to published articles
CREATE POLICY "Allow anonymous read access to published articles"
  ON articles
  FOR SELECT
  USING (status = 'published');

-- Drop the old policy if it exists
DROP POLICY IF EXISTS "Allow all operations for service role" ON articles;

-- Create a policy that allows authenticated users to read all articles (including drafts)
CREATE POLICY "Allow authenticated users to read all articles"
  ON articles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create a policy that allows authenticated users to insert articles
CREATE POLICY "Allow authenticated users to insert articles"
  ON articles
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create a policy that allows authenticated users to update articles
CREATE POLICY "Allow authenticated users to update articles"
  ON articles
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Create a policy that allows authenticated users to delete articles
CREATE POLICY "Allow authenticated users to delete articles"
  ON articles
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Note: These policies require users to be authenticated (logged in) via Supabase Auth
-- to perform any write operations or read draft articles.

