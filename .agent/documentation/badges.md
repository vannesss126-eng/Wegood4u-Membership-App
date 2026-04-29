# Badges — Tier + Level System

> Source of truth for the badge progression model. Locked 2026-04-23.
> Pair with [`credits-overview.md`](credits-overview.md) (the credits/task economy that drives badges) and [`badge-rewards.md`](badge-rewards.md) (tier→voucher mapping).

---

## What badges represent

Badges reward cumulative engagement, measured in **completed tasks**.

- 1 task = 10 credits in any single eligible-category cycle (Restaurant / Cafe / Bar).
- Hotel submissions and Experience do **not** contribute to badges.
- A user's tier + level is a **single global value**, not per-category. The badge detail page renders 4 category rows but they all show the same tier+level — rows differ only in category-themed art.

For full credit / cycle / referral mechanics, see [`credits-overview.md`](credits-overview.md).

---

## Tier + level table

Tier+level is derived from cumulative completed tasks across **Restaurant + Cafe + Bar** (Hotel excluded).

| Tasks completed | Tier | Level |
|---|---|---|
| 0 | — (no badge) | — |
| 1 | Bronze | 1 |
| 2 | Bronze | 2 |
| 3–4 | Bronze | 3 |
| 5–6 | Silver | 1 |
| 7–9 | Silver | 2 |
| 10–14 | Silver | 3 |
| 15–19 | Gold | 1 |
| 20–26 | Gold | 2 |
| 27–34 | Gold | 3 |
| 35–39 | Platinum | 1 |
| 40–44 | Platinum | 2 |
| 45+ | Platinum | 3 (max) |

> Source: product confirmation 2026-04-23 (Kasey Fong, WhatsApp). Supersedes the prior per-category 5–120 visit model.

Reference TypeScript implementation:

```ts
function tierLevelFor(tasks: number): { tier: BadgeTier; level: 1 | 2 | 3 } | null {
  if (tasks <= 0)   return null;                       // no badge
  if (tasks === 1)  return { tier: 'bronze',   level: 1 };
  if (tasks === 2)  return { tier: 'bronze',   level: 2 };
  if (tasks <= 4)   return { tier: 'bronze',   level: 3 };
  if (tasks <= 6)   return { tier: 'silver',   level: 1 };
  if (tasks <= 9)   return { tier: 'silver',   level: 2 };
  if (tasks <= 14)  return { tier: 'silver',   level: 3 };
  if (tasks <= 19)  return { tier: 'gold',     level: 1 };
  if (tasks <= 26)  return { tier: 'gold',     level: 2 };
  if (tasks <= 34)  return { tier: 'gold',     level: 3 };
  if (tasks <= 39)  return { tier: 'platinum', level: 1 };
  if (tasks <= 44)  return { tier: 'platinum', level: 2 };
  return              { tier: 'platinum', level: 3 };  // 45+
}
```

---

## Rewards per tier

Rewards are **tier-based**, not level-based — Silver L1 and Silver L3 mint identical 3-star vouchers. Level differentiates badge UI bragging rights only.

| Tier | Reward |
|---|---|
| Bronze | Airbnb voucher |
| Silver | 3-star hotel voucher |
| Gold | 4-star hotel voucher |
| Platinum | Specialty / 5-star / resort voucher |

Full mapping + `vouchers` table sketch in [`badge-rewards.md`](badge-rewards.md).

---

## Categories

| Category | Earns task credits? | Appears on badge detail page? |
|---|---|---|
| Restaurant | Yes | Yes (themed art) |
| Cafe | Yes | Yes (themed art) |
| Bar | Yes | Yes (themed art) |
| Hotel | No — visibility counter on My Tasks only | Yes (themed art, mirrors global tier+level) |
| Experience | No | No |

---

## Image asset URL pattern

Per-category badge art is hosted in the public `badges` Supabase Storage bucket:

```
${SUPABASE_URL}/storage/v1/object/public/badges/{Category}_{Tier}_{Rank}-min.webp
```

Example: `Bar_Bronze_1-min.webp`. The `{Rank}` segment in the filename maps to `{Level}` in the new model.

Bar and Hotel art assets must be uploaded to the bucket before Phase 5 UI ships — verify with bucket contents.

---

## Database schema

### `badges` table — [migration:401-411](supabase/migrations/20260417151509_remote_schema.sql#L401-L411)

| Column | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `name` | text | Human-readable name |
| `category` | enum `badge_category` | Values: `activity / cafe / restaurant / bar / hotel` (extended in migration `20260423160047`) |
| `required_count` | int | Threshold to unlock — under the new model, the cumulative-task count required (interpretation depends on `category`: rows with `category='activity'` use the global tier table) |
| `selfie_url`, `receipt_url` | text | Sample images |
| `description` | text? |  |
| `is_active` | bool | Default `true` |
| `created_at` | timestamptz |  |

### `user_badges` table — [migration:708-712](supabase/migrations/20260417151509_remote_schema.sql#L708-L712)

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | FK → `profiles.id` (CASCADE) |
| `badge_id` | int | FK → `badges.id` (CASCADE) |
| `earned_at` | timestamptz | Default `now()` |

PK is the composite `(user_id, badge_id)` — duplicate awards are impossible.

### RLS
- Authenticated users can read `badges`.
- Users can read their own `user_badges`.
- Inserts come exclusively from the `_credits_award_tier_badge` SECURITY DEFINER helper called by `on_submission_approved`.

---

## Trigger wiring (post Phase 1, 2026-04-23)

The legacy `check_and_award_badges` function is replaced by `on_submission_approved` ([migration:20260423160049](supabase/migrations/20260423160049_credits_trigger_rewrite.sql)). Flow:

1. Submission flips to `approved`.
2. `on_submission_approved` writes a `+1` row to `credits_ledger` for the eligible category (R/C/B).
3. If the cycle closes (numerator reaches 10), a row is inserted into `vouchers` at the user's current tier.
4. `_credits_completed_task_count(user_id)` recomputes total tasks; `_credits_award_tier_badge` walks the active `badges` table and inserts matching `user_badges` rows.
5. `trg_notify_on_badge_earned` fires a `notifications` row.

The legacy `check_and_award_badges` function is left on disk for manual rollback but no trigger calls it.

---

## Implementation status

- ✅ **Phase 1 backend live (2026-04-23):** enum extensions for `bar` + `hotel`, `credits_ledger` + `referral_half_credit_accumulator` + `vouchers` tables, `profiles.first_approved_submission_at` column with backfill, `on_submission_approved` trigger + helpers, `notify_on_badge_earned` sibling trigger.
- ⚠️ The `badges` table still holds **legacy seed rows** (e.g. `First Visit` at `required_count=1`, `Regular Visitor` at 5, `Cafe Explorer` at 3, etc.). They coexist with future tier/level rows. The new trigger still walks them, so a user with 1 task currently earns both `First Visit` *and* the future `Bronze L1` row (when seeded).
- ⏳ **Tier + level seed rows not yet inserted** in the `badges` table. Decision pending: 12 global rows (one per tier×level under `category='activity'`) vs 48 per-category rows. Current trigger uses `category='activity'` for global awards, so 12 global rows is the simplest path.
- ⏳ **Phase 5** (badge detail page UI) and **Phase 6** (badge collection share card) pending implementation. See [`tasks-redesign.plan.md`](../plans/tasks-redesign.plan.md).

---

## Legacy: per-category 4×3 system (being phased out)

For historical context — the original badge system had 4 categories × 4 tiers × 3 ranks = 48 per-category badges with thresholds 5 → 120 approved submissions per category. That model lives on in [config/badges.ts](config/badges.ts) constants and the legacy badge UI at [components/verified-member/badges/index.tsx](components/verified-member/badges/index.tsx). Both will be replaced when Phase 5 ships:

- `BADGE_REQUIREMENTS` (5, 10, 20, 30, … 120) — superseded by the global table above.
- `BADGE_CATEGORY_INFO` ("Bar Explorer", "Coffee Lover", etc.) — keeps the per-category labels and colors, still useful for category-themed badge art.
- `getCurrentBadge(approvedCount)` helper — superseded by `tierLevelFor(taskCount)` from the reference impl above.

The per-category constants remain consumable until Phase 5 deletes the legacy UI; new code should use `useTasks().tier` + the upcoming `level` field instead.

---

## Still open

- **Hotel "bigger claims" reward mechanic** — Hotel has a visibility counter on My Tasks but no reward path defined. Tracked in [`credits-overview.md`](credits-overview.md) "Still open."
- **Experience category** — never specified.
- **Badge seed strategy** — 12 global rows in `badges` (one per tier×level) vs 48 per-category. Pick one before Phase 5 wires the badge detail page.
