# Badges — Five-Badge Progression System

> Source of truth for the badge progression model. Locked **2026-05-06**.
> Pair with [`credits-overview.md`](credits-overview.md) (the Visit 10 cycle that drives the Visit Badge), [`extra-tasks.md`](extra-tasks.md) (star-earning loops), and [`badge-rewards.md`](badge-rewards.md) (Visit Badge → voucher mapping).

---

## What badges represent

Wegood4u tracks **five badges** in v1, each with its own Bronze / Silver / Gold / Platinum tier progression and L1 / L2 / L3 sub-levels. More badges may be added later.

| Badge | Driven by | Drives a reward? |
|---|---|---|
| **Visit Badge** (user rank) | Completed Visit 10 tasks (cumulative) | **Yes** — 1 voucher minted on every Visit Badge level-up (12 lifetime per user, see [`badge-rewards.md`](badge-rewards.md)) **+** profile picture frame |
| **Restaurant Badge** | Real approved Restaurant visits | Not in v1 — added when vendor sponsorships are signed |
| **Cafe Badge** | Real approved Cafe visits | Not in v1 — added when vendor sponsorships are signed |
| **Bar Badge** | Real approved Bar visits | Not in v1 — added when vendor sponsorships are signed |
| **Hotel Badge** | Real approved Hotel visits | Not in v1 — Hotel partner stores deferred until partnership signed |

> *"this rank is for 10 visit rank. and cafe have its own rank"* — Kasey, 2026-05-04
> *"this will be rewards later, once i got sponsorship from vendors"* — Kasey, 2026-05-04
> Terminology locked 2026-05-06: these are **badges**, not ranks. "Tier" and "Level" are sub-attributes within each badge.

Category badges are **never affected by extras** (referral / share / streak). Only real approved submissions move them.

**Experience** is not in v1. The `store_category` enum will eventually grow to include it but no Experience badge ships in v1.

---

## Visit Badge — drives vouchers + profile picture frame

The Visit Badge is the user's overall rank. Driven by **completed Visit 10 tasks** (where each task = 10 progress units: ≥6 from real R/C/B visits + ≤4 from star-traded extras — see [`credits-overview.md`](credits-overview.md)).

### Tier + level table

| Completed Visit 10 tasks | Tier | Level |
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

### Reference TypeScript

```ts
function visitBadgeFor(tasksCompleted: number): { tier: BadgeTier; level: 1 | 2 | 3 } | null {
  if (tasksCompleted <= 0)   return null;
  if (tasksCompleted === 1)  return { tier: 'bronze',   level: 1 };
  if (tasksCompleted === 2)  return { tier: 'bronze',   level: 2 };
  if (tasksCompleted <= 4)   return { tier: 'bronze',   level: 3 };
  if (tasksCompleted <= 6)   return { tier: 'silver',   level: 1 };
  if (tasksCompleted <= 9)   return { tier: 'silver',   level: 2 };
  if (tasksCompleted <= 14)  return { tier: 'silver',   level: 3 };
  if (tasksCompleted <= 19)  return { tier: 'gold',     level: 1 };
  if (tasksCompleted <= 26)  return { tier: 'gold',     level: 2 };
  if (tasksCompleted <= 34)  return { tier: 'gold',     level: 3 };
  if (tasksCompleted <= 39)  return { tier: 'platinum', level: 1 };
  if (tasksCompleted <= 44)  return { tier: 'platinum', level: 2 };
  return                      { tier: 'platinum', level: 3 };
}
```

### Voucher mapping

Tier (not level) determines voucher kind. Each level-up mints a voucher of that level's tier — Silver L1, Silver L2, and Silver L3 each mint identical Silver vouchers. Full table in [`badge-rewards.md`](badge-rewards.md).

### Profile picture frame

When the user's Visit Badge tier changes, their profile picture displays a tier-specific frame. Frame assets live at [`assets/images/tier_frame/`](../../assets/images/tier_frame/):

| Tier | Frame asset |
|---|---|
| Bronze | `Bronze.webp` |
| Silver | `Silver.webp` |
| Gold | `Goldd.webp` ⚠️ (current filename has typo — rename to `Gold.webp` recommended) |
| Platinum | `Diamond.webp` ⚠️ (current filename mismatches spec — rename to `Platinum.webp` recommended) |

Frame is **per-tier only**, not per-level — Silver L1 and Silver L3 share the same frame. Frame swaps automatically when the user crosses a tier boundary on cycle claim.

Render: composited around the user's profile picture wherever it appears (header, profile screen, comment threads, referral list rows). The frame includes a tier ribbon at the bottom, so the picture itself shows inside the glowing ring.

---

## Category Badges — Restaurant / Cafe / Bar / Hotel

Each of the four category badges has the same Bronze / Silver / Gold / Platinum tier structure with L1 / L2 / L3 sub-levels, with thresholds based on **real approved submissions in that category**.

### Threshold table

> Locked Kasey 2026-05-04. Same thresholds applied to all four category badges.

| Visits | Tier | Level |
|---|---|---|
| 0–4 | — (no badge) | — |
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
function categoryBadgeFor(visits: number): { tier: BadgeTier; level: 1 | 2 | 3 } | null {
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

### Category Badge rewards

Currently **none** wired up. Category Badge tiles in v1 show progression (current tier+level + threshold to next) but no reward callout. Reward triggers will be defined once vendor sponsorships are signed. **No "Coming soon" wording in the UI** per Kasey 2026-05-07.

---

## Day-one launch behavior

> Locked Kasey 2026-05-06: **No backfill anywhere.**

When a new user completes the verification form, they start at:

- Visit Badge: **0 tasks completed** (no badge yet)
- Restaurant Badge: **0 visits** (no badge yet)
- Cafe Badge: **0 visits** (no badge yet)
- Bar Badge: **0 visits** (no badge yet)
- Hotel Badge: **0 visits** (no badge yet)

Existing approved submissions from before launch day **do not** count toward any badge — every user starts fresh from verification onward. This applies uniformly to every badge.

> *"After they submit their verification form. They would likely start with 0 of course, visit rank 0, all category badges 0."* — Kasey, 2026-05-06

---

## Categories table

| Category | Earns Visit 10 progress? | Has its own category badge? |
|---|---|---|
| Restaurant | Yes | Yes |
| Cafe | Yes | Yes |
| Bar | Yes | Yes |
| Hotel | No (separate "bigger claims" track, TBD) | Yes |
| ~~Experience~~ | ~~No~~ | **Not in v1** — deferred |

---

## Badge art assets

Each badge needs tier × level art (4 tiers × 3 levels = 12 unique pieces per badge) **plus** the profile picture frame for Visit Badge.

### Asset strategies (one to choose with the team)

| Strategy | Asset count | Notes |
|---|---|---|
| **A. Full set** | 5 badges × 12 = 60 unique | Most polish, biggest art cost |
| **B. Tier-only** | 5 badges × 4 tiers = 20 | Levels still tracked + shown as text. Art is per-tier only. |
| **C. Composite** *(recommended)* | 4 category logos + 12 tier-level overlays + 12 Visit Badge pieces = 28 | Runtime composite of category logo + tier-level overlay |

**Recommend Strategy C** for v1. Materials breakdown:

1. **12 Visit Badge art pieces** (full custom art) — `visit_{tier}_{level}.webp` at 360×360 px
2. **4 category logos** — `category_{cafe|bar|restaurant|hotel}.webp` at 360×360 px (existing brand logos likely reusable)
3. **12 tier-level overlays** (transparent PNG/WebP) — `tier_overlay_{tier}_{level}.webp` at 360×360 px

### Profile picture frame assets (received 2026-05-06)

Located at [`assets/images/tier_frame/`](../../assets/images/tier_frame/):

| Tier | File | Size | Notes |
|---|---|---|---|
| Bronze | `Bronze.webp` | 27 KB | OK |
| Silver | `Silver.webp` | 25 KB | OK |
| Gold | `Goldd.webp` | 27 KB | ⚠️ filename typo — should be `Gold.webp` |
| Platinum | `Diamond.webp` | 25 KB | ⚠️ filename mismatch — should be `Platinum.webp` to match spec |

Action: ask the team to rename, or rename ourselves on import. Filenames are external-facing only inside Supabase Storage path — no spec-level concern.

### Asset URL pattern

```
${SUPABASE_URL}/storage/v1/object/public/badges/{filename}.webp
```

Hosted in the public `badges` Supabase Storage bucket. Profile frame files can live in the same bucket under a `tier_frame/` prefix or stay bundled in `assets/images/tier_frame/`.

### Render sizes in app

- **Hero (badge card on Challenges → My Task):** 120 px square
- **Card variant (Badges page):** 64 px
- **Chip variant (inline / history):** 32 px
- **Profile picture frame:** wraps the avatar at avatar's display size (typically 40–96 px)

React Native downscales the 360 px source for smaller surfaces — single asset covers all sizes.

---

## Database schema

> Reflects locked schema migration plan in [`../plans/stars-and-extra-progress.plan.md`](../plans/stars-and-extra-progress.plan.md) Phase 1.

### `badges` table — extended in Phase 1

| Column | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `name` | text | Human-readable name (e.g. "Cafe Badge — Silver L2") |
| `category` | enum `badge_category` | Legacy column. Kept for backward compatibility; new logic uses `badge_kind`. |
| `badge_kind` | text (new) | `'visit' \| 'cafe' \| 'bar' \| 'restaurant' \| 'hotel'` (Experience added later when category lands) |
| `tier` | text (new) | `'bronze' \| 'silver' \| 'gold' \| 'platinum'` |
| `level` | int (new) | `1 \| 2 \| 3` |
| `required_count` | int | Tasks (for Visit Badge) or visits (for category badges) needed to unlock |
| `selfie_url`, `receipt_url` | text | Legacy required-NOT-NULL columns. Pass empty strings for new badge rows. |
| `description` | text? | Optional flavor text |
| `is_active` | bool | Default `true`. Legacy seed rows flipped to `false` in migration. |
| `created_at` | timestamptz |  |

Legacy seed rows (First Visit, Coffee Lover, Bar Explorer, etc.) have `is_active = false` after migration — they remain in `user_badges` as historical data but don't drive new UI.

### `user_badges` table — unchanged

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

### Visit Badge — on cycle close

When a user taps **Complete Tasks** on the Visit 10 card and the cycle closes:

1. The active cycle in `visit_progress` is marked closed.
2. Cumulative completed-cycle count is recomputed.
3. The Visit Badge helper walks the active `badges` rows where `badge_kind = 'visit'` and inserts matching `user_badges` rows for any newly-crossed thresholds.
4. The **`mint_voucher_on_visit_levelup` trigger** fires on each new `user_badges` row with `badge_kind='visit'` and inserts a corresponding voucher row of that level's tier (Bronze L1 → Bronze voucher, Silver L2 → Silver voucher, etc.). Cycles between levels (4, 6, 8, 9, 11–14, 16–19, …) close cleanly without minting — only level thresholds (1, 2, 3, 5, 7, 10, 15, 20, 27, 35, 40, 45) mint.
5. If the **tier** crossed (e.g. Bronze L3 → Silver L1), the user's profile picture frame swaps. Frame is derived from current Visit Badge tier — no separate write.
6. `trg_notify_on_badge_earned` fires a `notifications` row.
7. A new cycle row is opened with progress 0/10.

### Category Badges — on submission approval

When a submission flips to `approved`:

1. Per-category counter increments (derived; no separate write).
2. The category badge helper walks `badges` rows where `badge_kind = '{category}'` and inserts any newly-crossed thresholds into `user_badges`.
3. `trg_notify_on_badge_earned` fires for each new badge.

Approvals are final ([`credits-overview.md`](credits-overview.md) §"Approvals are final") — no claw-back logic on badge awards.

---

## Implementation status

- ✅ **Profile picture frame assets received** (4 files in [`assets/images/tier_frame/`](../../assets/images/tier_frame/)) — minor filename cleanup pending.
- ⏳ **Phase 1 schema migration** — drop legacy `credits_ledger` / `referral_half_credit_accumulator` / `vouchers`, evolve `badges` table, seed new badge rows. Per [`../plans/stars-and-extra-progress.plan.md`](../plans/stars-and-extra-progress.plan.md).
- ⏳ **Manual claim flow** + `complete_visit_task` RPC + `_award_stars` + trade-button RPC pending.
- ⏳ **Badges page UI** showing all 5 badges pending — see plan Phase 7.
- ⏳ **Visit Badge art (12 pieces)** pending from Kasey's team. Phase 7 ships with placeholder gradients if delayed.

---

## Legacy: per-category 4×3 system (phased out)

The original system had 4 categories × 4 tiers × 3 ranks = 48 per-category badges, plus a separate global tier from cumulative completed cycles. The new model:

- **Drops** the separate global tier — replaced by the Visit Badge using the same Bronze/Silver/Gold/Platinum × L1/L2/L3 structure.
- **Keeps** per-category 4×3 progression with locked thresholds (5/10/20/30/40/50/60/70/80/90/100/120) across all four categories.
- The `BADGE_REQUIREMENTS` constants in [`config/badges.ts`](../../config/badges.ts) and the `BADGE_CATEGORY_INFO` labels still apply but should be migrated to use the locked threshold table above.
- `getCurrentBadge(approvedCount)` helper → replaced by `categoryBadgeFor(visits)` for category badges and `visitBadgeFor(tasksCompleted)` for the Visit Badge.

The legacy badge UI at [`components/verified-member/badges/index.tsx`](../../components/verified-member/badges/index.tsx) is replaced by the new Badges page in Phase 7 of the build plan.

---

## Still open

- **Category Badge rewards** — what does each tier crossing unlock? Pending vendor sponsorships. v1 ships progression-only on these tiles (no reward callout, no "Coming soon" wording).
- **Hotel "bigger claims" reward** — Hotel has a category badge but no dedicated reward path beyond the future per-category sponsorship.
- **Asset strategy choice** (A / B / C above) — defaults to C unless team pushes back.
- **Profile frame filename rename** — `Goldd.webp` → `Gold.webp`, `Diamond.webp` → `Platinum.webp` (cosmetic, doesn't block build).
- **Experience category** — when the `store_category` enum gains `experience`, add a 6th badge with the same threshold table.
