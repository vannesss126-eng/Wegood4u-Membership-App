-- Stars + Visit 10 v1 — Share screenshot bucket + RLS
--
-- Creates a public-read bucket for share screenshots, mirroring how the
-- existing `submitted-receipt` / `submitted-selfie` buckets are set up
-- (direct uploads, public URL, owner-only writes).
--
-- Path convention enforced by client + RLS:
--   {user_id}/{submission_id}/{platform}_{timestamp}.{ext}
-- The first folder segment must equal auth.uid()::text — the WITH CHECK
-- below validates this.

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('submission-share-screenshots', 'submission-share-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Read: public (anyone can view shared screenshots — they're meant to prove
-- public posts).
DROP POLICY IF EXISTS "share_screenshots_public_read" ON storage.objects;
CREATE POLICY "share_screenshots_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'submission-share-screenshots');

-- Insert: only authenticated users, only into their own folder.
DROP POLICY IF EXISTS "share_screenshots_owner_insert" ON storage.objects;
CREATE POLICY "share_screenshots_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'submission-share-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Update / Delete: owner only (mainly for re-upload before verification).
DROP POLICY IF EXISTS "share_screenshots_owner_modify" ON storage.objects;
CREATE POLICY "share_screenshots_owner_modify"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'submission-share-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "share_screenshots_owner_delete" ON storage.objects;
CREATE POLICY "share_screenshots_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'submission-share-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;
