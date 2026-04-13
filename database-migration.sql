-- =============================================
-- SNAPFIX V2 MIGRATION
-- Run this in Supabase SQL Editor AFTER the
-- original database-setup.sql has been run.
-- =============================================

-- ── Extend technicians table ──────────────────

ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS password_hash       TEXT,
  ADD COLUMN IF NOT EXISTS experience_years    INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_jobs_done     INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS city                TEXT,
  ADD COLUMN IF NOT EXISTS area                TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_url   TEXT,
  ADD COLUMN IF NOT EXISTS approval_status     TEXT         NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS registration_source TEXT         NOT NULL DEFAULT 'admin'
    CHECK (registration_source IN ('admin','portal'));

-- Techs added via /add command are auto-approved.
-- Techs who self-register via portal start as 'pending'.

-- ── Extend active_jobs table ─────────────────────

ALTER TABLE public.active_jobs
  ADD COLUMN IF NOT EXISTS customer_city   TEXT,
  ADD COLUMN IF NOT EXISTS customer_area   TEXT,
  ADD COLUMN IF NOT EXISTS customer_rating INT CHECK (customer_rating BETWEEN 1 AND 5);

-- ── Conversation state table ──────────────────────
-- Tracks multi-turn WhatsApp conversations.
-- One row per active customer conversation.

CREATE TABLE IF NOT EXISTS public.conversation_state (
  phone          TEXT        PRIMARY KEY,
  state          TEXT        NOT NULL DEFAULT 'idle'
                               CHECK (state IN ('idle','awaiting_problem','awaiting_location')),
  partial_problem TEXT,
  partial_trade   TEXT,
  partial_city    TEXT,
  partial_area    TEXT,
  language        TEXT        NOT NULL DEFAULT 'english'
                               CHECK (language IN ('english','urdu')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER conversation_state_updated_at
  BEFORE UPDATE ON public.conversation_state
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Auto-expire conversations older than 2 hours (cleanup function)
CREATE OR REPLACE FUNCTION cleanup_stale_conversations()
RETURNS void AS $$
BEGIN
  DELETE FROM public.conversation_state
  WHERE updated_at < NOW() - INTERVAL '2 hours';
END;
$$ LANGUAGE plpgsql;

-- ── New index: pending tech approvals ─────────────

CREATE INDEX IF NOT EXISTS idx_techs_approval
  ON public.technicians (approval_status)
  WHERE approval_status = 'pending';

-- ── Update is_active check to also require approval ──
-- When admin approves a portal-registered tech, set both
-- approval_status = 'approved' AND is_active = true.
-- ─────────────────────────────────────────────────────

-- ── Stats helper (used by admin dashboard) ──────────

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(
  total_technicians   BIGINT,
  active_technicians  BIGINT,
  pending_approval    BIGINT,
  bidding_jobs        BIGINT,
  assigned_jobs       BIGINT,
  completed_today     BIGINT,
  completed_total     BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.technicians),
    (SELECT COUNT(*) FROM public.technicians WHERE is_active = true AND approval_status = 'approved'),
    (SELECT COUNT(*) FROM public.technicians WHERE approval_status = 'pending'),
    (SELECT COUNT(*) FROM public.active_jobs WHERE status = 'bidding'),
    (SELECT COUNT(*) FROM public.active_jobs WHERE status = 'assigned'),
    (SELECT COUNT(*) FROM public.active_jobs
       WHERE status = 'completed' AND updated_at::date = CURRENT_DATE),
    (SELECT COUNT(*) FROM public.active_jobs WHERE status = 'completed');
END;
$$ LANGUAGE plpgsql;
