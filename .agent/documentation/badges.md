# Badges & Ranks — Six-Rank Progression System

> Source of truth for the rank + badge progression model. Locked **2026-05-04** — replaces the earlier single-global-tier design with six separate ranks.
> Pair with [`credits-overview.md`](credits-overview.md) (the Visit 10 cycle that drives Visit Rank), [`extra-tasks.md`](extra-tasks.md) (star-earning loops), and [`badge-rewards.md`](badge-rewards.md) (Visit Rank → voucher mapping).

---

## What ranks represent

Wegood4u tracks **six independent ranks**, each with its own Bronze / Silver / Gold / Platinum progression and L1/L2/L3 sub-levels:

| Rank | Driven by | Drives a reward? |
|---|---|---|
| **Visit Rank** | Cumulative completed Visit 10 cycles | **Yes** — voucher tier on cycle claim ([`badge-rewards.md`](badge-rewards.md)) |
| Cafe Rank | Real approved Cafe submissions | Future ("coming soon" — vendor sponsorship pending) |
| Bar Rank | Real approved Bar submissions | Future |
| Restaurant Rank | Real approved Restaurant submissions | Future |
| Hotel Rank | Real approved Hotel submissions | Future |
| Experience Rank | Real approved Experience submissions | Future |

> *"this rank is for 10 visit rank. and cafe have its own rank"* — Kasey, 2026-05-04
> *"this will be rewards later, once i got sponsorship from vendors"* — Kasey, 2026-05-04

Per-category ranks are **never affected by extras** (referral / share / streak). Only real approved submissions move them.

---

## Visit Rank — drives vouchers

Visit Rank is derived from cumulative **completed Visit 10 cycles** (where a cycle = 10 progress units, ≥6 from real visits + ≤4 from star trades).

### Tier + level table

| Cycles completed | Tier | Level |
|---|---|---|
| 0 | — (no rank) | — |
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

### Reference TypeScript

```ts
function visitRankFor(cycles: number): { tier: RankTier; level: 1 | 2 | 3 } | null {
  if (cycles <= 0)   return null;
  if (cycles === 1)  return { tier: 'bronze',   level: 1 };
  if (cycles === 2)  return { tier: 'bronze',   level: 2 };
  if (cycles <= 4)   return { tier: 'bronze',   level: 3 };
  if (cycles <= 6)   return { tier: 'silver',   level: 1 };
  if (cycles <= 9)   return { tier: 'silver',   level: 2 };
  if (cycles <= 14)  return { tier: 'silver',   level: 3 };
  if (cycles <= 19)  return { tier: 'gold',     level: 1 };
  if (cycles <= 26)  return { tier: 'gold',     level: 2 };
  if (cycles <= 34)  return { tier: 'gold',     level: 3 };
  if (cycles <= 39)  return { tier: 'platinum', level: 1 };
  if (cycles <= 44)  return { tier: 'platinum', level: 2 };
  return              { tier: 'platinum', level: 3 };
}
```

### Voucher mapping

Tier (not level) determines voucher kind on claim. Full table in [`badge-rewards.md`](badge-rewards.md).

---

## Per-category Ranks — Cafe / Bar / Restaurant / Hotel / Experience

Each category has the same Bronze / Silver / Gold / Platinum structure with L1 / L2 / L3 sub-levels, but the thresholds are based on **real approved submissions in that category**.

### Per-category threshold table

> Locked Kasey 2026-05-04. Same thresholds applied to all five per-category ranks.

| Visits | Tier | Level |
|---|---|---|
| 0–4 | — (no rank) | — |
| 5–9 | Bronze | 1 |
| 10–19 | Bronze | 2 |
| 20–29 | Bronze | 3 |
| 30–39 | Silver | 1 |
| 40–49 | Silver | 2 |
| 50–59 | Silver | 3 |
| 60–69 | Gold | 1 |
| 70–79 | Gold | 2 |
| 80–89 | Gold | 3 |
| 90–99 | Platinum | 1 |
| 100–119 | Platinum | 2 |
| 120+ | Platinum | 3 (max) |

### Reference TypeScript

```ts
function categoryRankFor(visits: number): { tier: RankTier; level: 1 | 2 | 3 } | null {
  if (visits < 5)    return null;
  if (visits < 10)   return { tier: 'bronze',   level: 1 };
  if (visits < 20)   return { tier: 'bronze',   level: 2 };
  if (visits < 30)   return { tier: 'bronze',   level: 3 };
  if (visits < 40)   return { tier: 'silver',   level: 1 };
  if (visits < 50)   return { tier: 'silver',   level: 2 };
  if (visits < 60)   return { tier: 'silver',   level: 3 };
  if (visits < 70)   return { tier: 'gold',     level: 1 };
  if (visits < 80)   return { tier: 'gold',     level: 2 };
  if (visits < 90)   return { tier: 'gold',     level: 3 };
  if (visits < 100)  return { tier: 'platinum', level: 1 };
  if (visits < 120)  return { tier: 'platinum', level: 2 };
  return              { tier: 'platinum', level: 3 };
}
```

### Per-category rank rewards

Currently **none** wired up. UI labels them "Coming soon" with a teaser hint about future rewards. Reward triggers will be defined once vendor sponsorships are signed (Kasey 2026-05-04).

---

## Day-one launch behavior

> Per [`credits-overview.md`](credits-overview.md) §"Day-one launch — no backfill":

- **Visit Rank starts at 0 cycles** for everyone (no backfill from existing approvals).
- **Per-category ranks DO count existing approved submissions.** A user with 6 prior cafe approvals starts with Cafe Rank at Bronze L1 (5+) and progressing toward Bronze L2 (10).

Distinction matters: Visit 10 is a *cycle* (resets at 10), so backfilling would be unfair to slow players. Per-category ranks are *cumulative all-time*, so existing data slots in cleanly.

---

## Categories table

| Category | Earns Visit 10 progress? | Has its own per-category rank? |
|---|---|---|
| Restaurant | Yes | Yes |
| Cafe | Yes | Yes |
| Bar | Yes | Yes |
| Hotel | No (separate "bigger claims" track, TBD) | Yes |
| Experience | No | Yes |

---

## Badge art assets

Badges are per-rank, per-tier, per-level art pieces. With 6 ranks × 4 tiers × 3 levels = 72 unique pieces if we go full.

### Asset strategies (one to choose with the team)

| Strategy | Asset count | Notes |
|---|---|---|
| **A. Full set** | 72 unique | Most polish, biggest art cost |
| **B. Tier-only** | 6 ranks × 4 tiers = 24 | Levels still tracked + shown as text. Art is per-tier only. |
| **C. Composite** *(Kasey-suggested)* | 5 category logos + 12 tier-level overlays + 12 Visit Rank pieces = 29 | Runtime composite of category logo + tier-level overlay. Lowest art cost. |

**Recommend Strategy C** for v1. The materials list to Kasey's team should request:

1. **12 Visit Rank badges** (full custom art) — `visit_{tier}_{level}.webp` at 360×360 px
2. **5 category logos** — `category_{cafe|bar|restaurant|hotel|experience}.webp` at 360×360 px (existing brand logos likely reusable)
3. **12 tier-level overlays** (transparent PNG/WebP) — `tier_overlay_{tier}_{level}.webp` at 360×360 px

### Asset URL pattern

```
${SUPABASE_URL}/storage/v1/object/public/badges/{filename}.webp
```

Hosted in the public `badges` Supabase Storage bucket. Existing per-category 4×3 art (legacy) can stay in the same bucket during transition.

### Render sizes in app

- **Hero (badge card on Challenges → My Task):** 120 px square
- **Card variant (rewards / ranks page):** 64 px
- **Chip variant (inline / history):** 32 px

React Native downscales the 360 px source for smaller surfaces — single asset covers all sizes.

---

## Database schema

### `badges` table — [migration:401-411](supabase/migrations/20260417151509_remote_schema.sql#L401-L411)

| Column | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `name` | text | Human-readable name (e.g. "Cafe Rank — Silver L2") |
| `rank_kind` | text | `'visit' \| 'cafe' \| 'bar' \| 'restaurant' \| 'hotel' \| 'experience'` (extension to existing `category` column or new column) |
| `tier` | text | `'bronze' \| 'silver' \| 'gold' \| 'platinum'` |
| `level` | int | `1 \| 2 \| 3` |
| `required_count` | int | Cycles (for Visit Rank) or visits (for category ranks) needed to unlock |
| `description` | text? | Optional flavor text |
| `is_active` | bool | Default `true` |
| `created_at` | timestamptz |  |

The legacy `category` column ([migration:20260423160047]) is being **superseded** by `rank_kind`. Migration plan: rename `category` → `rank_kind`, add `'visit'` as a valid value (replacing the old `'activity'`), backfill `tier` and `level` columns, drop legacy seed rows that don't match the new model.

### `user_badges` table — [migration:708-712](supabase/migrations/20260417151509_remote_schema.sql#L708-L712)

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | FK → `profiles.id` (CASCADE) |
| `badge_id` | int | FK → `badges.id` (CASCADE) |
| `earned_at` | timestamptz | Default `now()` |

PK is composite `(user_id, badge_id)` — duplicate awards are impossible.

### RLS

- Authenticated users can read `badges`.
- Users can read their own `user_badges`.
- Inserts come exclusively from the rank-award helper called by post-approval and post-cycle-close routines.

---

## Trigger wiring

### Visit Rank — on cycle close

When a user taps **Complete Tasks** on the Visit 10 card and the cycle closes:

1. The active cycle in `visit_progress` is marked closed.
2. A row is inserted into `vouchers` at the user's current Visit Rank tier (snapshot at mint time).
3. Cumulative completed-cycle count is recomputed.
4. The Visit Rank helper walks the active `badges` table where `rank_kind = 'visit'` and inserts matching `user_badges` rows.
5. `trg_notify_on_badge_earned` fires a `notifications` row.
6. A new cycle row is opened with progress 0/10.

### Per-category ranks — on submission approval

When a submission flips to `approved`:

1. Per-category counter increments (derived; no separate write).
2. The category rank helper walks `badges` where `rank_kind = '{category}'` and inserts any newly-crossed thresholds.
3. `trg_notify_on_badge_earned` fires for each new badge.

Approvals are final ([`credits-overview.md`](credits-overview.md) §"Approvals are final") — no claw-back logic on rank badges.

---

## Implementation status

- ✅ **Phase 1 backend foundation:** enum extensions for `bar` + `hotel`, `credits_ledger` + `vouchers` tables, `profiles.first_approved_submission_at` column with backfill.
- ⚠️ The `badges` table still holds **legacy seed rows** (e.g. `First Visit` at `required_count=1`, per-category `Coffee Lover`, etc.). They need to be cleared or migrated to the new `rank_kind` model.
- ⏳ **Schema migration** to rename `category` → `rank_kind`, add `tier` + `level` columns, seed 12 Visit Rank rows + 60 (or 24 with Strategy B) per-category rank rows.
- ⏳ **Manual claim flow** + `complete_visit_task` RPC + `_award_stars` + trade-button RPC pending.
- ⏳ **Ranks page UI** showing all 6 ranks pending — see [`stars-and-extra-progress.plan.md`](../plans/stars-and-extra-progress.plan.md) Phase 7.

---

## Legacy: per-category 4×3 system (phased out)

The original system had 4 categories × 4 tiers × 3 ranks = 48 per-category badges with thresholds 5 → 120 approved submissions per category, plus a separate global tier from cumulative completed cycles. The new model:

- **Drops** the separate global tier — replaced by Visit Rank using the same Bronze/Silver/Gold/Platinum structure.
- **Keeps** per-category 4×3 progression but adds Experience as a fifth category and locks consistent thresholds (5/10/20/30/40/50/60/70/80/90/100/120) across all categories.
- The `BADGE_REQUIREMENTS` constants in [config/badges.ts](config/badges.ts) and the `BADGE_CATEGORY_INFO` labels still apply but should be migrated to use the locked threshold table above.
- `getCurrentBadge(approvedCount)` helper → replaced by `categoryRankFor(visits)` for category ranks and `visitRankFor(cycles)` for the new Visit Rank.

The legacy badge UI at [components/verified-member/badges/index.tsx](components/verified-member/badges/index.tsx) is replaced by the new Ranks page in Phase 7 of the build plan.

---

## Still open

- **Per-category rank rewards** — what does each tier crossing unlock? "Coming soon" per Kasey 2026-05-04.
- **Hotel "bigger claims" reward** — Hotel has a per-category rank counter but no dedicated reward path.
- **Asset strategy choice** (A / B / C above) — defaults to C unless team pushes back.
- **Badge seed migration plan** — clearing legacy rows in production needs a careful migration with the Phase 1 schema work.
