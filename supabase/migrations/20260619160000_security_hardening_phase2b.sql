-- ============================================================================
-- Security hardening — Phase 2B: private receipt/selfie buckets (F4)
-- Plan: .claude/plans/good-day-i-want-rustling-haven.md
--
-- The submitted-receipt / submitted-selfie buckets were world-readable (anon
-- SELECT), exposing receipts (PII) and selfies (faces). Make them PRIVATE and
-- gate reads to the owner + admins; uploads must land under the user's own
-- {auth.uid()}/ folder. The client now stores the object PATH and resolves
-- short-lived signed URLs for the admin review screen; the AI review edge fn
-- downloads via the service role (unaffected by these policies).
--
-- Deploy AFTER the matching client + edge-fn changes (path storage, signed URLs,
-- and fetchImageBytes(bucket, path)).
-- ============================================================================

begin;

-- Make the buckets private (no public object access).
update storage.buckets set public = false
  where id in ('submitted-receipt', 'submitted-selfie');

-- F4: remove the anonymous public-read policy.
drop policy if exists "Allow public SELECT on submitted buckets" on storage.objects;

-- Replace the unscoped upload policy with an owner-folder-scoped one.
drop policy if exists "Allow authenticated uploads to submitted buckets" on storage.objects;

create policy "Submitted uploads by owner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('submitted-receipt', 'submitted-selfie')
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Reads: the owner (their own {uid}/ folder) or an admin (review screen).
-- Both resolve via short-lived signed URLs created with these privileges; the
-- service role (AI review edge fn) bypasses RLS and is unaffected.
create policy "Submitted read by owner or admin"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('submitted-receipt', 'submitted-selfie')
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or public.is_admin(auth.uid())
    )
  );

-- NOTE: the "submission-share-screenshots" bucket also has a public-read policy
-- (share_screenshots_public_read TO public). Left as-is here pending confirmation
-- of the share-verification display flow; revisit if those screenshots are
-- considered sensitive.

commit;
