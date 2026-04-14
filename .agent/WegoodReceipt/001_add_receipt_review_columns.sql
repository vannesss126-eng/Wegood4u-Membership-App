-- ============================================================================
-- Wegood4u: Receipt Review Agent — Database Migration
-- ============================================================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- This migration:
--   1. Adds columns for extracted receipt data (date, amount, hash)
--   2. Creates the webhook trigger for auto-review on new submissions
--   3. Creates an index for fast duplicate lookups
-- ============================================================================


-- ─── Step 1: Add columns for extracted receipt data ──────────────────────────
-- These store the AI-extracted information from each receipt image.

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS receipt_date    DATE,
  ADD COLUMN IF NOT EXISTS total_amount    NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS currency        VARCHAR(3) DEFAULT 'MYR',
  ADD COLUMN IF NOT EXISTS merchant_name   TEXT,
  ADD COLUMN IF NOT EXISTS receipt_hash    VARCHAR(64);

-- Add admin review tracking columns if they don't exist yet
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS admin_notes     TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by     TEXT;

COMMENT ON COLUMN submissions.receipt_date   IS 'Transaction date extracted from receipt image via OCR';
COMMENT ON COLUMN submissions.total_amount   IS 'Total amount extracted from receipt image via OCR';
COMMENT ON COLUMN submissions.currency       IS 'Currency code from receipt (default MYR for Malaysia)';
COMMENT ON COLUMN submissions.merchant_name  IS 'Merchant/store name extracted from receipt';
COMMENT ON COLUMN submissions.receipt_hash   IS 'SHA-256 hash of receipt image bytes for duplicate detection';
COMMENT ON COLUMN submissions.reviewed_by    IS 'Who reviewed: user ID for manual, "auto-review-agent" for automated';


-- ─── Step 2: Create indexes for fast duplicate lookups ───────────────────────

-- Composite index: user + store + date (the primary duplicate lookup path)
CREATE INDEX IF NOT EXISTS idx_submissions_duplicate_lookup
  ON submissions (user_id, store_id, receipt_date)
  WHERE status IN ('submission_approved', 'submission_created');

-- Receipt hash index for exact-image duplicate detection
CREATE INDEX IF NOT EXISTS idx_submissions_receipt_hash
  ON submissions (receipt_hash)
  WHERE receipt_hash IS NOT NULL;

-- Status index for admin dashboard queries (pending submissions)
CREATE INDEX IF NOT EXISTS idx_submissions_status_created
  ON submissions (status, created_at DESC)
  WHERE status = 'submission_created';


-- ─── Step 3: Create the database webhook trigger ─────────────────────────────
-- This calls the Edge Function whenever a new submission is inserted.
--
-- OPTION A: Use Supabase Dashboard (recommended)
--   Go to: Database → Webhooks → Create a new webhook
--   - Name:   review-submission-on-insert
--   - Table:  submissions
--   - Events: INSERT
--   - Type:   Supabase Edge Function
--   - Edge Function: review-submission
--   - HTTP Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--
-- OPTION B: Use pg_net extension (SQL-based webhook)
--   Uncomment the function and trigger below:

/*
-- Enable the pg_net extension (HTTP requests from Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function that fires on INSERT and calls the Edge Function
CREATE OR REPLACE FUNCTION notify_review_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for new submissions (status = 'submission_created')
  IF NEW.status = 'submission_created' THEN
    PERFORM net.http_post(
      url    := current_setting('app.supabase_url') || '/functions/v1/review-submission',
      body   := jsonb_build_object(
        'type',   'INSERT',
        'table',  'submissions',
        'record', row_to_json(NEW)::jsonb
      ),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to submissions table
DROP TRIGGER IF EXISTS on_submission_created ON submissions;
CREATE TRIGGER on_submission_created
  AFTER INSERT ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_agent();
*/


-- ─── Step 4: Helper view for admin dashboard ─────────────────────────────────
-- Shows pending submissions with extracted data for quick manual review

CREATE OR REPLACE VIEW pending_submissions_view AS
SELECT
  s.id,
  s.user_id,
  s.store_id,
  s.receipt_url,
  s.selfie_url,
  s.status,
  s.receipt_date,
  s.total_amount,
  s.currency,
  s.merchant_name,
  s.admin_notes,
  s.reviewed_by,
  s.created_at,
  s.reviewed_at
FROM submissions s
WHERE s.status = 'submission_created'
ORDER BY s.created_at DESC;


-- ─── Step 5: RPC function for manual batch review ────────────────────────────
-- Allows admin to approve/reject a submission from the admin dashboard

CREATE OR REPLACE FUNCTION update_submission_review(
  p_submission_id UUID,
  p_status        TEXT,
  p_admin_notes   TEXT DEFAULT NULL,
  p_reviewed_by   UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE submissions
  SET
    status      = p_status,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    reviewed_by = COALESCE(p_reviewed_by::text, reviewed_by),
    reviewed_at = NOW()
  WHERE id = p_submission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
