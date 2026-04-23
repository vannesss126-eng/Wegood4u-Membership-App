# Badges (current implementation)

> What the **code actually does today**. The target model lives in [`credits-overview.md`](credits-overview.md) and [`badge-rewards.md`](badge-rewards.md) — both locked as of 2026-04-23 but **not yet implemented**. Until the migration to the credits/task model lands, this doc is the source of truth for actual runtime behaviour.

---

## What this covers

The badge tier/rank system that awards users for accumulating approved submissions per category. Counts come from the `submissions` table; awards land in `user_badges` via a Postgres trigger. The UI shows 12 badges per category (4 tiers × 3 ranks).

This doc deliberately documents the **current** implementation. Key gaps vs the target model:
- **Bar and Hotel badges can never be earned** with today's schema (fix scoped — see "Issues" below).
- Current trigger counts raw approved submissions. Target model counts completed tasks (10 credits per cycle) across R/C/B, with Hotel shown on My Tasks as a visibility counter only.
- Current thresholds are 5 → 120 submissions per category. Target thresholds are 5 / 15 / 35 cumulative tasks across R/C/B for Silver / Gold / Platinum (Bronze default).

---

## Data model

### `badges` table — [migration:401-411](supabase/migrations/20260417151509_remote_schema.sql#L401-L411)

| Column | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `name` | text | Human-readable name |
| `category` | enum `badge_category` | `'activity'`, `'cafe'`, `'restaurant'` (only 3 — see issue below) |
| `required_count` | int | Threshold of approvals to unlock |
| `selfie_url`, `receipt_url` | text | (purpose unclear — likely sample images) |
| `description` | text? | |
| `is_active` | bool | Default `true` |
| `created_at` | timestamptz | |

### `user_badges` table — [migration:708-712](supabase/migrations/20260417151509_remote_schema.sql#L708-L712)

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | FK → `profiles.id` (CASCADE) |
| `badge_id` | int | FK → `badges.id` (CASCADE) |
| `earned_at` | timestamptz | Default `now()` |

PK is the composite `(user_id, badge_id)` — duplicate awards are impossible.

### RLS
- Authenticated users can read `badges` ([migration:1085](supabase/migrations/20260417151509_remote_schema.sql#L1085)).
- Users can read their own `user_badges` ([migration:1165](supabase/migrations/20260417151509_remote_schema.sql#L1165)).
- System inserts into `user_badges` ([migration:1157](supabase/migrations/20260417151509_remote_schema.sql#L1157)).

---

## Badge config — [config/badges.ts](config/badges.ts)

### Categories ([badges.ts:17-18](config/badges.ts#L17-L18))
```
['Bar', 'Cafe', 'Restaurant', 'Hotel']
```
Display names ([badges.ts:48-53](config/badges.ts#L48-L53)):

| Category | Display | Color |
|---|---|---|
| Bar | Bar Explorer | `#8B5CF6` purple |
| Cafe | Coffee Lover | `#F59E0B` amber |
| Restaurant | Foodie | `#EF4444` red |
| Hotel | Hotel Explorer | `#3B82F6` blue |

### Tiers × Ranks × Thresholds ([badges.ts:21-34](config/badges.ts#L21-L34))

| Tier | Rank | Threshold (approved visits) |
|---|---|---|
| Bronze | 1 | 5 |
| Bronze | 2 | 10 |
| Bronze | 3 | 20 |
| Silver | 1 | 30 |
| Silver | 2 | 40 |
| Silver | 3 | 50 |
| Gold | 1 | 60 |
| Gold | 2 | 70 |
| Gold | 3 | 80 |
| Platinum | 1 | 90 |
| Platinum | 2 | 100 |
| Platinum | 3 | 120 |

12 badges per category × 4 categories = 48 total badge slots in the UI.

### Image URL pattern ([badges.ts:62-65](config/badges.ts#L62-L65))
```
${SUPABASE_URL}/storage/v1/object/public/badges/{Category}_{Tier}_{Rank}-min.webp
```
Example: `Bar_Bronze_1-min.webp`. Stored in the public `badges` bucket.

---

## Trigger — `check_and_award_badges`

[supabase/migrations/20260417151509_remote_schema.sql:145-207](supabase/migrations/20260417151509_remote_schema.sql#L145-L207)

**Fires:** `AFTER UPDATE ON submissions` when `NEW.status = 'approved' AND OLD.status != 'approved'`.

**Logic:**
1. Count total approved submissions for the user.
2. Count approved submissions where `partner_store_category = 'cafe'` → `cafe_approved_count`.
3. Count approved submissions where `partner_store_category = 'restaurant'` → `restaurant_approved_count`.
4. For each `badges` row with `category = 'activity'` and `required_count <= total_approved_count`, INSERT into `user_badges` (ON CONFLICT DO NOTHING).
5. Same for `category = 'cafe'` against `cafe_approved_count`.
6. Same for `category = 'restaurant'` against `restaurant_approved_count`.

**The trigger does not count `bar` or `hotel`** — those `partner_store_category` values don't exist in the submissions enum.

---

## UI — [components/verified-member/badges/index.tsx](components/verified-member/badges/index.tsx)

- Renders 4 category tabs from `BADGE_CATEGORIES` ([badges/index.tsx:296-317](components/verified-member/badges/index.tsx#L296-L317)).
- For the active tab, loops `BADGE_TIERS` × `BADGE_RANKS` and shows 12 badges.
- Uses [hooks/useSubmissions.ts:100-108](hooks/useSubmissions.ts#L100-L108) to compute per-category counts.
- "Current: \[Tier\] \[Rank\]" highlight ([badges/index.tsx:249-260](components/verified-member/badges/index.tsx#L249-L260)).
- Progress copy ([badges/index.tsx:338-341](components/verified-member/badges/index.tsx#L338-L341)) lists the 12 thresholds.

---

## Issues

### Bar and Hotel badges are unreachable (HIGH — fix scoped 2026-04-23)
The submission schema enum is `cafe | restaurant | others` ([types/submission.ts:6](types/submission.ts#L6)). When a user submits a proof for a partner store mapped to `bar`, the row goes into `others`. The trigger only counts `cafe` and `restaurant` for category-specific badges; nothing increments `bar` or `hotel` counters.

[hooks/useSubmissions.ts:100-108](hooks/useSubmissions.ts#L100-L108) tries to compute `bar` and `hotel` counts client-side by filtering the `category` field, but since those values never appear, both counts are always **0**. The Bar and Hotel badge grids in the UI render but can never light up.

**Resolution (decided with Kasey 2026-04-23, see [`credits-overview.md`](credits-overview.md)):**
- **Bar** → added to the credits/task system. Requires extending `partner_store_category` with `bar`, updating `mapStoreCategory()` in [components/verified-member/submission/index.tsx:70-81](components/verified-member/submission/index.tsx#L70-L81), and extending `badge_category` similarly.
- **Hotel** → stays in the UI as a visibility-only approved-submission counter on the My Tasks tracker. It does **not** earn credits, is not a referral auto-placement target, and does not contribute to badge tiers. Hotel submissions still need a dedicated enum value and counter source.
- Per-category badge grids will be replaced by cumulative-task tiers under the new model; the category display survives only as the visual grouping of the progress bars, not as independent badge progressions.

### Migration enum drift
The `badge_category` enum in the migration has only `('activity', 'cafe', 'restaurant')` ([migration:60-64](supabase/migrations/20260417151509_remote_schema.sql#L60-L64)) but the UI references four categories. There is no `'bar'` or `'hotel'` value possible for a row in `badges` today, even if you wanted to seed them. This must be fixed as part of the credits-ledger migration.

### Project-overview drift
[`app-project-overview.md`](app-project-overview.md) previously described "Bar Explorer, Coffee Lover, Foodie, Hotel Explorer" with thresholds 5 → 120. That was synced to this doc on 2026-04-23 but still predates the credits-model cutover. Expect both docs to be rewritten once the credits ledger ships.

---

## Reconciliation with [`credits-overview.md`](credits-overview.md) + [`badge-rewards.md`](badge-rewards.md)

| Aspect | What the code does today | Target model (locked 2026-04-23) |
|---|---|---|
| Categories | Bar / Cafe / Restaurant / Hotel (4 separate badge grids) | Restaurant / Cafe / Bar earn credits. Hotel shown on My Tasks as visibility counter only. Experience off-system. |
| Tiers | Bronze / Silver / Gold / Platinum × Ranks 1–3 (12 per category) | Bronze / Silver / Gold / Platinum (Level 1/2/3 thresholds within a tier **still open**) |
| Thresholds | 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120 per-category visits | **5 / 15 / 35** cumulative tasks across R/C/B (Bronze is default) |
| Award trigger | On submission status change to `approved` | Derived from completed tasks (10 credits per cycle = 1 task) |
| Counters | Per-category approved-submission counts | Per-category `(numerator/10)` with gold-tick overlay for referral +1s (max 4 per cycle) |
| Referral effect | None | +1 numerator on nearest-complete R/C/B task (gold tick on progress bar) |
| Rewards | Visual only (no redemption) | Each completed task mints 1 voucher at current tier — see [`badge-rewards.md`](badge-rewards.md) |

The target model is **locked but not implemented**. The current `check_and_award_badges` trigger keeps running until the credits ledger lands; the migration plan will rewrite (or replace) it to count completed tasks.

Still open (see [`credits-overview.md`](credits-overview.md) "Still open"):
- Level 1/2/3 sub-thresholds within each tier — the Figma shows ranks, Kasey hasn't defined the promotion rule.
- Hotel "bigger claims" reward mechanic.
- Experience category treatment.
