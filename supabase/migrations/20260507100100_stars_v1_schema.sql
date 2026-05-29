-- Stars + Visit 10 v1 — Schema (new tables)
--
-- Creates 6 new tables for the stars + cumulative cycle model:
--   star_wallet, star_ledger, visit_progress, submission_shares, daily_checkins, vouchers
-- Plus 2 streak columns on profiles.
--
-- RLS policies in stars_v1_rls.sql; RPCs in stars_v1_rpcs.sql; triggers in stars_v1_triggers.sql.

BEGIN;

-- ============================================================
-- profiles: add daily streak columns
-- ============================================================

ALTER TABLE "public"."profiles"
  ADD COLUMN IF NOT EXISTS "current_streak" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_checkin_at" timestamp with time zone;

COMMENT ON COLUMN "public"."profiles"."current_streak" IS 'Consecutive daily check-ins. Resets to 0 if user misses a day. KL TZ for day boundary.';
COMMENT ON COLUMN "public"."profiles"."last_checkin_at" IS 'Timestamp of the user''s most recent daily check-in. NULL = never checked in.';


-- ============================================================
-- star_wallet: per-user star balance
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."star_wallet" (
    "user_id" "uuid" NOT NULL,
    "balance" integer NOT NULL DEFAULT 0,
    "updated_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    CONSTRAINT "star_wallet_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "star_wallet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "star_wallet_balance_nonneg" CHECK ("balance" >= 0)
);

ALTER TABLE "public"."star_wallet" OWNER TO "postgres";
COMMENT ON TABLE "public"."star_wallet" IS 'Per-user running star balance. Stars are earned from extra tasks (share/streak/referral) and spent via the manual trade button to add +1 to Visit 10 cycle progress.';


-- ============================================================
-- visit_progress: active Visit 10 cycle per user
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."visit_progress" (
    "cycle_id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "user_id" "uuid" NOT NULL,
    "real_visits" integer NOT NULL DEFAULT 0,
    "extras_applied" integer NOT NULL DEFAULT 0,
    "opened_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    "closed_at" timestamp with time zone,
    CONSTRAINT "visit_progress_pkey" PRIMARY KEY ("cycle_id"),
    CONSTRAINT "visit_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "visit_progress_real_visits_range" CHECK ("real_visits" BETWEEN 0 AND 10),
    CONSTRAINT "visit_progress_extras_range" CHECK ("extras_applied" BETWEEN 0 AND 4),
    CONSTRAINT "visit_progress_total_lte_10" CHECK ("real_visits" + "extras_applied" <= 10)
);

ALTER TABLE "public"."visit_progress" OWNER TO "postgres";
COMMENT ON TABLE "public"."visit_progress" IS 'Active and historical Visit 10 cycles. closed_at IS NULL means the user''s currently active cycle. Closes when user taps "Complete Tasks" at 10/10.';

-- One open cycle per user
CREATE UNIQUE INDEX IF NOT EXISTS "visit_progress_one_open_per_user"
  ON "public"."visit_progress" ("user_id")
  WHERE "closed_at" IS NULL;

-- For listing closed cycles in History
CREATE INDEX IF NOT EXISTS "visit_progress_user_closed_at_idx"
  ON "public"."visit_progress" ("user_id", "closed_at" DESC)
  WHERE "closed_at" IS NOT NULL;


-- ============================================================
-- daily_checkins: per-day check-in audit
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."daily_checkins" (
    "id" bigint GENERATED ALWAYS AS IDENTITY,
    "user_id" "uuid" NOT NULL,
    "checkin_date" date NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    CONSTRAINT "daily_checkins_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "daily_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "daily_checkins_unique_per_day" UNIQUE ("user_id", "checkin_date")
);

ALTER TABLE "public"."daily_checkins" OWNER TO "postgres";
COMMENT ON TABLE "public"."daily_checkins" IS 'One row per (user, KL-day). UNIQUE constraint blocks double-tap. checkin_date stored in Asia/Kuala_Lumpur.';

CREATE INDEX IF NOT EXISTS "daily_checkins_user_date_idx"
  ON "public"."daily_checkins" ("user_id", "checkin_date" DESC);


-- ============================================================
-- submission_shares: verified social media shares
-- ============================================================
-- Note: submissions.id is bigint (sequence-generated), so submission_id is bigint here.

CREATE TABLE IF NOT EXISTS "public"."submission_shares" (
    "id" bigint GENERATED ALWAYS AS IDENTITY,
    "submission_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "post_url" "text",
    "screenshot_path" "text",
    "status" "text" NOT NULL DEFAULT 'pending',
    "ai_review_meta" "jsonb",
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    CONSTRAINT "submission_shares_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "submission_shares_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE,
    CONSTRAINT "submission_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "submission_shares_platform_check" CHECK ("platform" = ANY (ARRAY['facebook'::"text", 'instagram'::"text", 'tiktok'::"text"])),
    CONSTRAINT "submission_shares_status_check" CHECK ("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"])),
    CONSTRAINT "submission_shares_unique_submission_platform" UNIQUE ("submission_id", "platform")
);

ALTER TABLE "public"."submission_shares" OWNER TO "postgres";
COMMENT ON TABLE "public"."submission_shares" IS 'One row per (submission, platform) share attempt. UNIQUE blocks duplicate shares of the same approved submission to the same platform. Stars awarded on verified_at via trigger.';

CREATE INDEX IF NOT EXISTS "submission_shares_user_status_idx"
  ON "public"."submission_shares" ("user_id", "status");

CREATE INDEX IF NOT EXISTS "submission_shares_submission_id_idx"
  ON "public"."submission_shares" ("submission_id");


-- ============================================================
-- star_ledger: append-only audit of every star event
-- ============================================================
-- Sources are typed via separate nullable FK columns (mirrors credits_ledger pattern):
--   source_submission_id  for share_* reasons
--   source_referral_user_id  for l1/l2_referral reasons (the invitee's user_id)
--   source_checkin_id  for daily_streak_14 reason
--   cycle_id  for conversion_to_progress reason

CREATE TABLE IF NOT EXISTS "public"."star_ledger" (
    "id" bigint GENERATED ALWAYS AS IDENTITY,
    "user_id" "uuid" NOT NULL,
    "delta_stars" integer NOT NULL,
    "reason" "text" NOT NULL,
    "source_submission_id" bigint,
    "source_referral_user_id" "uuid",
    "source_checkin_id" bigint,
    "cycle_id" "uuid",
    "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    CONSTRAINT "star_ledger_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "star_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "star_ledger_source_submission_fkey" FOREIGN KEY ("source_submission_id") REFERENCES "public"."submissions"("id") ON DELETE SET NULL,
    CONSTRAINT "star_ledger_source_referral_user_fkey" FOREIGN KEY ("source_referral_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
    CONSTRAINT "star_ledger_source_checkin_fkey" FOREIGN KEY ("source_checkin_id") REFERENCES "public"."daily_checkins"("id") ON DELETE SET NULL,
    CONSTRAINT "star_ledger_cycle_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."visit_progress"("cycle_id") ON DELETE SET NULL,
    CONSTRAINT "star_ledger_reason_check" CHECK ("reason" = ANY (ARRAY[
      'share_facebook'::"text",
      'share_instagram'::"text",
      'share_tiktok'::"text",
      'share_all_three_bonus'::"text",
      'daily_streak_14'::"text",
      'l1_referral'::"text",
      'l1_referral_self_bonus'::"text",
      'l2_referral'::"text",
      'conversion_to_progress'::"text"
    ]))
);

ALTER TABLE "public"."star_ledger" OWNER TO "postgres";
COMMENT ON TABLE "public"."star_ledger" IS 'Append-only audit of every star event: awards (+) and trade-to-progress conversions (-). delta_stars is positive for awards, negative for conversions. cycle_id set on conversion_to_progress rows.';

-- For the History feed query (latest events per user)
CREATE INDEX IF NOT EXISTS "star_ledger_user_created_at_idx"
  ON "public"."star_ledger" ("user_id", "created_at" DESC);

-- Unique idempotency indexes (prevents double-awards even under concurrent writes;
-- _award_stars uses INSERT ... ON CONFLICT DO NOTHING to rely on these).
CREATE UNIQUE INDEX IF NOT EXISTS "star_ledger_unique_share"
  ON "public"."star_ledger" ("user_id", "reason", "source_submission_id")
  WHERE "source_submission_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "star_ledger_unique_referral"
  ON "public"."star_ledger" ("user_id", "reason", "source_referral_user_id")
  WHERE "source_referral_user_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "star_ledger_unique_checkin"
  ON "public"."star_ledger" ("user_id", "reason", "source_checkin_id")
  WHERE "source_checkin_id" IS NOT NULL;


-- ============================================================
-- vouchers: minted on Visit 10 cycle close
-- ============================================================
-- Recreated with new shape:
--   - badge_kind column (visit for v1, future per-category values)
--   - level snapshot at mint
--   - new reward_kind enum values matching the locked Visit Badge tier mapping

CREATE TABLE IF NOT EXISTS "public"."vouchers" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "user_id" "uuid" NOT NULL,
    "badge_kind" "text" NOT NULL DEFAULT 'visit',
    "tier" "text" NOT NULL,
    "level" integer,
    "reward_kind" "text" NOT NULL,
    "earned_from_cycle_id" "uuid",
    "redeemed_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vouchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "vouchers_cycle_fkey" FOREIGN KEY ("earned_from_cycle_id") REFERENCES "public"."visit_progress"("cycle_id") ON DELETE SET NULL,
    CONSTRAINT "vouchers_badge_kind_check" CHECK ("badge_kind" = ANY (ARRAY['visit'::"text", 'cafe'::"text", 'bar'::"text", 'restaurant'::"text", 'hotel'::"text"])),
    CONSTRAINT "vouchers_tier_check" CHECK ("tier" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text", 'platinum'::"text"])),
    CONSTRAINT "vouchers_level_range" CHECK ("level" IS NULL OR "level" BETWEEN 1 AND 3),
    CONSTRAINT "vouchers_reward_kind_check" CHECK ("reward_kind" = ANY (ARRAY[
      'airbnb_3star'::"text",
      'hotel_3_4star'::"text",
      'hotel_4_5star'::"text",
      'specialty_5star_resort'::"text"
    ]))
);

ALTER TABLE "public"."vouchers" OWNER TO "postgres";
COMMENT ON TABLE "public"."vouchers" IS 'Minted on Visit 10 cycle close. Tier is snapshot at mint time — future tier-ups don''t retroactively upgrade. badge_kind is "visit" for v1; per-category values reserved for future Category Badge rewards.';
COMMENT ON COLUMN "public"."vouchers"."tier" IS 'User''s Visit Badge tier at the moment they tapped Complete Tasks. Frozen — never updated post-mint.';
COMMENT ON COLUMN "public"."vouchers"."level" IS 'L1/L2/L3 sub-level at mint, for display only. Tier (not level) determines reward_kind.';
COMMENT ON COLUMN "public"."vouchers"."reward_kind" IS 'airbnb_3star (Bronze) | hotel_3_4star (Silver) | hotel_4_5star (Gold) | specialty_5star_resort (Platinum)';
COMMENT ON COLUMN "public"."vouchers"."redeemed_at" IS 'Set when user claims voucher in Rewards subtab. NULL = unredeemed (claimable). v1 ships with "Coming soon" modal — stays NULL.';

CREATE INDEX IF NOT EXISTS "vouchers_user_redeemed_idx"
  ON "public"."vouchers" ("user_id", "redeemed_at");


COMMIT;
