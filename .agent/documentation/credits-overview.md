# Credits System — Overview & Rules

> Source: product discussion with Kasey Fong on 2026-04-21 and 2026-04-22 (WhatsApp).
> Pair with [`referral-system.md`](referral-system.md) and [`architecture-brief.md`](architecture-brief.md).

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

Only **Restaurant, Cafe, Bar** participate in the credits/task system. Each of these has its own per-category task counter (e.g. `Bar Bronze Exploration · 5 of 10`).

**Hotel** and **Experience** do **not** earn credits and do **not** have task counters. They follow a separate "bigger claims" reward path that hasn't been specified yet.

> "restaurant cafe and bar only" … "hotel and experience will fall into other categories" … "hotel will reward bigger claims" — Kasey, 2026-04-22

---

## Earning credits

| Event | Credit delta | Where it applies |
|---|---|---|
| Approved submission in Restaurant / Cafe / Bar | +1 | Numerator of that same category's task (e.g. cafe `4/10` → `5/10`) |
| Level 1 referral qualifies | +1 to inviter | **Auto-placed** on the inviter's nearest-complete category task — manifests as the denominator dropping by 1 (e.g. bar `5/10` → `5/9`). Also +1 to the invitee per [`referral-system.md`](referral-system.md). |
| Level 2 referral qualifies | +0.5 to top-level affiliate | Accumulates. Every **2** qualified Level 2 events = 1 full credit, then auto-placed using the same nearest-complete rule. |
| Approved submission in Hotel / Experience | 0 | These don't earn credits — they're on the separate "bigger claims" track. |

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

When a referral credit is awarded (Level 1, or a completed Level 2 pair), the system **automatically** applies it to one of the user's eligible-category tasks. Users do **not** choose where the credit lands.

> "cannot assign . it will make our progress heavy" — Kasey, 2026-04-22 (rejecting the idea of letting users assign credits to a chosen category)

### Placement algorithm
1. Look at the user's three eligible-category tasks (Restaurant, Cafe, Bar).
2. Pick the one **nearest to completion** (highest `numerator / current_denominator` ratio).
3. Decrement that category's denominator by 1.

#### Worked example (from chat)
User has three ongoing tasks:

| Category | Progress |
|---|---|
| Cafe | 4/10 |
| Bar | 5/10 ← closest |
| Restaurant | 1/10 |

A referral qualifies → bar becomes `5/9`.

### Tie-break order
When multiple categories share the same closest-to-complete ratio: **Restaurant → Cafe → Bar**.

### Per-category cap (per cycle)
> "Each categories must only max reduce to 6" … "Means each categories can claim 4 only" … "Per cycle of task of each categories" — Kasey

- Each category's denominator can drop **at most 4 times per cycle** (10 → 9 → 8 → 7 → 6, floor at 6).
- Once a category task completes, a new cycle begins with the denominator reset to 10.
- If the nearest-complete category has already hit its 4-reduction cap for this cycle, fall through to the next-closest eligible category by the same tie-break rule.

### Per-invitee constraint
> "This is for 1st time only ya." … "Means every submission of new user on new successfully approval" — Kasey

Each invitee triggers **exactly one** referral credit for their inviter — on the invitee's first qualifying approved submission. Their subsequent approved submissions don't grant further referral credits.

---

## Tasks → Rewards

- **1 completed task = 1 hotel-stay voucher** (claimable in the Rewards subtab).
  > "1 task = 1 hotel stay" … "yes. hotel voucher" — Kasey
- Tasks are unlimited — completing one in a category resets that category's counter and starts a new cycle.

### Badge tiers (cumulative tasks across all eligible categories)

| Tier | Tasks required |
|---|---|
| Bronze | default (no tasks required) |
| Silver | 5 tasks |
| Gold | 15 tasks |
| Platinum | 25 tasks |

### Hotel "bigger claims" track — TBD
Hotel (and possibly Experience) don't feed the credits/task loop. Kasey said hotels "reward bigger claims" but didn't specify the mechanism. **Confirm with Kasey before designing this.**

---

## Where credits / tasks are surfaced in the UI

| Screen | What to show |
|---|---|
| **Tasks tab → Rewards subtab** | Primary home for credit balance and voucher redemption. The current "Coming Soon" hotel-voucher card becomes claimable once the user has ≥1 completed task. |
| **Tasks tab → Badges subtab, top section** | "Ongoing Task" status bar above "Your Badges". Show all eligible categories' progress (e.g. `Bar Bronze Exploration · 5/9`). Category label lives here. |
| **Profile tab** | **Do NOT show credits here** — Kasey explicitly rejected putting credits in profile. |

### Ongoing-task status bar — example
```
Ongoing Task
Bar Bronze Exploration   5/9
Cafe Bronze Exploration  4/10
Restaurant Bronze        1/10
```
The reduced denominators (e.g. `5/9` instead of `5/10`) reflect referral credits already auto-placed.

---

## Resolved questions (as of 2026-04-22)

| # | Question | Answer |
|---|---|---|
| 1 | Does referral give a credit, or reduce task minimum? | **Both — they're the same thing.** A referral credit manifests as a -1 to the nearest-complete category task's denominator. |
| 2 | Level 2 fractional handling | Accumulate 0.5 events; every pair = 1 full credit. Even count required. |
| 3 | Per-category vs global tasks | **Per-category.** Three concurrent tasks (Restaurant, Cafe, Bar). Denominator default 10. |
| 4 | Fractional credits in storage | **Store as integers.** Level 2 0.5s live in a small accumulator (or a `pending_half_credits` counter); only commit to the ledger as integer +1 when the pair completes. |
| 5 | Voucher caps / expiry | Skipped — no vouchers are wired up yet. Revisit when redemption is built. |

---

## Still open

- **Hotel "bigger claims" mechanic** — completely undefined. What does a hotel visit reward, and how is it shown?
- **Experience category** — only mentioned in passing as "falls into other categories." Confirm whether it follows hotel's path or is its own thing.
- **Tie-break beyond Restaurant > Cafe > Bar** — what if all three are tied AND Restaurant has hit its 4-reduction cap? Assume cascade Cafe → Bar, but confirm.
- **Cycle reset semantics** — when a task completes (e.g. Bar `9/9`), does the new cycle start at `0/10` or could leftover visits roll over? Assume reset to `0/10`.
- **Update to [`referral-system.md`](referral-system.md)** — the Level 2 = 0.5-credit rule and the auto-placement mechanic both override what's currently written there. That doc should be revised (not this one) when the credit ledger lands.

---

## Implementation notes (when ready to build)

- Derive the user's per-category task progress from a `credits_ledger` table:
  - `(user_id, category, delta_numerator, delta_denominator, reason, source_submission_id, source_referral_id, cycle_id, created_at)`
  - `reason` ∈ `{ approved_submission, level1_referral, level2_pair }`
  - Direct approval rows: `delta_numerator = +1`, `delta_denominator = 0`.
  - Referral rows: `delta_numerator = 0`, `delta_denominator = -1`, with `category` set by the placement algorithm at write-time.
- Level 2 half-credits live outside the ledger in a small `referral_half_credit_accumulator(user_id, count)` table or column. When `count` becomes even, write a `level2_pair` ledger row and decrement `count` by 2.
- A category's current `(numerator, denominator)` for the active cycle = sum of deltas with matching `cycle_id`. Once `numerator >= denominator`, the cycle closes: increment task count, mint 1 hotel voucher (or queue it), open a new cycle.
- Task count = sum of completed cycles across all eligible categories. Don't store separately — derive.
- Badge tier = `tier_from_task_count(task_count)` with the 5/15/25 thresholds. Derive.
- Per-cycle 4-reduction cap is enforced at write-time by the placement algorithm: count existing `delta_denominator = -1` rows in the active cycle for that category; if already 4, skip to next category in the tie-break order.
