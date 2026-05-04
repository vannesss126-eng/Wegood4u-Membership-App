# Wegood4u — Stars + Visit 10 Development Plan

> Phase-by-phase rollout of the locked stars + cumulative Visit 10 cycle model with 6 ranks.
> Source-of-truth specs in [`../documentation/credits-overview.md`](../documentation/credits-overview.md), [`../documentation/extra-tasks.md`](../documentation/extra-tasks.md), [`../documentation/badges.md`](../documentation/badges.md), [`../documentation/badge-rewards.md`](../documentation/badge-rewards.md), [`../documentation/referral-system.md`](../documentation/referral-system.md), [`../documentation/history-feed.md`](../documentation/history-feed.md), [`../documentation/notifications.md`](../documentation/notifications.md).
> Latest re-lock: 2026-05-04.

---

## Sequencing principles

1. **Database first.** Everything else depends on the new schema. Get migrations + RLS + triggers in before any UI changes.
2. **Lowest-risk validation first.** Re-wire referrals before building daily streak / share, because referrals already have qualification logic — the swap from credit-awards to star-awards is the smallest delta and validates the star wallet end-to-end.
3. **External dependencies last.** AI share verification has the most external risk (model behavior, hashtag list, manual review fallback). Ship it after the wallet is proven.
4. **Each phase is independently shippable** to staging behind a feature flag (`feature_stars_v1`). Production rollout per-phase, not a single big-bang merge.
5. **No backfill on launch (locked 2026-05-04):** verified members start at Visit 10 = 0/10. Existing approved submissions DO carry into per-category rank counters (those are cumulative all-time, not cyclical).

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
| 0.5 | Backfill rule | **Locked 2026-05-04** — no backfill on Visit 10. Per-category ranks count existing approvals |
| 0.6 | Claw-back policy | **Locked 2026-05-04** — N/A. Approvals are final, can't be reverted. Removes a whole class of edge cases. |
| 0.7 | Manual trade vs auto-convert | **Locked** — manual. User taps "Use 100 ★ for +1 Progress" |
| 0.8 | Star icon | **Lucide `Star` for v1**; custom asset pending Kasey's team |
| 0.9 | Voucher reward kinds | **Locked 2026-05-04** — see Phase 8 voucher table |
| 0.10 | Final hashtag list for share verification | **Pending Kasey** ("I send you the hashtag later") |
| 0.11 | Per-category rank rewards | **Pending vendor sponsorship** — UI ships in v1 with "Coming soon" hint |
| 0.12 | Voucher inventory sourcing | **Pending** — honor-system codes for v1 demo, real partner integration later |
| 0.13 | `feature_stars_v1` flag | **Pending dev** — scaffold in env / config |

### Exit criteria

- Phase 0 is **substantially complete**. Outstanding blockers are all "wait on materials" (hashtag list, custom badge art) — they don't block schema/UI work.

---

## Materials needed from Kasey's team

### Critical (blocks Phase 7 polish)

**1. `stars.svg` rework**
- Format: True vector SVG (single `<path>` or `<polygon>`, NOT base64-embedded PNG)
- Color: Use `currentColor` so we tint at runtime
- No fixed `width`/`height` on root `<svg>`
- Render sizes in app: 12 px (history pill) up to 120 px (hero)
- File size goal: ≤ 5 KB
- Filename: `stars.svg` → drop into [`assets/images/`](../../assets/images/)

**2. User Visit Rank badge art — 12 unique pieces**
- 4 tiers × 3 levels: `bronze_1, bronze_2, ..., platinum_3`
- Format: WebP (preferred) or PNG with transparency
- Source size: 360 × 360 px
- Style: match the existing 3D illustrated style (current "Platinum L1" art)
- Naming: `visit_{tier}_{level}.webp`

**3. Per-category rank badge art — Strategy C (composite, recommended)**
- 5 category logos (Cafe / Bar / Restaurant / Hotel / Experience): `category_{name}.webp` at 360 × 360 px
- 12 tier-level overlays (transparent PNG/WebP): `tier_overlay_{tier}_{level}.webp` at 360 × 360 px
- Total: 17 assets vs 60 if going full unique. Rendered as composite at runtime.

### Nice to have (Lucide placeholders work for v1)

**4. Hashtag list** for share verification — plain text, replaces the 4 placeholders.

**5. Tile / nav icons** — currently using Lucide. Brand-styled set optional.

### TBD (out of v1 scope)

**6. Voucher partner integration** — sourcing TBD. Honor-system codes for demo.

---

## Phase 1 — Database foundation

**Goal:** lay the schema for everything else. No UI changes, no user-visible behavior yet.

### Files affected

- `supabase/migrations/{ts}_stars_v1_schema.sql` (new)
- `supabase/migrations/{ts}_stars_v1_rls.sql` (new)
- `supabase/migrations/{ts}_stars_v1_triggers.sql` (new)
- `supabase/migrations/{ts}_ranks_seed.sql` (new — seed Visit Rank + per-category rank rows)
- `types/database.ts` (regenerate from `supabase gen types`)

### Steps

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
  rank_kind text NOT NULL DEFAULT 'visit',
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

#### 1.2 Badges schema migration (the rank model)

```sql
-- Rename category column → rank_kind (semantics shift), add tier + level
ALTER TABLE badges
  RENAME COLUMN category TO rank_kind;
ALTER TABLE badges
  ADD COLUMN tier text CHECK (tier IN ('bronze','silver','gold','platinum')),
  ADD COLUMN level int CHECK (level BETWEEN 1 AND 3);

-- Update enum to use 'visit' instead of legacy 'activity'
-- (and ensure cafe / bar / restaurant / hotel / experience all valid)

-- Seed 12 Visit Rank rows
INSERT INTO badges (name, rank_kind, tier, level, required_count, is_active) VALUES
  ('Visit Bronze L1',   'visit', 'bronze',   1,   1, true),
  ('Visit Bronze L2',   'visit', 'bronze',   2,   2, true),
  ('Visit Bronze L3',   'visit', 'bronze',   3,   3, true),
  ('Visit Silver L1',   'visit', 'silver',   1,   5, true),
  ('Visit Silver L2',   'visit', 'silver',   2,   7, true),
  ('Visit Silver L3',   'visit', 'silver',   3,  10, true),
  ('Visit Gold L1',     'visit', 'gold',     1,  15, true),
  ('Visit Gold L2',     'visit', 'gold',     2,  20, true),
  ('Visit Gold L3',     'visit', 'gold',     3,  27, true),
  ('Visit Platinum L1', 'visit', 'platinum', 1,  35, true),
  ('Visit Platinum L2', 'visit', 'platinum', 2,  40, true),
  ('Visit Platinum L3', 'visit', 'platinum', 3,  45, true);

-- Seed 60 per-category rank rows (5 categories × 12 tier-level pairs)
-- Using thresholds 5,10,20,30,40,50,60,70,80,90,100,120
-- (loop over cafe / bar / restaurant / hotel / experience)
```

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
complete_visit_task()  RETURNS uuid (voucher_id)
  → require real_visits + extras_applied >= 10
  → mint voucher at user's current Visit Rank tier (snapshot)
  → set closed_at, evaluate Visit Rank tier crossing
  → open new cycle (real_visits=0, extras_applied=0)
  → leave star_wallet untouched

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

- `on_submission_approved`: when `submissions.status` flips to `approved` and category ∈ {restaurant, cafe, bar}, call `_apply_real_visit`. Hotel approvals do **not** call this. Also evaluate per-category rank threshold crossings for ALL categories (including Hotel + Experience) and insert any new `user_badges` rows.
- `on_submission_share_verified`: when `submission_shares.status` flips to `verified`, call `_award_stars` with platform's star value. After write, check if all 3 platforms exist for that submission_id and (if so) award the +5 bonus once.
- `on_invitee_first_approval`: replaces old credit-award logic. Awards `+100` self-bonus to invitee, `+100` to L1 inviter, `+50` to L2 affiliate (if any).
- `on_cycle_closed`: when `visit_progress.closed_at` is set, evaluate Visit Rank tier crossing and insert any new `user_badges` rows.

### Acceptance criteria

- All 6 new tables exist with correct constraints.
- RLS policies prevent cross-user reads.
- Star ledger is append-only (no `UPDATE` policy).
- `complete_visit_task` mints exactly one voucher and re-opens the cycle.
- `trade_stars_for_progress` is atomic — no race condition between balance check and update.
- 12 Visit Rank + 60 per-category rank rows seeded in `badges` table.

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

#### 2.3 Claim flow

Tap → call `complete_visit_task` RPC → success modal: *"Voucher unlocked — view in Rewards"* → cycle resets to `0 / 10` → tier badge re-evaluation toast if a threshold crossed.

### Acceptance criteria

- Visit 10 card renders correct state for: 0/10, mid-cycle, claimable.
- Trade button enabled iff wallet ≥ 100 AND extras < 4.
- "Complete Tasks" button is disabled until `total >= 10`.
- Tapping Complete Tasks mints exactly one voucher.
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
- Split `badge_earned` by `rank_kind`: `visit_rank_earned` vs `category_rank_earned`

#### 6.2 Frontend rendering

Add row components for each new event type. Star pill uses Lucide `Star` (until custom asset arrives) + warm-amber background.

#### 6.3 Notifications

In-app DB notification writes for each new event type via lightweight triggers on the same source tables. Push delivery (Expo) is **deferred** — currently not implemented per [`../documentation/notifications.md`](../documentation/notifications.md) "Gaps."

### Acceptance criteria

- All 9 event types render correctly in History with the right pill, target text, and ordering.
- Pagination still returns correct `total_count`.
- Notifications screen shows correct icon + title for each new action.

---

## Phase 7 — Ranks page UI (Visit Rank + 5 category ranks)

**Goal:** new dedicated Ranks page showing all 6 progressions.

### Files affected

- `app/ranks/index.tsx` (new — replaces legacy badges page)
- `components/ranks/rank-tile.tsx` (new — one tile per rank)
- `components/ranks/rank-art.tsx` (new — composite tier+level art per Strategy C)
- `hooks/useRanks.ts` (new)

### Steps

- 6 rank tiles, each showing:
  - Composite art (category logo + tier-level overlay) for category ranks; Visit Rank uses dedicated 12-piece set
  - Current tier + level (e.g. "Cafe Rank — Silver L1")
  - Progress to next level (e.g. "12 / 30 visits to Bronze L2")
  - "Coming soon" hint on rewards for category ranks
- Reference design: [`designs/05-ranks.html`](designs/05-ranks.html) (to be created)
- Verify all asset files are uploaded to the `badges` bucket; flag missing assets at build time.

### Acceptance criteria

- Visit Rank tile renders correct tier+level for cycles completed.
- Each category rank tile renders correct tier+level based on real approved submissions in that category.
- Per-category rank rewards show "Coming soon" tag.

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

Seed a `staging-users` set with: 1 user mid-cycle (5/10 with no extras), 1 user at 9/10, 1 user with 4 extras applied, 1 user with 80 stars in wallet, 1 user with a closed cycle and a claimable voucher, 1 user with various per-category ranks.

---

## Open questions tracker

| # | Question | Owner | Blocks phase |
|---|---|---|---|
| 1 | Final hashtag list | Kasey | 5 |
| 2 | Custom stars.svg vector source | Kasey's team | UI polish (not blocking) |
| 3 | User Visit Rank badge art (12 pieces) | Kasey's team | 7 polish |
| 4 | Per-category rank art assets (Strategy C) | Kasey's team | 7 polish |
| 5 | Per-category rank rewards | Kasey + vendors | future phase |
| 6 | Voucher inventory sourcing | Kasey + vendors | redemption phase |
| 7 | Hotel "bigger claims" reward path | Kasey | future phase |

All schema and core UI work can proceed without these — they're all materials/polish blockers, not logic blockers.

---

## Phase order + sequencing chart

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6 ──► Phase 7 ──► Phase 8
   │           │           │           │           │           │           │           │
   └ resolved  └ schema    └ Visit 10  └ Referral  └ Daily     └ Share +   └ History   └ 6 ranks
                 + RPCs      card UI     re-wire     streak       AI verify   + push      page
                                         to stars    (simple)
```

Phases 3, 4, 5 are independent of each other once Phase 1 lands and can run in parallel if dev capacity allows. Phase 6 needs at least one of {3, 4, 5} live. Phase 7 is independent and can slot in any time after Phase 1.
