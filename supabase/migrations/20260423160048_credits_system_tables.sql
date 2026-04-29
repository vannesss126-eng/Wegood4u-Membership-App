-- Phase 1.2 + 1.3 — credits/task ledger infrastructure.
--
-- Creates three new tables (credits_ledger, referral_half_credit_accumulator,
-- vouchers) and a profiles.first_approved_submission_at column with backfill.
--
-- Triggers that populate these tables (placement algorithm, badge promotion,
-- task-completion voucher minting) land in a later migration — this file is
-- schema-only. Inserts are locked down to SECURITY DEFINER callers.
--
-- Source of truth: .agent/documentation/credits-overview.md
--                  .agent/documentation/badge-rewards.md
--                  .agent/documentation/referral-system.md

-- ---------------------------------------------------------------------------
-- 1. credits_ledger
-- ---------------------------------------------------------------------------
-- Append-only +1 events per category cycle. Denominator is a constant 10 and
-- is not stored per row. Task completion = sum(delta_numerator) reaching 10
-- within a cycle_id.
--
-- category is restricted to credits-earning categories only. Hotel is NEVER
-- allowed a row here (its visibility counter comes directly from submissions).
-- 'others' is also excluded; legacy submissions categorised 'others' do not
-- earn credits.
CREATE TABLE IF NOT EXISTS public.credits_ledger (
  id                    bigserial PRIMARY KEY,
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category              public.store_category NOT NULL,
  delta_numerator       smallint NOT NULL DEFAULT 1 CHECK (delta_numerator = 1),
  reason                text NOT NULL CHECK (reason IN (
                          'approved_submission',
                          'level1_referral',
                          'level2_pair'
                        )),
  source_submission_id  bigint REFERENCES public.submissions(id) ON DELETE SET NULL,
  source_referral_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cycle_id              uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credits_ledger_category_eligible CHECK (
    category IN ('restaurant', 'cafe', 'bar')
  ),
  CONSTRAINT credits_ledger_submission_source_required CHECK (
    (reason = 'approved_submission' AND source_submission_id IS NOT NULL)
    OR reason IN ('level1_referral', 'level2_pair')
  ),
  CONSTRAINT credits_ledger_referral_source_required CHECK (
    (reason IN ('level1_referral', 'level2_pair') AND source_referral_id IS NOT NULL)
    OR reason = 'approved_submission'
  )
);

ALTER TABLE public.credits_ledger OWNER TO postgres;

COMMENT ON TABLE  public.credits_ledger IS 'Append-only +1 credit events per cycle. Derive per-category progress by summing delta_numerator grouped by cycle_id.';
COMMENT ON COLUMN public.credits_ledger.category IS 'Eligible categories only: restaurant, cafe, bar. Hotel and others never appear here.';
COMMENT ON COLUMN public.credits_ledger.cycle_id IS 'UUID identifying the current task cycle for (user_id, category). Minted on the first row of a new cycle; subsequent rows reuse it until the cycle closes at numerator=10.';
COMMENT ON COLUMN public.credits_ledger.reason IS 'approved_submission | level1_referral | level2_pair — set by the trigger, never by clients.';

-- Query patterns:
--   "how full is this user's active bar cycle?"
--   SELECT sum(delta_numerator) FROM credits_ledger
--    WHERE user_id = $1 AND category = 'bar' AND cycle_id = <active>
-- Index tuned for that plus history-style scans.
CREATE INDEX IF NOT EXISTS idx_credits_ledger_user_category_cycle
  ON public.credits_ledger (user_id, category, cycle_id);

CREATE INDEX IF NOT EXISTS idx_credits_ledger_user_created
  ON public.credits_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credits_ledger_source_submission
  ON public.credits_ledger (source_submission_id)
  WHERE source_submission_id IS NOT NULL;

ALTER TABLE public.credits_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credits ledger"
  ON public.credits_ledger
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- No INSERT/UPDATE/DELETE policies intentionally — only SECURITY DEFINER
-- trigger functions write here. Clients get zero write access.


-- ---------------------------------------------------------------------------
-- 2. referral_half_credit_accumulator
-- ---------------------------------------------------------------------------
-- Level 2 qualifications award +0.5 to the top-level affiliate. We store
-- these as an even-count accumulator; every pair settles as a single +1
-- ledger row (reason='level2_pair') and decrements count by 2.
CREATE TABLE IF NOT EXISTS public.referral_half_credit_accumulator (
  user_id     uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  count       smallint NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_half_credit_accumulator OWNER TO postgres;

COMMENT ON TABLE public.referral_half_credit_accumulator IS 'Holds unsettled Level-2 half-credits. When count becomes even, the placement trigger writes a level2_pair row to credits_ledger and decrements by 2.';

ALTER TABLE public.referral_half_credit_accumulator ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own half-credit accumulator"
  ON public.referral_half_credit_accumulator
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ---------------------------------------------------------------------------
-- 3. vouchers
-- ---------------------------------------------------------------------------
-- Minted when a task cycle closes (numerator reaches 10). Tier is frozen at
-- mint time — a voucher is not re-evaluated at redemption even if the user's
-- current tier later differs. Rewards per tier defined in badge-rewards.md.
CREATE TABLE IF NOT EXISTS public.vouchers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier                  text NOT NULL CHECK (tier IN ('bronze','silver','gold','platinum')),
  reward_kind           text NOT NULL CHECK (reward_kind IN (
                          'airbnb',
                          '3_star_hotel',
                          '4_star_hotel',
                          'specialty'
                        )),
  earned_from_cycle_id  uuid NOT NULL,
  redeemed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vouchers OWNER TO postgres;

COMMENT ON TABLE  public.vouchers IS 'Hotel-stay vouchers minted on task completion. One voucher per closed cycle. Tier frozen at mint.';
COMMENT ON COLUMN public.vouchers.tier IS 'Badge tier at mint time. Later tier changes do not retroactively upgrade a voucher.';
COMMENT ON COLUMN public.vouchers.earned_from_cycle_id IS 'References the credits_ledger.cycle_id that triggered the mint. Not a FK because cycle_id appears on multiple rows; enforce via trigger invariants.';
COMMENT ON COLUMN public.vouchers.redeemed_at IS 'Set when the user claims the voucher in the Rewards subtab. NULL = unredeemed.';

CREATE INDEX IF NOT EXISTS idx_vouchers_user_unredeemed
  ON public.vouchers (user_id)
  WHERE redeemed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vouchers_user_created
  ON public.vouchers (user_id, created_at DESC);

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vouchers"
  ON public.vouchers
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Redemption (setting redeemed_at) will happen via a SECURITY DEFINER RPC
-- added when the Rewards subtab redesign lands. Clients do not UPDATE directly.


-- ---------------------------------------------------------------------------
-- 4. profiles.first_approved_submission_at
-- ---------------------------------------------------------------------------
-- Set once when a user's first submission transitions to 'approved'. Drives
-- the referral qualification state in referral-system.md (Active = verified
-- AND first_approved_submission_at IS NOT NULL) and gates the 1+1 credit
-- award so it fires exactly once per invitee.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_approved_submission_at timestamptz;

COMMENT ON COLUMN public.profiles.first_approved_submission_at IS
  'Timestamp of the user''s first approved submission. NULL until that happens. Set once by the on_submission_approved trigger; never cleared.';

-- Backfill for existing users: earliest reviewed_at of any approved submission.
-- reviewed_at is set by the admin/AI when the status was flipped; use it in
-- preference to updated_at since updated_at also changes on unrelated edits.
UPDATE public.profiles p
SET first_approved_submission_at = sub.first_approved_at
FROM (
  SELECT
    s.user_id,
    MIN(COALESCE(s.reviewed_at, s.updated_at, s.created_at)) AS first_approved_at
  FROM public.submissions s
  WHERE s.status = 'approved'
  GROUP BY s.user_id
) sub
WHERE p.id = sub.user_id
  AND p.first_approved_submission_at IS NULL;
