-- Partner Analytics Dashboard — Phase 2 (Full-Supabase migration), Migration 4 of 5
--
-- oauth_tokens: stores per-partner OAuth tokens for Instagram + TikTok polling.
-- Each partner store that wants IG/TikTok stats must complete an OAuth flow;
-- the resulting access_token + refresh_token + expiry land here.
--
-- Locked 2026-05-18 — addition contributed during API-doc review.
--
-- Design notes:
--   • Composite uniqueness on (partner_store_id, platform) — one token per
--     (store, platform) pair. Re-authorisation = UPDATE not INSERT.
--   • Tokens are SENSITIVE. Default RLS denies all access; only the service
--     role (used by Edge Functions) can read/write. Partners NEVER see their
--     own raw tokens via the dashboard.
--   • access_token / refresh_token columns stored plain — Supabase free tier
--     has no built-in column encryption. If this project ever needs at-rest
--     encryption, move to Supabase Vault or a pgcrypto wrapper. Documented
--     as a known limitation, not a blocker for MVP.
--   • YouTube doesn't appear in the platform enum because YouTube polling
--     uses a single API key (Deno.env.get('YOUTUBE_API_KEY')), not per-partner
--     OAuth. Only IG + TikTok need per-partner tokens.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."oauth_tokens" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "partner_store_id" "text" NOT NULL
      REFERENCES "public"."partner_stores"("id") ON DELETE CASCADE,
    "platform" "text" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text",
    "expires_at" timestamptz,
    "scopes" "text"[],
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "oauth_tokens_platform_check"
      CHECK ("platform" IN ('instagram', 'tiktok')),
    CONSTRAINT "oauth_tokens_store_platform_unique"
      UNIQUE ("partner_store_id", "platform")
);

ALTER TABLE "public"."oauth_tokens" OWNER TO "postgres";

COMMENT ON TABLE "public"."oauth_tokens" IS
  'Per-partner OAuth tokens for IG/TikTok polling. Sensitive — service role access only.';

COMMENT ON COLUMN "public"."oauth_tokens"."access_token" IS
  'Sensitive. Stored plain on Supabase free tier (no column encryption). Move to Vault if at-rest encryption becomes a requirement.';


-- ============================================================
-- RLS — admin-only reads, service-role-only writes via Edge Functions
-- ============================================================

ALTER TABLE "public"."oauth_tokens" ENABLE ROW LEVEL SECURITY;

-- No partner SELECT policy on purpose — partners never see raw tokens.

DROP POLICY IF EXISTS "admins read oauth tokens" ON "public"."oauth_tokens";
CREATE POLICY "admins read oauth tokens"
  ON "public"."oauth_tokens" FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())));

DROP POLICY IF EXISTS "admins write oauth tokens" ON "public"."oauth_tokens";
CREATE POLICY "admins write oauth tokens"
  ON "public"."oauth_tokens" FOR ALL TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())))
  WITH CHECK ("public"."is_admin"((SELECT auth.uid())));

-- Edge Functions running with the service role key bypass RLS entirely,
-- which is the intended path for token reads during polling and writes
-- during the OAuth callback flow.


-- ============================================================
-- updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."oauth_tokens_touch_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "oauth_tokens_updated_at" ON "public"."oauth_tokens";
CREATE TRIGGER "oauth_tokens_updated_at"
  BEFORE UPDATE ON "public"."oauth_tokens"
  FOR EACH ROW EXECUTE FUNCTION "public"."oauth_tokens_touch_updated_at"();

COMMIT;
