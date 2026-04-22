![alt text](image.png)# Referral System — Two-Level Tree + Qualification Rules
> Context doc for the Invite Friends / Referrals feature. Pair with `architecture-brief.md`.

---

## What this feature does
Each user (affiliate) can invite friends. Those invites form a **two-level tree**:

- **Level 1** — people the affiliate directly invited
- **Level 2** — people that Level 1 users invited

The affiliate can see both levels in the "Referrals" tab of the Invite Friends screen. Level 1 users are shown as top-level rows; expanding a row reveals their Level 2 invitees nested underneath.

---

## Current implementation (as of 2026-04-21)

### Data model
| Table / View | Column | Purpose |
|---|---|---|
| `profiles` | `inviter_id` (uuid, FK → profiles.id) | Who invited this user. Forms the tree. |
| `profiles` | `verification_completed` (bool) | True once user finishes the verification questionnaire. |
| `profiles` | `role` ('subscriber' / 'member' / 'affiliate' / 'admin') | Becomes `member` after verification. |
| `invitation_codes` | `code`, `user_id`, `usage_count` | Per-affiliate invite code + usage counter. |
| `submissions` | `status` ('pending' / 'approved' / 'rejected') | Proof-of-travel submissions. |
| `referral_tree` (VIEW) | recursive CTE joining `profiles` on `inviter_id` | Flattens the tree into Level 1 + Level 2 rows for a given affiliate. |

### Key files
- UI: [components/invite-friends/referrals.tsx](components/invite-friends/referrals.tsx)
- Data hook: [hooks/useReferrals.ts](hooks/useReferrals.ts)
- Schema + view: [supabase/migrations/20260417151509_remote_schema.sql:656-687](supabase/migrations/20260417151509_remote_schema.sql#L656-L687)
- Usage-count trigger: [supabase/migrations/20260417151509_remote_schema.sql:270-282](supabase/migrations/20260417151509_remote_schema.sql#L270-L282)

### What's NOT implemented yet
- No qualification gating — every `inviter_id` link currently shows up in the tree regardless of whether the invitee is real/active.
- No credits table, no credit awards.
- The "green dot" in the UI has no state — it's always solid green.

---

## New rules (to implement)

### 1. Referral qualification states
A referral row in the tree has one of three visible states, driven by the invitee's own profile + submission history:

| State | Trigger condition | Dot appearance | Name shown |
|---|---|---|---|
| **Registered only** | Invitee signed up, no verification yet | Empty/outline dot (gray border, hollow) | Hidden or placeholder (e.g. "Pending member") |
| **Verified member** | `profiles.verification_completed = true` | Gray solid dot | Name visible |
| **Active (qualified)** | Verified **AND** has at least one `submissions.status = 'approved'` | Full green dot (current color `#206E56`) | Name visible |

**Reasoning:** we do not want to display or reward ghost/spam accounts. A referral only "counts" once the invitee has proven real engagement by getting one submission approved.

### 2. Credit reward — the "1+1" rule
When an invitee transitions to the **Active (qualified)** state for the first time:

- **+1 credit** to the invitee (the person who just qualified)
- **+1 credit** to their direct inviter (Level 1 relationship only)

Level 2 relationships do **not** award credits to the top-level affiliate at this stage. Level 2 is display-only.

Award fires **once per invitee**, on the first approved submission after verification. Subsequent approvals do not grant additional referral credits.

### 3. The "within 1 hour" reward note
Product copy referenced a "reward credit of visit within 1 hour" tied to the invitee's first submission. Treat this as a UX timing hint for the invitee's own experience (show the credit landing quickly after approval), **not** as a hard expiry window on the referral reward itself. Clarify with product before enforcing a 1-hour cutoff in the database logic.

### 4. Anti-abuse
- Credits only issue when the submission reaches `approved` — AI review + human review gate this.
- A rejected first submission does **not** award; the invitee stays in "Verified member" state and can try again with another submission.
- If an approved submission is later reverted to rejected (admin override), decide whether to claw back the credit. **Open question — confirm with product.**

---

## Credits (placeholder — full spec pending)
Credits are a new concept. For now, document only what the referral flow needs:

- Unit: integer "credit" (1 credit per qualifying referral event)
- Two award events per qualifying referral: one to invitee, one to inviter
- No expiry assumed
- Redemption rules, balance UI, and the broader credit economy are **out of scope for this doc** — the user will define these separately

When implementing, stub a `credits_ledger` table (user_id, delta, reason, source_submission_id, created_at) so every credit movement is auditable. Do not mutate a running balance in place — derive balance from the ledger.

---

## Implementation checklist (when the user is ready to build)
1. Add `credits_ledger` table + RLS so users can only read their own rows.
2. Add a `first_approved_submission_at` column on `profiles` (nullable timestamp) — set once via trigger when a user's first submission reaches `approved`.
3. Trigger/edge function on that transition:
   - Insert `+1` ledger row for the invitee (reason: `first_approved_submission`)
   - If `profiles.inviter_id` is not null, insert `+1` ledger row for the inviter (reason: `referral_qualified`, `source_submission_id = <id>`)
4. Extend the `referral_tree` view (or the `useReferrals` hook query) to join `verification_completed` and `first_approved_submission_at` so the UI can render the three dot states.
5. Update [components/invite-friends/referrals.tsx:231-237](components/invite-friends/referrals.tsx#L231-L237) so `greenCircle` style becomes conditional: hollow / gray / green.
6. Hide names (or show a "Pending" placeholder) for invitees still in the "Registered only" state.

---

## Open questions to resolve with product
- Do Level 2 qualified referrals award anything to the top-level affiliate (e.g. 0.5 credits, or a separate bonus)?
- Claw-back policy if an approved submission is later rejected.
- Does the "within 1 hour" copy reflect a real business rule, or is it just UX framing?
- Is there a cap on referral credits per affiliate per day / month?
