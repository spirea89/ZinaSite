-- Supabase Events Table Schema - Fix and Verification
-- Run this SQL in your Supabase SQL Editor to ensure the events table and RLS policies are set up correctly

-- Step 1: Create the events table if it doesn't exist
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 2: Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_start_date_status ON events(start_date, status);

-- Step 3: Enable Row Level Security (RLS) - this is critical!
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Allow anonymous read access to published events" ON events;
DROP POLICY IF EXISTS "Allow authenticated users to read all events" ON events;
DROP POLICY IF EXISTS "Allow authenticated users to insert events" ON events;
DROP POLICY IF EXISTS "Allow authenticated users to update events" ON events;
DROP POLICY IF EXISTS "Allow authenticated users to delete events" ON events;

-- Step 5: Create the RLS policy for anonymous users to read published events
-- This is the key policy that allows public access to published events
CREATE POLICY "Allow anonymous read access to published events"
  ON events
  FOR SELECT
  USING (status = 'published');

-- Step 6: Create policy for authenticated users to read all events (including drafts)
CREATE POLICY "Allow authenticated users to read all events"
  ON events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Step 7: Create policy for authenticated users to insert events
CREATE POLICY "Allow authenticated users to insert events"
  ON events
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Step 8: Create policy for authenticated users to update events
CREATE POLICY "Allow authenticated users to update events"
  ON events
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Step 9: Create policy for authenticated users to delete events
CREATE POLICY "Allow authenticated users to delete events"
  ON events
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Verification: Check if RLS is enabled and policies exist
-- Run these queries to verify:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'events';
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'events';

