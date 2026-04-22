# Auth & Onboarding Pipeline

> Reference for the registration → email confirmation → verification → member flow.
> Pair with [`project-overview.md`](project-overview.md) for the high-level role model.

---

## What this covers

How a person goes from "no account" to a verified member able to submit travel proofs. Covers all auth screens, the verification questionnaire, the trigger that auto-creates profiles, session storage, and route guards.

The role progression in the schema:

```
(no account)  →  subscriber  →  member  →  affiliate  →  admin
                  (default)     (verified)  (granted)   (granted)
```

Subscriber is automatic at signup. Member promotion is currently incomplete — see [Known issues](#known-issues).

---

## End-to-end flow

### 1. Registration → subscriber
- User opens [app/register.tsx](app/register.tsx) and submits email, password, display name, optional DOB, gender, and optional invitation code.
- [context/AuthContext.tsx:83-198](context/AuthContext.tsx#L83-L198) `signUp()`:
  - Validates the invitation code against `invitation_codes` (case-sensitive index lookup, must be `is_active = true`) at [AuthContext.tsx:97-119](context/AuthContext.tsx#L97-L119).
  - Calls `supabase.auth.signUp` with username, dob, gender stuffed into `raw_user_meta_data`.
- The Postgres trigger `handle_new_user` at [supabase/migrations/20260417151509_remote_schema.sql:231-251](supabase/migrations/20260417151509_remote_schema.sql#L231-L251) fires automatically and inserts a row into `profiles` with `role = 'subscriber'`. Auth metadata is mapped into `username`, `dob`, `gender` columns.
- If an invitation code was supplied, [AuthContext.tsx:179](context/AuthContext.tsx#L179) writes `inviter_id` onto the profile. The trigger `on_profile_inviter_set` at [migration:909](supabase/migrations/20260417151509_remote_schema.sql#L909) bumps the inviter's `invitation_codes.usage_count`.
- User is redirected to [app/confirm-email/index.tsx](app/confirm-email/index.tsx).

### 2. Email confirmation
- Supabase emails a deep link. The user taps it.
- [app/auth/callback.tsx:6-78](app/auth/callback.tsx#L6-L78) extracts `access_token` + `refresh_token` from the deep link (param or `window.location.hash`) and calls `supabase.auth.setSession`.
- [app/confirm-email/index.tsx:20-59](app/confirm-email/index.tsx#L20-L59) handles the `type=signup` branch — sets the session, then redirects to `/(tabs)` after 2s.
- Resend link with 60s cooldown at [app/confirm-email/index.tsx:117-166](app/confirm-email/index.tsx#L117-L166).
- Once `auth.users.email_confirmed_at` is non-null, [AuthGuard](components/AuthGuard.tsx) treats the user as authenticated.

### 3. Verification questionnaire → member (intended)
- User is sent to [app/question/index.tsx](app/question/index.tsx) on first authenticated entry.
- Form captures: full name, communication channel + handle (WhatsApp / Telegram / Line / WeChat with country code), country of residence, travel destination category & detail, travel style, accommodation, budget.
- On submit, [app/question/index.tsx:297-312](app/question/index.tsx#L297-L312) upserts the `profiles` row with `verification_completed = true` plus all preference columns, then redirects to `/tasks`.

### 4. Login (returning user)
- [app/login.tsx:39-63](app/login.tsx#L39-L63) calls `supabase.auth.signInWithPassword`.
- AuthGuard at [components/AuthGuard.tsx:10-32](components/AuthGuard.tsx#L10-L32) checks `isAuthenticated` (defined in [AuthContext.tsx:268](context/AuthContext.tsx#L268) as `!!user && !!user.email_confirmed_at`).
- Unauthenticated users hit [LoginRequiredScreen](components/LoginRequiredScreen.tsx).

### 5. Forgot / reset password
- [app/forgot-password.tsx:27-69](app/forgot-password.tsx#L27-L69) calls `supabase.auth.resetPasswordForEmail` with `redirectTo` hard-coded to `https://wegood4u-web.web.app/reset-password` — the reset is handled by the **separate web app**, not in-app.
- If the deep link does come back into the app, [app/reset-confirm.tsx:18-120](app/reset-confirm.tsx#L18-L120) sets the recovery session and calls `supabase.auth.updateUser({ password })`.

---

## Key files

| Stage | File | Notes |
|---|---|---|
| Sign up | [app/register.tsx](app/register.tsx) | Form + invitation code field |
| Sign up logic | [context/AuthContext.tsx:83-198](context/AuthContext.tsx#L83-L198) | `signUp()` validates code, calls Supabase, writes inviter_id |
| Profile auto-create | [supabase/migrations/...sql:231-251](supabase/migrations/20260417151509_remote_schema.sql#L231-L251) | `handle_new_user` trigger — sets `role='subscriber'` |
| Email confirm | [app/confirm-email/index.tsx](app/confirm-email/index.tsx) | Resend + deep-link handler |
| Email confirm callback | [app/auth/callback.tsx](app/auth/callback.tsx) | Extracts tokens, sets session |
| Login | [app/login.tsx](app/login.tsx) | Email + password |
| Forgot password | [app/forgot-password.tsx](app/forgot-password.tsx) | Sends recovery email; handler is on the web app |
| Reset confirm | [app/reset-confirm.tsx](app/reset-confirm.tsx) | In-app fallback if deep link returns to native |
| Verification questionnaire | [app/question/index.tsx:237-343](app/question/index.tsx#L237-L343) | Sets `verification_completed = true` + preferences |
| Auth guard | [components/AuthGuard.tsx](components/AuthGuard.tsx) | Requires `email_confirmed_at` |
| Login-required fallback | [components/LoginRequiredScreen.tsx](components/LoginRequiredScreen.tsx) | Shown to unauthenticated users on gated screens |
| User context | [context/UserContext.tsx](context/UserContext.tsx) | Combined auth + profile data; `refreshUserData` after questionnaire |
| Session storage | [lib/supabase.ts:117-185](lib/supabase.ts#L117-L185) | `EnhancedStorageAdapter` |

---

## State-change points

| Event | Table | Column | Value | Where |
|---|---|---|---|---|
| Sign up | `auth.users` | (Supabase managed) | new row | `supabase.auth.signUp` |
| `handle_new_user` fires | `profiles` | `role` | `'subscriber'` | [migration:245](supabase/migrations/20260417151509_remote_schema.sql#L245) |
| Invitation code applied | `profiles` | `inviter_id` | inviter's UUID | [AuthContext.tsx:179](context/AuthContext.tsx#L179) |
| Invitation usage bump | `invitation_codes` | `usage_count` | +1 | trigger `on_profile_inviter_set` [migration:909](supabase/migrations/20260417151509_remote_schema.sql#L909) |
| Email confirmed | `auth.users` | `email_confirmed_at` | timestamp | Supabase |
| Questionnaire submitted | `profiles` | `verification_completed` | `true` | [app/question/index.tsx:310](app/question/index.tsx#L310) |
| Questionnaire submitted | `profiles` | preference columns | values | [app/question/index.tsx:297-312](app/question/index.tsx#L297-L312) |
| **Role → 'member'** | `profiles` | `role` | (stays `'subscriber'`) | **NOT IMPLEMENTED** — see below |

---

## Session storage

[lib/supabase.ts:117-185](lib/supabase.ts#L117-L185) defines `EnhancedStorageAdapter`, a hybrid:
- **Small values (< 2KB)** — Expo SecureStore (iOS Keychain / Android EncryptedSharedPreferences).
- **Large values** — AsyncStorage with chunking.

This avoids SecureStore's per-item size limits while still keeping JWT-sized tokens encrypted at rest on the device.

---

## Edge cases

- **Existing email** — Supabase returns an error from `signUp`; surfaced at [app/register.tsx:138-139](app/register.tsx#L138-L139).
- **Invalid invitation code** — Throws before `signUp` is called; user sees error toast.
- **Expired email-confirm token** — [app/reset-confirm.tsx:37-43](app/reset-confirm.tsx#L37-L43) shows alert and redirects to `/login`.
- **Deep link arriving at the wrong screen** — `app/auth/callback.tsx` handles both signup and recovery; `confirm-email/index.tsx` handles tokens already attached to the URL.
- **Session restored from storage** — `EnhancedStorageAdapter` rehydrates on app launch; `AuthContext` wires this into the React tree.

---

## Known issues

### Member promotion never happens
The questionnaire flips `verification_completed = true` but **does not change `role`**. There's no DB trigger watching `verification_completed`, no app-side update, and no observed gating that treats `verification_completed = true` as equivalent to `role = 'member'`.

Effective behavior today: every "verified" user still has `role = 'subscriber'` in the schema. Anything that role-checks for `'member'` will exclude them.

**Fix options (pick one with product):**
1. Add a Postgres trigger on `profiles` that flips `role` to `'member'` when `verification_completed` becomes `true` and `role = 'subscriber'`.
2. Update the questionnaire write to set `role = 'member'` in the same upsert.
3. Treat `verification_completed = true` as the source of truth and remove `role = 'member'` from the role enum.

The referral system in [`referral-system.md`](referral-system.md) already keys off `verification_completed`, not `role` — option 3 may be the cleanest. Confirm with product before committing.

### Forgot-password is split between native + web
The reset link goes to a separate web app. If the user opens the email on their phone (likely), they leave the native app to reset. [app/reset-confirm.tsx](app/reset-confirm.tsx) only fires if a recovery deep link somehow ends up back in the native app — confirm this branch is actually reachable in production.
