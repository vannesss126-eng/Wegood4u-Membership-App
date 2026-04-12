High‑level idea for Guest Mode

Goal for Apple: Let unauthenticated users (guests) freely browse Home / partner cafes / map. Only require login when they try to do account‑specific actions (profile, tasks, submitting proof, rewards, etc.).

In the current code, the “forced login wall” comes from two places:

- Root stack (`app/_layout.tsx`): first screen is effectively `login`, so the app opens there.
- Global auth gate on tabs (`app/(tabs)/_layout.tsx`): the whole tab bar is wrapped in `AuthGuard`, which redirects unauthenticated users to `/login`.

Guest mode is basically: “unauthenticated = guest” + remove those two global redirects, then gate only the truly private parts.

---

1. Decide what guests can and can’t do

Based on the product goals and Apple’s feedback:

Guest can (no login required)

- Open the app (launch screen).
- See Home tab (`app/(tabs)/index.tsx`) – recommended restaurants/cafes, partner stores.
- See Map tab (`app/(tabs)/map.tsx`) – list/map of partner locations.

Must require login

- Profile tab (`app/(tabs)/profile.tsx`): profile data, membership info, stats, settings.
- Tasks tab (`app/(tabs)/tasks.tsx`): questionnaire, membership steps, admin tools.
- Any CTA like “Submit Proof”, “Rewards”, “Invite Friends”, “Become Member”, “My submissions”, etc.

This gives a clear rule: **browsing locations = guest allowed; anything personalized or write‑heavy = login required.**

---

2. Navigation changes to remove the login wall

2.1 Remove global `AuthGuard` from the whole tab layout

This is the single most important step.

Right now:

```tsx
// app/(tabs)/_layout.tsx
<AuthGuard>
  <Tabs> ... </Tabs>
</AuthGuard>
```

Implementation plan:

- Remove `AuthGuard` here entirely so that the tabs (Home / Tasks / Map / Profile) are always navigable, even when `isAuthenticated === false`.
- We’ll later add **per‑screen gating** for Tasks and Profile, instead of blocking the whole tab bar.

This change lets Expo Router handle tab navigation natively without a hard blocker, which directly addresses the “forced login” violation.

2.2 Make the app open onto tabs instead of the login screen (and prefer guest by default)

In `app/_layout.tsx`, the stack doesn’t explicitly set an initial route, and the first screen is effectively `login`. Even if we add a “Continue as Guest” link on the login screen, there is still a risk that a fast Apple reviewer sees the login wall first and rejects the app by habit.

Plan:

- Update the `Stack` in `app/_layout.tsx` to use `initialRouteName="(tabs)"` so the app opens straight into the tab bar (Home as the default tab).
- Keep `login`, `register`, `forgot-password`, etc. in the stack so they remain reachable, but no longer as the first screen.
- Add a “Sign In” button in the top‑right corner of the header on **Home** and **Map** screens so users (and reviewers) clearly see that login is an **optional, opt‑in** action.

Result: when Apple opens the app, they land on the **Home tab** within `/(tabs)`, immediately seeing curated cafes in Chiang Mai and Kuala Lumpur. This makes it undeniable that the core functionality is open to everyone.

---

3. Per‑screen auth gating instead of a global wall

Now that tabs are accessible to everyone, we add route‑level checks only where needed.

3.1 Keep Home and Map fully open

- `HomeScreen` (`app/(tabs)/index.tsx`) already works fine when `userData` is null because it uses `userData?.fullName || 'User'`.
- `MapScreen` (`app/(tabs)/map.tsx`) is just listing static or public partner stores.

Plan:

- Do not block these screens at all.
- Add a small “Sign In” button in the header (top‑right) of both Home and Map that routes to `/login`. This reinforces that guest browsing is the default and sign‑in is optional.

3.2 Gate the Tasks tab with a reusable `LoginRequiredScreen`

Current `TasksScreen` (`app/(tabs)/tasks.tsx`) assumes a user:

- If `userLoading` → loading spinner.
- If `!userData` → “Unable to load user data” error.
- Else it renders `AdminTaskScreen`, `UnverifiedMember`, or `VerifiedMember`.

Plan:

- Import `useAuth` and check `isAuthenticated`.
- Introduce a shared `LoginRequiredScreen` component and use it here.

Implementation logic (conceptual):

```tsx
const { isAuthenticated } = useAuth();

if (!isAuthenticated) {
  // Show a friendly “Login required” screen
  // with buttons: “Sign in” and “Sign up”
  return <LoginRequiredScreen featureName="Tasks" />;
}
```

- Keep the existing role‑based logic **only inside** the authenticated branch.

This turns the Tasks tab into a soft, friendly gate with a polished UX instead of a broken “no user data” error or an aggressive redirect back to `/login`.

3.3 Gate the Profile tab with the same `LoginRequiredScreen`

`ProfileScreen` (`app/(tabs)/profile.tsx`) currently:

- Shows a loading state while `userLoading`.
- Shows “Unable to load profile data” if `!userData`.
- Otherwise renders full profile UI.

Plan:

- Import `useAuth` and reuse `LoginRequiredScreen`:

```tsx
const { isAuthenticated } = useAuth();

if (!isAuthenticated) {
  return <LoginRequiredScreen featureName="Profile" />;
}
```

The `LoginRequiredScreen` should:

- Display copy like “Sign in to view your badges, claim rewards, and manage your profile.”
- Provide clear **Log In** and **Sign Up** buttons (`router.push('/login')`, `router.push('/register')`).

This provides a deliberate, friendly UX instead of an error message or sudden redirect.

3.4 Gate sensitive actions (CTAs) elsewhere

For example:

- “Submit Proof” buttons in `components/verified-member/...` or submission flows.
- “Rewards”, “Invite Friends”, “Become Member”, “Request invitation code”, etc.

Plan:

- For each such button, before navigating or performing a mutation, check `isAuthenticated`:
  - If `true` → proceed as now.
  - If `false` → either:
    - Redirect to `/login`, or
    - Open a small modal that offers “Log in” / “Sign up” and then routes to `/login` or `/register`.

We don’t need a new navigation structure; just guard the tap handlers for these actions.

---

4. Explicit “Continue as Guest” vs. default guest behavior

We can still provide an explicit “Continue as Guest” when the user is already on an auth screen, but the **primary safety for App Store review** should come from the app **not opening on `/login` at all**.

Options:

- Keep `login.tsx` as the primary auth screen and (optionally) add a “Continue as Guest” link that does `router.replace('/(tabs)')` for users who landed there from deep links or manual navigation.
- Optionally create a simple `app/index.tsx` welcome screen if we ever want a marketing splash, with:
  - “Browse cafes” → `/(tabs)` (guest path).
  - “Sign in / Sign up” → `/login` or `/register`.

However, the **recommended behavior for approval** is:

- **Default entry** = `/(tabs)` → `index` (Home) with cafes and map.
- Auth screens are **secondary** entry points reachable via:
  - Header “Sign In” buttons on Home/Map.
  - `LoginRequiredScreen` for Profile/Tasks.
  - Deep links (password reset, email confirmation, OAuth callback).

---

5. How this satisfies Apple’s “forced login” rule

After implementing the above:

- On first launch, the app lands on the **Home tab** within `/(tabs)`, showing partner stores and (via Map tab) the map. No login is required, and there’s no initial login wall.
- The user can:
  - Browse recommended cafes and restaurants.
  - View partner locations on the map.
- When they try to do anything account‑based (Profile, Tasks, submit proof, rewards, invites…), they see a clear, well‑designed `LoginRequiredScreen` with login/sign‑up buttons and are routed to `/login` or `/register` only at that point.

This is fully aligned with Apple’s Guideline 5.1.1: **core functionality is open to all users, and authentication is only required where strictly necessary, presented in a user‑friendly way.**