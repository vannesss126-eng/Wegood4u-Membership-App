![alt text](image.png)# Referral System — Two-Level Tree + Qualification Rules
> Context doc for the Invite Friends / Referrals feature. Pair with [`architecture-brief.md`](architecture-brief.md), [`credits-overview.md`](credits-overview.md), and [`badge-rewards.md`](badge-rewards.md).
>
> **Scope note:** this doc owns the *tree + qualification* logic. The *credit award mechanic* (auto-placement, +1 numerator, 4-tick cap, Level 2 half-credit accumulator) is defined in [`credits-overview.md`](credits-overview.md) and supersedes anything older in this file.

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

- **+1 credit** to the invitee (applied to their own nearest-complete R/C/B task, per [`credits-overview.md`](credits-overview.md) auto-placement rules).
- **+1 credit** to their direct inviter (Level 1 relationship, same auto-placement rules).

**Level 2 is no longer display-only** (updated 2026-04-22). When a Level 2 invitee qualifies, the top-level affiliate accumulates +0.5 credit; every pair of Level 2 qualifications settles as +1 auto-placed credit. Full mechanic in [`credits-overview.md`](credits-overview.md).

Award fires **once per invitee**, on the first approved submission after verification. Subsequent approvals do not grant additional referral credits.

Visual manifestation: a referral credit is never shown as "balance +1." It appears on the recipient's My Tasks tracker as a **gold tick** on the progress bar of the auto-placed category, with `(+N)` beside the approved count. See [`credits-overview.md`](credits-overview.md) "Referral auto-placement rules."

### 3. The "within 1 hour" reward note
Product copy referenced a "reward credit of visit within 1 hour" tied to the invitee's first submission. Treat this as a UX timing hint for the invitee's own experience (show the credit landing quickly after approval), **not** as a hard expiry window on the referral reward itself. Clarify with product before enforcing a 1-hour cutoff in the database logic.

### 4. Anti-abuse
- Credits only issue when the submission reaches `approved` — AI review + human review gate this.
- A rejected first submission does **not** award; the invitee stays in "Verified member" state and can try again with another submission.
- If an approved submission is later reverted to rejected (admin override), decide whether to claw back the credit. **Open question — confirm with product.**

---

## Credits (full spec now in [`credits-overview.md`](credits-overview.md))
Credits are the app's single progress unit (replacing the earlier "points" concept). The full economy — earning rules, auto-placement algorithm, per-category caps, badge tiers, voucher rewards — is locked in [`credits-overview.md`](credits-overview.md) as of 2026-04-23.

What this doc contributes to the credit system:
- The qualification gate (Verified + first approved submission) that triggers a credit event.
- The 1+1 split at Level 1 (invitee + inviter).
- The 0.5 + 0.5 = 1 split at Level 2 (top-level affiliate accumulator).

Everything after the credit event — auto-placement, ledger shape, cycle mechanics, voucher minting — lives in [`credits-overview.md`](credits-overview.md).

---

## Implementation checklist (when the user is ready to build)
1. Add `credits_ledger` table + RLS so users can only read their own rows. Schema per [`credits-overview.md`](credits-overview.md) "Implementation notes" — `(user_id, category, delta_numerator, reason, source_submission_id, source_referral_id, cycle_id, created_at)`.
2. Add `referral_half_credit_accumulator(user_id, count)` for Level 2 pairing.
3. Add a `first_approved_submission_at` column on `profiles` (nullable timestamp) — set once via trigger when a user's first submission reaches `approved`.
4. Trigger/edge function on that transition:
   - Run the auto-placement algorithm (nearest-complete R/C/B category, tie-break Restaurant → Cafe → Bar, skip if that category has already hit 4 gold ticks this cycle).
   - Insert `+1` ledger row for the invitee with `reason = 'approved_submission'` *plus* their own referral credit on the chosen category.
   - If `profiles.inviter_id` is not null (Level 1), insert `+1` ledger row for the inviter with `reason = 'level1_referral'`, `source_referral_id = <invitee_id>`.
   - If the inviter's own inviter (Level 2 → top-level affiliate) exists, increment that user's half-credit accumulator by 1. If the accumulator is now even, insert `+1` ledger row with `reason = 'level2_pair'` and decrement the accumulator by 2.
5. Extend the `referral_tree` view (or the `useReferrals` hook query) to join `verification_completed` and `first_approved_submission_at` so the UI can render the three dot states.
6. Update [components/invite-friends/referrals.tsx:231-237](components/invite-friends/referrals.tsx#L231-L237) so `greenCircle` style becomes conditional: hollow / gray / green.
7. Hide names (or show a "Pending" placeholder) for invitees still in the "Registered only" state.
8. Surface a "Bonus 1 Credit for {category}" toast/banner on the Referrals page when a qualifying event awards the user a credit.

---

## Open questions to resolve with product
- ~~Do Level 2 qualified referrals award anything to the top-level affiliate?~~ **Resolved 2026-04-22:** yes, +0.5 per qualified Level 2 invitee, settled as +1 credit per pair. Full mechanic in [`credits-overview.md`](credits-overview.md).
- Claw-back policy if an approved submission is later rejected.
- Does the "within 1 hour" copy reflect a real business rule, or is it just UX framing?
- Is there a cap on referral credits per affiliate per day / month? (Per-category per-cycle cap is 4 gold ticks — see [`credits-overview.md`](credits-overview.md) — but that's a per-cycle mechanic, not a per-affiliate rate limit.)
