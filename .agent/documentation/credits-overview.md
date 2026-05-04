# Credits System — Overview & Rules

> Source: product discussions with Kasey Fong (WhatsApp). Latest lock: **2026-05-04** — daily streak revised to 50 stars / 14 days, voucher rewards upgraded across all tiers, ranks split into 6 separate progressions, no backfill, approvals are final.
> Pair with [`extra-tasks.md`](extra-tasks.md) (the three star-earning loops), [`referral-system.md`](referral-system.md) (referral tree + qualification), [`badges.md`](badges.md) (6-rank progression model), and [`badge-rewards.md`](badge-rewards.md) (voucher mapping).

---

## The model in one diagram

```
  Approved R/C/B visit  ─────────►  +1 to Visit 10 progress
                                     (real visits — minimum 6 of 10 per cycle)
                                     +1 to that category's rank counter

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
                    1 voucher minted at user's Visit Rank tier
                                     │
                          Cycle resets to 0/10
                          Star wallet preserved
```

---

## Two separate progress concepts

### A. Visit 10 Task — single cumulative reward cycle

- **One** counter, cumulative across **Restaurant + Cafe + Bar** (any mix counts).
- 10 progress units in a cycle = 1 voucher.
- **Floor: 6 real visits** must be approved R/C/B submissions in any combination (e.g. 4 cafe + 1 restaurant + 1 bar). The user does **not** need to visit 10 of any single category.
- **Ceiling: +4 extras** from stars per cycle. User manually trades 100 stars for +1 progress (max 4 trades per cycle). Star wallet retains leftover after each trade.
- Reward claim is **manual**: at 10/10, a "Complete Tasks" button mints 1 voucher, resets the counter to 0/10, and re-evaluates the Visit Rank if a tier threshold was crossed.
- The Visit 10 cycle drives **Visit Rank** (the user-facing rank that gates voucher reward kind). See [`badges.md`](badges.md).

> *"i was thinking, our rewards based on 10 visit (6 from physical shop, 4 from task -optional). doesnt require for 10 restaurant or 10 bar or 10 cafe. 6 physical shop can be 4 cafe, 1 restaurant, 1 bar"* — Kasey, 2026-05-03
> *"once they complete the task, they press complete task, then they will get voucher in rewards tab"* — Kasey, 2026-05-03
> *"10 visit task can be repeat after each cycle"* — Kasey, 2026-05-04

### B. Per-category Ranks — drive per-category badges

Each approved submission also increments that category's per-category rank counter. Five separate ranks: **Cafe / Bar / Restaurant / Hotel / Experience**.

- Rank counters track **real approved submissions only** — extras (referral / share / streak) **never** move them.
- Rank progression: Bronze L1 (5) → Bronze L2 (10) → Bronze L3 (20) → Silver L1 (30) → … → Platinum L3 (120). Full table in [`badges.md`](badges.md).
- Per-category rank rewards are **future** ("coming soon" — vendor sponsorship pending). Rank UI ships in v1; rewards wire up later.

> *"this rank is for 10 visit rank. and cafe have its own rank"* — Kasey, 2026-05-04
> *"this will be rewards later, once i got sponsorship from vendors"* — Kasey, 2026-05-04
> *"the badges only apply those who really visit the cafe, restaurant and bar"* — Kasey, 2026-05-03

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

All four categories (R/C/B/Hotel) are eligible for share stars. Hotel-derived share stars feed the same wallet that can be traded into the R/C/B Visit 10 cycle.

> *"14 days = 50 star"* — Kasey, 2026-05-04 (revised down from earlier 100; reasoning: low-effort activity warrants smaller reward)

---

## Eligible categories

| Category | Earns Visit 10 progress from real submission? | Earns share stars? | Has per-category rank? |
|---|---|---|---|
| Restaurant | Yes (+1) | Yes (15/15/15+5) | Yes |
| Cafe | Yes (+1) | Yes | Yes |
| Bar | Yes (+1) | Yes | Yes |
| Hotel | **No** — separate "bigger claims" track (TBD) | **Yes** (stars feed R/C/B Visit 10 wallet) | Yes |
| Experience | No — separate track, not specified | No | Yes |

> Hotel sharing extension confirmed Kasey 2026-05-03: *"All can"*.

---

## Cycle close + reward claim

1. Active cycle's progress reaches 10/10 (any combination of ≥6 real visits + ≤4 extras).
2. UI shows a primary **"Complete Tasks"** button on the Visit 10 card.
3. User taps → 1 voucher of the user's **current Visit Rank tier** is minted into the Rewards subtab.
4. Cycle counter resets to 0/10. Star wallet retains any leftover stars.
5. Visit Rank is re-evaluated against cumulative completed cycles — may award a Silver / Gold / Platinum badge if a threshold was just crossed.

The claim is **manual** — vouchers do not auto-mint at 10/10. This avoids surprising users mid-flow and lets them see the milestone before consuming it.

---

## Approvals are final

> *"for approved submission we wouldn't able to redo the approval. So can't reject"* — Kasey, 2026-05-04

Once an admin approves a submission, the status is locked. There is **no path** to revert approved → rejected. This removes a whole class of edge cases:

- No claw-back of share-stars earned from the approved submission
- No revocation of the +1 Visit 10 progress
- No cancellation of vouchers minted by cycles that included the now-questionable visit
- No rollback of rank tier badges earned

If admin needs to remove a submission entirely (e.g. legal / abuse), the submission row is deleted; downstream awards stay intact (treated as detached history).

---

## Day-one launch — no backfill

> *"No, all verified members can immediately began their daily checkin tasks"* — Kasey, 2026-05-04

When the new model ships:

- Existing approved R/C/B submissions **do not** retroactively count toward any user's first Visit 10 cycle. Everyone starts at `0/10`.
- Existing approved submissions **do** count toward the new per-category rank counters (so a user with 6 prior cafe approvals starts at Cafe Rank Bronze L1 = 5 visits, with 1 toward Bronze L2).
- Daily check-in is open to all verified members from day 1 — no approved-submission pre-requirement.

---

## Visit Rank tiers

Visit Rank is the user-facing tier that gates voucher kind on cycle claim. Driven by **cumulative completed Visit 10 cycles** (5 / 15 / 35 thresholds for Silver / Gold / Platinum, with L1/L2/L3 sub-thresholds within each tier).

**Full table + reference TypeScript in [`badges.md`](badges.md).**

| Tier | Cumulative completed cycles | Voucher kind on next cycle close |
|---|---|---|
| Bronze | 1–4 | 3-star or equivalent Airbnb voucher |
| Silver | 5–14 | 3–4 star hotel or equivalent Airbnb voucher |
| Gold | 15–34 | 4–5 star hotel or equivalent Airbnb voucher |
| Platinum | 35+ | Specialty / 5-star / Resort and Airbnb equivalent voucher |

Voucher tier is **frozen at mint time** (the user's Visit Rank when they tap Complete Tasks). Future tier-ups don't retroactively upgrade earlier vouchers. Full mapping + storage shape in [`badge-rewards.md`](badge-rewards.md).

---

## UI surfaces

| Surface | What it shows |
|---|---|
| **Tasks tab → My Task subtab** | "Submit 10 Proof of Travels" card with `6 (+2) / 10` notation, 0-2-4-6-8-10 tick scale, extras zone tinted amber. **"Use 100 ★ for +1 Progress"** trade button when wallet ≥ 100 and cycle < 4 extras. Star wallet status. Three extra-task tiles. Latest-earned Visit Rank badge card. Last 3 history entries. |
| **Tasks tab → Submit Proof subtab** | Visit submission form (Date Visit → Partner Store → Receipt → Selfie → Submit). Social Media Share card (link / screenshot + verify) for approved submissions. |
| **Tasks tab → Rewards subtab** | Star wallet hero. **"Complete Tasks & Claim"** button when active cycle = 10/10. Voucher inventory (claimable + redeemed). Trade button (mirrors My Task subtab for convenience). |
| **Badge / Ranks page** | Visit Rank tile + 5 per-category rank tiles. Each shows current tier+level + threshold to next level. |
| **Profile tab** | **Do not display stars or credits here** — Kasey explicitly excluded the profile tab from the progression UI. |

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
| Visit Rank earned | `{date} • Reached {tier} {level}` |
| Per-category rank earned | `{date} • Cafe Rank — Silver L1` |
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
- **`vouchers`**: minted on cycle close. Tier is snapshotted at mint time. Schema sketch in [`badge-rewards.md`](badge-rewards.md).

Per-category rank counts are derived: `SELECT count(*) FROM submissions WHERE user_id = ? AND status = 'approved' AND category = ?`. No separate table needed.

Visit Rank is derived from completed-cycle count. No separate table needed.

Approvals are final → no `claw-back` table or revocation logic required.

---

## Resolved questions

| # | Question | Answer | Locked |
|---|---|---|---|
| 1 | Per-category cycles or one cumulative cycle? | One cumulative cycle across R/C/B. 6-visit floor, +4 extras ceiling. | 2026-05-03 |
| 2 | What unit do extras use? | **Stars.** 100 stars = +1 progress (manual trade). Cap +4 per cycle. | 2026-05-03 |
| 3 | Do visits earn stars? | No. Stars come only from extra tasks. Visits earn Visit 10 progress directly. | 2026-05-03 |
| 4 | Auto-claim or manual claim? | **Manual.** "Complete Tasks" button at 10/10 mints the voucher. | 2026-05-03 |
| 5 | What drives Visit Rank? | Cumulative **completed cycles** (5 / 15 / 35). Same model as before, applied to the new unified cycle. | 2026-05-03 |
| 6 | Are per-category counters affected by extras? | No. They track real submissions only — used on the Ranks page. | 2026-05-03 |
| 7 | Can Hotel submissions be shared for stars? | Yes. Hotel itself stays excluded from Visit 10 cycle progress. | 2026-05-03 |
| 8 | L1 / L2 referral star values | L1 = 100 stars, L2 = 50 stars. Two L2 = 100 stars = +1 progress. | 2026-05-03 |
| 9 | Daily streak length / reward | **14 consecutive days = 50 stars.** Single payout at milestone, recurring. KL TZ. | 2026-05-04 |
| 10 | Share star rates per platform | 15 / 15 / 15 + 5 bonus (FB / IG / TikTok / all-three-bonus). Max 50 per approved submission. | 2026-05-03 |
| 11 | Per-category rank model | 6 ranks total (Visit + 5 category). Per-category thresholds B1=5, B2=10, B3=20, S1=30, S2=40, S3=50, G1=60, G2=70, G3=80, P1=90, P2=100, P3=120. | 2026-05-04 |
| 12 | Per-category rank rewards | "Coming soon" — vendor sponsorship pending. Rank UI ships in v1; rewards wire up later. | 2026-05-04 |
| 13 | Voucher reward kinds | Bronze = 3-star/Airbnb; Silver = 3–4 star hotel/Airbnb; Gold = 4–5 star hotel/Airbnb; Platinum = Specialty/5-star/resort + Airbnb equivalent. | 2026-05-04 |
| 14 | Backfill on launch day? | **No.** Verified members start fresh (Visit 10 = 0/10). Existing approved submissions DO carry into per-category rank counters. | 2026-05-04 |
| 15 | Claw-back when admin reverses approval? | **N/A** — admin cannot reverse an approval. Once approved, locked. | 2026-05-04 |
| 16 | Daily check-in eligibility | All verified members from day 1. No approved-submission pre-requirement. | 2026-05-04 |
| 17 | Daily check-in activity gate | v1: just check-in button. v2: blog/video viewing + foreground time tracking (deferred). | 2026-05-04 |
| 18 | Day boundary timezone | `Asia/Kuala_Lumpur` (= MY time). | 2026-05-04 |

---

## Still open

- **Hotel "bigger claims" reward path** — Kasey referenced larger Hotel-only rewards but never specified mechanism. Hotel still has a per-category rank counter and earns share-stars, but its own dedicated reward track is undefined.
- **Final hashtag list** for share verification — Kasey: *"I send you the hashtag later"*.
- **Voucher inventory sourcing** — partner integration (Airbnb, hotel chains) vs honor-system codes, TBD before redemption ships.
