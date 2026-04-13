-- =============================================
-- SNAPFIX DATABASE SETUP
-- Run this once in Supabase SQL Editor
-- =============================================

-- 1. Technicians table
CREATE TABLE public.technicians (
  phone_number  TEXT        PRIMARY KEY
                              CHECK (phone_number ~ '^923\d{9}$'),
  name          TEXT        NOT NULL,
  trade         TEXT        NOT NULL
                              CHECK (trade IN ('Plumber','Electrician','HVAC','Carpenter','Painter','Other')),
  service_area  TEXT        NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Active jobs table
CREATE TABLE public.active_jobs (
  job_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone      TEXT        NOT NULL,
  trade_required      TEXT        NOT NULL,
  problem_summary     TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'bidding'
                                    CHECK (status IN ('bidding','assigned','completed')),
  bids                JSONB       NOT NULL DEFAULT '[]'::jsonb,
  assigned_tech_phone TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- service_role key (used server-side) bypasses
-- RLS automatically — no policies needed.
-- This blocks all direct anon/public access.
-- =============================================

ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_jobs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- AUTO-UPDATE updated_at ON EVERY CHANGE
-- =============================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER technicians_updated_at
  BEFORE UPDATE ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER active_jobs_updated_at
  BEFORE UPDATE ON public.active_jobs
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================
-- INDEXES (aligned with actual query patterns)
-- =============================================

-- is this sender a technician?
CREATE INDEX idx_tech_phone        ON public.technicians (phone_number);

-- find active techs by trade (Flow 2)
CREATE INDEX idx_tech_trade_active ON public.technicians (trade, is_active)
  WHERE is_active = true;

-- latest bidding job for a trade (Flow 3)
CREATE INDEX idx_jobs_trade_status ON public.active_jobs (trade_required, status, created_at DESC)
  WHERE status = 'bidding';

-- customer's open job (Flow 4)
CREATE INDEX idx_jobs_customer     ON public.active_jobs (customer_phone, status);

-- cleanup queries
CREATE INDEX idx_jobs_updated      ON public.active_jobs (updated_at);

-- =============================================
-- STATUS TRANSITION GUARD
-- Prevents reverting assigned → bidding or
-- re-opening a completed job.
-- =============================================

CREATE OR REPLACE FUNCTION validate_job_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot change a completed job';
  END IF;
  IF OLD.status = 'assigned' AND NEW.status = 'bidding' THEN
    RAISE EXCEPTION 'Cannot revert an assigned job to bidding';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guard_job_status
  BEFORE UPDATE ON public.active_jobs
  FOR EACH ROW EXECUTE FUNCTION validate_job_status_transition();

-- =============================================
-- CONVENIENCE VIEW
-- =============================================

CREATE OR REPLACE VIEW active_bidding_jobs AS
SELECT
  job_id,
  customer_phone,
  trade_required,
  problem_summary,
  created_at,
  jsonb_array_length(bids) AS bid_count
FROM public.active_jobs
WHERE status = 'bidding'
ORDER BY created_at DESC;

-- =============================================
-- MAINTENANCE FUNCTION
-- Run manually or via a Supabase cron job:
--   SELECT cleanup_old_jobs();
-- =============================================

CREATE OR REPLACE FUNCTION cleanup_old_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.active_jobs
  WHERE status = 'completed'
    AND updated_at < NOW() - INTERVAL '30 days';
  RAISE NOTICE 'Old completed jobs removed.';
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SYSTEM STATS (useful for admin queries)
-- =============================================

CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS TABLE(
  total_technicians  BIGINT,
  active_technicians BIGINT,
  bidding_jobs       BIGINT,
  assigned_jobs      BIGINT,
  completed_jobs     BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.technicians),
    (SELECT COUNT(*) FROM public.technicians  WHERE is_active = true),
    (SELECT COUNT(*) FROM public.active_jobs  WHERE status = 'bidding'),
    (SELECT COUNT(*) FROM public.active_jobs  WHERE status = 'assigned'),
    (SELECT COUNT(*) FROM public.active_jobs  WHERE status = 'completed');
END;
$$ LANGUAGE plpgsql;
