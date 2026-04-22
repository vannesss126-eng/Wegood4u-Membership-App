# Profile & Settings

> The Profile tab and the screens reachable from the Settings overlay.

---

## What this covers

The Profile tab serves as the user's home for personal info, settings navigation, and quick stats. The actual settings live in [app/profile/](app/profile/) and are reached via a slide-in overlay (not direct tab routes).

---

## Profile tab landing — [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx)

| Element | Behavior | File:line |
|---|---|---|
| Auth gate | Unauthenticated → `LoginRequiredScreen` | [profile.tsx:84-85](app/(tabs)/profile.tsx#L84-L85) |
| Avatar | Tap → image picker → uploads to Supabase Storage `profilePic` bucket → updates `profiles.avatar_url` | [profile.tsx:103-153](app/(tabs)/profile.tsx#L103-L153), [services/imageUpload.tsx:9-57](services/imageUpload.tsx#L9-L57) |
| Greeting | `getGreeting()` based on time of day | [profile.tsx:166](app/(tabs)/profile.tsx#L166) |
| Settings entry | Hamburger icon opens `SettingsOverlay` | [profile.tsx:194](app/(tabs)/profile.tsx#L194) |
| Invite button | Hidden for `subscriber` role | [profile.tsx:198](app/(tabs)/profile.tsx#L198) |
| Stats panel | Role-dependent (see below) | [profile.tsx:234-287](app/(tabs)/profile.tsx#L234-L287) |

### Stats panel by role
- **Subscriber** — single "Become a Member" CTA only ([profile.tsx:237](app/(tabs)/profile.tsx#L237)).
- **Admin** — pending submissions count ([profile.tsx:249](app/(tabs)/profile.tsx#L249)).
- **Member / Affiliate** — daily submission count (`X/20`), badge count, collection count.

> Note: today every "verified" user still has `role = 'subscriber'` because the questionnaire flips `verification_completed = true` but never changes `role`. See [`auth-onboarding.md`](auth-onboarding.md#known-issues).

---

## Settings overlay — [app/profile/SettingsOverlay.tsx](app/profile/SettingsOverlay.tsx)

A right-slide `Modal` ([overlay:157-269](app/profile/SettingsOverlay.tsx#L157-L269)) that acts as the navigation hub for all settings screens.

- **Open** — `setShowSettingsOverlay(true)` from the profile tab.
- **Close** — backdrop tap or X button ([overlay:262-266](app/profile/SettingsOverlay.tsx#L262-L266)).
- **Section structure** — General, Security, About, with role-gated items (Preferences / Notifications / Invite hidden for subscribers at [overlay:185-201](app/profile/SettingsOverlay.tsx#L185-L201)).
- **Navigation pattern** — Each menu item closes the overlay then `router.push()`s the destination ([overlay:100-137](app/profile/SettingsOverlay.tsx#L100-L137)).
- **Logout** — Confirmation alert → `supabase.auth.signOut` ([overlay:28-52](app/profile/SettingsOverlay.tsx#L28-L52)).
- **Delete Account** — See [`account-deletion.md`](account-deletion.md). Invoked at [overlay:54-97](app/profile/SettingsOverlay.tsx#L54-L97).

---

## Settings screens

| Screen | File | Role gate | Reads | Writes |
|---|---|---|---|---|
| Account profile | [account.tsx](app/profile/account.tsx) | All | `profiles` (full_name, username, email, dob, gender, role, `email_confirmed_at`, `verification_completed`) | **None — read-only** |
| Change password | [change-password.tsx](app/profile/change-password.tsx) | All | Auth state | `supabase.auth.updateUser({ password })` ([line 70](app/profile/change-password.tsx#L70)). Forces re-login after success ([line 98](app/profile/change-password.tsx#L98)). |
| Preferences | [preferences.tsx](app/profile/preferences.tsx) | Non-subscribers (gated at overlay:185) | `profiles` via `UserContext` | `profiles.update()` via `updatePreferences()` |
| Notifications | [notifications.tsx](app/profile/notifications.tsx) | All | `notifications` (with actor join), unread count | `is_read` flag, soft-delete |
| About | [about.tsx](app/profile/about.tsx) | None | Static | — |
| Contact | [contact.tsx](app/profile/contact.tsx) | None | Form local state | **Mock — 2-second `setTimeout`** ([contact.tsx:32-41](app/profile/contact.tsx#L32-L41)). No backend hooked up. |
| FAQ | [faq.tsx](app/profile/faq.tsx) | None | Local `faqData` array (12 items, 6 categories) | Expand/collapse local state |

See [`notifications.md`](notifications.md) for the in-app notifications system in detail.

---

## Editable fields & where they persist

### Avatar
- Source: `expo-image-picker` → `fetch` → `Uint8Array` → `supabase.storage.from('profilePic').upload(...)` ([imageUpload.tsx:28](services/imageUpload.tsx#L28)).
- Persisted column: `profiles.avatar_url` ([imageUpload.tsx:67](services/imageUpload.tsx#L67)).
- **No remove/reset flow** — only upload-replace.

### Preferences
- Country, communication channel + handle, travel destination category & detail, travel style, accommodation, budget.
- Live in `profiles` columns: `country_of_residence`, `preferred_communication_channel`, etc.
- Loaded via `UserContext` ([UserContext.tsx:129-157](context/UserContext.tsx#L129-L157)); written via `updatePreferences()`.
- Save button is gated by a `hasChanges` flag at [preferences.tsx:161-164](app/profile/preferences.tsx#L161-L164).

### Password
- Goes through Supabase Auth, not the `profiles` table.
- After success, the user is forced to re-login.

### Account info (full_name, username, DOB, gender)
- Set during signup + questionnaire.
- **No editing UI exists** — `account.tsx` displays them read-only.

---

## Gaps

- **Account info is read-only** — can't edit name, username, DOB, or gender after signup. Users would have to reach out to support (which goes through the mock contact form).
- **Contact form is a mock** — `handleSubmit` resolves a 2s `setTimeout`. Submissions go nowhere. Users believe their message was sent.
- **Avatar can't be removed** — only replaced.
- **No client-side route protection** — Preferences/Notifications are hidden in the overlay menu for subscribers, but typing the URL directly would still reach them. Add a role check inside each screen if this matters.
- **Preference field semantics undocumented** — dropdowns like "Travel Destination Category" have no business definition or validation rules. Confirm with product before extending.
- **No data export / portability** — users can delete their account but not download what's been collected on them. Consider for compliance.
