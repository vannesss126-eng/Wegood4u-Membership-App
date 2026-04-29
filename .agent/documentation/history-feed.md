# History — Unified Activity Feed

> Source of truth for the activity feed surfaced as the **History** snippet on My Tasks and the standalone **History** page (`/tasks/history`).
> Pair with [`credits-overview.md`](credits-overview.md) (drives task / credit / voucher events) and [`badges.md`](badges.md) (drives badge events).

---

## What History represents

A single chronological feed of everything that has *happened* on a user's account that they should see — submissions reviewed, credits cycled into completed tasks, badges earned, vouchers redeemed.

It's a **read** surface only. Nothing in History writes; events are recorded by other systems (admin review, credits trigger, voucher redemption flow) and History merges them on read.

Two consumers share the same data:

| Surface | Page size | Purpose |
|---|---|---|
| **My Tasks → History snippet** | 5 most recent | At-a-glance list with `→` to the full page |
| **`/tasks/history`** | 10 per page, paginated | Full reverse-chronological log |

Both render identical rows; only the page size and the page-controls footer differ.

---

## Data source — `get_user_activity` RPC

Defined in [`supabase/migrations/20260426130000_fix_user_activity_ambiguous_column.sql`](../../supabase/migrations/20260426130000_fix_user_activity_ambiguous_column.sql) (supersedes the earlier `20260423160050` and `20260423160051` migrations — see *Migration history* below).

```sql
get_user_activity(p_limit int DEFAULT 10, p_offset int DEFAULT 0)
RETURNS TABLE (event_type text, event_at timestamptz, target text, metadata jsonb, total_count bigint)
```

- **`SECURITY DEFINER` + `auth.uid()`** — clients never pass a `user_id`; the function reads the caller's session and filters internally. Equivalent to RLS without per-table policies.
- **`STABLE`** — safe to use in cached planner contexts; depends only on snapshot data.
- **`#variable_conflict use_column`** — disambiguates the OUT column `event_at` from inner `event_at` references. Without this, Postgres throws 42702.
- **Window-function total** — `COUNT(*) OVER ()` returns total event count in the same query so paginated UIs don't need a second round-trip. Read it from the first row of any response.

### Event sources (all UNION ALL'd inside the RPC)

| `event_type` | Source table(s) | Trigger condition | `event_at` | `target` |
|---|---|---|---|---|
| `submission_approved` / `submission_rejected` | `submissions` | `status IN ('approved','rejected')` | `COALESCE(reviewed_at, updated_at, created_at)` | `partner_store_name` |
| `badge_earned` | `user_badges JOIN badges` | New row in `user_badges` | `earned_at` | `badges.name` |
| `task_completed` | `credits_ledger` | A cycle's `SUM(delta_numerator) >= 10` (closed). Picked as the row with `ROW_NUMBER() = 1` ordered by `id DESC` per cycle | `created_at` of the closing ledger row | `category` (e.g. `'restaurant'`) |
| `voucher_redeemed` | `vouchers` | `redeemed_at IS NOT NULL` | `redeemed_at` | `reward_kind` (e.g. `'airbnb'`) |

The four `metadata` shapes are fixed per type and documented in the migration. Clients should treat unknown `event_type` values as forward-compat (don't crash) — future event types may join later.

### Why we chose an RPC over a view

- Pagination is materially cheaper as a parameterised function than as a view + `LIMIT/OFFSET` from PostgREST.
- `SECURITY DEFINER` lets us join `user_badges → badges` and read `vouchers` without granting blanket SELECT to authenticated users.
- The `total_count` window column is much harder to express cleanly across multiple PostgREST requests on a view.

---

## Frontend wiring

### Hook — [`hooks/useActivity.ts`](../../hooks/useActivity.ts)

```ts
useActivity({ page = 1, pageSize = 10, enabled = true })
  → { events, totalCount, totalPages, hasMore, isLoading, error, refetch }
```

- `page` is **1-indexed** to match the visible UI labels; the hook converts to `(page - 1) * pageSize` for the RPC offset.
- `total_count` comes back as a Postgres `bigint`, which `postgrest-js` returns as a string. The hook coerces with `Number(...)` and falls back to `0` on empty pages.
- `totalPages = Math.max(1, Math.ceil(totalCount / pageSize))` — always at least 1 so the empty-state page numbers don't disappear.
- `enabled: false` short-circuits without firing the request — used when the screen mounts before `userData?.id` is available.

### Snippet — `components/verified-member/my-tasks/index.tsx`

- Calls `useActivity({ pageSize: 5 })`.
- Renders the latest 5 events under the **History** card, with a `→` button routing to `/tasks/history`.
- Empty state copy: *"No activity yet."*

### Full page — `app/tasks/history.tsx`

- Calls `useActivity({ pageSize: 10, page })` where `page` is local component state.
- Footer renders numbered page links + `‹ Prev` / `Next ›`. Current page highlighted; Prev disabled at page 1; Next disabled at last page.
- Shows the *"You've reached the end!"* hint only when on the last page.
- Back arrow returns to the Tasks tab.

### Row rendering (shared logic)

| Event type | Date | Target | Status | Trailing pill |
|---|---|---|---|---|
| `submission_approved` | `MMM D` | partner store name | `Approved` (green) | `+1 credit` |
| `submission_rejected` | `MMM D` | partner store name | `Rejected` (red) | — |
| `badge_earned` | `MMM D` | `Earned {badge name}` | — | — |
| `task_completed` | `MMM D` | `{Category} Task Completed` | — | `+1 voucher` |
| `voucher_redeemed` | `MMM D` | `Redeemed {reward_kind}` | — | — |

`MMM D` is the user's locale-formatted short date (e.g. `Apr 26`).

---

## Realtime + freshness

History does **not** maintain its own realtime subscription. It relies on:

1. **Refetch on remount** — switching tabs (Submit → My Tasks) re-mounts `MyTasks`, which re-runs `useActivity`.
2. **Refetch on dependency change** — page change, page-size change, or `userId` change triggers `fetchEvents`.
3. **Sibling subscriptions** — `useTasks` subscribes to `credits_ledger` inserts and refetches itself; the My Tasks UI re-renders and the History snippet shows the new event after the next user-driven refetch (or remount).

If we want hot-update on the standalone History page later, the cheapest path is adding the same `credits_ledger` / `submissions` / `user_badges` / `vouchers` Realtime channel inside `useActivity` and calling `refetch()` from the handler. Not currently necessary — the page is rarely watched live.

---

## Edge cases & gotchas

- **`event_at` ambiguity (42702).** Already fixed in the latest migration. Any future change to the RPC must keep the `#variable_conflict use_column` directive *or* fully qualify every `event_at` reference inside CTEs.
- **Closed-cycle row pick.** A cycle has multiple ledger rows; the RPC picks the row with the largest `id` per `cycle_id` as the "closing" event. If business logic ever lets a cycle reopen (it currently can't), this needs revisiting — it would emit only the most recent close, not each one.
- **Submissions reverted from approved → rejected.** The current RPC treats any row in those statuses as a single event. If a row flips, the History row's `event_type` and `status` flip too on the next fetch — there's no permanent log of the transition. (Tracked as an open question in [`referral-system.md`](referral-system.md) "claw-back policy.")
- **Vouchers that were earned but never redeemed.** They do **not** appear in History — they appear in the **Rewards** subtab as redeemable items. Only the `redeemed_at` transition emits a History event.
- **`task_completed` vs `submission_approved` clustering.** A 10th approved submission emits both events at very close timestamps. The History UI sorts strictly by `event_at DESC` and may interleave them by milliseconds — that's intentional, not a bug.

---

## Migration history

| Migration | Purpose |
|---|---|
| `20260423160050_user_activity_rpc.sql` | First version. Returned only event rows; UI computed total via a second query. |
| `20260423160051_user_activity_total_count.sql` | Added `total_count` window column. Introduced the latent `event_at` ambiguity bug. |
| `20260426130000_fix_user_activity_ambiguous_column.sql` | Current. Adds `#variable_conflict use_column` and fully qualifies CTE references. |

Earlier migrations are left in the chain for replay correctness; the current function definition is whatever the latest `CREATE OR REPLACE` ran.

---

## Related docs

- [`credits-overview.md`](credits-overview.md) — defines the credit / cycle / voucher events History surfaces.
- [`badges.md`](badges.md) — defines `badge_earned` semantics.
- [`submission-review-ai.md`](submission-review-ai.md) — defines when `submission_approved` / `submission_rejected` fire.
- [`notifications.md`](notifications.md) — push/in-app notifications fire from the same triggers; History is the persistent log, notifications are the transient nudge.
