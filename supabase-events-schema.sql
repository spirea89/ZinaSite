-- Supabase Database Schema for Events
-- Run this SQL in your Supabase SQL Editor to create the events table
-- IMPORTANT: Make sure to run the entire script, especially the RLS policies at the end!

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location TEXT,
  registration_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_start_date_status ON events(start_date, status);

-- Enable Row Level Security (RLS) - CRITICAL: This must be enabled for policies to work!
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Allow anonymous read access to published events" ON events;
DROP POLICY IF EXISTS "Allow authenticated users to read all events" ON events;
DROP POLICY IF EXISTS "Allow authenticated users to insert events" ON events;
DROP POLICY IF EXISTS "Allow authenticated users to update events" ON events;
DROP POLICY IF EXISTS "Allow authenticated users to delete events" ON events;

-- Create a policy that allows anonymous read access to published events
-- CRITICAL: This policy allows public (non-authenticated) users to see published events
-- Without this policy, anonymous users cannot see any events!
CREATE POLICY "Allow anonymous read access to published events"
  ON events
  FOR SELECT
  USING (status = 'published');

-- Create a policy that allows authenticated users to read all events (including drafts)
CREATE POLICY "Allow authenticated users to read all events"
  ON events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create a policy that allows authenticated users to insert events
CREATE POLICY "Allow authenticated users to insert events"
  ON events
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create a policy that allows authenticated users to update events
CREATE POLICY "Allow authenticated users to update events"
  ON events
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Create a policy that allows authenticated users to delete events
CREATE POLICY "Allow authenticated users to delete events"
  ON events
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Note: These policies require users to be authenticated (logged in) via Supabase Auth
-- to perform any write operations or read draft events.

-- VERIFICATION QUERIES (run these after executing the schema to verify):
-- 1. Check if RLS is enabled:
--    SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'events';
--    (Should show rowsecurity = true)
--
-- 2. Check if policies exist:
--    SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'events';
--    (Should show 5 policies)
--
-- 3. Test anonymous read access (should only return published events):
--    SELECT id, title, status FROM events;
--    (When run as anonymous user, should only show events with status = 'published')

