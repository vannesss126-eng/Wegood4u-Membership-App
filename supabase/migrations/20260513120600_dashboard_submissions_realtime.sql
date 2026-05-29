-- Partner Analytics Dashboard — Phase 1, Migration 7 of 7
--
-- Adds submissions to the supabase_realtime publication so the dashboard's
-- live visit counter (spec §5.1) can subscribe and update in real time when
-- a customer verifies a visit on the mobile app.
--
-- Background: the audit found that submissions is NOT currently in the
-- realtime publication. Other related tables (visit_progress, submission_shares,
-- star_wallet, star_ledger, user_favorite_stores, profiles, badges) already are.
--
-- Cost: realtime is row-level. Partners only receive payloads for rows their
-- RLS allows them to read (i.e. submissions where partner_store_id is theirs
-- AND status filtering happens client-side). At the current ~44 partner /
-- few-hundred-visits-per-day scale this is negligible.

BEGIN;

ALTER PUBLICATION supabase_realtime ADD TABLE "public"."submissions";

COMMIT;
