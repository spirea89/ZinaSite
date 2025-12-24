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

-- Create a policy that allows anonymous read access to published articles
CREATE POLICY "Allow anonymous read access to published articles"
  ON articles
  FOR SELECT
  USING (status = 'published');

-- Create a policy that allows all operations for authenticated users
-- Note: You may want to restrict this further based on your authentication needs
CREATE POLICY "Allow all operations for service role"
  ON articles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Note: The above policy allows all operations. For production, you should:
-- 1. Set up authentication
-- 2. Create more restrictive policies
-- 3. Use the service role key on the server side (not the anon key)

