# Wegood4u — Stars + Visit 10 Development Plan

> Phase-by-phase rollout of the locked stars + cumulative Visit 10 cycle model with 5 badges.
> Source-of-truth specs in [`../documentation/credits-overview.md`](../documentation/credits-overview.md), [`../documentation/extra-tasks.md`](../documentation/extra-tasks.md), [`../documentation/badges.md`](../documentation/badges.md), [`../documentation/badge-rewards.md`](../documentation/badge-rewards.md), [`../documentation/referral-system.md`](../documentation/referral-system.md), [`../documentation/history-feed.md`](../documentation/history-feed.md), [`../documentation/notifications.md`](../documentation/notifications.md).
> Latest re-lock: 2026-05-04.

---

## Sequencing principles

1. **Database first.** Everything else depends on the new schema. Get migrations + RLS + triggers in before any UI changes.
2. **Lowest-risk validation first.** Re-wire referrals before building daily streak / share, because referrals already have qualification logic — the swap from credit-awards to star-awards is the smallest delta and validates the star wallet end-to-end.
3. **External dependencies last.** AI share verification has the most external risk (model behavior, hashtag list, manual review fallback). Ship it after the wallet is proven.
4. **Each phase is independently shippable** to staging behind a feature flag (`feature_stars_v1`). Production rollout per-phase, not a single big-bang merge.
5. **No backfill anywhere on launch (locked 2026-05-06):** verified members start at 0 across all 5 badges. No existing-submissions carryover for Visit Badge OR Category Badges. Everyone begins fresh from verification.

---

## Phase 0 — Pre-flight

**Goal:** unblock the build by closing open product questions and tooling decisions.

### Status

| # | Task | Status |
|---|---|---|
| 0.1 | Daily streak payout shape | **Locked 2026-05-04** — 14 days = 50 stars, single payout at milestone, recurring |
| 0.2 | Daily streak grace period | **Locked** — none. Miss a day = streak resets to 0 |
| 0.3 | Daily check-in eligibility | **Locked 2026-05-04** — open to all verified members from day 1; no approved-submission gate |
| 0.4 | Day boundary timezone | **Locked** — Asia/Kuala_Lumpur (= MY time) |
| 0.5 | Backfill rule | **Locked 2026-05-06** — no backfill anywhere. All 5 badges start at 0 after verification. |
| 0.6 | Claw-back policy | **Locked 2026-05-04** — N/A. Approvals are final, can't be reverted. Removes a whole class of edge cases. |
| 0.7 | Manual trade vs auto-convert | **Locked** — manual. User taps "Use 100 ★ for +1 Progress" |
| 0.8 | Star icon | **Lucide `Star` for v1**; custom asset pending Kasey's team |
| 0.9 | Voucher reward kinds | **Locked 2026-05-04** — see Phase 8 voucher table |
| 0.10 | Final hashtag list for share verification | **Pending Kasey** ("I send you the hashtag later") |
| 0.11 | Category Badge rewards | **Pending vendor sponsorship** — v1 Category Badge tiles ship with progression-only (no reward callout, no "Coming soon" wording per Kasey 2026-05-07) |
| 0.12 | Voucher inventory sourcing | **Pending** — honor-system codes for v1 demo, real partner integration later |
| 0.13 | `feature_stars_v1` flag | **Pending dev** — scaffold in env / config |

### Exit criteria

- Phase 0 is **substantially complete**. Outstanding blockers are all "wait on materials" (hashtag list, custom badge art) — they don't block schema/UI work.

---

## Asset strategy — bundled in-app (locked 2026-05-08)

All badge / voucher / frame art is **bundled in the app**, not server-hosted. Reasoning:

| Concern | Bundled (chosen) | Server-side (rejected) |
|---|---|---|
| Total size | ~2 MB across all badges + vouchers + frames — adds 2–4% to app bundle | 0 |
| First render | Instant (local file read) | 200–800 ms cold network roundtrip |
| Offline | Works | Breaks |
| Egress cost @ 30k MAU | $0 | ~$5–10/month on Supabase Pro overage |
| Update cadence | App release (acceptable — art changes infrequently) | Bucket upload |

**What stays server-side:** user-uploaded content (submission proofs, avatars). These are per-user and can't be bundled.

**Hybrid escape hatch:** if we ever want to swap to remote-hosted later, abstract behind a single `<TierAsset />` component that resolves `'visit_bronze_1'` → `require()` today and `{uri:...}` later. One-line refactor.

### Received assets (already in repo)

**1. `stars.svg`** — at [`assets/icons/star.svg`](../../assets/icons/star.svg). True vector, transparent. Pending: swap hardcoded `fill="#F2C540"` → `fill="currentColor"` for runtime tinting.

**2. Visit Badge art (16 files, ~460 KB)** — at [`assets/images/visit rank/`](../../assets/images/visit%20rank/):
- `Pre-visit Bronze/`: `B.webp`, `B1.webp`, `B2.webp`, `B3.webp`
- `Pre-Visit Silver/`: `S.webp`, `31.webp`, `32.webp`, `33.webp`
- `Pre-Visit Gold/`: `38.webp`, `39.webp`, `40.webp`, `41.webp`
- `Pre-Visit Diamond/`: `48.webp`, `49.webp`, `50.webp`, `51.webp` (Diamond folder = Platinum tier — accessory naming only, the spec tier is Platinum)
- 4 files per tier. Default mapping: numeric files → L1/L2/L3 (drop the 4th = master tier badge).

**3. Voucher art (4 files, ~80 KB)** — at [`assets/images/voucher/`](../../assets/images/voucher/):
- `bronze_voucher.webp`, `silver_voucher.webp`, `gold_voucher.webp`, `plat_voucher.webp`
- One per Visit Badge tier. Used on the Rewards subtab voucher cards.

**4. Profile picture frames (4 files, ~112 KB)** — at [`assets/images/tier_frame/`](../../assets/images/tier_frame/):
- `Bronze.webp`, `Silver.webp`, `Goldd.webp`, `Diamond.webp` — file names have typos but tier mapping is clear (Bronze/Silver/Gold/Platinum).
- Per-tier only, not per-level.

### Not yet received

**5. Category Badge art** — Strategy C (composite, recommended):
- 4 category logos (Cafe / Bar / Restaurant / Hotel) — can reuse existing brand logos in the app
- 12 tier-level overlays (transparent) — `tier_overlay_{tier}_{level}.webp` at 360×360 px
- Total: 16 new files when delivered. Phase 7 ships with placeholder gradients if delayed.

**6. Final hashtag list** for share verification — plain text from Kasey.

---

## Phase 1 — Database foundation

**Goal:** lay the schema for everything else. No UI changes, no user-visible behavior yet.

### Production state (audited 2026-05-06 against [`supabase/migrations/20260506104505_remote_schema.sql`](../../supabase/migrations/20260506104505_remote_schema.sql))

What exists today + what to do with it:

| Artifact | Action |
|---|---|
| `credits_ledger` table (per-category cycle data) | **Drop** — wrong shape for new single-cycle model |
| `referral_half_credit_accumulator` table | **Drop** — replaced by direct `+50` star awards |
| `vouchers` table (old `reward_kind` CHECK + missing `badge_kind`/`level`) | **Drop & recreate** with new schema |
| `badges` table | **Migrate in place** — add `badge_kind`, `tier`, `level` columns; flip legacy seed rows to `is_active = false`; seed new badge rows |
| `user_badges` table | **Keep** — historical data stays. Legacy badge IDs reference old rows now hidden via `is_active=false`. |
| `store_category` enum | **Leave as-is** for v1 (Experience deferred — add `experience` later when category lands) |
| `badge_category` enum | **Leave as-is** for v1 (Experience deferred) |
| `_credits_*` functions (8 total) | **Drop** — replaced by new RPCs |
| `check_and_award_badges` legacy fn | **Drop** — replaced by badge threshold logic |
| `on_submission_approved` trigger fn | **Rewrite** for new model |
| `referral_tree` view (L1/L2 with `referral_state`) | **Keep as-is** — supports the new flow already |
| `profiles.first_approved_submission_at` (backfilled) | **Keep** |
| `push_tokens` table | **Keep dormant** — push deferred |

### Files affected

- `supabase/migrations/20260507100000_stars_v1_drop_legacy.sql` — drops legacy functions, tables, indexes
- `supabase/migrations/20260507100100_stars_v1_schema.sql` — creates new tables (`star_wallet`, `star_ledger`, `visit_progress`, `submission_shares`, `daily_checkins`, `vouchers`)
- `supabase/migrations/20260507100200_stars_v1_badges_evolve.sql` — adds `badge_kind`/`tier`/`level` to `badges`, hides legacy rows
- `supabase/migrations/20260507100300_stars_v1_rls.sql`
- `supabase/migrations/20260507100400_stars_v1_rpcs.sql` — `trade_stars_for_progress`, `complete_visit_task`, `record_daily_checkin`, internal helpers
- `supabase/migrations/20260507100500_stars_v1_triggers.sql` — `on_submission_approved`, `on_submission_share_verified`
- `supabase/migrations/20260507100600_stars_v1_badges_seed.sql` — seeds 12 Visit Badges + 48 Category Badges
- `supabase/migrations/20260507100700_stars_v1_redemption_notify.sql` — admin + user notification on `vouchers.redeemed_at` set (Phase 1 follow-up, 2026-05-08)
- `supabase/migrations/20260507100800_stars_v1_history_rpc_v2.sql` — replaces `get_user_activity` with new event vocabulary; mandatory because the legacy body referenced the dropped `credits_ledger` table (Phase 1 follow-up, 2026-05-08)
- `types/database.ts` (regenerate from `supabase gen types`)

### Steps

#### 1.0 Drop legacy artifacts (run first)

```sql
-- Drop legacy functions (per-category cycle logic, no longer needed)
DROP FUNCTION IF EXISTS public._credits_active_cycle_id(uuid, store_category);
DROP FUNCTION IF EXISTS public._credits_apply_delta(uuid, store_category, text, bigint, uuid);
DROP FUNCTION IF EXISTS public._credits_award_tier_badge(uuid);
DROP FUNCTION IF EXISTS public._credits_completed_task_count(uuid);
DROP FUNCTION IF EXISTS public._credits_pick_referral_target(uuid);
DROP FUNCTION IF EXISTS public._credits_reward_kind_for_tier(text);
DROP FUNCTION IF EXISTS public._credits_tier_for_task_count(integer);
DROP FUNCTION IF EXISTS public.check_and_award_badges();

-- Drop legacy tables (test data, no production users yet)
DROP TABLE IF EXISTS public.credits_ledger CASCADE;
DROP TABLE IF EXISTS public.referral_half_credit_accumulator CASCADE;
DROP TABLE IF EXISTS public.vouchers CASCADE;  -- recreated below with new shape

-- Experience category deferred for v1 — no enum extension needed.
-- (When Experience lands later: ALTER TYPE public.store_category ADD VALUE IF NOT EXISTS 'experience';
--  and ALTER TYPE public.badge_category ADD VALUE IF NOT EXISTS 'experience';)
```

#### 1.1 New tables

```sql
-- One per user; running star balance.
-- No queued_extras column — manual trade means stars sit in wallet until user taps.
star_wallet (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance int NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
)

-- Audit trail. Every star award AND every trade-to-progress writes here.
star_ledger (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delta_stars int NOT NULL,
  reason text NOT NULL CHECK (reason IN (
    'share_facebook','share_instagram','share_tiktok','share_all_three_bonus',
    'daily_streak_14',
    'l1_referral','l2_referral','l1_referral_self_bonus',
    'conversion_to_progress'
  )),
  source_id uuid,            -- nullable; submission_id / invitee_id / checkin_id
  source_type text,          -- 'submission' | 'referral' | 'checkin' | null
  cycle_id uuid,             -- nullable; set on conversion_to_progress rows
  created_at timestamptz NOT NULL DEFAULT now()
)

-- Active Visit 10 cycle per user. Closed on Complete Tasks tap.
visit_progress (
  cycle_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  real_visits int NOT NULL DEFAULT 0 CHECK (real_visits BETWEEN 0 AND 10),
  extras_applied int NOT NULL DEFAULT 0 CHECK (extras_applied BETWEEN 0 AND 4),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
)
CREATE UNIQUE INDEX one_open_cycle_per_user
  ON visit_progress(user_id) WHERE closed_at IS NULL;

-- One row per (submission, platform). Verified shares only.
submission_shares (
  id bigserial PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook','instagram','tiktok')),
  post_url text,
  screenshot_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  ai_review_meta jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, platform)
)

-- One row per (user, KL-day).
daily_checkins (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,    -- in Asia/Kuala_Lumpur
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
)

-- Minted on cycle close. Tier snapshot at mint time.
vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_kind text NOT NULL DEFAULT 'visit',
  tier text NOT NULL CHECK (tier IN ('bronze','silver','gold','platinum')),
  level int CHECK (level BETWEEN 1 AND 3),
  reward_kind text NOT NULL CHECK (reward_kind IN (
    'airbnb_3star','hotel_3_4star','hotel_4_5star','specialty_5star_resort'
  )),
  earned_from_cycle_id uuid REFERENCES visit_progress(cycle_id),
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
)

-- Add streak columns to profiles
ALTER TABLE profiles
  ADD COLUMN current_streak int NOT NULL DEFAULT 0,
  ADD COLUMN last_checkin_at timestamptz;
```

#### 1.2 Badges schema migration (the badge model)

The existing `badges.category` column has enum type `badge_category`, so we can't simply rename. Instead:

```sql
-- Hide legacy seed rows (they stay in user_badges as historical, just don't drive new UI)
UPDATE public.badges SET is_active = false;

-- Add tier + level columns (text CHECK, not enum, for simplicity)
ALTER TABLE public.badges
  ADD COLUMN tier text CHECK (tier IN ('bronze','silver','gold','platinum')),
  ADD COLUMN level int CHECK (level BETWEEN 1 AND 3),
  ADD COLUMN badge_kind text CHECK (badge_kind IN ('visit','cafe','bar','restaurant','hotel'));
-- ('experience' added later when the category lands)
-- (Keep the legacy 'category' column for now — drop in Phase 8 cleanup)

-- Seed 12 Visit Badge rows
INSERT INTO public.badges (name, category, badge_kind, tier, level, required_count, is_active, selfie_url, receipt_url) VALUES
  ('Visit Bronze L1',   'activity', 'visit', 'bronze',   1,   1, true, '', ''),
  ('Visit Bronze L2',   'activity', 'visit', 'bronze',   2,   2, true, '', ''),
  ('Visit Bronze L3',   'activity', 'visit', 'bronze',   3,   3, true, '', ''),
  ('Visit Silver L1',   'activity', 'visit', 'silver',   1,   5, true, '', ''),
  ('Visit Silver L2',   'activity', 'visit', 'silver',   2,   7, true, '', ''),
  ('Visit Silver L3',   'activity', 'visit', 'silver',   3,  10, true, '', ''),
  ('Visit Gold L1',     'activity', 'visit', 'gold',     1,  15, true, '', ''),
  ('Visit Gold L2',     'activity', 'visit', 'gold',     2,  20, true, '', ''),
  ('Visit Gold L3',     'activity', 'visit', 'gold',     3,  27, true, '', ''),
  ('Visit Platinum L1', 'activity', 'visit', 'platinum', 1,  35, true, '', ''),
  ('Visit Platinum L2', 'activity', 'visit', 'platinum', 2,  40, true, '', ''),
  ('Visit Platinum L3', 'activity', 'visit', 'platinum', 3,  45, true, '', '');

-- Seed 48 Category Badge rows (4 categories × 12 tier-level pairs)
-- Thresholds locked 2026-05-04: 5/10/20/30/40/50/60/70/80/90/100/120
-- Loop over cafe / bar / restaurant / hotel (Experience deferred for v1)
-- (full INSERT generated programmatically in the migration file)
```

**Note:** the `selfie_url` / `receipt_url` columns are required-NOT-NULL legacy from the original badges design. We pass empty strings for now; they'll be replaced when real badge art assets land in Phase 7 (we'll repurpose `selfie_url` to point to the badge's hero art, or add a new `art_url` column).

#### 1.3 RLS

- `star_wallet`, `star_ledger`, `visit_progress`, `submission_shares`, `daily_checkins`, `vouchers`: users can `SELECT` their own rows only. **No client `INSERT` / `UPDATE`** — all writes through `SECURITY DEFINER` RPCs or triggers. Admin role can read everything.

#### 1.4 RPCs / helpers

```sql
-- Award stars. Idempotent on (user_id, reason, source_id).
_award_stars(p_user_id, p_delta, p_reason, p_source_id, p_source_type)
  → updates star_wallet.balance
  → inserts star_ledger row

-- Manual trade. Called from client on tap of "Use 100 ★ for +1 Progress" button.
trade_stars_for_progress()  RETURNS jsonb { success, new_balance, new_extras_applied }
  → require auth.uid() user has balance >= 100
  → require active cycle has < 4 extras applied
  → atomic: balance -= 100, cycle.extras_applied += 1, ledger row inserted
  → returns updated state

-- Close cycle. Manual claim.
complete_visit_task()  RETURNS jsonb { cycle_id, leveled_up_badges[] }
  → require real_visits + extras_applied >= 10
  → set closed_at on the active cycle
  → evaluate Visit Badge level crossings; INSERT user_badges rows for any new levels
  → mint_voucher_on_visit_levelup trigger fires per inserted row → vouchers row inserted
  → open new cycle (real_visits=0, extras_applied=0)
  → leave star_wallet untouched
  → cycles between levels close cleanly without minting

-- Add a real visit on submission approval (R/C/B only).
_apply_real_visit(p_user_id)
  → real_visits += 1 on active cycle (cap 10)

-- Daily check-in. Called from client; SECURITY DEFINER inside.
record_daily_checkin()  RETURNS jsonb { streak, awarded_stars }
  → use Asia/Kuala_Lumpur to compute today
  → unique constraint blocks double-tap
  → if last_checkin = yesterday: streak += 1, else streak = 1
  → if streak % 14 == 0: _award_stars(user, 50, 'daily_streak_14', checkin_id, 'checkin')
```

#### 1.5 Triggers

- `on_submission_approved`: when `submissions.status` flips to `approved` and category ∈ {restaurant, cafe, bar}, call `_apply_real_visit`. Hotel approvals do **not** call this. Also evaluate Category Badge threshold crossings for ALL four categories (R/C/B/Hotel) and insert any new `user_badges` rows.
- `on_submission_share_verified`: when `submission_shares.status` flips to `verified`, call `_award_stars` with platform's star value. After write, check if all 3 platforms exist for that submission_id and (if so) award the +5 bonus once.
- `on_invitee_first_approval`: replaces old credit-award logic. Awards `+100` self-bonus to invitee, `+100` to L1 inviter, `+50` to L2 affiliate (if any).
- `on_cycle_closed`: when `visit_progress.closed_at` is set, evaluate Visit Badge tier crossing and insert any new `user_badges` rows.

### Acceptance criteria

- All 6 new tables exist with correct constraints.
- RLS policies prevent cross-user reads.
- Star ledger is append-only (no `UPDATE` policy).
- `complete_visit_task` closes the cycle, fires Visit Badge level evaluation, and re-opens a new cycle. Voucher mint happens via `mint_voucher_on_visit_levelup` trigger on each new `user_badges` insert (so 0 or 1 voucher per cycle close, depending on whether a level was crossed).
- `trade_stars_for_progress` is atomic — no race condition between balance check and update.
- 12 Visit Badge + 48 Category Badge rows seeded in `badges` table.

### Rollback

- All new tables behind `IF NOT EXISTS`. Drop in reverse-dependency order if needed.
- Triggers wrapped in `CREATE OR REPLACE` — revert by re-deploying previous bodies.
- `badges` table column rename can be reversed if needed.

### Risks

- **TZ correctness** for `daily_checkins.checkin_date`. Use `(now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date` everywhere, never `current_date`.
- **Race in trade flow** — two concurrent taps. Mitigate with row-level lock on `star_wallet` inside `trade_stars_for_progress`.

---

## Phase 2 — Visit 10 progress UI redesign + manual trade button

**Goal:** replace the per-category progress cards with the new single Visit 10 card. Manual claim button. Manual trade button.

### Files affected

- `components/verified-member/my-tasks/index.tsx`
- `components/verified-member/my-tasks/visit-progress-card.tsx` (new)
- `components/verified-member/my-tasks/star-trade-button.tsx` (new)
- `hooks/useVisitProgress.ts` (new — replaces parts of `useTasks`)
- `hooks/useStarWallet.ts` (new)
- `app/tasks/index.tsx` — wire the new card

### Steps

#### 2.1 Hooks

```ts
useVisitProgress() → {
  cycle: { real_visits, extras_applied, total: real_visits + extras_applied },
  isClaimable: boolean,             // total >= 10
  claim: () => Promise<voucherId>,
  isLoading, error
}

useStarWallet() → {
  balance: number,
  canTrade: boolean,                // balance >= 100 AND cycle has < 4 extras
  trade: () => Promise<{ new_balance, new_extras_applied }>,
  isLoading, error
}
```

Subscribes to `visit_progress` and `star_wallet` row changes via Supabase Realtime so the card hot-updates.

#### 2.2 Card UI

Per [`designs/01-tasks-my-task.html`](designs/01-tasks-my-task.html):

- Centered "6" with "+2 ★" pill on right (uses invisible spacer trick to keep "6" at true center)
- Header: "Submit 10 Proof of Travels"
- Label: "Main Tasks"
- Progress bar: tick scale `0, 2, 4, 6, 8, 10`, extras zone tinted amber
- **"Use 100 ★ for +1 Progress"** button — enabled when `canTrade`
- Wallet status line below button: `120 ★ in wallet · 2 of 4 extras used this cycle`
- "Complete Tasks & Claim" primary button replaces trade button when `isClaimable` (per [`designs/01-B-tasks-claimable.html`](designs/01-B-tasks-claimable.html))

> **Implementation note:** the design files use the page title "Challenges" in the top header. **Ignore that label** — implement the tab as **"Tasks"** to match the actual app navigation. Only the page-title text changes; everything else (layout, colors, components, spacing) follows the design exactly.

#### 2.3 Star wallet pill in Tasks tab header

The page header on Tasks (UI label "Challenges", route `/(tabs)/tasks/`) shows a star wallet pill in the top-right (e.g. `60 ★`). Wire to `star_wallet.balance`.

- Lives **only on the Tasks tab**, not on Home / Map / Store / Profile.
- Realtime subscription to `star_wallet` row updates so the pill increments live as stars are awarded.
- Tap behavior: optional — could deep-link to the Rewards subtab or a wallet-detail modal. Phase 2 ships read-only.

#### 2.3 Claim flow

Tap → call `complete_visit_task` RPC → cycle resets to `0 / 10` → if the close crossed a Visit Badge level, success modal *"Voucher unlocked — view in Rewards"* + tier badge toast; otherwise just *"Cycle complete — keep going!"* with no voucher claim.

### Acceptance criteria

- Visit 10 card renders correct state for: 0/10, mid-cycle, claimable.
- Trade button enabled iff wallet ≥ 100 AND extras < 4.
- "Complete Tasks" button is disabled until `total >= 10`.
- Tapping Complete Tasks closes the cycle and mints a voucher only when a Visit Badge level threshold is crossed (12 lifetime moments per user); cycles between levels close cleanly without minting.
- Realtime: a manually-inserted approved submission for the test user updates the card within 2 seconds.

---

## Phase 3 — Referral re-wiring (smallest star source)

**Goal:** swap existing credit-award logic for star awards. Validates the wallet end-to-end.

### Files affected

- `supabase/migrations/{ts}_referral_to_stars.sql` (new)
- `hooks/useReferrals.ts` — surface qualification state and recent star awards
- `components/invite-friends/referrals.tsx` — three-state dot rendering

### Steps

#### 3.1 Trigger swap

Replace existing `on_invitee_first_approval` body:

- Remove credit-ledger inserts and the half-credit accumulator logic.
- Insert via `_award_stars`:
  - `+100` to invitee (`l1_referral_self_bonus`)
  - `+100` to direct inviter (`l1_referral`) if `inviter_id` exists
  - `+50` to grandparent inviter (`l2_referral`) if exists

#### 3.2 Frontend

- Render the three dot states (Registered only / Verified / Active) per [`../documentation/referral-system.md`](../documentation/referral-system.md) §1.
- On qualification, show a toast: *"+100 ★ from {invitee_name}"*.
- Hide names until invitee reaches at least Verified state.

### Acceptance criteria

- A test invitee reaching `submissions.status='approved'` for the first time:
  - Awards 100 stars to invitee, 100 to L1 inviter, 50 to L2 affiliate.
  - All three writes show on respective `star_ledger` rows.
- A second approved submission from the same invitee does **not** re-fire awards.
- Referrals UI shows correct dot color per state.

---

## Phase 4 — Daily Log-In Streak

**Goal:** ship the second star source. Simple v1 — just check-in button.

### Files affected

- `app/(tabs)/tasks/rewards.tsx` (or `bonus-tasks.tsx`)
- `components/bonus-tasks/daily-checkin-tile.tsx` (new)
- `components/bonus-tasks/streak-detail.tsx` (new — 14-day grid)
- `hooks/useDailyCheckin.ts` (new)
- `supabase/migrations/{ts}_record_daily_checkin_rpc.sql` (new — RPC body finalized)

### Steps

#### 4.1 Hook + RPC

```ts
useDailyCheckin() → {
  currentStreak, lastCheckinDate, canCheckinToday, nextMilestoneAt,
  checkin: () => Promise<{ streak, awardedStars }>
}
```

`canCheckinToday` derived from comparing `last_checkin_at` to `(now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date`.

#### 4.2 UI

Tile on Rewards tab — small surface showing current streak count + "Check in today" CTA when eligible.

Tap tile → expanded streak detail screen (per [`designs/02-daily-streak.html`](designs/02-daily-streak.html)):

- Streak hero: *"4-day streak"* with flame iconography
- 14-day grid: past days checked, today highlighted, future days greyed
- Next milestone reward card: **+50 ★ at day 14**
- Primary "Check In Now" button when eligible

#### 4.3 Streak reset semantics

- Last check-in date < (today - 1 day in KL) → reset streak to 0 on next check-in (which becomes day 1).
- No grace period.
- Recurring: hitting day 14 awards 50 stars and the counter rolls forward.

#### 4.4 Eligibility

Open to **all verified members** from day 1. No approved-submission pre-requirement (locked Kasey 2026-05-04).

### Acceptance criteria

- Two consecutive day-boundary crossings (mocked clock) increment streak from 1 → 2.
- A 13-day streak followed by a check-in awards `+50 ★` in `star_ledger`, with `reason='daily_streak_14'`.
- Day 15 check-in starts the next 14-day window.
- Double-tapping check-in within the same KL day produces a no-op (UNIQUE constraint).

### Phase 4.5 (deferred — pairs with blog section build)

- Foreground time tracking via `AppState` listeners.
- Streak day only counts if session ≥ 1 minute OR opened a blog/video during the session.
- Requires the blog section to exist first (separate project).

---

## Phase 5 — Social Media Share + AI verification

**Goal:** highest-value, highest-risk star source. Requires AI verification path.

### Files affected

- `components/submission/share-earn-card.tsx` (new)
- `app/submission/[id]/share.tsx` (new — full share-earn screen)
- `hooks/useSubmissionShare.ts` (new)
- `supabase/functions/verify-share/index.ts` (new edge function)
- `supabase/migrations/{ts}_share_verification_trigger.sql` (new)

### Steps

#### 5.1 Submit Proof tab integration

After a user's submission is approved:
- Submission detail screen shows a "Share & earn" card with 3 platforms + per-platform `+15 ★` chips and the *"+5 ★ if you share all three"* line.
- Card surfaces on the Submit Proof tab while any approved submission has unfilled platforms.

#### 5.2 Share screen UI

Build from [`designs/03-share-earn-v2.html`](designs/03-share-earn-v2.html):
- Hero: "+50 stars max" (no RM 5 line)
- Wegood4u green/white palette
- Hashtag pills (placeholder list — final from Kasey)
- Paste-URL input + Screenshot upload (S3 presigned URL flow per [`../documentation/architecture-brief.md`](../documentation/architecture-brief.md))

#### 5.3 Edge function `verify-share`

```
1. Insert submission_shares row with status='pending'.
2. If post_url: fetch metadata (oEmbed where available, scrape fallback);
   check hashtag presence + mention presence in caption.
3. If screenshot: download, compute pHash, run hashtag/mention OCR via the
   same AI pipeline used by submission-review-ai.md.
4. Dedup: reject if URL or pHash already verified for any user.
5. On pass → status='verified', verified_at=now(), trigger fires _award_stars.
6. On fail → status='rejected', return reason for UI display + manual review queue.
```

#### 5.4 Manual review queue (admin)

Failed verifications surface in an admin queue. Admin can override status='verified' which fires the same trigger.

### Acceptance criteria

- Sharing a single platform on an approved submission credits 15 stars within 30 seconds.
- Sharing all 3 platforms on the same submission credits 50 stars total.
- Re-using a post URL across two users → second attempt rejected.
- Hotel-submission shares credit stars and feed the R/C/B Visit 10 cycle.
- Manual review override correctly fires the award trigger.

### Risks

- **Hashtag scraping on TikTok/IG** is brittle. Plan a 30-day failure-rate dashboard from day 1; if auto-verify drops below 70%, fall back to manual-review-default.
- **Cost.** Each verification ≈ submission review cost. Track per-day invocations; alert if 10× expected volume.

---

## Phase 6 — History feed + Notifications expansion

**Goal:** make new events visible in History.

### Files affected

- `supabase/migrations/{ts}_user_activity_v2.sql` (new — adds new event types)
- `hooks/useActivity.ts` — render new event-type rows
- `components/history/row.tsx` — new pill kinds
- `app/profile/notifications.tsx` — new icon mapping

### Steps

#### 6.1 RPC migration

Extend `get_user_activity` to UNION ALL the new sources:

- `submission_shares` where `status='verified'` → `share_verified` rows (one per platform + a synthetic row for all-three bonus when applicable)
- `daily_checkins` aggregated to `daily_streak_milestone` (one row per 14-day boundary, `+50 ★`)
- `star_ledger` filtered to `reason IN ('l1_referral','l2_referral','l1_referral_self_bonus')` → `referral_qualified` rows
- `star_ledger` filtered to `reason='conversion_to_progress'` → `stars_converted` rows
- `visit_progress` where `closed_at IS NOT NULL` → rename `task_completed` to `cycle_completed`
- Split `badge_earned` by `badge_kind`: `visit_badge_earned` vs `category_badge_earned`
- `vouchers` where `redeemed_at IS NOT NULL` → `voucher_redemption_requested` rows (admin fulfillment is out-of-band; History shows the user request only)

#### 6.2 Frontend rendering

Add row components for each new event type. Star pill uses Lucide `Star` (until custom asset arrives) + warm-amber background.

#### 6.3 Notifications

In-app DB notification writes for each new event type via lightweight triggers on the same source tables. Push delivery (Expo) is **deferred** — currently not implemented per [`../documentation/notifications.md`](../documentation/notifications.md) "Gaps."

### Acceptance criteria

- All 9 event types render correctly in History with the right pill, target text, and ordering.
- Pagination still returns correct `total_count`.
- Notifications screen shows correct icon + title for each new action.

---

## Phase 7 — Badges page UI (Visit Badge + 4 Category Badges)

**Goal:** new dedicated Badges page showing all 5 progressions.

### Files affected

- `app/badges/index.tsx` (new — replaces legacy badges page)
- `components/badges/badge-tile.tsx` (new — one tile per badge)
- `components/badges/badge-art.tsx` (new — composite tier+level art per Strategy C)
- `components/profile/profile-frame.tsx` (new — wraps avatar with tier-frame asset)
- `hooks/useBadges.ts` (new)

### Steps

- 5 badge tiles, each showing:
  - Composite art (category logo + tier-level overlay) for Category Badges; Visit Badge uses dedicated 12-piece set
  - Current tier + level (e.g. "Cafe Badge — Silver L1")
  - Progress to next level (e.g. "12 / 30 visits to Bronze L2")
  - Progression-only on Category Badge tiles (no reward callout — see Kasey 2026-05-07 lock)
- Profile picture frame component composites the avatar inside the tier frame from [`assets/images/tier_frame/`](../../assets/images/tier_frame/) — applies anywhere the avatar renders (header, profile, comment threads, referral list rows).
- Reference design: **not yet produced** — implement based on the spec in [`../documentation/badges.md`](../documentation/badges.md) "Visit Badge" + "Category Badges" sections. Use the same Wegood4u green/white palette, page-header pattern, and tile layout as the other design files.
- Verify all asset files are uploaded to the `badges` bucket; flag missing assets at build time.

### Asset state (audited 2026-05-08)

| Asset | Status |
|---|---|
| `stars.svg` | ✅ Received at [assets/icons/star.svg](../../assets/icons/star.svg) — true vector, transparent. One tweak pending: swap hardcoded `fill="#F2C540"` → `fill="currentColor"` for runtime tinting. |
| **Visit Badge art (16 files, ~460 KB)** | ✅ Received at [`assets/images/visit rank/`](../../assets/images/visit%20rank/) — bundled in app. |
| **Voucher art (4 files, ~80 KB)** | ✅ Received at [`assets/images/voucher/`](../../assets/images/voucher/) — bundled in app. |
| Profile frames (4 files, ~112 KB) | ✅ Received at [`assets/images/tier_frame/`](../../assets/images/tier_frame/) — bundled in app. |
| Category Badge art (16 files via Strategy C) | ⚠️ Pending — Phase 7 ships with placeholder gradients if delayed |

All bundled — see "Asset strategy" section above.

### Voucher minting + redemption (revised 2026-05-10)

> *"As of now, we will issue voucher on our own. When press redeem voucher, we will rewards manually 1st. If future will be Auto."* — Kasey, 2026-05-07
> *"vouchers redeem amount will only increase based ONLY visit badges rank and level"* — wegood4u, 2026-05-10

**Mint trigger** — `mint_voucher_on_visit_levelup` on `user_badges` insert filtered to `badge_kind='visit'`. Each Visit Badge level entered (Bronze L1 → Platinum L3) mints exactly one voucher of that level's tier. **12 lifetime per user max** (3 of each tier). Cycles between levels close cleanly without minting.

**Rewards subtab UI** — fixed catalog of 4 voucher tier cards (Bronze / Silver / Gold / Platinum), always visible using bundled art from `assets/images/voucher/`. Each card has a Redeem button:
- Disabled (grey) when count of unredeemed of that tier = 0
- Enabled (green) labeled **"Redeem ×N"** when N ≥ 1

**User-facing flow:**
1. User taps **Redeem** on an enabled card.
2. Confirmation modal: *"Request your {tier} voucher? Our team will reach out via WhatsApp to issue it."*
3. User confirms → `vouchers.redeemed_at` set on the **oldest unredeemed of that tier** (FIFO) → admin notification fires.
4. Admin sees the request in the **Tasks → Redeem Req tab** (sibling to Submission). Each row shows user, tier, requested time. Admin contacts user via WhatsApp, then taps **Mark fulfilled** → `vouchers.fulfilled_at` set.

Notes:
- Voucher tier is locked at mint to the level entered, not the user's current Visit Badge tier.
- Users can stack multiple vouchers of the same tier; "Redeem ×N" reflects the count.
- No "Coming soon" wording — Kasey explicitly: *"We no need put future or coming soon ya."*
- No hotel selection screen in v1 — admin handles hotel matching out-of-band. v2 adds hotel options once partnerships are signed.

### Parked: voucher rewards from Category Badges

User briefly considered minting on Category Badge level-ups too (max 60 lifetime per user); reverted 2026-05-10 because volume felt overwhelming. Schema already supports it — only the trigger filter would change. Revisit if Kasey approves.

### Hotel category — partner stores deferred

Hotel Badge exists in the badge model but Hotel partner stores are not listed in v1 (no signed hotel partnerships yet).

> *"we only list the hotel submission when we got partnership. We just can left it there. Just without any hotel selection."* — Kasey, 2026-05-07

Effect: Hotel Badge tile appears on the Badges page but stays at 0 progress for everyone in v1 (no Hotel submissions possible without partner stores). When partnerships are signed, Hotel listings are enabled and progress begins flowing.

### Acceptance criteria

- Visit Badge tile renders correct tier+level for cycles completed.
- Each Category Badge tile renders correct tier+level based on real approved submissions in that category.
- Category Badge tiles show progression (current tier+level + threshold to next) — no reward callout, no "Coming soon" wording.
- Visit Badge tile uses placeholder gradient art if real Visit Badge art not in `badges` bucket — no broken images.
- Profile picture frame swaps automatically when Visit Badge tier crosses (Bronze → Silver, Silver → Gold, etc.).
- Voucher card Redeem button: disabled grey at 0; enabled green with "Redeem ×N" when N ≥ 1; tap → confirm modal → oldest unredeemed of that tier has `redeemed_at` set + admin notification fires.
- Admin **Tasks → Redeem Req tab** shows pending rows (`redeemed_at IS NOT NULL AND fulfilled_at IS NULL`); Mark fulfilled flips `vouchers.fulfilled_at`.
- Visit Badge level-up trigger mints one voucher per level entered; 12 lifetime cap per user.

---

## Phase 8 — Polish, monitoring, launch

### Steps

| # | Task |
|---|---|
| 8.1 | Telemetry dashboard: cycles closed/day, stars awarded by source, trades per cycle, claim-vs-claimable lag |
| 8.2 | Auto-verify success rate alert for shares (drop below 70% in any 7-day window) |
| 8.3 | Soft launch: feature flag on for 5% of users for 1 week; watch error rate and support tickets |
| 8.4 | Full rollout: flag default-on |
| 8.5 | Update [`../documentation/app-project-overview.md`](../documentation/app-project-overview.md) §2.3 to remove "not yet implemented" |
| 8.6 | Delete legacy `BADGE_REQUIREMENTS` constants and per-category UI in [`config/badges.ts`](../../config/badges.ts) once Phase 2 + 7 are confirmed live |

---

## Cross-cutting considerations

### Idempotency

Every star-award path is keyed by `(user_id, reason, source_id)`. Re-running a trigger or replaying a webhook must not double-award. Enforce with `INSERT ... ON CONFLICT DO NOTHING` on a unique partial index where applicable.

### Concurrency

`star_wallet` is updated under row-level lock inside `_award_stars` and `trade_stars_for_progress`. Multiple parallel calls for the same user serialize. Add an integration test that fires 10 simultaneous awards and verifies the final balance is exactly 10× the per-award value.

### No claw-back logic needed

Approvals are final ([`../documentation/credits-overview.md`](../documentation/credits-overview.md) §"Approvals are final"). Skip the entire claw-back / rollback design layer — it doesn't exist. If a fake approval slips through, the awarded stars / progress / vouchers stay.

### Realtime

Supabase Realtime subscriptions on `visit_progress`, `star_wallet`, and `submission_shares` keep the UI in sync without polling.

### Cost guardrails

- AI share verification: log per-day cost. Hard cap with a feature flag if cost exceeds 2× projection.
- S3 egress for share screenshots: same `architecture-brief.md` rules — no auto-load in lists, presigned-URL on demand only.

### Test data strategy

Seed a `staging-users` set with: 1 user mid-cycle (5/10 with no extras), 1 user at 9/10, 1 user with 4 extras applied, 1 user with 80 stars in wallet, 1 user with a closed cycle and a claimable voucher, 1 user with various Category Badges earned.

---

## Open questions tracker

| # | Question | Owner | Blocks phase |
|---|---|---|---|
| 1 | Final hashtag list | Kasey | 5 |
| 2 | ~~Custom stars.svg vector source~~ — **received 2026-05-06** | — | resolved |
| 3 | Visit Badge art (12 pieces) | Kasey's team | 7 polish only — placeholder gradients ship if delayed |
| 4 | ~~Per-category tier overlay art~~ — **received 2026-05-06** (transparency redo pending team response) | Kasey's team | 7 polish only |
| 5 | Category Badge rewards | Kasey + vendors | future phase |
| 6 | Voucher inventory sourcing | Kasey + vendors | redemption phase (out of v1) |
| 7 | Hotel "bigger claims" reward path | Kasey | future phase |
| 8 | ~~Badge model walkthrough~~ — **resolved 2026-05-06** | vannesss + Kasey | model locked: 5 badges, no backfill anywhere |

All schema and core UI work can proceed without these — they're all materials/polish blockers, not logic blockers.

---

## Phase order + sequencing chart

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6 ──► Phase 7 ──► Phase 8
   │           │           │           │           │           │           │           │
   └ resolved  └ schema    └ Visit 10  └ Referral  └ Daily     └ Share +   └ History   └ 5 badges
                 + RPCs      card UI     re-wire     streak       AI verify   + push      page
                                         to stars    (simple)
```

Phases 3, 4, 5 are independent of each other once Phase 1 lands and can run in parallel if dev capacity allows. Phase 6 needs at least one of {3, 4, 5} live. Phase 7 is independent and can slot in any time after Phase 1.
