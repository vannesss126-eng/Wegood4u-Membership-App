-- Adds AI receipt review fields for automatic submission processing

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS receipt_date date,
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS merchant_name text,
  ADD COLUMN IF NOT EXISTS receipt_hash text,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by text;

COMMENT ON COLUMN public.submissions.receipt_date   IS 'Transaction date extracted from receipt image via OCR';
COMMENT ON COLUMN public.submissions.total_amount   IS 'Total amount extracted from receipt image via OCR';
COMMENT ON COLUMN public.submissions.currency       IS 'Currency code from receipt (default MYR for Malaysia)';
COMMENT ON COLUMN public.submissions.merchant_name  IS 'Merchant/store name extracted from receipt';
COMMENT ON COLUMN public.submissions.receipt_hash   IS 'SHA-256 hash of receipt image bytes for duplicate detection';
COMMENT ON COLUMN public.submissions.admin_notes    IS 'Notes from admin during review process';
COMMENT ON COLUMN public.submissions.reviewed_by    IS 'Who reviewed: user ID for manual, "auto-review-agent" for automated';

CREATE INDEX IF NOT EXISTS idx_submissions_receipt_date ON public.submissions(receipt_date);
CREATE INDEX IF NOT EXISTS idx_submissions_total_amount ON public.submissions(total_amount);
CREATE INDEX IF NOT EXISTS idx_submissions_receipt_hash ON public.submissions(receipt_hash);
CREATE INDEX IF NOT EXISTS idx_submissions_partner_store_name ON public.submissions(partner_store_name);

-- Composite index: user + store + date (the primary duplicate lookup path)
CREATE INDEX IF NOT EXISTS idx_submissions_duplicate_lookup
  ON public.submissions (user_id, partner_store_name, receipt_date)
  WHERE status IN ('approved', 'pending');

-- Receipt hash index for exact-image duplicate detection
CREATE INDEX IF NOT EXISTS idx_submissions_receipt_hash_lookup
  ON public.submissions (receipt_hash)
  WHERE receipt_hash IS NOT NULL;

-- Status index for admin dashboard queries (pending submissions)
CREATE INDEX IF NOT EXISTS idx_submissions_status_pending
  ON public.submissions (status, created_at DESC)
  WHERE status = 'pending';

-- Helper view for admin dashboard
CREATE OR REPLACE VIEW pending_submissions_view AS
SELECT
  s.id,
  s.user_id,
  s.partner_store_name,
  s.partner_store_category,
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
  s.updated_at
FROM public.submissions s
WHERE s.status = 'pending'
ORDER BY s.created_at DESC;

-- RPC function for manual batch review
CREATE OR REPLACE FUNCTION update_submission_review(
  p_submission_id bigint,
  p_status text,
  p_admin_notes text DEFAULT NULL,
  p_reviewed_by text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE public.submissions
  SET
    status = p_status,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    reviewed_by = COALESCE(p_reviewed_by, reviewed_by),
    updated_at = NOW()
  WHERE id = p_submission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
