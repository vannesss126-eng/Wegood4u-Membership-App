-- Partner Analytics Dashboard — Phase 1, Migration 6 of 8
--
-- billing_statements: monthly reconciliation records per partner store
-- (verified visits × per-visit fee). Drives the dashboard's Billing tab
-- (spec §5.4).
--
-- Scope simplified 2026-05-13: payment status tracking removed
-- (status / issued_at / paid_at / due_at columns dropped). Partner billing
-- is handled out-of-band (email / WhatsApp invoices); the dashboard only
-- displays the amount owed. If we ever want in-dashboard payment status,
-- add the columns back in a new migration.
--
-- Design notes:
--   • One row per (partner_store_id, period_year, period_month).
--   • period_start / period_end are denormalised for ergonomic date queries;
--     the (year, month) composite is the conceptual key.
--   • Snapshot fields capture state at statement-generation time:
--     verified_visit_count, per_visit_fee_at_generation, total_amount. If
--     the fee changes later, the existing statement is not retroactively
--     updated.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."billing_statements" (
    "id" bigserial PRIMARY KEY,
    "partner_store_id" "text" NOT NULL
      REFERENCES "public"."partner_store_settings"("partner_store_id") ON DELETE CASCADE,
    "period_year" smallint NOT NULL,
    "period_month" smallint NOT NULL,
    "period_start" date NOT NULL,
    "period_end" date NOT NULL,
    "verified_visit_count" integer NOT NULL DEFAULT 0,
    "per_visit_fee_at_generation" numeric(10,2) NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "currency" "text" NOT NULL DEFAULT 'MYR',
    "notes" "text",
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "billing_statements_period_check"
      CHECK ("period_month" BETWEEN 1 AND 12),
    CONSTRAINT "billing_statements_period_unique"
      UNIQUE ("partner_store_id", "period_year", "period_month")
);

ALTER TABLE "public"."billing_statements" OWNER TO "postgres";

COMMENT ON TABLE "public"."billing_statements" IS
  'Monthly billing statements per partner store. verified_visit_count × per_visit_fee_at_generation = total_amount. Payment status tracked out-of-band.';

CREATE INDEX IF NOT EXISTS "billing_statements_store_period_idx"
  ON "public"."billing_statements" ("partner_store_id", "period_year" DESC, "period_month" DESC);


-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE "public"."billing_statements" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners read their billing" ON "public"."billing_statements";
CREATE POLICY "partners read their billing"
  ON "public"."billing_statements" FOR SELECT TO "authenticated"
  USING ("public"."is_partner_for_store"("partner_store_id"));

DROP POLICY IF EXISTS "admins read all billing" ON "public"."billing_statements";
CREATE POLICY "admins read all billing"
  ON "public"."billing_statements" FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())));

DROP POLICY IF EXISTS "admins write billing" ON "public"."billing_statements";
CREATE POLICY "admins write billing"
  ON "public"."billing_statements" FOR ALL TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())))
  WITH CHECK ("public"."is_admin"((SELECT auth.uid())));


-- ============================================================
-- updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."billing_statements_touch_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "billing_statements_updated_at" ON "public"."billing_statements";
CREATE TRIGGER "billing_statements_updated_at"
  BEFORE UPDATE ON "public"."billing_statements"
  FOR EACH ROW EXECUTE FUNCTION "public"."billing_statements_touch_updated_at"();

COMMIT;
