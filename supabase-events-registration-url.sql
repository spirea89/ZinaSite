-- Add registration form URL to events table
-- Run this in Supabase SQL Editor after the main events schema.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registration_url TEXT;

COMMENT ON COLUMN events.registration_url IS 'Optional URL to the event registration form (e.g. Google Form, Typeform).';
