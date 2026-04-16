-- =============================================
-- SNAPFIX V3 MIGRATION
-- Run in Supabase SQL Editor
-- =============================================

-- Add CNIC column if not exists
ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS cnic TEXT;

-- Add status for expired jobs
ALTER TABLE public.active_jobs
  DROP CONSTRAINT IF EXISTS active_jobs_status_check;

ALTER TABLE public.active_jobs
  ADD CONSTRAINT active_jobs_status_check
  CHECK (status IN ('bidding','assigned','completed','expired'));

-- Add CRON_SECRET env note (set this in Vercel)
-- CRON_SECRET = any random string, e.g. openssl rand -hex 32

-- Index for cron job query
CREATE INDEX IF NOT EXISTS idx_jobs_bidding_created
  ON public.active_jobs (status, created_at)
  WHERE status = 'bidding';
