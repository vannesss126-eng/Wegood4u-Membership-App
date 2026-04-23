# Notifications

> In-app notification system. Push notifications are scaffolded but **not wired** — see [Gaps](#gaps).

---

## What this covers

How users find out about submission state changes (approved / rejected) and how admins find out about new pending submissions. All in-app — no push delivery yet despite `expo-notifications` being installed.

---

## Architecture

```
submission INSERT or status UPDATE
  → Postgres trigger
    → INSERT into notifications table
      → client refetches via useNotifications hook
        → Notifications screen renders
```

Notifications are **database rows**, not push messages. The client polls on screen mount; there is no real-time subscription, no Expo Push, no FCM.

---

## Data model

### `notifications` table — [migration:454-464](supabase/migrations/20260417151509_remote_schema.sql#L454-L464)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | PK, auto-increment |
| `recipient_id` | uuid | FK → `profiles.id`. Who sees the notification. |
| `actor_id` | uuid? | FK → `profiles.id`. Who triggered it (nullable for system events). |
| `action` | text | `submission_created`, `submission_approved`, `submission_rejected` |
| `object_type` | text | `submission`, `badge` |
| `object_id` | text | The submission ID (or badge ID) |
| `data` | jsonb | Context — store name, admin notes, etc. |
| `is_read` | boolean | Default `false` |
| `created_at` | timestamptz | |

**Indexes** at [migration:829-837](supabase/migrations/20260417151509_remote_schema.sql#L829-L837):
- `idx_notifications_recipient_id` on `recipient_id`
- `idx_notifications_recipient_created_at` on `(recipient_id, created_at DESC)` — drives the inbox query
- `idx_notifications_actor_id` on `actor_id`

**RLS** at [migration:997-1153](supabase/migrations/20260417151509_remote_schema.sql#L997-L1153):
- Recipients can read / update / delete their own.
- Admins can read / update everything.
- **No client INSERT** — only server-side triggers create notifications.

### `push_tokens` table — [migration:631-639](supabase/migrations/20260417151509_remote_schema.sql#L631-L639)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | PK |
| `user_id` | uuid | FK → `profiles.id` |
| `expo_push_token` | text | Unique per device |
| `device_info` | jsonb | Device metadata |
| `is_active` | boolean | Default `true` |
| `created_at`, `updated_at` | timestamps | |

**Indexes:** `idx_push_tokens_user_id`, `idx_push_tokens_active` (partial, `WHERE is_active = true`).

**RLS:** Users CRUD their own tokens only — no broadcast policy.

The table exists. **Nothing writes to it yet.** See [Gaps](#gaps).

---

## Triggers — what creates notifications

### `notify_on_submission_insert` — [migration:307-315](supabase/migrations/20260417151509_remote_schema.sql#L307-L315)
Fires `AFTER INSERT ON submissions`. Inserts one notification per admin with:
- `action = 'submission_created'`
- `object_type = 'submission'`
- `data = ` full submission row (jsonb)

Hook: `trg_notify_on_submission_insert` at [migration:929](supabase/migrations/20260417151509_remote_schema.sql#L929).

### `notify_on_submission_status_change` — [migration:333-341](supabase/migrations/20260417151509_remote_schema.sql#L333-L341)
Fires `AFTER UPDATE OF status ON submissions` when status changes to `approved` or `rejected`. Inserts one notification to the submission owner with:
- `action = 'submission_approved'` or `'submission_rejected'`
- `object_type = 'submission'`
- `data = { status, admin_notes, reviewed_at }`

Hook: `trg_notify_on_submission_status_change` at [migration:933](supabase/migrations/20260417151509_remote_schema.sql#L933).

### Badge events — NOT wired
`check_and_award_badges` at [migration:145-207](supabase/migrations/20260417151509_remote_schema.sql#L145-L207) inserts into `user_badges` but does not insert a notification. Earning a badge is silent. See [`badges.md`](badges.md).

### Referral events — NOT wired
A qualified referral does not create a notification today. The referral system docs ([`referral-system.md`](referral-system.md)) propose this for future work.

---

## Client side

### `useNotifications` hook — [hooks/useNotifications.ts:6-158](hooks/useNotifications.ts#L6-L158)

Exposes:
- `notifications` — array fetched with actor profile join ([hook:26-35](hooks/useNotifications.ts#L26-L35))
- `unreadCount` — derived ([hook:142](hooks/useNotifications.ts#L142))
- `markAsRead(id)`, `markAllAsRead()`, `deleteNotification(id)` ([hook:70-139](hooks/useNotifications.ts#L70-L139))
- Auto-refetch on mount ([hook:144-146](hooks/useNotifications.ts#L144-L146)). No interval, no real-time subscription.

### Notifications screen — [app/profile/notifications.tsx:27-299](app/profile/notifications.tsx#L27-L299)
- Lists notifications, swipe-to-delete ([screen:119](app/profile/notifications.tsx#L119)).
- Unread badge with red dot ([screen:236](app/profile/notifications.tsx#L236)).
- "Mark all as read" button ([screen:220](app/profile/notifications.tsx#L220)).
- Per-action icons: approval = green check, rejection = red X, badge = award, default = store ([screen:108-121](app/profile/notifications.tsx#L108-L121)).
- Tap a submission/badge notification → navigates to `/tasks` ([screen:95-106](app/profile/notifications.tsx#L95-L106)).

Type defs: [types/notification.ts](types/notification.ts).

---

## Gaps

### Push notifications are not implemented
The `expo-notifications@0.32.16` package is installed but never imported. There is:
- No `requestPermissionsAsync` call anywhere.
- No `getExpoPushTokenAsync` call.
- No code that writes to `push_tokens`.
- No edge function that calls Expo's `/send` endpoint.

Effective behavior: users only see notifications when they open the Notifications screen. No badge on the app icon, no banners while the app is closed.

**To wire this up** the work is roughly:
1. Add a permission request + token registration on first authenticated session (probably in `AuthContext` or a `usePushTokenRegistration` hook).
2. Write the token to `push_tokens` (handle device replacement / re-installs by upserting on `(user_id, expo_push_token)`).
3. Add a Supabase Edge Function or a Postgres trigger via `pg_net` that POSTs to Expo's send API whenever a `notifications` row is inserted (mirror the pattern in [`submission-review-ai.md`](submission-review-ai.md)).
4. Strip inactive tokens (Expo returns receipts that flag `DeviceNotRegistered` etc).

### Badges are silent
Earning a badge inserts a `user_badges` row but no `notifications` row. If badge feedback matters to retention, add a trigger on `user_badges` insert.

### No notification preferences
Users can't opt out of any notification type. There's no preferences table or UI.

### No real-time inbox
The hook refetches on mount only. Long sessions on the Notifications screen won't see new arrivals until the user pulls to refresh or remounts. Could be solved with a Supabase Realtime subscription on `notifications WHERE recipient_id = auth.uid()`.

### Limited notification vocabulary
Only three actions exist (`submission_created`, `submission_approved`, `submission_rejected`). The credits/task model locked on 2026-04-23 ([`credits-overview.md`](credits-overview.md), [`badge-rewards.md`](badge-rewards.md)) expands this significantly. Future needs:
- **Badge earned** (e.g. "You reached Silver") — currently silent (see "Badges are silent" above).
- **Task completed** — a cycle reaching 10 credits mints a voucher; user should know.
- **Referral qualified** — 1+1 at Level 1, half-credit accumulation at Level 2. Show the gold-tick landing: "Bonus 1 Credit for Restaurant."
- **Voucher claimable / redeemed** — pairs with the Rewards subtab.

The History page on the Tasks tab (per [`credits-overview.md`](credits-overview.md) "History feed — event types") will render the same event vocabulary from a separate feed query; the notifications system should share the event taxonomy so both surfaces stay in sync.
- Account-level events (password change confirmation, deletion grace period if added, etc.)
