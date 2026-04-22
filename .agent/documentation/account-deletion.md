# Account Deletion

> Edge function + RPC that permanently removes a user. **Destructive and partially atomic** — read carefully before modifying.

---

## What this covers

The end-to-end "Delete My Account" flow: UI → Edge Function → Postgres RPC → Storage cleanup → Auth user deletion. Plus the failure modes and the orphaned-referrals issue.

---

## Call flow

```
SettingsOverlay confirm dialog
  → supabase.functions.invoke('delete-account', POST)  (no body)
    → Edge Function /delete-account/index.ts
      ├─ Verify Bearer token → resolve userId
      ├─ RPC: public.delete_user_data(userId)         ← deletes DB rows
      ├─ List + remove storage objects under {userId}/  ← deletes images
      └─ supabaseAdmin.auth.deleteUser(userId)         ← deletes auth row
    → Client: supabase.auth.signOut()
```

---

## Entry point — UI

[app/profile/SettingsOverlay.tsx:54-97](app/profile/SettingsOverlay.tsx#L54-L97)

Two-step confirmation:
1. Alert: "Delete Account — Are you absolutely sure? This action cannot be undone and all your travel proofs, badges, and rewards will be permanently lost."
2. Destructive "Delete My Account" button → `supabase.functions.invoke('delete-account', { method: 'POST' })` ([overlay:65](app/profile/SettingsOverlay.tsx#L65)).

No request body. The edge function identifies the caller solely from the `Authorization: Bearer <jwt>` header.

---

## Edge function — auth gating

[supabase/functions/delete-account/index.ts](supabase/functions/delete-account/index.ts)

| Step | What | Where |
|---|---|---|
| Read header | `Authorization: Bearer <token>` | [index.ts:45-47](supabase/functions/delete-account/index.ts#L45-L47) |
| Verify token | `supabaseAdmin.auth.getUser(token)` → `userId` | [index.ts:50](supabase/functions/delete-account/index.ts#L50) |
| Reject | 401 if missing or invalid | [index.ts:47, 53](supabase/functions/delete-account/index.ts#L47) |

**Authorization model:** the user can only delete *themselves*. There is no `target_user_id` parameter. The function uses the Supabase **service role** ([index.ts:15](supabase/functions/delete-account/index.ts#L15)) to bypass RLS during cleanup — meaning the JWT verification is the **only** thing keeping a logged-in user from deleting an arbitrary account. Don't add a body parameter that overrides the resolved `userId` without thinking carefully.

---

## RPC: `public.delete_user_data(p_user_id uuid)`

[supabase/migrations/20260417151509_remote_schema.sql:213-225](supabase/migrations/20260417151509_remote_schema.sql#L213-L225)

```sql
DELETE FROM public.submissions       WHERE user_id = p_user_id;
DELETE FROM public.notifications     WHERE recipient_id = p_user_id OR actor_id = p_user_id;
DELETE FROM public.user_badges       WHERE user_id = p_user_id;
DELETE FROM public.invitation_codes  WHERE user_id = p_user_id;
DELETE FROM public.push_tokens       WHERE user_id = p_user_id;
DELETE FROM public.profiles          WHERE id = p_user_id;
```

### Why each table needs an explicit DELETE

| Table | FK on `profiles.id` | Cascade? | Reason for explicit DELETE |
|---|---|---|---|
| `submissions` | `submissions_user_id_fkey` | YES | RPC does it explicitly so admins see consistent deletion order; cascade would also catch it. |
| `notifications` | `recipient_id` and `actor_id` FKs | **NO** | **Must** delete explicitly or profile DELETE will fail FK check. |
| `user_badges` | `user_badges_user_id_fkey` | YES | Explicit for clarity. |
| `invitation_codes` | `invitation_codes_user_id_fkey` | YES | Explicit for clarity. |
| `push_tokens` | `fk_push_tokens_profiles` | YES | Explicit for clarity. |
| `profiles` | `profiles_id_fkey` → `auth.users.id` | YES | Last; deleting `auth.users` later cascades anyway. |

The RPC is `SECURITY DEFINER` so it runs with elevated privileges regardless of caller.

---

## Storage cleanup

[supabase/functions/delete-account/index.ts:65-98](supabase/functions/delete-account/index.ts#L65-L98)

- **Bucket:** `user-uploads`
- **Prefix:** `${userId}/`
- **Pagination:** lists with `STORAGE_PAGE_SIZE = 1000` and removes in batches.
- **Best-effort:** per-page errors are collected into `storageFailures[]` and returned to the client, but **the deletion continues**. A storage failure does not abort the auth deletion.

What lives there: receipt photos and selfies referenced by `submissions.selfie_url` / `submissions.receipt_url` ([migration:487-488](supabase/migrations/20260417151509_remote_schema.sql#L487-L488)).

---

## Auth row deletion

[supabase/functions/delete-account/index.ts:101](supabase/functions/delete-account/index.ts#L101)

`supabaseAdmin.auth.deleteUser(userId)` — final step. If this fails, the response is 500 but the database has already been cleaned up.

Response shape on success:
```json
{ "success": true, "storageFailures": [...] }
```

---

## Side effects & integrity issues

### Orphaned referrals (HIGH)
`profiles.inviter_id` has a FK to `profiles.id` with **no cascade and no `SET NULL`** ([migration:967](supabase/migrations/20260417151509_remote_schema.sql#L967)). When a user with downstream referrals deletes their account:
- The referred users keep `inviter_id = <deleted user uuid>`.
- The `referral_tree` view ([migration:656-687](supabase/migrations/20260417151509_remote_schema.sql#L656-L687)) silently drops orphaned rows from the recursive CTE (no parent to join to).
- Their direct referrals lose the credit-earning relationship invisibly.

**Fix options (need to pick one):**
1. Add `SET inviter_id = NULL WHERE inviter_id = p_user_id` in the RPC before the `profiles` delete.
2. Alter the FK to `ON DELETE SET NULL`.
3. Delete the children's referral relationship explicitly with audit (e.g. write to a `referral_history` table).

### Approved submissions are deleted, not anonymized
The RPC drops all submissions regardless of status. Approved travel proofs disappear with the user. If product wants to retain anonymized history (for analytics, badge audit, etc.), this needs an anonymization pass before delete.

### Firebase data is not touched
The function does not interact with Firestore. Today this is fine — Firestore only holds `partner_store` docs (operator-managed, not per-user). If user-scoped Firestore data is ever added (preferences cache, store favorites, etc.), this function must be extended.

### No audit trail
Nothing records *that* a deletion happened — neither the user ID, timestamp, nor who initiated. If this matters for compliance, add an `audit_log` insert at the start of the RPC before any DELETEs.

### No transaction wrapping
The RPC runs DELETEs sequentially without an explicit `BEGIN`/`COMMIT`. A mid-RPC failure leaves a partially deleted profile. Wrap the whole thing in a transaction or document why partial-deletion is acceptable.

### Storage failures are silent to the user
Failed objects are returned in the response but the UI doesn't surface them. From the user's perspective everything succeeded; in reality their photos may still exist in S3/Storage. Either surface the failures or retry asynchronously.

---

## Failure modes

| Phase | Failure | DB state | Auth state | Storage state |
|---|---|---|---|---|
| Token verify | Invalid / missing JWT | unchanged | unchanged | unchanged |
| RPC | DB error mid-run | **partial** | unchanged | unchanged |
| Storage list/remove | Per-page error | already cleaned | unchanged | partial |
| `auth.deleteUser` | API failure | already cleaned | unchanged → **orphaned auth row** | maybe partial |

The worst case is RPC succeeds + auth delete fails: there's an `auth.users` row with no profile. Next login attempt will fail because the profile is missing. Manual cleanup via the Supabase dashboard is required. **There is no retry logic** — the client has to re-invoke the entire flow.

---

## When modifying this function

Anything that touches deletion order, RLS, or which tables get cleaned needs to be tested end-to-end against:
1. A user with downstream referrals (verify orphaning behavior or fix it).
2. A user with > 1000 storage objects (verify pagination doesn't bail).
3. An admin user (no special path today, but worth confirming).
4. A user mid-submission (race between INSERT and account deletion).
