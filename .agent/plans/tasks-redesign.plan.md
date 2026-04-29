---
name: Tasks Tab & Badges Redesign
overview: "Rebuild the Challenges/Tasks tab around the locked credits/task model: rename to Tasks, split into My Tasks / Submit / Rewards, add Badges and History as routed detail pages, wire referral gold-tick UI, and back it with a credits_ledger. Backend and frontend both in scope."
todos:
  - id: phase1-backend
    content: Extend enums, add credits_ledger + accumulator + vouchers, rewrite badge/credit triggers, add useTasks hook and unified activity feed source.
    status: completed
  - id: phase2-tasks-shell
    content: Rename Challenges→Tasks, drop points pill, restructure subtabs to My Tasks / Submit / Rewards. Unverified members keep current flow.
    status: completed
  - id: phase3-my-tasks
    content: Build the My Tasks subtab — progress section (4 category bars with gold ticks), Badge summary card, latest-5 history list.
    status: completed
  - id: phase4-history-page
    content: Standalone paginated History page rendering the unified event feed (submissions / badges / task completions / vouchers).
    status: completed
  - id: phase5-badge-detail
    content: Badge detail page with 4 category sections of tier/level markers. L1/2/3 promotion formula now defined (2026-04-23).
    status: completed
  - id: phase6-badge-share
    content: Per-category badge collection share card, routed from the badge detail page's share CTA.
    status: completed
  - id: phase7-submit-form
    content: New Submit form (Date/Month/Year → Partner → Receipt → Selfie → Submit) and dedicated "Proof Submitted" screen replacing the alert.
    status: completed
  - id: phase8-referral-notice
    content: "Bonus 1 Credit for {category}" banner on Referrals page and matching gold-tick animation on the recipient's My Tasks bar.
    status: completed
isProject: true
---

# Tasks Tab & Badges Redesign

## Goal

Ship the Figma-designed "Tasks" experience on top of the credits/task model locked in [credits-overview.md](.agent/documentation/credits-overview.md) and [badge-rewards.md](.agent/documentation/badge-rewards.md). The tab is renamed from `Challenges`/`Travel Proof` to `Tasks`, restructured into three subtabs (My Tasks / Submit / Rewards), and gains two routed detail pages (Badges, History). Unverified members keep the old flow.

## Source of truth

- Credits mechanic + thresholds: [credits-overview.md](.agent/documentation/credits-overview.md)
- Tier rewards: [badge-rewards.md](.agent/documentation/badge-rewards.md)
- Referral qualification / tree: [referral-system.md](.agent/documentation/referral-system.md)
- Current code behaviour: [badges.md](.agent/documentation/badges.md)

If any of these contradict this plan, the docs win — update the plan, not the spec.

## Open questions

- ~~**L1/2/3 sub-level promotion formula.**~~ **Resolved 2026-04-23.** Single global tier+level per user, derived from cumulative R/C/B task count via the table in [credits-overview.md](.agent/documentation/credits-overview.md) "Badge tiers + levels". Same value mirrored across all 4 category rows on the badge detail page; rows differ only in art. Rewards remain tier-based, not level-based.
- **Hotel reward mechanic.** Hotel shows a visibility counter but earns nothing. Design doesn't show what a Hotel submission actually unlocks. Track in [credits-overview.md](.agent/documentation/credits-overview.md) "Still open."
- **Cycle rollover edge cases.** If a cycle closes at numerator > 10 (shouldn't happen with +1 enforcement, but defensive) — discard, roll over, or error?

Assumptions locked from the 2026-04-21 → 2026-04-23 product discussions are captured in the docs; skim them before starting a phase.

---

## Phase 1 — Backend (schema, ledger, triggers, hooks)

All DB work lands as one migration `supabase/migrations/YYYYMMDDHHMMSS_credits_ledger.sql` (timestamp at write-time).

### 1.1 Enum extensions

- `partner_store_category`: add `bar`, add `hotel`. Today it's `cafe | restaurant | others` ([types/submission.ts:6](types/submission.ts#L6)); update both the DB enum and the TS union.
- `badge_category`: extend to match the 4 UI categories (today it's `activity | cafe | restaurant` per [migration:60-64](supabase/migrations/20260417151509_remote_schema.sql#L60-L64)).
- Update `mapStoreCategory()` in [components/verified-member/submission/index.tsx:70-81](components/verified-member/submission/index.tsx#L70-L81) so Bar no longer falls into `others`.

### 1.2 New tables

```sql
-- cycle_id is a UUID per (user_id, category, cycle_index); auto-generated on first delta in a new cycle.
credits_ledger (
  id             bigserial PK,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category       partner_store_category NOT NULL,   -- one of restaurant/cafe/bar; NEVER hotel
  delta_numerator smallint NOT NULL CHECK (delta_numerator = 1),
  reason         text NOT NULL CHECK (reason IN ('approved_submission','level1_referral','level2_pair')),
  source_submission_id uuid REFERENCES submissions(id),
  source_referral_id   uuid REFERENCES profiles(id),   -- the invitee whose qualification triggered this
  cycle_id       uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
)

referral_half_credit_accumulator (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  count   smallint NOT NULL DEFAULT 0 CHECK (count >= 0)
)

vouchers (
  id                  uuid PK DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier                text NOT NULL CHECK (tier IN ('bronze','silver','gold','platinum')),
  reward_kind         text NOT NULL,     -- 'airbnb' | '3_star_hotel' | '4_star_hotel' | 'specialty'
  earned_from_cycle_id uuid NOT NULL,
  redeemed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
)
```

RLS: users can `SELECT` their own rows in all three tables. Inserts only via `SECURITY DEFINER` trigger functions.

### 1.3 Profile column

- `ALTER TABLE profiles ADD COLUMN first_approved_submission_at timestamptz NULL;`
- Backfill for existing users: `UPDATE profiles SET first_approved_submission_at = (SELECT min(updated_at) FROM submissions WHERE user_id = profiles.id AND status='approved');`

### 1.4 Trigger rewrite

Replace `check_and_award_badges` ([migration:145-207](supabase/migrations/20260417151509_remote_schema.sql#L145-L207)) with:

1. `on_submission_approved` — fires `AFTER UPDATE ON submissions` when `NEW.status='approved' AND OLD.status<>'approved'`.
   - If the submission category is eligible (restaurant/cafe/bar) **and** this is the user's first approval, set `profiles.first_approved_submission_at = now()`.
   - Insert a `delta_numerator=+1, reason='approved_submission'` ledger row for that category, using the user's current active cycle_id (or minting a new one).
   - If numerator for the active cycle reaches 10, close the cycle (mint a voucher at the user's current tier per the 5/15/35 thresholds, open a new cycle).
   - Award referral credits (see 1.4.2).
   - Award badges (see 1.4.3).

2. **1.4.2 Referral auto-placement**
   - If the submission was the user's first approval:
     - Insert a `reason='level1_referral'` ledger row for the **user** themselves? **No** — re-read [referral-system.md](.agent/documentation/referral-system.md): the invitee's own +1 is on their own approved submission (already covered above). Only the **inviter** gets an auto-placed referral credit.
     - If `profiles.inviter_id IS NOT NULL`: run the placement algorithm for the inviter — nearest-complete R/C/B (tie-break Restaurant → Cafe → Bar), skip any category that already has 4 referral rows in its active cycle. Insert `reason='level1_referral'` ledger row.
     - If the inviter has an inviter (Level 2): `referral_half_credit_accumulator.count += 1`. If count becomes even, run placement for that Level-2 grandparent and insert `reason='level2_pair'` ledger row, then `count -= 2`.
   - Placement algorithm must run inside a transaction with advisory locks per `user_id` to prevent double-placement under concurrent triggers.

3. **1.4.3 Badge awards**
   - Task count = `SELECT count(DISTINCT cycle_id) FROM credits_ledger WHERE user_id=? AND category IN ('restaurant','cafe','bar') AND <cycle is closed>`.
   - Tier = `bronze | silver | gold | platinum` via 0 / 5 / 15 / 35 thresholds.
   - Insert into `user_badges` ON CONFLICT DO NOTHING when tier transitions up. Sub-level (L1/2/3) handling deferred pending the open question.

4. Keep `trg_notify_on_submission_status_change` ([migration:933](supabase/migrations/20260417151509_remote_schema.sql#L933)) intact. Add sibling trigger on `user_badges` insert to create a notification row (addresses the "Badges are silent" gap in [notifications.md](.agent/documentation/notifications.md)).

### 1.5 Unified activity feed

Either:
- View `user_activity AS SELECT ... FROM submissions UNION ALL ... FROM user_badges UNION ALL ... FROM closed_cycles UNION ALL ... FROM vouchers`, or
- `rpc get_user_activity(user_id, limit, offset)` returning a discriminated shape.

Preference: RPC, for pagination + RLS simplicity.

### 1.6 New / updated hooks

- `hooks/useTasks.ts` (new): returns `{ categories: { restaurant, cafe, bar, hotel }, currentTier, currentLevel, completedTasks, vouchers }`. Subscribes to ledger changes.
- `hooks/useActivity.ts` (new): paginated unified feed for the History page.
- `hooks/useSubmissions.ts`: keep for Submit form needs; deprecate `approvedCounts` in favour of `useTasks`.

### 1.7 Migration acceptance

- All existing `user_badges` rows preserved; new trigger is additive for tier promotions.
- Dry-run against a snapshot of prod data in a branch DB; verify task counts and tier assignments match manual SQL.
- Rollback script included (revert enum, drop new tables).

---

## Phase 2 — Tasks tab shell

Scope: rename and restructure only. No new content yet.

### 2.1 Tab rename

- [app/(tabs)/tasks.tsx](app/(tabs)/tasks.tsx): already named `tasks` at the route level. Confirm label in [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx) shows `Tasks` (not `Challenge`).
- Remove any stray `Challenges` / `Challenge` header copy. Strip the `200 ★` pill entirely — search: `Grep "200" app/` and `Grep "points" components/verified-member/`.

### 2.2 Subtab restructure

In [components/verified-member/VerifiedMember.tsx](components/verified-member/VerifiedMember.tsx):

- Replace `activeTab` union `'submit' | 'badges' | 'rewards'` with `'my-tasks' | 'submit' | 'rewards'`.
- Drop the existing stats block (`Approved` / `Pending` counters) — moves into My Tasks section redesign.
- Keep [components/verified-member/rewards/index.tsx](components/verified-member/rewards/index.tsx) mounted under `rewards` tab unchanged (design not yet produced).
- Move `components/verified-member/submission/index.tsx` content behind the `submit` tab, but drop the in-tab history table — it relocates to My Tasks + standalone page.
- Add a placeholder `components/verified-member/my-tasks/index.tsx` that Phase 3 fills in.

### 2.3 Unverified gate

Verified-only gate is already handled at the `VerifiedMember` level — unverified users render the old flow via `app/(tabs)/tasks.tsx` branching. Verify nothing in that branch references the renamed tabs.

### 2.4 Acceptance

- Tasks tab opens to `My Tasks` by default.
- `Submit` and `Rewards` still function exactly as before (rewards unchanged, submit minus the history block).
- Points pill gone. No visual regressions on the unverified path.

---

## Phase 3 — My Tasks subtab (Design 1)

New file: `components/verified-member/my-tasks/index.tsx`.

### 3.1 Section 1 — Task progress tracker

- 4 horizontal category chips at the top: `Restaurant` (default selected), `Cafe`, `Bar`, `Hotel`. Selected style from the Figma — green pill, white text; unselected — white pill, gray border, dark text.
- Below: big numeric counter for the selected category's current cycle numerator.
- Caption: `Total Visited {Category}`.
- Progress bar with 6 fixed ticks at positions 0, 2, 4, 6, 8, 10.
  - Approved-submission portion renders in brand green (`#206E56`).
  - Referral +1 portion renders as gold ticks (`#D4A017` or closest Figma gold) at positions `numerator_from_submissions+1` onward.
  - `(+N)` text annotation renders in smaller gold font to the right of the current count.
  - Hotel never shows gold ticks (cap forced to 0 referrals).
- Caption below the bar: `Earn 1 credit for each approved submission!` (replaces the old "10 Points" copy).

### 3.2 Section 2 — My Badge

- Heading `My Badge` with a right-aligned `→` button that routes to the Badge detail page (Phase 5).
- If the user has no completed tasks:
  - Empty-state card with placeholder badge art and copy `Start submitting content now to earn your first badge!` (match current copy in [components/verified-member/badges/index.tsx](components/verified-member/badges/index.tsx)).
- Else:
  - Render the user's current tier + level badge (name + image).
  - Subcopy: `Upload {N} proofs to reach the next level` where `N` = credits remaining toward the next tier threshold.

### 3.3 Section 3 — History snippet

- Heading `History` with right-aligned `→` button routing to the full History page (Phase 4).
- Render the last 5 rows from `useActivity({ limit: 5 })`.
- Row shape: `Date | Target | Status`. Event-type-specific copy:
  - `approved_submission` → `{MMM D} | {partner_store} | Approved` + `+1 credit` trailing pill.
  - `badge_earned` → `{MMM D} | Earned {Tier} Level {N}`.
  - `task_completed` → `{MMM D} | {Category} Task Completed | +1 voucher`.
  - `voucher_redeemed` → `{MMM D} | Redeemed {reward_kind}`.
- If empty, show `No activity yet.`

### 3.4 Acceptance

- 4 category chips render, tap switches the big counter + progress bar.
- Bar/gold-tick positions match the ledger state.
- `→` buttons navigate to the two routed pages (stubs OK until Phase 4/5 land).

---

## Phase 4 — History full page (Design 2)

New route: `app/tasks/history.tsx`.

### 4.1 Table

- Columns: `Date` | `Restaurant` (or event target) | `Status`. **Drop** the `Rewards` column.
- Event-type rendering matches the snippet copy from Phase 3.3, extended to include voucher redemptions.
- Back arrow in the header routes to the Tasks tab.

### 4.2 Pagination

- Page size = 10.
- Footer: numbered page links + `‹ Prev` / `Next ›`. Current page highlighted, disable Prev at page 1 and Next at last page.
- Show `You've reached the end!` copy under the last page only.

### 4.3 Data

- `hooks/useActivity({ page, pageSize: 10 })`. Server-side pagination via the RPC from 1.5.

### 4.4 Acceptance

- Navigating Prev/Next and page numbers updates the list without flashing.
- Events are sorted newest-first across all types.
- RLS test: verify one user cannot load another's history.

---

## Phase 5 — Badge detail page (Design 3)

New route: `app/tasks/badges.tsx` (replaces or wraps the current [components/verified-member/badges/index.tsx](components/verified-member/badges/index.tsx) when landed).

### 5.1 Structure

- Header: back arrow + `My Badge` title.
- 4 scrollable category sections: `Restaurant`, `Cafe`, `Bar`, `Hotel`. Each section:
  - Heading + right-aligned share CTA (`↗`) that opens the Badge Collection share card (Phase 6).
  - Horizontal scroll of 12 badge tiles (4 tiers × 3 levels). Earned tiles show in color; locked tiles grayscale with reduced opacity.
  - Horizontal progress rail under the tiles showing where the user currently sits.

### 5.2 Tier + level resolution (locked 2026-04-23)

Tier+level is a single global value per user, derived from cumulative completed tasks across **R/C/B** (Hotel excluded). All 4 category rows display the same global tier+level — they differ only in category-themed badge art.

Full threshold table + reference TypeScript impl: see [`badges.md`](.agent/documentation/badges.md) "Tier + level table". Don't duplicate the numbers here — link back to that doc.

Tile state per row:
- Tile is **earned** if its tier+level position is `<=` the user's current global tier+level (compare via the linear order Bronze L1 → Bronze L2 → … → Platinum L3).
- Exactly one tile is `current` (the user's present tier+level).
- All later tiles are `locked` (grayscale).

Caption under each tile: `Level {N}` + `{Tier}` (e.g. `Level 1 Platinum`).

### 5.3 Data wiring

Extend [hooks/useTasks.ts](hooks/useTasks.ts) to expose `level: 1 | 2 | 3 | null` alongside `tier`. Helper function `tierLevelFor(taskCount)` lives next to `tierFromTaskCount` (reference impl in [badges.md](.agent/documentation/badges.md) "Target tier + level table"). Backend trigger needs no change for the L1/L2/L3 mechanic since it's purely derivable.

Per-category badge art uses the existing URL pattern: `${SUPABASE_URL}/storage/v1/object/public/badges/{Category}_{Tier}_{Rank}-min.webp`. Bar and Hotel image variants must be uploaded to the bucket before this phase can render — verify with bucket contents.

### 5.4 Acceptance

- 4 category rows render, each with 12 tiles in tier-then-level order.
- All 4 rows highlight the same tile as `current`.
- Earned/locked state matches the user's `useTasks().tier` + `level`.
- Share CTA per row launches Phase 6 with the right category arg.

---

## Phase 6 — Badge collection share card (Design 4)

New route: `app/tasks/badges/share/[category].tsx` (or bottom-sheet modal — decide during implementation).

### 6.1 Card content

- Title: `My Badge Collection`.
- Main art: the user's latest badge for that category (same art assets as Phase 5).
- Title: tier name in green (e.g. `Platinum`).
- Subtitle: `Level {N}`.
- Caption: `{total} total visit(s) {category}` — source from `useTasks().categories[{category}].totalApprovedSubmissions` (include all approved submissions, pre-cycle-reset).
- Footer: profile chip (avatar + `{displayName}` + `Joined since {MMM D, YYYY}`).
- Bottom CTA: green `Share` button that triggers `expo-sharing` with a PNG capture of the card (render-to-bitmap via `react-native-view-shot` or similar).

### 6.2 Acceptance

- Share sheet opens with the image attached.
- Copy matches the selected category.

---

## Phase 7 — New Submit form + Proof Submitted (Design 5 + 6)

Update: `components/verified-member/submission/index.tsx`. New route: `app/tasks/submit-success.tsx` (or an in-place full-screen overlay).

### 7.1 Form structure

Three wrapper cards stacked vertically, each with a numbered heading.

**1. Date Visit** — new requirement, replaces "auto today":
- Three dropdowns: `Date` (1–31), `Month` (Jan–Dec), `Year` (current year and one prior).
- Submit to `submissions.receipt_date` as an ISO date. Validate: not in future, not older than 6 months (mirror the AI-review window used in [submission-review-ai.md](.agent/documentation/submission-review-ai.md)).
- Inline error copy under the row for validation failures.

**2. Select a Partner Store** — keep existing picker + search, just restyle into the numbered card.

**3. Upload Receipt** — restyle existing `ImagePicker`-backed uploader.

**4. Upload Selfie** — separate card from receipt (currently these are often combined; split per design).

**5. Submit** — green pill CTA at the bottom.

### 7.2 Proof Submitted screen (Design 6)

Replace the current success alert with a dedicated view:

- Title: `Proof Submitted!`.
- Body: `Your proof has been submitted successfully and points are on the way` → rewrite to `Your proof has been submitted — credits will land once an admin approves your proof.` (drops "points" per credits-overview).
- `OK` button dismisses to the My Tasks subtab and triggers a `useTasks` refetch.

### 7.3 Acceptance

- Date-in-future is rejected before upload.
- All 4 categories accepted (requires Phase 1 enum extension).
- Success screen shows, OK returns to My Tasks.
- No regression for unverified members.

---

## Phase 8 — Referral credit notice

Files: [components/invite-friends/referrals.tsx](components/invite-friends/referrals.tsx) + My Tasks progress bar animation.

### 8.1 Referrals page banner

- When a `level1_referral` or `level2_pair` ledger row is written for the current user, surface a toast/banner on the Referrals page: `🎁 Bonus 1 Credit for {category}`.
- Trigger source: Supabase Realtime subscription on `credits_ledger` filtered by `user_id = auth.uid()` and `reason IN ('level1_referral','level2_pair')`. If the user is on the Referrals page when the event arrives, show the banner for 4s then auto-dismiss. If not, skip — the notification system (Phase 1.4 sibling trigger) handles the off-screen case.

### 8.2 My Tasks bar animation

- When a new gold tick lands on the active category's progress bar, animate it sliding in (200ms ease-out) so the user sees *where* the referral credit went.
- Reuse the same Realtime subscription.

### 8.3 Dot state wiring

Finally fulfill the deferred items from [referral-system.md](.agent/documentation/referral-system.md) implementation checklist:
- Three-state dot (hollow / gray / green) in [components/invite-friends/referrals.tsx:231-237](components/invite-friends/referrals.tsx#L231-L237).
- Hide name or show `Pending member` for `Registered only` rows.

### 8.4 Acceptance

- A staging user qualifies a referral → inviter sees the banner on Referrals page and the gold tick on My Tasks.
- Level 2 pair completion: grandparent sees banner exactly every 2 qualifications, never single.
- Dot states match the user's verification + first-approval state.

---

## Execution order recommendation

1. **Phase 1** must ship first — every frontend phase depends on `useTasks`, the ledger, and the enum extensions.
2. **Phase 2** gates the rest of the UI work; keep it small and mergeable on its own.
3. **Phases 3 + 7 + 4** in parallel if more than one person is on the project — they share Phase 2 but don't touch each other's files.
4. **Phase 8** can start as soon as Phase 2 lands; it doesn't need the full My Tasks UI to test the trigger + banner.
5. **Phases 5 + 6** unblocked 2026-04-23 — slot anywhere after Phase 1.

## Notes for incremental delivery

- One migration per phase where possible — Phase 1 is the exception (has to be atomic).
- After Phase 1, dogfood with a staging account: submit → verify ledger row → verify tier/voucher.
- After Phase 2, manually click each subtab; ensure no console errors or red-screen regressions on unverified flows.
- After each UI phase, sanity-check the unverified/guest routes — none of these changes should affect them.
- Keep the Figma open side-by-side during Phase 3/5/7 to spot spacing and color drift early.
- File path assumptions (`components/verified-member/my-tasks/`, `app/tasks/history.tsx`, etc.) are conventions matching the repo's existing layout — adjust during implementation if the team has different preferences.
