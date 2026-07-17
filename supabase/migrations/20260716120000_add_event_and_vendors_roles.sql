-- 2026-07-16:
--   Add two account types to the public.user_role enum:
--     • 'event'   — an event partner (e.g. Amazing Thailand). A standalone account,
--                   NOT tied to any partner store and with no dashboard. Its only
--                   purpose is to anchor a referral/invitation code; we measure how
--                   many members registered with that code. Event partners do NOT do
--                   the visit-10 tasks and do NOT redeem vouchers — referral count only.
--     • 'vendors' — a partner-store operator account. Classifies the auth user as a
--                   vendor. NOTE: this role is a label; access to vendors.wegood4u.com
--                   is still granted by a partner_accounts row (via is_partner_for_store),
--                   not by this enum value on its own.
--
--   Full set after this migration:
--     subscriber | member | affiliate | admin | event | vendors
--
-- Idempotent: ADD VALUE IF NOT EXISTS is a no-op if the value already exists
-- (Postgres 12+). New values are appended after the existing ones. We only ADD the
-- values here — no column is switched to use them in this same migration, so this is
-- safe to run in the migration's transaction.
--
-- VERIFY (before/after):
--   SELECT unnest(enum_range(NULL::public.user_role)) AS user_role;

ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'event';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'vendors';
