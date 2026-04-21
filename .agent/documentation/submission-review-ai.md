# AI Submission Review — Feature Specification

## Overview

Wegood4u is an Expo/React Native travel rewards app on Supabase. Users visit partner stores (cafes, restaurants, bars, experiences), take a **selfie photo** and a **receipt photo**, then submit them as proof of visit via the Tasks tab. An AI reviewer processes each submission automatically using a Supabase Edge Function (`supabase/functions/review-submission/index.ts`) that calls Claude's Vision API.

**The AI reviewer can only approve or flag submissions — it never rejects.** Rejections are reserved for Phase 2 after the system has been validated in production.

---

## Architecture

- **Edge Function:** `review-submission/index.ts` — auto-invoked on every new pending submission (see Trigger below).
- **Trigger:** `supabase/migrations/20260420120000_ai_review_trigger.sql` installs an `AFTER INSERT` Postgres trigger on `public.submissions` that fires only when `NEW.status = 'pending'`. It uses `pg_net.http_post` to send an async `POST` to the Edge Function URL with `{ submission_id: NEW.id }`. The async call ensures the user's INSERT is never blocked on the Anthropic API, and any webhook-delivery failure is swallowed as a warning so the submission still succeeds.
- **AI Model:** Claude Sonnet 4.6 via `/v1/messages` with vision (two base64 image content blocks).
- **Reviewer identity:** Uses admin profile UUID `11b60765-9911-4985-9cbf-0ba4d568303c` (wegood4u@gmail.com) as `reviewed_by`. The `admin_notes` field distinguishes AI decisions from human ones (AI notes always start with "Auto-approved:" or "AI review incomplete:").
- **Concurrency guard:** Atomic claim (`UPDATE ... WHERE reviewed_by IS NULL`) prevents duplicate processing.
- **Database columns:** `receipt_date`, `total_amount`, `currency`, `merchant_name`, `receipt_hash`, `admin_notes`, `reviewed_by`, `reviewed_at` on the `submissions` table.

---

## Phase 1 — Current (Approve or Pending only)

**Guiding principle:** During early stage, the AI assists but does not punish. All ambiguous cases go to a human admin. This avoids unfairly flagging users due to image quality issues, slow uploads, or edge cases the AI hasn't been trained on.

### Decision outcomes

| Outcome | When | What happens |
|---------|------|-------------|
| **Approved** | All checks pass | `status = 'approved'`, `admin_notes` explains why |
| **Pending** | Any check fails | `status` stays `pending`, `admin_notes` lists what failed, admin reviews manually |

**The AI will NEVER set `status = 'rejected'` in Phase 1.**

### Checks performed

The AI analyzes both the receipt photo and selfie photo in a single Claude Vision call and evaluates these criteria:

#### 1. Receipt data extraction
Claude extracts from the receipt image:
- `receipt_date` — transaction date (YYYY-MM-DD)
- `total_amount` — grand total paid (numeric)
- `currency` — currency code if visible (e.g. MYR, RM)
- `merchant_name` — store/merchant name as printed

If any of `receipt_date` or `total_amount` cannot be read → **pending** with note listing which fields are missing (e.g. "missing receipt date, receipt total").

#### 2. Receipt date freshness
The receipt date must be within **21 days** of the submission date (`created_at`). If the receipt is older than 21 days → **pending** with note "Receipt date is older than 21 days from submission."

#### 3. Selfie validation
Claude checks the selfie image for:
- `person_visible` — a clearly recognizable human face is present
- `receipt_visible` — a physical paper receipt is also visible in the selfie (held in frame)

If either check fails → **pending** with note listing what's missing (e.g. "missing person in selfie, receipt visible in selfie").

#### 4. Merchant name vs partner store
The `merchant_name` extracted from the receipt is compared against the `partner_store_name` the user selected when submitting. If the names don't match (fuzzy comparison) → **pending** with note "Merchant name on receipt does not match selected partner store."

This catches cases where a user submits a receipt from a different store than the one they selected.

#### 5. Duplicate detection
Two layers of duplicate detection run against all existing `approved` and `pending` submissions for the same user:

- **Exact image match:** SHA-256 hash of the receipt image bytes. If an identical image was already submitted → **pending** with note referencing the prior submission ID.
- **Fuzzy match:** Same `partner_store_name` + same `receipt_date` + same `total_amount` (within RM 0.05 tolerance). If matched → **pending** with note.

#### 6. Image size guard
Each image must be under ~3.5MB raw (Claude Vision's 5MB base64 limit). If oversized → **pending** with note "Image exceeds size limit, manual review required."

### Auto-approve criteria (ALL must pass)

A submission is auto-approved only when **every** check passes:
- Receipt date extracted successfully
- Total amount extracted successfully
- Receipt date is within 21 days of submission
- Person visible in selfie
- Receipt visible in selfie
- Merchant name matches partner store (or close enough)
- No duplicate detected
- Images within size limits

If **any** check fails, the submission stays `pending` with detailed `admin_notes` for the human admin.

---

## Phase 2 — Future (Approve, Pending, or Reject)

Phase 2 promotes certain `pending` cases to `rejected` once the system has proven reliable in production.

### Changes from Phase 1

| Check | Phase 1 outcome | Phase 2 outcome |
|-------|-----------------|-----------------|
| Exact duplicate image (SHA-256 match) | Pending | **Rejected** |
| Fuzzy duplicate (same store + date + amount) | Pending | **Rejected** |
| Blurry / unreadable receipt (all fields null) | Pending | **Rejected** |
| Receipt date older than 21 days | Pending | **Rejected** |
| Selfie missing person or receipt | Pending | Pending (still needs human judgment) |
| Merchant name mismatch | Pending | Pending (still needs human judgment) |
| Image oversized | Pending | Pending |

### Rejection notes

When rejecting in Phase 2, `admin_notes` will include a clear reason so the user (or admin) understands:
- "Duplicate receipt — matches submission #X"
- "Receipt is unreadable — no date or total could be extracted"
- "Receipt is too old — dated more than 21 days before submission"

---

## Key data structures

### Submissions table fields (AI-related)

| Column | Type | Description |
|--------|------|-------------|
| `receipt_date` | date | Transaction date extracted via OCR |
| `total_amount` | numeric(12,2) | Total amount extracted via OCR |
| `currency` | text | Currency code from receipt, NULL if unreadable |
| `merchant_name` | text | Merchant name extracted from receipt |
| `receipt_hash` | text | SHA-256 hash of receipt image bytes |
| `admin_notes` | text | AI or admin review notes |
| `reviewed_by` | uuid | Profile ID — AI uses admin UUID, humans use their own |
| `reviewed_at` | timestamptz | When the review decision was made |

### Partner stores

Users select from a pre-existing catalog of partner stores when submitting. The selected store's `name` is saved as `partner_store_name` on the submission. The AI compares this against the `merchant_name` it extracts from the receipt.

---

## Edge Function implementation

**File:** `supabase/functions/review-submission/index.ts`

### Flow

1. Parse `submission_id` from the trigger's POST body (`{ submission_id }`)
2. Fetch submission row from Postgres
3. Early-exit if status is not `pending`
4. Atomic claim: `UPDATE ... SET reviewed_by = AI_REVIEWER_ID WHERE reviewed_by IS NULL`
5. Fetch receipt + selfie images in parallel (with media type detection)
6. Compute SHA-256 hash of receipt image
7. Run hash-based duplicate check (unconditional — catches exact dupes even if OCR fails)
8. Check image sizes
9. Call Claude Vision with both images as base64 content blocks
10. Extract receipt fields + selfie validation from Claude's JSON response
11. Check receipt date freshness (21-day rule)
12. Check merchant name vs partner store name
13. Run fuzzy duplicate check (if extraction succeeded)
14. Decide: approved or pending
15. Write results back to submissions table

### Environment variables

- `SUPABASE_URL` — Supabase project URL
- `SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS
- `ANTHROPIC_API_KEY` — Claude API key

### Deployment

```bash
supabase functions deploy review-submission --no-verify-jwt
```

### Estimated cost

~RM 0.10-0.15 per submission at Claude Sonnet 4.6 pricing (two images + short prompt + JSON response). Can be reduced by switching to `claude-haiku-4-5` if accuracy is sufficient.
