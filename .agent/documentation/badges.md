# Badges (current implementation)

> What the **code actually does today**. The model in [`credits-overview.md`](credits-overview.md) describes a different future system; until that lands, this doc is the source of truth.

---

## What this covers

The badge tier/rank system that awards users for accumulating approved submissions per category. Counts come from the `submissions` table; awards land in `user_badges` via a Postgres trigger. The UI shows 12 badges per category (4 tiers × 3 ranks).

This doc deliberately documents the **current** implementation. It also calls out two important issues:
- **Bar and Hotel badges can never be earned** with today's schema.
- The credits/task model in [`credits-overview.md`](credits-overview.md) doesn't fit the current trigger.

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

### Bar and Hotel badges are unreachable (HIGH)
The submission schema enum is `cafe | restaurant | others` ([types/submission.ts:6](types/submission.ts#L6)). When a user submits a proof for a partner store mapped to `bar`, the row goes into `others`. The trigger only counts `cafe` and `restaurant` for category-specific badges; nothing increments `bar` or `hotel` counters.

[hooks/useSubmissions.ts:100-108](hooks/useSubmissions.ts#L100-L108) tries to compute `bar` and `hotel` counts client-side by filtering the `category` field, but since those values never appear, both counts are always **0**. The Bar and Hotel badge grids in the UI render but can never light up.

**Fix options:**
1. Extend the `partner_store_category` enum to include `bar` and `hotel`, update `mapStoreCategory()` in [components/verified-member/submission/index.tsx:70-81](components/verified-member/submission/index.tsx#L70-L81), update the trigger to count all four, and add corresponding `badge_category` enum values.
2. Drop Bar and Hotel from `BADGE_CATEGORIES` in [config/badges.ts](config/badges.ts) so the UI doesn't promise something the schema can't deliver.

### Migration enum drift
The `badge_category` enum in the migration has only `('activity', 'cafe', 'restaurant')` ([migration:60-64](supabase/migrations/20260417151509_remote_schema.sql#L60-L64)) but the UI references four categories. There is no `'bar'` or `'hotel'` value possible for a row in `badges` today, even if you wanted to seed them.

### Project-overview drift
[`project-overview.md:42-46`](project-overview.md#L42-L46) describes the categories as "Bar Explorer, Coffee Lover, Foodie, Hotel Explorer" with thresholds "from 5 visits (Bronze 1) to 120 visits (Platinum 3)" — that line matches this doc and the code, but the prior `last updated` date (2026-04-07) predates the credits discussion. The two docs should be kept consistent until the new credits/badge model is decided.

---

## Reconciliation with [`credits-overview.md`](credits-overview.md)

| Aspect | What the code does | What credits-overview proposes |
|---|---|---|
| Categories | Bar / Cafe / Restaurant / Hotel | Restaurant / Cafe / Bar only (Hotel separate "bigger claims") |
| Tiers | Bronze / Silver / Gold / Platinum × Ranks 1–3 (12 per category) | Bronze (default) / Silver / Gold / Platinum, no ranks |
| Thresholds | 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120 visits | 5 / 15 / 25 *tasks* (where 1 task = 10 credits) |
| Award trigger | On submission status change to `approved` | Derived from completed tasks (which derive from credits) |
| Counters | Per-category approved-submission counts | Per-category task progress + denominator reductions from referrals |

These models are incompatible. The credits-overview model assumes a credits ledger and per-category task counters that **don't exist in code yet**. The current `check_and_award_badges` trigger should keep working until the credits ledger is built; once it is, the trigger will need to be rewritten (or replaced) to count completed tasks rather than raw submissions.

Confirm with product which model is the long-term target before extending either.
