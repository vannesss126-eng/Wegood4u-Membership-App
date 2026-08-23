-- 2026-08-01: Create a public Storage bucket for partner-store QR code images.
--
-- Holds the printable QR PNG/SVG for every referral code, organized as
--   partner-store-codes/<sanitized store name>/<CODE>.png|svg
-- Files are uploaded out-of-band via `supabase storage cp` (CLI, linked project);
-- this migration only provisions the bucket. Public so the design/print team and
-- any client can fetch the images by URL without auth.
--
-- The QR images themselves encode https://wegood4u.com/r/<code> — this bucket is
-- just a durable home for the picture files, not a replacement for the /r/ pages.
--
-- Idempotent: ON CONFLICT (id) DO NOTHING.
--
-- VERIFY:
--   SELECT id, name, public FROM storage.buckets WHERE id = 'partner-store-codes';

INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-store-codes', 'partner-store-codes', true)
ON CONFLICT (id) DO NOTHING;
