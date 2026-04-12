Account Deletion Issue – Solution Plan

1. Define What “Delete Account” Means
- Deleting an account must:
  - Remove the Supabase auth user.
  - Remove or anonymize all user-linked data (e.g. `profiles`, submissions, referrals) via `ON DELETE CASCADE` or explicit deletes.
- Decision: Implement a single backend entry point (Supabase Edge Function) that:
  - Reads the current user from the JWT.
  - Deletes the auth user and associated data using the service role key.

2. Implement Supabase Edge Function `delete-account`
- Create an Edge Function (e.g. `delete-account`) in Supabase that:
  - Uses the service role key (server-side only) to initialize Supabase.
  - Reads the Bearer token from the `Authorization` header and calls `supabase.auth.getUser(jwt)` to identify the current user.
  - Optionally deletes or cascades related rows in application tables (e.g. `profiles`, `submissions`, referrals) for that `user.id`.
  - Calls `supabase.auth.admin.deleteUser(user.id)` to remove the auth user.
  - Returns `{ success: true }` on success or an appropriate error JSON and HTTP status on failure.
- Deploy the function and confirm it works against a test user.

3. Add `handleDeleteAccount` in the App (SettingsOverlay)
- In `app/profile/SettingsOverlay.tsx`, where `handleLogout` already lives:
  - Inject `useAuth` to access `signOut` (or `forceClearAuth`) and import `supabase` and `router`.
  - Implement `handleDeleteAccount`:
    - Show an `Alert` with a strong warning:  
      “Are you sure you want to permanently delete your account and all associated data? This action cannot be undone.”
    - On confirm:
      - Call `supabase.functions.invoke('delete-account', { method: 'POST' })`.
      - If the function returns an error, show a friendly “Delete Failed” alert.
      - On success, call `signOut()` or `forceClearAuth()` to clear local auth state.
      - Navigate back to guest Home with `router.replace('/(tabs)')`.

4. Expose a Clear “Delete Account” Entry in Settings UI
- Still in `SettingsOverlay.tsx`:
  - Add a visible “Delete Account” row in the appropriate section:
    - Either under “Security” or immediately above the red “Logout” button.
  - Style it as a destructive action (red icon/text) to distinguish it from normal settings.
  - Hook the row’s `onPress` to `handleDeleteAccount`.
- Ensure the button is easy to find for any signed-in user (no deep nesting).

5. Verify Behavior and Align with Apple’s Rule
- Manual QA before submission:
  - Create a test user, perform some actions (profile, submissions, etc.).
  - Tap “Delete Account”, confirm, and verify:
    - The user is logged out and sees guest Home (`/(tabs)`).
    - The user’s row is gone from `auth.users`.
    - Related rows in `profiles` and other user-linked tables are deleted or anonymized.
  - Optionally attempt to sign up again with the same email, confirming behavior matches the product decision (new account or blocked).
- For App Review notes (optional but helpful):
  - Briefly mention: “Users can delete their account and all associated data at any time from Profile → Settings → Delete Account.”