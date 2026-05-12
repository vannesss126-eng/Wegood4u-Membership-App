# Visit 10 & Stars — Overview & Rules

> Source: product discussions with Kasey Fong (WhatsApp). Latest lock: **2026-05-06** — terminology aligned to "Badges", no backfill anywhere on launch day.
> Pair with [`extra-tasks.md`](extra-tasks.md) (the three star-earning loops), [`referral-system.md`](referral-system.md) (referral tree + qualification), [`badges.md`](badges.md) (5-badge progression model), and [`badge-rewards.md`](badge-rewards.md) (voucher mapping).
>
> **Naming convention used in this doc:**
> - **"Visit 10 Task"** — the user-facing feature name. UI label is "Submit 10 Proof of Travels".
> - **"cycle"** — one in-progress instance of the Visit 10 Task. Stored as a row in `visit_progress`; closes when the user taps "Complete Tasks". Multiple cycles complete over time.
> - **"Visit Badge"** — the user's overall badge, driven by cumulative completed cycles.

---

## The model in one diagram

```
  Approved R/C/B visit  ─────────►  +1 to Visit 10 progress
                                     (real visits — minimum 6 of 10 per cycle)
                                     +1 to that category's badge counter

  Share / Streak / Referral ────►  Stars in user wallet

       User taps "Use 100 ★ for +1 Progress"
                                     │
                          100 stars deducted from wallet
                                     │
                                     ▼
                    +1 to Visit 10 progress (max +4 per cycle)

              Visit 10 progress reaches 10/10
                                     │
                          User taps "Complete Tasks"
                                     │
                                     ▼
                    Cycle resets to 0/10
                    Star wallet preserved
                    Visit Badge re-evaluated
                                     │
                                     ▼
                    If a Visit Badge level was crossed:
                    1 voucher minted of that level's tier
                    (Bronze L1 → Bronze voucher, etc.)
                    Profile frame may swap
```

---

## Two separate progress concepts

### A. Visit 10 Task — the cumulative reward concept

The **Visit 10 Task** is Wegood4u's central engagement loop. Each instance of it is called a **cycle**: a row in `visit_progress` that starts at 0/10 and closes when the user claims at 10/10. Users complete many cycles over time.

- **One** counter per active cycle, cumulative across **Restaurant + Cafe + Bar** (any mix counts).
- **Floor: 6 real visits** per cycle — must be approved R/C/B submissions in any combination (e.g. 4 cafe + 1 restaurant + 1 bar). The user does **not** need to visit 10 of any single category.
- **Ceiling: +4 extras** from stars per cycle. User manually trades 100 stars for +1 progress (max 4 trades per cycle). Star wallet retains leftover after each trade.
- Reward claim is **manual**: at 10/10, a "Complete Tasks" button closes the cycle, opens a new one at 0/10, and re-evaluates the **Visit Badge**. Voucher minting is gated on **Visit Badge level-up** (revised 2026-05-10) — only the cycle that crosses a threshold (1, 2, 3, 5, 7, 10, 15, 20, 27, 35, 40, 45 cumulative) mints; intermediate cycles close cleanly without minting.
- Each completed cycle drives the **Visit Badge** (the user-facing badge that gates voucher tier and the profile picture frame). See [`badges.md`](badges.md).

> *"i was thinking, our rewards based on 10 visit (6 from physical shop, 4 from task -optional). doesnt require for 10 restaurant or 10 bar or 10 cafe. 6 physical shop can be 4 cafe, 1 restaurant, 1 bar"* — Kasey, 2026-05-03
> *"once they complete the task, they press complete task, then they will get voucher in rewards tab"* — Kasey, 2026-05-03
> *"10 visit task can be repeat after each cycle"* — Kasey, 2026-05-04

### B. Category Badges — drive per-category recognition

Each approved submission also increments that category's badge counter. Four separate category badges in v1: **Cafe / Bar / Restaurant / Hotel**. (Experience is deferred until the `store_category` enum gains it.)

- Badge counters track **real approved submissions only** — extras (referral / share / streak) **never** move them.
- Progression: Bronze L1 (5) → Bronze L2 (10) → Bronze L3 (20) → Silver L1 (30) → … → Platinum L3 (120). Full table in [`badges.md`](badges.md).
- Category Badge tiles show progression (current tier+level + threshold to next). Reward mechanics are not part of v1 — they're added later when vendor sponsorships are signed. UI does **not** show "Coming soon" wording (Kasey 2026-05-07).
- **Hotel** has a Category Badge in the model but stays at 0 progress in v1 — Hotel partner stores aren't listed until partnership signed (no Hotel submissions possible until then).

> *"this rank is for 10 visit rank. and cafe have its own rank"* — Kasey, 2026-05-04
> *"this will be rewards later, once i got sponsorship from vendors"* — Kasey, 2026-05-04
> *"the badges only apply those who really visit the cafe, restaurant and bar"* — Kasey, 2026-05-03
> *"We no need put future or coming soon ya. As in, we only list the hotel submission when we got partnership."* — Kasey, 2026-05-07
> Terminology updated 2026-05-06: these are **Badges**, not Ranks. Tier and Level are sub-attributes within each Badge.

---

## Stars and the +4 cap

**Stars** are the unit earned by extra tasks. They are **not** earned by visits.

| Conversion | Rule |
|---|---|
| 100 stars | = +1 Visit 10 progress (manual trade — user taps button) |
| Per-cycle cap | At most 4 extras may apply to one cycle |
| Beyond cap | The "Trade 100 ★" button disables once cycle has 4 extras applied. Stars stay in the wallet for the next cycle. |
| Leftover stars at cycle close | Carry forward — wallet is not reset on claim |

Star sources and rates documented in [`extra-tasks.md`](extra-tasks.md). Summary:

| Source | Stars |
|---|---|
| Share approved submission to Facebook | +15 |
| Share approved submission to Instagram | +15 |
| Share approved submission to TikTok | +15 |
| Bonus: all 3 platforms shared for the same submission | +5 |
| L1 referral qualifies | +100 |
| L2 referral qualifies | +50 |
| Daily log-in 14-day streak completion | **+50** (revised 2026-05-04 from 100) |

All four eligible-share categories (R/C/B/Hotel) earn share stars. Hotel-derived share stars feed the same wallet that can be traded into the R/C/B Visit 10 cycle.

> *"14 days = 50 star"* — Kasey, 2026-05-04 (revised down from earlier 100; reasoning: low-effort activity warrants smaller reward)

---

## Eligible categories

| Category | Earns Visit 10 progress from real submission? | Earns share stars? | Has its own Category Badge? |
|---|---|---|---|
| Restaurant | Yes (+1) | Yes (15/15/15+5) | Yes |
| Cafe | Yes (+1) | Yes | Yes |
| Bar | Yes (+1) | Yes | Yes |
| Hotel | **No** — separate "bigger claims" track (TBD) | **Yes** (stars feed R/C/B Visit 10 wallet) | Yes |
| Experience | No — not in v1 | No | Not in v1 |

> Hotel sharing extension confirmed Kasey 2026-05-03: *"All can"*.
> Experience deferred until `store_category` enum gains it.

---

## Cycle close + voucher minting

1. Active cycle's progress reaches 10/10 (any combination of ≥6 real visits + ≤4 extras).
2. UI shows a primary **"Complete Tasks"** button on the Visit 10 card.
3. User taps → cycle closes; counter resets to 0/10; star wallet retains any leftover stars.
4. Visit Badge is re-evaluated against cumulative completed cycles. If a level threshold is crossed, a `user_badges` row is inserted.
5. The `user_badges` insert fires the `mint_voucher_on_visit_levelup` trigger, which writes a voucher row of the new level's tier (Bronze L1 → Bronze, Silver L2 → Silver, etc.).
6. If the tier itself changed (e.g. Bronze → Silver), the user's profile picture frame swaps automatically (driven by Visit Badge tier — see [`badges.md`](badges.md) §"Profile picture frame").

Cycles between levels (4, 6, 8, 9, 11–14, 16–19, …, 41–44) close cleanly with **no voucher mint** — the user only receives one voucher per Visit Badge level achieved (12 lifetime max).

The claim is **manual** — closing the cycle requires a tap. This avoids surprising users mid-flow and lets them see the milestone before consuming it.

## Voucher redemption (admin-fulfilled in v1)

> *"As of now, we will issue voucher on our own. When press redeem voucher, we will rewards manually 1st. If future will be Auto."* — Kasey, 2026-05-07

The Rewards subtab shows **all 4 tier voucher cards as a fixed catalog** (Bronze / Silver / Gold / Platinum). Each card displays the user's available redemption count for that tier. The Redeem button is disabled (grey) at 0 and enabled (green, labeled **"Redeem ×N"**) when N ≥ 1. Users can stack multiple vouchers of the same tier and redeem them one at a time.

When the user taps **Redeem**:
1. Confirmation modal: *"Request your {tier} voucher? Our team will reach out via WhatsApp to issue it."*
2. User confirms → the **oldest unredeemed voucher of that tier** has `redeemed_at` set (FIFO) → admin notification fires.
3. Admin sees the pending request in the **Tasks → Redeem Req tab** (sibling to Submission). Each row shows user, tier, requested time. The admin taps "Mark fulfilled" once they've contacted the user via WhatsApp / email — that flips `vouchers.fulfilled_at`.

For v1, fulfillment outside the app is the source of truth; the app just tracks the request + the fulfilled flag. v2 adds an in-app hotel-selection step once partnerships are signed.

---

## Approvals are final

> *"for approved submission we wouldn't able to redo the approval. So can't reject"* — Kasey, 2026-05-04

Once an admin approves a submission, the status is locked. There is **no path** to revert approved → rejected. This removes a whole class of edge cases:

- No claw-back of share-stars earned from the approved submission
- No revocation of the +1 Visit 10 progress
- No cancellation of vouchers minted by Visit Badge levels reached via the now-questionable visit
- No rollback of badge tier awards

If admin needs to remove a submission entirely (e.g. legal / abuse), the submission row is deleted; downstream awards stay intact (treated as detached history).

---

## Day-one launch — no backfill anywhere

> *"After they submit their verification form. They would likely start with 0 of course, visit rank 0, all category badges 0."* — Kasey, 2026-05-06

When a new user completes the verification form, they start at **0 across every badge**:

- **Visit Badge:** 0 tasks completed (no badge yet)
- **Restaurant / Cafe / Bar / Hotel Badges:** 0 visits (no badge yet)

Existing approved submissions from before the user verifies — or before the new model launches — **do not** count toward any badge counter. Every user begins fresh from the moment verification completes.

This rule applies uniformly:
- Existing R/C/B approvals do not seed the Visit 10 cycle (cycle starts at 0/10).
- Existing approvals in any category do not seed that Category Badge counter.
- Daily check-in is open to all verified members from day 1 — no approved-submission pre-requirement.

---

## Visit Badge tiers (summary)

> **Canonical source: [`badges.md`](badges.md) §"Visit Badge".** This section is a summary for cross-reference; the full L1/L2/L3 sub-thresholds + reference TypeScript live in `badges.md`. If anything below disagrees with `badges.md`, the latter is correct.

The Visit Badge is the user-facing badge that **mints vouchers on level-up** and drives the profile picture frame. Driven by **cumulative completed Visit 10 cycles** (5 / 15 / 35 thresholds for Silver / Gold / Platinum, with L1/L2/L3 sub-thresholds within each tier).

| Tier | Cumulative completed cycles | Voucher tier minted on each level | Profile frame |
|---|---|---|---|
| Bronze | 1, 2, 3 | Bronze (×3) — 3-star or equivalent Airbnb voucher | Bronze frame |
| Silver | 5, 7, 10 | Silver (×3) — 3–4 star hotel or equivalent Airbnb voucher | Silver frame |
| Gold | 15, 20, 27 | Gold (×3) — 4–5 star hotel or equivalent Airbnb voucher | Gold frame |
| Platinum | 35, 40, 45 | Platinum (×3) — Specialty / 5-star / Resort and Airbnb equivalent voucher | Platinum frame |

A user who reaches Platinum L3 has earned 12 lifetime vouchers (3 of each tier). Full voucher schema + redemption flow in [`badge-rewards.md`](badge-rewards.md).

---

## UI surfaces

| Surface | What it shows |
|---|---|
| **Tasks tab → My Task subtab** | "Submit 10 Proof of Travels" card with `6 (+2) / 10` notation, 0-2-4-6-8-10 tick scale, extras zone tinted amber. **"Use 100 ★ for +1 Progress"** trade button when wallet ≥ 100 and cycle < 4 extras. Star wallet status. Three extra-task tiles. Visit Badge card. Last 3 history entries. |
| **Tasks tab → Submit Proof subtab** | Visit submission form (Date Visit → Partner Store → Receipt → Selfie → Submit). Social Media Share card (link / screenshot + verify) for approved submissions. |
| **Tasks tab → Rewards subtab** | Star wallet hero. **"Complete Tasks & Claim"** button when active cycle = 10/10. Voucher inventory (claimable + redeemed). Trade button (mirrors My Task subtab for convenience). |
| **Badges page** | Visit Badge tile + 4 category badge tiles. Each shows current tier+level + threshold to next level. |
| **Anywhere user avatar appears** | Avatar wrapped in a tier frame derived from Visit Badge tier. See [`badges.md`](badges.md) §"Profile picture frame". |
| **Profile tab** | **Do not display stars or credits here** — Kasey explicitly excluded the profile tab from the progression UI. (The avatar with frame still shows.) |

### Visit 10 card — example states

```
Submit 10 Proof of Travels       6 (+2) / 10        [Use 100 ★ for +1 Progress]
Submit 10 Proof of Travels       6 (+4) / 10        [Complete Tasks & Claim]   ← claimable
Submit 10 Proof of Travels       10 / 10            [Complete Tasks & Claim]   ← claimable, no extras
```

The `(+N)` annotation reflects star-trades applied to the active cycle (max +4). Visits portion (left) is real R/C/B submissions only.

### History feed — event types

| Event | Example row |
|---|---|
| Approved submission | `{date} • {partner_store} • Approved` |
| Share verified | `{date} • Shared {partner_store} on {platform} • +15 ★` |
| Daily streak milestone | `{date} • 14-day streak completed • +50 ★` |
| Referral qualified | `{date} • {invitee_name} qualified (L1) • +100 ★` |
| Stars traded for progress | `{date} • Used 100 ★ for +1 Progress` |
| Cycle completed | `{date} • Visit 10 Task completed • +1 voucher` |
| Visit Badge earned | `{date} • Reached {tier} {level}` |
| Category Badge earned | `{date} • Cafe Badge — Silver L1` |
| Voucher redeemed | `{date} • Redeemed {reward_kind}` |

Latest 3 surface on My Task; full feed on the History page. See [`history-feed.md`](history-feed.md).

---

## Storage model

> Implementation notes — finalize during build phase.

- **`star_wallet`** (per user): integer balance.
  - Columns: `(user_id, balance, updated_at)`.
  - Trade button enabled when `balance >= 100 AND active cycle has < 4 extras`.
- **`star_ledger`** (per event): every star award and every trade-to-progress event.
  - Columns: `(user_id, delta_stars, reason, source_id, source_type, created_at)`.
  - `reason` ∈ `{ share_facebook, share_instagram, share_tiktok, share_all_three_bonus, daily_streak_14, l1_referral, l2_referral, conversion_to_progress }`.
- **`visit_progress`** (per active cycle): the user's current Visit 10 cycle.
  - Columns: `(user_id, cycle_id, real_visits, extras_applied, opened_at, closed_at)`.
  - `real_visits + extras_applied = 10` triggers the claim-eligible state. Cycle closes on Complete Tasks tap, not automatically.
- **`submission_shares`**: one row per (submission, platform) verified share. Unique key on `(submission_id, platform)`.
- **`daily_checkins`**: audit table; one row per (user, KL-day). Uniqueness on `(user_id, checkin_date)`. KL = `Asia/Kuala_Lumpur` per Kasey.
- **`vouchers`**: minted on **Visit Badge level-up** (database trigger on `user_badges` insert filters `badge_kind='visit'`). Tier matches the level being entered. `redeemed_at` set when user taps Redeem; `fulfilled_at` set when admin marks the request done in Redeem Req. Schema sketch in [`badge-rewards.md`](badge-rewards.md).

Per-category badge counts are derived: `SELECT count(*) FROM submissions WHERE user_id = ? AND status = 'approved' AND category = ?`. No separate table needed.

Visit Badge is derived from completed-cycle count. No separate table needed.

Approvals are final → no `claw-back` table or revocation logic required.

---

## Resolved questions

| # | Question | Answer | Locked |
|---|---|---|---|
| 1 | Per-category cycles or one cumulative cycle? | One cumulative cycle across R/C/B. 6-visit floor, +4 extras ceiling. | 2026-05-03 |
| 2 | What unit do extras use? | **Stars.** 100 stars = +1 progress (manual trade). Cap +4 per cycle. | 2026-05-03 |
| 3 | Do visits earn stars? | No. Stars come only from extra tasks. Visits earn Visit 10 progress directly. | 2026-05-03 |
| 4 | Auto-claim or manual claim? | **Manual cycle close.** "Complete Tasks" button at 10/10 closes the cycle. Voucher mint is then automatic via the level-up trigger (revised 2026-05-10 — no longer minted per cycle, only on Visit Badge level threshold). | 2026-05-03 / 2026-05-10 |
| 5 | What drives the Visit Badge? | Cumulative **completed cycles** (5 / 15 / 35). | 2026-05-03 |
| 6 | Are Category Badges affected by extras? | **No.** They track real submissions only. | 2026-05-03 |
| 7 | Can Hotel submissions be shared for stars? | **Yes.** Hotel itself stays excluded from Visit 10 cycle progress. | 2026-05-03 |
| 8 | L1 / L2 referral star values | **L1 = 100 stars, L2 = 50 stars.** | 2026-05-03 |
| 9 | Daily streak length / reward | **14 consecutive days = 50 stars.** Recurring; KL timezone. | 2026-05-04 |
| 10 | Share star rates per platform | **15 / 15 / 15 + 5 bonus.** Max 50 per approved submission. | 2026-05-03 |
| 11 | Badge model — how many badges? | **5 in v1:** Visit Badge + 4 category badges (R/C/B/H). Experience deferred. | 2026-05-06 |
| 12 | Per-category badge thresholds | B1=5, B2=10, B3=20, S1=30, S2=40, S3=50, G1=60, G2=70, G3=80, P1=90, P2=100, P3=120 visits | 2026-05-04 |
| 13 | Category Badge rewards | Pending vendor sponsorship. v1 Category Badge tiles show progression only — no reward callout, no "Coming soon" wording (Kasey 2026-05-07). | 2026-05-04 / 2026-05-07 |
| 14 | Voucher reward kinds | Bronze = 3-star/Airbnb; Silver = 3–4 star hotel/Airbnb; Gold = 4–5 star hotel/Airbnb; Platinum = Specialty/5-star/resort + Airbnb. | 2026-05-04 |
| 15 | Backfill on launch day? | **No.** Verified members start at 0 across **all 5 badges**. No existing-submissions carryover anywhere. | 2026-05-06 |
| 16 | Claw-back when admin reverses approval? | **N/A** — admin cannot reverse an approval. Once approved, locked. | 2026-05-04 |
| 17 | Daily check-in eligibility | All verified members from day 1. No approved-submission pre-requirement. | 2026-05-04 |
| 18 | Day boundary timezone | `Asia/Kuala_Lumpur` (= MY time). | 2026-05-04 |
| 19 | Profile picture frame | Driven by Visit Badge tier. 4 frame assets in [`assets/images/tier_frame/`](../../assets/images/tier_frame/). Swaps on tier crossing. | 2026-05-06 |
| 20 | Voucher mint trigger | **Visit Badge level-up** (12 lifetime per user — 3 of each tier). Earlier model minted one per cycle close; revised 2026-05-10 because per-cycle minting overproduced vouchers (45 cycles → 45 vouchers vs the new 12-max). Category Badges stay reward-less per Kasey 2026-05-07. | 2026-05-10 |
| 21 | Category Badge rewards (broader scheme) | Parked. wegood4u briefly considered minting on category badge level-ups too (up to 60 lifetime per user); reverted 2026-05-10 to keep volume manageable. Kept on the table for Kasey's input. | 2026-05-10 |

---

## Still open

- **Hotel "bigger claims" reward path** — Kasey referenced larger Hotel-only rewards but never specified mechanism. Hotel still has a Category Badge counter and earns share-stars, but its own dedicated reward track is undefined.
- **Final hashtag list** for share verification — Kasey: *"I send you the hashtag later"*.
- **Voucher inventory sourcing** — partner integration (Airbnb, hotel chains) vs honor-system codes, TBD before redemption ships.
