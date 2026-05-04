# History — Unified Activity Feed

> Source of truth for the activity feed surfaced as the **History** snippet on My Tasks and the standalone **History** page (`/tasks/history`).
> Pair with [`credits-overview.md`](credits-overview.md) (Visit 10 cycle + star events), [`extra-tasks.md`](extra-tasks.md) (share / streak events), [`referral-system.md`](referral-system.md) (referral events), and [`badges.md`](badges.md) (badge events).

---

## What History represents

A single chronological feed of everything that has *happened* on a user's account that they should see — submissions reviewed, shares verified, daily streaks completed, referrals qualified, stars converted into Visit 10 progress, cycles completed, badges earned, vouchers redeemed.

It's a **read** surface only. Nothing in History writes; events are recorded by other systems (admin review, share verifier, streak trigger, referral trigger, voucher redemption flow) and History merges them on read.

Two consumers share the same data:

| Surface | Page size | Purpose |
|---|---|---|
| **My Tasks → History snippet** | 5 most recent | At-a-glance list with `→` to the full page |
| **`/tasks/history`** | 10 per page, paginated | Full reverse-chronological log |

Both render identical rows; only the page size and the page-controls footer differ.

---

## Event types

| `event_type` | Source | Trigger condition | `event_at` | `target` | Trailing pill |
|---|---|---|---|---|---|
| `submission_approved` | `submissions` | `status = 'approved'` | `COALESCE(reviewed_at, updated_at, created_at)` | partner store name | `+1 Visit 10` (R/C/B only) |
| `submission_rejected` | `submissions` | `status = 'rejected'` | same as above | partner store name | — |
| `share_verified` | `submission_shares` | new row inserted with `status = 'verified'` | `verified_at` | `Shared {partner_store} on {platform}` | `+15 ★` (or `+5 ★` for the all-three bonus row) |
| `daily_streak_milestone` | `daily_checkins` aggregation | streak reaches a 14-day boundary | `awarded_at` | `14-day streak completed` | `+50 ★` |
| `referral_qualified` | `star_ledger` rows with `reason IN ('l1_referral','l2_referral')` | inserted when invitee transitions to Active | `created_at` | `{invitee_name} qualified ({L1\|L2})` | `+100 ★` or `+50 ★` |
| `stars_converted` | `star_ledger` rows with `reason = 'conversion_to_progress'` | user taps "Use 100 ★ for +1 Progress" trade button | `created_at` | `Stars → Visit 10 progress` | `+1 progress` |
| `cycle_completed` | `visit_progress` | user taps Complete Tasks; `closed_at` set | `closed_at` | `Visit 10 Task completed` | `+1 voucher` |
| `visit_rank_earned` | `user_badges JOIN badges` where `rank_kind='visit'` | new row | `earned_at` | `Visit Rank — {tier} L{level}` | — |
| `category_rank_earned` | `user_badges JOIN badges` where `rank_kind IN ('cafe','bar','restaurant','hotel','experience')` | new row | `earned_at` | `{Category} Rank — {tier} L{level}` | — |
| `voucher_redeemed` | `vouchers` | `redeemed_at IS NOT NULL` | `redeemed_at` | `Redeemed {reward_kind}` | — |

The `metadata` shapes per type are documented in the RPC migration. Clients should treat unknown `event_type` values as forward-compat — future event types may join later.

---

## Data source — `get_user_activity` RPC

```sql
get_user_activity(p_limit int DEFAULT 10, p_offset int DEFAULT 0)
RETURNS TABLE (event_type text, event_at timestamptz, target text, metadata jsonb, total_count bigint)
```

- **`SECURITY DEFINER` + `auth.uid()`** — clients never pass a `user_id`; the function reads the caller's session and filters internally. Equivalent to RLS without per-table policies.
- **`STABLE`** — safe to use in cached planner contexts.
- **`#variable_conflict use_column`** — disambiguates the OUT column `event_at` from inner CTE references. Without this, Postgres throws 42702.
- **Window-function total** — `COUNT(*) OVER ()` returns total event count in the same query so paginated UIs don't need a second round-trip.

### Why we chose an RPC over a view

- Pagination is materially cheaper as a parameterised function than a view + `LIMIT/OFFSET` from PostgREST.
- `SECURITY DEFINER` lets us join `user_badges → badges`, read `vouchers`, `submission_shares`, `daily_checkins`, and `star_ledger` without granting blanket SELECT.
- The `total_count` window column is much harder to express cleanly across multiple PostgREST requests on a view.

### Migration state

The current RPC ([20260426130000_fix_user_activity_ambiguous_column.sql](../../supabase/migrations/20260426130000_fix_user_activity_ambiguous_column.sql)) supports the legacy event set (`submission_approved`, `submission_rejected`, `badge_earned`, `task_completed`, `voucher_redeemed`).

A follow-up migration is required to add the new event types: `share_verified`, `daily_streak_milestone`, `referral_qualified`, `stars_converted`, `visit_rank_earned`, `category_rank_earned`, and to rename `task_completed` → `cycle_completed` to match the new model. That migration is **pending** — track in the implementation plan for the extra-tasks feature.

---

## Frontend wiring

### Hook — [`hooks/useActivity.ts`](../../hooks/useActivity.ts)

```ts
useActivity({ page = 1, pageSize = 10, enabled = true })
  → { events, totalCount, totalPages, hasMore, isLoading, error, refetch }
```

- `page` is **1-indexed** to match visible UI labels.
- `total_count` is a Postgres `bigint` returned as a string by `postgrest-js`; the hook coerces with `Number(...)`.
- `totalPages = Math.max(1, Math.ceil(totalCount / pageSize))` — always at least 1.
- `enabled: false` short-circuits — used when the screen mounts before `userData?.id` is available.

### Snippet — `components/verified-member/my-tasks/index.tsx`

- Calls `useActivity({ pageSize: 5 })`.
- Renders the latest 5 events under the **History** card with a `→` button to `/tasks/history`.
- Empty state: *"No activity yet."*

### Full page — `app/tasks/history.tsx`

- Calls `useActivity({ pageSize: 10, page })` where `page` is local state.
- Footer renders numbered page links + `‹ Prev` / `Next ›`. Current page highlighted; Prev disabled at page 1; Next disabled at last page.
- Shows the *"You've reached the end!"* hint only on the last page.
- Back arrow returns to the Tasks tab.

### Row rendering (shared logic)

Star-bearing rows display the trailing pill in the brand-yellow / extras color used on the Visit 10 progress bar. Star count uses the SVG star icon (Lucide fallback in Phase 1) at row height.

---

## Realtime + freshness

History does **not** maintain its own realtime subscription. It relies on:

1. **Refetch on remount** — switching tabs (Submit → My Tasks) re-mounts `MyTasks`, which re-runs `useActivity`.
2. **Refetch on dependency change** — page change, page-size change, or `userId` change triggers `fetchEvents`.
3. **Sibling subscriptions** — `useTasks` subscribes to `visit_progress` + `star_ledger` inserts and refetches itself; the My Tasks UI re-renders, and the History snippet shows the new event after the next user-driven refetch (or remount).

If hot-update on the standalone History page becomes important, the cheapest path is adding the same `submissions` / `submission_shares` / `daily_checkins` / `star_ledger` / `visit_progress` / `user_badges` / `vouchers` Realtime channel inside `useActivity` and calling `refetch()` from the handler.

---

## Edge cases & gotchas

- **`event_at` ambiguity (42702).** Already fixed in the latest migration. Any future change must keep the `#variable_conflict use_column` directive *or* fully qualify every `event_at` reference inside CTEs.
- **Conversion clustering.** When a wallet hits 100 from a share verification, both `share_verified` and `stars_converted` fire at near-identical timestamps. The History UI sorts strictly by `event_at DESC` and may interleave by milliseconds — intentional, not a bug.
- **Cycle-close clustering.** A cycle reaching 10/10 + the user tapping Complete Tasks emits `cycle_completed`, possibly `badge_earned` (if a tier threshold was crossed), and a fresh `vouchers` row in quick succession. All three may surface as distinct History entries within seconds of each other.
- **Submissions cannot be reverted approved → rejected** (locked 2026-05-04, [`credits-overview.md`](credits-overview.md) §"Approvals are final"). The flip case no longer applies — once approved, the History row stays as `submission_approved` permanently.
- **Vouchers earned but never redeemed.** They do **not** appear in History — they appear in the **Rewards** subtab as redeemable items. Only the `redeemed_at` transition emits a History event.
- **Streak resets.** A missed day resets `profiles.current_streak` to 0 silently — no History entry is written for the reset (only for milestones).

---

## Migration history

| Migration | Purpose |
|---|---|
| `20260423160050_user_activity_rpc.sql` | First version. Returned only event rows; UI computed total via a second query. |
| `20260423160051_user_activity_total_count.sql` | Added `total_count` window column. Introduced the latent `event_at` ambiguity bug. |
| `20260426130000_fix_user_activity_ambiguous_column.sql` | Current. Adds `#variable_conflict use_column` and fully qualifies CTE references. |
| _(pending)_ | Add `share_verified`, `daily_streak_milestone`, `referral_qualified`, `stars_converted`, `visit_rank_earned`, `category_rank_earned` event types; rename `task_completed` → `cycle_completed`; split badge events by rank kind. |

Earlier migrations are left in the chain for replay correctness; the current function definition is whatever the latest `CREATE OR REPLACE` ran.

---

## Related docs

- [`credits-overview.md`](credits-overview.md) — Visit 10 cycle + stars wallet + cycle close events.
- [`extra-tasks.md`](extra-tasks.md) — share / streak event sources.
- [`referral-system.md`](referral-system.md) — referral qualification + L1/L2 star awards.
- [`badges.md`](badges.md) — `badge_earned` semantics.
- [`submission-review-ai.md`](submission-review-ai.md) — when `submission_approved` / `submission_rejected` fire.
- [`notifications.md`](notifications.md) — push/in-app notifications fire from the same triggers; History is the persistent log, notifications are the transient nudge.
