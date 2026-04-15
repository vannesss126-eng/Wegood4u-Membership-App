# Project Architecture Briefing — Say Sheji Group App
> Paste this into Claude Code as context before asking it to implement anything.

---

## What this app does
A travel proof submission app where shop users submit photo evidence of travel (up to 20 submissions/day per user). Admins/shop owners review and approve or reject each submission.

---

## Current backend: Supabase (Free tier)
- Auth, database (Postgres), RLS policies, and storage are all on Supabase
- RLS policies are already set up and working — do not break or rewrite these
- There is an existing RLS policy limiting each user to 20 proof-of-travel submissions per day (previously 10, updated to 20)

---

## Scale targets
| Stage | Users | Submissions/day |
|---|---|---|
| Phase 1 (now) | ~900–1,500 (30–50 shops × 30 users) | up to 20/user/day |
| Phase 2 | ~4,500 (150 shops) | up to 20/user/day |
| Full scale | ~27,000–30,000 MAU | up to 20/user/day |
| Long-term target | ~200,000 MAU | 10/user/day active users |

---

## Infrastructure decisions (agreed)

### 1. Upgrade Supabase Free → Pro
- Supabase Free pauses after 1 week inactivity — not suitable for production
- Supabase Pro: $25/month base, includes 100K MAU, 100GB storage, 250GB egress
- MAU overages: $0.00325 per MAU over 100K (200K users ≈ +$325/month)
- **Action:** Upgrade to Pro before Phase 1 launch

### 2. Image uploads → AWS S3 (NOT Supabase Storage)
- Supabase Storage free limit is only 1 GB — fills up in days with image uploads
- At scale, image storage needs are in the TB range — too expensive on Supabase overages ($0.021/GB)
- **Decision:** Move ALL file/image uploads to AWS S3
- S3 cost: ~$0.023/GB/month storage + $0.09/GB egress — much cheaper at volume
- Auth, database, and RLS stay on Supabase — do NOT migrate these to AWS
- Implementation: backend generates S3 presigned URLs → mobile app uploads directly to S3 → store the S3 file path/key in the Supabase database

### 3. Image size limit
- Cap all proof-of-travel image uploads at 1 MB maximum
- Implement client-side compression before upload (target ~200–300 KB actual size)
- This reduces storage and egress costs by 5–7x

---

## Bandwidth / egress — what counts and what doesn't

### Does NOT count as egress (free):
- User uploading a photo (data flows IN to storage)
- Writing rows to the database (INSERT/UPDATE)
- Auth sign-in / sign-up

### DOES count as egress (costs money):
- Any image downloaded from storage to a user's device
- Any database query result sent back to the app
- Realtime subscription data pushed to clients

### Key rule: never auto-load images in list/table views
Loading images in a table automatically burns egress on every page load.
At 10,000 active users browsing history with images: ~1.5 TB/month egress.
Design all list views as text-only. Images load on explicit user action only.

---

## Submission review UI — use Pattern B (text-only table + on-demand modal)

### Pattern B implementation (required):
- The submissions review table shows ONLY: user name/avatar initials, shop name, submission timestamp, status badge (Pending / Approved / Rejected), and a "Review" button
- NO images are loaded in the table rows — zero egress on list view
- When admin clicks "Review" on a row, open a modal that:
  1. Calls the backend to generate a **short-lived S3 presigned URL** (60-second expiry)
  2. Loads and displays the single proof image
  3. Shows submission metadata (submission ID, image size, location tag if available, device)
  4. Provides Approve and Reject action buttons
- After approve/reject, the modal closes and the table row status updates

### Why presigned URLs with short expiry:
- Image URLs are never stored in the frontend or database in a way that can be shared
- URL expires after 60 seconds — prevents link sharing or re-requests
- Only generates egress for the exact moment an admin reviews

---

## What stays on Supabase (do not migrate)
- Supabase Auth (JWT-based) — all user sessions, tokens
- Postgres database — all tables, relationships
- RLS policies — all row-level security rules
- Edge functions / triggers / automation (if any)
- Realtime subscriptions (if used)

## What moves to AWS
- File storage only → AWS S3
- No other AWS services needed at this stage (no Cognito, no RDS, no Lambda beyond presigned URL generation)

---

## Future consideration (not now)
- Full AWS migration (RDS, Cognito, Lambda) only makes sense at 500K+ users with dedicated DevOps
- Supabase Team plan ($599/month) is NOT recommended — it adds compliance features (SOC2, HIPAA, SSO), not more capacity. Same storage/MAU overage rates as Pro.
- Auto-delete approved/rejected proof photos after 30 days to keep storage flat

---

## Implementation priority order
1. Upgrade Supabase Free → Pro
2. Set up AWS S3 bucket + IAM policy for presigned URL generation
3. Implement client-side image compression (target 200–300 KB)
4. Wire up presigned URL upload flow (backend generates URL → app uploads to S3 → save S3 key to Supabase DB)
5. Build submission review table (Pattern B — text only, no images)
6. Build on-demand review modal with presigned read URL (60s expiry)