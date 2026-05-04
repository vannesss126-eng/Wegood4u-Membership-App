# Referral System — Two-Level Tree + Qualification Rules

> Owns the *tree + qualification* logic for the Invite Friends / Referrals feature.
> Award mechanic (stars → Visit 10 progress) is owned by [`credits-overview.md`](credits-overview.md) and [`extra-tasks.md`](extra-tasks.md). This doc describes when a referral fires; those docs describe what it earns.
> Pair with [`architecture-brief.md`](architecture-brief.md), [`credits-overview.md`](credits-overview.md), [`extra-tasks.md`](extra-tasks.md), and [`badge-rewards.md`](badge-rewards.md).

---

## What this feature does

Each user (affiliate) can invite friends. Those invites form a **two-level tree**:

- **Level 1** — people the affiliate directly invited
- **Level 2** — people that Level 1 users invited

The affiliate sees both levels in the "Referrals" tab of the Invite Friends screen. Level 1 users are top-level rows; expanding a row reveals their Level 2 invitees nested underneath.

### Referral count is unlimited

There is **no cap** on how many people a single affiliate can refer. Same `invitation_codes.code` is reused for every invite — no per-code usage limit, no per-day rate limit, no concept of "deleting" a referral to free up a slot.

> *"i dont think it should limit to 7 referral only" … "it should be unlimited" … "Unlimited ya"* — Kasey, 2026-04-23

This rejected an earlier proposal to cap referrals at 7 with a "delete inactive referral" feature. **Do not introduce that cap or feature** — they were explicitly rejected.

**Don't confuse this with the per-cycle +4 cap in [`credits-overview.md`](credits-overview.md):** an affiliate can convert at most 4 stars-derived increments into a single Visit 10 cycle. That's a per-cycle cap on the conversion, not a referral-count cap. Stars beyond the 4-cap simply queue and apply to the next cycle. Qualified referrals continue to earn stars indefinitely.

### Implementation invariants — keep these true

| Place | Today | Rule |
|---|---|---|
| `invitation_codes` table | has `usage_count`, `is_active`, `code`. No `max_uses`. | **Do not add** `max_uses` or any cap column. |
| Trigger that bumps `usage_count` ([migration:270-282](supabase/migrations/20260417151509_remote_schema.sql#L270-L282)) | unconditional `usage_count = usage_count + 1` | **Do not add** a `WHERE usage_count < N` guard. |
| `useReferrals` hook ([hooks/useReferrals.ts](hooks/useReferrals.ts)) | returns all rows from `referral_tree` | **Do not add** `.slice(0, N)` or pagination caps. |
| Referrals UI ([components/invite-friends/referrals.tsx](components/invite-friends/referrals.tsx)) | renders every Level 1 row | **Do not add** a list cap. |
| RLS on `invitation_codes` | inserts gated by role, no count check | Don't add a count check. |

---

## Current implementation (as of 2026-04-21)

### Data model

| Table / View | Column | Purpose |
|---|---|---|
| `profiles` | `inviter_id` (uuid, FK → profiles.id) | Who invited this user. Forms the tree. |
| `profiles` | `verification_completed` (bool) | True once user finishes verification questionnaire. |
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
- No star wallet, no star awards.
- The "green dot" in the UI has no state — it's always solid green.

---

## Qualification rules (to implement)

### 1. Referral states

A referral row in the tree has one of three visible states, driven by the invitee's profile + submission history:

| State | Trigger condition | Dot appearance | Name shown |
|---|---|---|---|
| **Registered only** | Invitee signed up, no verification yet | Empty / outline dot (gray border, hollow) | Hidden or placeholder ("Pending member") |
| **Verified member** | `profiles.verification_completed = true` | Gray solid dot | Name visible |
| **Active (qualified)** | Verified **AND** has at least one `submissions.status = 'approved'` | Full green dot (`#206E56`) | Name visible |

Reasoning: don't display or reward ghost / spam accounts. A referral only "counts" once the invitee has proven real engagement.

### 2. Star awards — the 1+1 rule (in stars)

When an invitee transitions to the **Active (qualified)** state for the first time:

- **+100 stars** to the invitee (auto-converts to +1 Visit 10 progress when the wallet hits 100).
- **+100 stars** to the direct inviter (Level 1 relationship).
- If the inviter's own inviter (Level 2 → top-level affiliate) exists: **+50 stars** to that user.

> Star values locked 2026-05-03 alongside the credits → stars rebrand. Two qualified Level 2 invitees = 100 stars = +1 Visit 10 progress (same as one Level 1).

### 3. Per-invitee one-shot

Award fires **once per invitee**, on the first approved submission after verification. Subsequent approvals do not grant additional referral stars.

> *"This is for 1st time only ya. Means every submission of new user on new successfully approval"* — Kasey

### 4. The "within 1 hour" reward note

Product copy referenced a "reward credit of visit within 1 hour" tied to the invitee's first submission. Treat this as a UX timing hint — show the star landing quickly after approval — **not** as a hard expiry window. Confirm with product before enforcing a 1-hour cutoff in the database.

### 5. Anti-abuse

- Stars only issue when the submission reaches `approved` — AI review + human review gate this.
- A rejected first submission does **not** award; the invitee stays in "Verified member" state and can try again with another submission.
- **Approvals are final** ([`credits-overview.md`](credits-overview.md) §"Approvals are final"). Admin cannot reverse `approved` → `rejected`, so referral stars cannot be clawed back. Once awarded, locked.

---

## How referral stars feed the cycle

Per [`credits-overview.md`](credits-overview.md), all extra-task stars enter a single per-user wallet. Once the wallet hits 100, +1 Visit 10 progress is auto-applied (max +4 per cycle, leftover queued).

Referral does **not** auto-place onto a specific category — there are no category-specific cycles anymore. The Visit 10 cycle is a single cumulative counter across R/C/B.

Visual manifestation: a referral star award shows on the recipient's Visit 10 card as `(+N)` extras applied to the cycle, plus a History entry like `{date} • {invitee_name} qualified (L1) • +100 ★`. See [`history-feed.md`](history-feed.md) for the full event vocabulary.

---

## Implementation checklist (when ready to build)

1. Add `star_wallet` table (per [`credits-overview.md`](credits-overview.md) "Storage model") + RLS so users can only read their own row.
2. Add `star_ledger` table for the audit trail of every star award + every conversion-to-progress event.
3. Add `first_approved_submission_at` column on `profiles` (nullable timestamp) — set once via trigger when a user's first submission reaches `approved`.
4. Trigger on that transition:
   - Insert `+100` ledger row for the invitee with `reason = 'l1_referral_self_bonus'` (the invitee's own first-approval bonus).
   - If `profiles.inviter_id` is not null (Level 1), insert `+100` ledger row for the inviter with `reason = 'l1_referral'`, `source_id = <invitee_id>`.
   - If the inviter's own inviter (Level 2 → top-level affiliate) exists, insert `+50` ledger row for that user with `reason = 'l2_referral'`.
   - For each ledger insert, run the wallet-update routine (which may trigger a conversion-to-progress event if the wallet hits 100, capped at +4/cycle).
5. Extend the `referral_tree` view (or `useReferrals` hook query) to join `verification_completed` and `first_approved_submission_at` so the UI can render the three dot states.
6. Update [components/invite-friends/referrals.tsx:231-237](components/invite-friends/referrals.tsx#L231-L237) so `greenCircle` style becomes conditional: hollow / gray / green.
7. Hide names (or show "Pending") for invitees in "Registered only" state.
8. Surface a toast / banner on the Referrals page when a qualifying event awards stars: *"+100 stars from {invitee_name}"*.

---

## Open questions

- ~~Do Level 2 qualified referrals award anything?~~ **Resolved 2026-04-22 / re-locked 2026-05-03:** yes, +50 stars per qualified Level 2 invitee.
- ~~Is there a cap on the number of referrals per affiliate?~~ **Resolved 2026-04-23: no.** Unlimited.
- ~~Claw-back policy if an approved submission is later rejected.~~ **Resolved 2026-05-04: N/A.** Admin cannot reverse approvals — once approved, locked.
- Does the "within 1 hour" copy reflect a real business rule or just UX framing?
- Is there a per-affiliate rate limit on referral stars per day / month? (Per-cycle +4 trade cap exists in [`credits-overview.md`](credits-overview.md) but that's a conversion cap, not a referral-rate cap. Unlimited-referrals decision strongly suggests no rate limit, but confirm.)
