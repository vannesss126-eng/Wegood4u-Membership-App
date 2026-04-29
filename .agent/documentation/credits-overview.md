# Credits System — Overview & Rules

> Source: product discussion with Kasey Fong on 2026-04-21, 2026-04-22, and 2026-04-23 (WhatsApp).
> Pair with [`referral-system.md`](referral-system.md), [`badge-rewards.md`](badge-rewards.md), and [`architecture-brief.md`](architecture-brief.md).

---

## What credits are

**Credits** are the single unit of progress in Wegood4u. They replace the earlier "points" concept entirely — the Lorem ipsum mockup showing "200 Point balance" is dropped.

> "no point" … "we dont have other point system" … "we dont want complicate it" … "we remove the point system, we just use task" — Kasey, 2026-04-21

There is exactly one in-app currency (credits). The flow is:

```
approved submission (R/C/B)  →  +1 credit toward that category's task
qualified referral           →  +1 credit auto-placed on nearest-complete task
10 credits in a category     →  1 task completed in that category
1 task                       →  1 hotel-stay voucher
N tasks                      →  badge tier (see below)
```

---

## Eligible categories

Only **Restaurant, Cafe, Bar** participate in the credits/task system — they earn credits from approved submissions and receive referral auto-placements. Each has its own per-category task counter (e.g. `Bar Bronze Exploration · 5 of 10`).

**Hotel** still appears on the My Tasks tracker with a simple approved-submission counter (for visibility/engagement), but Hotel submissions do **not** earn credits, and referral credits never auto-place on Hotel. Hotel is excluded from badge tier task counts.

**Experience** does not appear in the credits/task system. It follows the separate "bigger claims" reward path that hasn't been specified yet.

> "restaurant cafe and bar only" … "hotel and experience will fall into other categories" … "hotel will reward bigger claims" — Kasey, 2026-04-22
>
> Hotel shown-but-excluded on My Tasks confirmed 2026-04-23.

---

## Earning credits

| Event | Credit delta | Where it applies |
|---|---|---|
| Approved submission in Restaurant / Cafe / Bar | +1 | Numerator of that same category's task (e.g. cafe `4/10` → `5/10`) |
| Level 1 referral qualifies | +1 to inviter | **Auto-placed** on the inviter's nearest-complete category task as **+1 numerator** (e.g. bar `5/10` → `6/10`). Displayed on the progress bar as a **gold-coloured tick**, and beside the approved count as `(+1)`. Also +1 to the invitee per [`referral-system.md`](referral-system.md). |
| Level 2 referral qualifies | +0.5 to top-level affiliate | Accumulates. Every **2** qualified Level 2 events = 1 full credit, then auto-placed using the same nearest-complete rule (again as +1 numerator / gold tick). |
| Approved submission in Hotel | +1 on Hotel's visibility counter only | No credit toward task completion, no referral bonus, no badge tier contribution. Shown on My Tasks for engagement. |
| Approved submission in Experience | 0 | Experience is on the separate "bigger claims" track and not surfaced in My Tasks. |

Qualification (for both Level 1 and Level 2) = invitee is verified **and** has at least one approved submission, per [`referral-system.md`](referral-system.md).

### Level 2 example
> "A refer B and C. B refer D, A get 0.5. B refer E, get 0.5. Must have 2 people only rewards 1 credit." — Kasey

- A invites B and C (Level 1).
- B invites D → A accumulates 0.5.
- B invites E → A accumulates another 0.5 → A's pair completes → +1 credit auto-placed.

Level 2 is **even-count only** — a single 0.5 sits in the accumulator until paired.

This supersedes the "Level 2 is display-only" line in [`referral-system.md`](referral-system.md) — that doc should be updated when the credit ledger is built.

---

## Referral auto-placement rules

When a referral credit is awarded (Level 1, or a completed Level 2 pair), the system **automatically** applies it to one of the user's eligible-category tasks as a **+1 numerator increment** (gold tick). Users do **not** choose where the credit lands.

> "cannot assign . it will make our progress heavy" — Kasey, 2026-04-22 (rejecting the idea of letting users assign credits to a chosen category)

### Why +1 numerator, not −1 denominator (decided 2026-04-23)

Originally the referral bonus was modelled as a **denominator decrement** (e.g. `5/10` → `5/9`). This created two UI problems:
1. The tick-mark scale becomes irregular (`0, 2, 4, 6, 8, 9`), confusing to read.
2. Task completion could fire at different totals (9 vs 10) depending on referral history.

Switched to **+1 numerator increment**: the denominator is always `10`, the tick-mark scale stays `0, 2, 4, 6, 8, 10`, and referral bonuses appear as gold ticks filling the bar faster. Task completes cleanly at numerator == 10.

> "so if its +1, we dont need to update the track progress UI, just immediately add one" — user, 2026-04-23
> "Thats why Im thinking +1 would be better then -1 sir" — Kasey, 2026-04-23

### Placement algorithm
1. Look at the user's three eligible-category tasks (Restaurant, Cafe, Bar).
2. Pick the one **nearest to completion** (highest `numerator / 10` ratio).
3. Add a `+1` row to that category's ledger with `reason ∈ {level1_referral, level2_pair}`.

#### Worked example (from chat)
User has three ongoing tasks:

| Category | Progress |
|---|---|
| Cafe | 4/10 |
| Bar | 5/10 ← closest |
| Restaurant | 1/10 |

A referral qualifies → bar becomes `6/10`, displayed as `5 (+1) / 10` with a gold tick on the progress bar at position 6.

### Tie-break order
When multiple categories share the same closest-to-complete ratio: **Restaurant → Cafe → Bar**.

### Per-category cap (per cycle)
> "Each categories must only max reduce to 6" … "Means each categories can claim 4 only" … "Per cycle of task of each categories" — Kasey
>
> "so the maximum add is 4 gold line ya" — Kasey, 2026-04-23

- Each category can receive **at most 4 referral +1 increments per cycle** (i.e. up to 4 gold ticks on the progress bar).
- At most 4 of the 10 credits needed to complete a cycle can come from referrals; the remaining ≥6 must come from approved submissions.
- Once a category task completes (numerator reaches 10), a new cycle begins with numerator reset to 0 and the gold-tick counter reset.
- If the nearest-complete category has already received its 4 gold ticks for this cycle, fall through to the next-closest eligible category by the same tie-break rule.

### Per-invitee constraint
> "This is for 1st time only ya." … "Means every submission of new user on new successfully approval" — Kasey

Each invitee triggers **exactly one** referral credit for their inviter — on the invitee's first qualifying approved submission. Their subsequent approved submissions don't grant further referral credits.

---

## Tasks → Rewards

- **1 completed task = 1 hotel-stay voucher** (claimable in the Rewards subtab).
  > "1 task = 1 hotel stay" … "yes. hotel voucher" — Kasey
- Tasks are unlimited — completing one in a category resets that category's counter and starts a new cycle.

### Badge tiers + levels

Tier and level are a single global value per user, derived from cumulative completed tasks across Restaurant + Cafe + Bar (Hotel excluded). Tier thresholds are 5 / 15 / 35 tasks for Silver / Gold / Platinum (Bronze covers tasks 1–4); each tier subdivides into 3 levels.

**The full tier+level table, reference TypeScript implementation, reward mapping, asset URL pattern, and trigger wiring all live in [`badges.md`](badges.md).** That document is the source of truth — this file should not duplicate it.

> "1-5 is Bronze / 5-15 is Silver / 15-35 is Gold / 35p onwards is Platinum" — Kasey
> "5 task completion = 50 successfull approval = level up to Silver" — Kasey
> "if user completed 4 task = 40 shop, he start a new task, he still in bronze" — Kasey
>
> L1/L2/L3 sub-thresholds resolved 2026-04-23 — see [`badges.md`](badges.md).

### Hotel "bigger claims" track — TBD
Hotel (and possibly Experience) don't feed the credits/task loop. Kasey said hotels "reward bigger claims" but didn't specify the mechanism. **Confirm with Kasey before designing this.**

---

## Where credits / tasks are surfaced in the UI

| Screen | What to show |
|---|---|
| **Tasks tab → My Tasks subtab** | Primary progress surface. Top section: per-category `(numerator / 10)` progress bars for Restaurant, Cafe, Bar (credit-earning) + Hotel (visibility-only). Gold ticks on the progress bar represent referral +1s. Middle section: latest-earned badge card with `→` to full badge page. Bottom section: last 5 history entries with `View All` to full history page. |
| **Tasks tab → Submit subtab** | Verified-member submit form (Date Visit → Partner Store → Receipt → Selfie → Submit). Replaces the alert with a dedicated "Proof Submitted" screen. |
| **Tasks tab → Rewards subtab** | Primary home for voucher redemption. Claimable once the user has ≥1 completed task. Design not yet produced — current in-app Rewards page stays as placeholder. |
| **Badge detail page** (routed from My Tasks badge card `→`) | 4 category sections (R/C/Bar/Hotel), each a horizontal list of tier/level badges. Per-category share CTA launches a Badge Collection share card. |
| **Profile tab** | **Do NOT show credits here** — Kasey explicitly rejected putting credits in profile. |

### Ongoing-task status bar — example
```
Ongoing Task
Bar Bronze Exploration   5 (+1) / 10    ← 1 gold tick on progress bar
Cafe Bronze Exploration  4 / 10
Restaurant Bronze        1 / 10
Hotel                    3 / 10         ← counter only, no credits / no referrals
```
The `(+N)` annotation and gold ticks reflect referral credits auto-placed on that category. Submission count and referral count are surfaced separately so users can see *why* progress moved without them submitting anything.

### History feed — event types

Per Kasey, 2026-04-23, the History page must cover more than approved submissions:

| Event | Example row |
|---|---|
| Approved submission | `{date} • {partner_store} • Approved` |
| Badge earned | `{date} • Earned Silver Level 1` |
| Task completed | `{date} • Bar Bronze Exploration completed • +1 voucher` |
| Reward redeemed | `{date} • Redeemed 3-star hotel voucher` |

> "History not only approved submission but also badge updates, track progress complete, and reward used" — user, 2026-04-23
> "Yes" — Kasey, 2026-04-23

The latest 5 events surface on the My Tasks subtab; the full paginated feed lives on the standalone History page.

---

## Resolved questions (as of 2026-04-22)

| # | Question | Answer |
|---|---|---|
| 1 | Does referral give a credit, or reduce task minimum? | **Credit.** A referral manifests as **+1 numerator** on the nearest-complete category task (denominator stays fixed at 10). Displayed as a gold tick on the progress bar. Switched from −1 denominator on 2026-04-23 to keep the tick scale at `0, 2, 4, 6, 8, 10`. |
| 2 | Level 2 fractional handling | Accumulate 0.5 events; every pair = 1 full credit. Even count required. |
| 3 | Per-category vs global tasks | **Per-category.** Three concurrent credit-earning tasks (Restaurant, Cafe, Bar) plus Hotel as a visibility-only counter. Denominator fixed at 10. |
| 4 | Fractional credits in storage | **Store as integers.** Level 2 0.5s live in a small accumulator (or a `pending_half_credits` counter); only commit to the ledger as integer +1 when the pair completes. |
| 5 | Voucher caps / expiry | Skipped — no vouchers are wired up yet. Revisit when redemption is built. |
| 6 | Badge tier thresholds | **5 / 15 / 35** tasks for Silver / Gold / Platinum (updated 2026-04-23 from 5/15/25). Bronze is default. |
| 7 | Hotel on My Tasks | Shown with approved-submission counter; does not earn credits, is not a referral auto-placement target, does not contribute to badge tier. |
| 8 | L1/L2/L3 sub-level thresholds | Resolved 2026-04-23. Single global tier+level per user, derived from cumulative R/C/B task count. Full table + reference impl in [`badges.md`](badges.md). Same value mirrored across all 4 category rows on the badge detail page. |

---

## Still open

- **Hotel reward mechanic** — Hotel now has a visibility counter on My Tasks, but no reward path has been specified. Kasey referenced "bigger claims" but didn't define what a Hotel visit unlocks.
- **Experience category** — only mentioned in passing as "falls into other categories." Confirm whether it follows hotel's path or is its own thing.
- **Tie-break beyond Restaurant > Cafe > Bar** — what if all three are tied AND Restaurant has already received 4 gold ticks this cycle? Assume cascade Cafe → Bar, but confirm.
- **Cycle reset semantics** — when a task completes (numerator = 10), does the new cycle start at `0/10` or could leftover approved submissions roll over? Assume reset to `0/10` and gold-tick counter also resets.
- **Update to [`referral-system.md`](referral-system.md)** — the Level 2 = 0.5-credit rule and the +1-numerator auto-placement mechanic both override what's currently written there. That doc should be revised (not this one) when the credit ledger lands.

---

## Implementation notes (when ready to build)

- Derive the user's per-category task progress from a `credits_ledger` table:
  - `(user_id, category, delta_numerator, reason, source_submission_id, source_referral_id, cycle_id, created_at)`
  - `reason` ∈ `{ approved_submission, level1_referral, level2_pair }`
  - All rows: `delta_numerator = +1`. Denominator is the constant `10` and is not stored per row.
  - Direct approvals: `reason = 'approved_submission'`, `source_submission_id` set.
  - Referrals: `reason = 'level1_referral'` or `'level2_pair'`, `source_referral_id` set, `category` set by the placement algorithm at write-time.
- Level 2 half-credits live outside the ledger in a small `referral_half_credit_accumulator(user_id, count)` table or column. When `count` becomes even, write a `level2_pair` ledger row and decrement `count` by 2.
- A category's current numerator for the active cycle = `SUM(delta_numerator)` with matching `cycle_id`. The submission-vs-referral split for UI `5 (+1) / 10` display comes from filtering by `reason`. Once `numerator >= 10`, the cycle closes: increment task count, mint 1 voucher (or queue it), open a new cycle.
- Task count = sum of completed cycles across **R/C/B only** (Hotel excluded). Don't store separately — derive.
- Badge tier = `tier_from_task_count(task_count)` with the **5/15/35** thresholds. Derive.
- Per-cycle 4-referral cap is enforced at write-time by the placement algorithm: count existing rows with `reason IN ('level1_referral','level2_pair')` in the active cycle for that category; if already 4, skip to next category in the tie-break order.
- History page events pull from multiple sources: `submissions` (approved), `user_badges` (earned_at), completed `cycle_id` rows in `credits_ledger`, and the future voucher-redemption table. A unified `user_activity` view/feed is the simplest rendering path.
