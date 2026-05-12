# Wegood4u Mobile App - Project Overview

This document provides a detailed technical overview of the Wegood4u mobile application, its architecture, technology stack, database design, and core systems. It is meant to serve as a comprehensive reference guide for developers and AI assistants.

---

## 1. High-Level Architecture

Wegood4u is a modern mobile application built as a membership portal connecting bloggers and content creators with F&B/Tourism businesses. The frontend is built entirely using **React Native and Expo**, while the architecture employs a **Dual-Backend System**:

1. **Supabase (PostgreSQL):** Handles User Authentication, Profiles, Submissions, Badges, and Real-time constraints.
2. **Firebase (Firestore & Cloud Functions):** Handles the `partner_store` documents, offering flexible NoSQL storage for store details and utilizing Cloud Functions for backend script executions.

### Technology Stack
*   **Framework:** React Native with Expo (`~54.0.33`)
*   **Routing:** Expo Router (`file-based routing`)
*   **Dual-Backend:** Supabase (`supabase-js` v2) & Google Firebase (`firebase` v12)
*   **Icons:** Lucide React Native & Expo Vector Icons
*   **Local Storage:** AsyncStorage, Expo SecureStore
*   **Forms & Validation:** Zod
*   **Media & Device:** Expo Camera, Image Picker, Location
*   **Authentication:** Supabase Auth (Email/Phone OTP possible, JWTs linked to `profiles` table)

---

## 2. Core Systems & Flows

### 2.1 Role-Based Access Control (RBAC)
User permissions dictate which parts of the app are accessible. 
1.  **Subscriber:** The starting role. Can view partner stores, blogs, and settings, but cannot participate in core activities (upload proofs, request invites).
2.  **Member:** A user who verified their email/phone and filled out the initial questionnaire. They can participate in core activities to earn badges.
3.  **Affiliate:** An approved member given a unique invitation code to invite sub-members.
4.  **Admin:** Privileged users who handle submission approvals, manage affiliate codes, and oversee system health.

### 2.2 Proof of Visit & Submission System
Members can log "visits" to partner establishments (Cafe, Restaurant, Bar, Hotel). 
*   **Upload flow:** A member takes a selfie and a photo of a receipt.
*   **Data Pipeline:** The images are uploaded to a Supabase Storage Bucket, and a record is inserted into the `submissions` table.
*   **Review Queue:** Submissions stay `pending` until an `admin` approves or rejects them. 

### 2.3 Gamification & Badge System
Stars + Visit 10 cycle model — shipped per [`../plans/stars-and-extra-progress.plan.md`](../plans/stars-and-extra-progress.plan.md). Sources of truth: [`credits-overview.md`](credits-overview.md), [`extra-tasks.md`](extra-tasks.md), [`badges.md`](badges.md), [`badge-rewards.md`](badge-rewards.md). Phase 5b (AI auto-verify for shares) and the operational items in Phase 8 (telemetry, soft launch) remain open; everything else is live.

*   **Single cumulative Visit 10 cycle:** one counter across Restaurant + Cafe + Bar (any mix). 10 progress = 1 closed cycle. Floor of 6 real visits per cycle. Hotel is a separate track (no partner stores listed in v1). Experience is deferred.
*   **Stars** are the unit earned by extra tasks. **Manual trade: user taps "Use 100 ★ for +1 Progress"** on the Visit 10 card. Cycle accepts a maximum of **+4 trades**; leftover stars stay in wallet.
*   **Three extra tasks** earn stars: Social Media Share (15 / 15 / 15 + 5 bonus across Facebook / Instagram / TikTok / all-three; v1 manual-review-default, AI verifier deferred to Phase 5b), Daily Log-In Streak (**50 stars per 14-day streak**, recurring, KL TZ, open to all verified members), Referral (L1 = 100 stars, L2 = 50 stars per qualified invitee, plus 100 stars self-bonus on the invitee's first approval).
*   **Manual claim:** at 10/10, user taps "Complete Tasks" to close the cycle and reset to 0/10. Vouchers mint **only on Visit Badge level-ups** (12 lifetime per user — Bronze L1/L2/L3 = 3 Bronze vouchers, Silver L1/L2/L3 = 3 Silver, etc.). Cycles between levels close cleanly without minting.
*   **Five badges total in v1:**
    - **Visit Badge** (user rank) — driven by completed cycles (1–4 / 5–14 / 15–34 / 35+ for Bronze/Silver/Gold/Platinum). Each level-up mints **1 voucher of that tier** **and** swaps the user's profile picture frame on tier crossings.
    - **Cafe / Bar / Restaurant / Hotel Badges** — each driven by real approved submissions in that category. Thresholds: B1=5, B2=10, B3=20, S1=30, S2=40, S3=50, G1=60, G2=70, G3=80, P1=90, P2=100, P3=120. v1 ships progression-only on Category Badge tiles (no reward callout, no "Coming soon" wording). Reward mechanics added when vendor sponsorships are signed. Hotel partner stores aren't listed in v1 — Hotel Badge stays at 0 progress until partnership signed.
*   **Voucher kinds (Visit Badge tier):** Bronze = 3-star/Airbnb; Silver = 3–4 star hotel/Airbnb; Gold = 4–5 star hotel/Airbnb; Platinum = Specialty/5-star/resort + Airbnb equivalent. Tier snapshot at mint.
*   **Voucher redemption (v1, admin-fulfilled):** Rewards subtab shows 4 tier cards as a fixed catalog (Bronze/Silver/Gold/Platinum). Each card's Redeem button is disabled grey at 0 unredeemed and enabled green with **"Redeem ×N"** when N ≥ 1. Tap → confirmation modal → `redeem_voucher` RPC flips `redeemed_at` on the oldest unredeemed of that tier (FIFO) → admin notification. Admin sees the queue in **Tasks → Redeem Req tab**, fulfills via WhatsApp, taps "Mark fulfilled" to set `vouchers.fulfilled_at`. v2 adds in-app fulfillment + hotel selection screen once partnerships are signed.
*   **Profile picture frame** — driven by Visit Badge tier. Frame swaps automatically on tier crossing. 4 frame assets bundled at `assets/images/tier_frame/`.
*   **Asset strategy** — bundled in-app, not server-hosted. Badge / voucher / frame art all ship inside the app via static `require()` maps in `lib/badgeAssets.ts`, `lib/visitRankAssets.ts`, `lib/voucherAssets.ts`. ~2 MB total, no Supabase Storage egress.
*   **Approvals are final** — admin cannot revert approved → rejected. No claw-back logic for stars, progress, vouchers, or badge awards.
*   **No backfill on launch** — verified members start at 0 across all 5 badges. No existing-submission carryover.

### 2.4 Activity History
Unified, paginated activity feed surfaced as the **History** snippet on My Tasks and the standalone **/tasks/history** page. Backed by a `SECURITY DEFINER` Postgres RPC (`get_user_activity`) that UNIONs submissions, badges, completed cycles, and redeemed vouchers into one chronological list. Full spec in [`history-feed.md`](history-feed.md).

### 2.5 Affiliate & Referral System
Tracks relationships via an `inviter_id` field in the user profile. Full rules in [`referral-system.md`](referral-system.md).
*   Affiliates can distribute unique generated codes.
*   The system records direct (Level 1) and indirect (Level 2) referrals via recursive SQL Views (`referral_tree`).
*   Qualifying event = invitee's first submission approved. On qualification: **+100 stars** to the invitee (`l1_referral_self_bonus`), **+100 stars** to the L1 inviter (`l1_referral`), **+50 stars** to the L2 affiliate if any (`l2_referral`). Award keys are idempotent on `(user_id, reason, source_referral_user_id)` so trigger replays are no-ops.
*   Stars feed the same wallet used by Social Media Share and Daily Log-In Streak. Conversion to Visit 10 progress is **manual** — user taps "Use 100 ★ for +1 Progress" on the Visit 10 card. Cycle accepts a maximum of +4 trades; leftover stars stay in wallet across cycles.

### 2.6 Profile tab — stats + favorites (locked 2026-05-10)

The Profile tab shows three quick-stat cells under the avatar+frame: **Submission count** · **Badges earned** · **Favorites count**. Submission count uses approved-submission total (currently `stats.approved` from `useUserSubmissions`). Favorites count is the row count from `user_favorite_stores` for the current user.

The third slot was previously labeled **"Collection"** with no data wired — replaced 2026-05-10 because no spec ever materialized for what "Collection" should count.

The **Favorites** feature itself drives partner store affinity (heart icon at [components/partner-store/PartnerStoreDetailContent.tsx:99-106](components/partner-store/PartnerStoreDetailContent.tsx#L99-L106)). Listed in two places: a dedicated Favorites screen reachable from the Profile tab, and a quick filter chip on the Map / Home stores list. Full spec lives in [`partner-stores.md`](partner-stores.md) §"Favorites" and [`../plans/favorites-and-wishlist.plan.md`](../plans/favorites-and-wishlist.plan.md). A future "saved for visit" / wishlist concept ships in the same plan but lands second per Kasey.

### 2.7 Daily submission cap

A per-user RLS cap of **20 submissions per UTC day** is enforced at insert time via a RESTRICTIVE policy + the `user_daily_submission_count` helper. **Re-confirmed 2026-05-10** by Kasey (*"i think 20 per day is ok"*) — cap stays.

---

## 3. Database Schema Overview (Supabase / PostgreSQL)

The entire application state runs securely using Supabase Row Level Security (RLS) policies.

- `profiles`: The central user record, linked 1:1 with `auth.users`. Contains the user's role, personal details, contact preferences, parent affiliate (`inviter_id`), `current_streak`, `last_checkin_at`, and `first_approved_submission_at`.
- `invitation_codes`: Stores the unique affiliate string codes, and usage count statistics. Linked to the user who requested the code.
- `submissions`: Central record of visits containing image URLs, store category, approval status (`pending`, `approved`, `rejected`), admin notes, and auto-review metadata such as `receipt_date`, `total_amount`, `currency`, `merchant_name`, and `receipt_hash`.
- `badges`: Static lookup table — 60 active rows: 12 Visit Badges (`badge_kind='visit'`) + 48 Category Badges (`badge_kind in cafe/bar/restaurant/hotel`). Legacy seed rows kept with `is_active=false` to preserve historical `user_badges` references.
- `user_badges`: Junction table indicating which user has unlocked which badge.
- `star_wallet`: Per-user star balance. Updated under row-level lock by `_award_stars` and `trade_stars_for_progress` to serialize concurrent awards.
- `star_ledger`: Append-only audit trail. Idempotent on `(user_id, reason, source_*)`. Reasons: `share_facebook` / `share_instagram` / `share_tiktok` / `share_all_three_bonus` / `daily_streak_14` / `l1_referral` / `l2_referral` / `l1_referral_self_bonus` / `conversion_to_progress`.
- `visit_progress`: Active Visit 10 cycle per user; partial unique index ensures one open cycle per user. `closed_at` set on Complete Tasks tap.
- `submission_shares`: One row per (submission, platform). UNIQUE on the pair. `status` ∈ {`pending`, `verified`, `rejected`}; trigger fires star award on flip to verified.
- `daily_checkins`: One row per (user, KL-day). UNIQUE on the pair blocks double-tap.
- `vouchers`: Minted on Visit Badge level-up by the `mint_voucher_on_visit_levelup` trigger (one row per level entered). Tier matches the level. `redeemed_at` flipped by `redeem_voucher` RPC; `fulfilled_at` flipped by admin in the Redeem Req tab.

### Automated Triggers
- **`handle_new_user`**: Creates a new profile immediately when Supabase Auth completes signup.
- **`increment_invitation_usage`**: Updates the parent's code usage count automatically when a new sub-user is attached.
- **`on_submission_approved`**: Fires on submission status flip to `approved`. Backfills `first_approved_submission_at`, advances Visit 10 cycle for R/C/B, evaluates Category Badge thresholds (R/C/B/H), fires referral chain awards on first-approval.
- **`on_submission_share_verified`**: Awards 15 ★ per platform on share verification, plus +5 ★ when all three platforms reach verified for the same submission.
- **`mint_voucher_on_visit_levelup`**: Fires on `user_badges` insert filtered to `badge_kind='visit'`. Joins to `badges` to read tier/level/reward_kind, inserts a voucher row of that tier.
- **`notify_on_*`**: Notification writers — `notify_on_badge_earned` (covers visit + category), `notify_on_share_verified`, `notify_on_referral_qualified`, `notify_on_voucher_redemption_request`, plus the original submission insert/status-change pair. All swallow exceptions so notification failures can't block the underlying action.

### Client-callable RPCs
- **`trade_stars_for_progress()`**: Atomic 100 ★ → +1 progress trade. Validates `< 4` extras applied + sufficient balance.
- **`complete_visit_task()`**: Closes the active cycle, evaluates Visit Badge level-ups (which trigger voucher mint via `mint_voucher_on_visit_levelup`), opens a new cycle.
- **`record_daily_checkin()`**: KL-TZ day-boundary check-in. Awards 50 ★ on every 14-day streak boundary.
- **`redeem_voucher(voucher_id uuid)`**: Idempotent voucher redemption. Flips `redeemed_at`; admin notification follows.
- **`get_user_activity(limit, offset)`**: Unified paginated activity feed across submissions, shares, daily streak milestones, referral awards, conversions, completed cycles, badges, and voucher redemptions.

---

## 4. Firebase Architecture (NoSQL)

While Supabase manages structured relational user data, **Firebase** is leveraged for flexible document storage and serverless computing.

### 4.1 Firestore Database
- **`partner_store` Collection:** Contains all documents representing restaurants, cafes, and hotels. Being NoSQL, this collection allows us to easily nest arbitrary structures (like an array of `menu-images` strings, `days`, and `priceRange`) directly on the store object without needing a separate relational image table.

### 4.2 Firebase Cloud Functions
- Used to execute isolated backend logic, perform scheduled maintenance, or process changes originating from the `partner_store` ecosystem.

---

## 5. Key Directories

*   `/app`: The main screens powered by Expo Router. Uses `/(tabs)` for the main bottom bar navigation, and stack routing for deeper screens.
*   `/components`: Reusable UI components (buttons, specific user role states like `VerifiedMember`).
*   `/config`: System configurations, such as the `badges.ts` definitions.
*   `/supabase`: Central folder for Supabase. Includes `/migrations` where the SQL schema is heavily documented and defined.
*   `/types`: TypeScript definitions mapping to the Supabase schema and complex objects.

---

*(Last Updated: 2026-05-10 — added §2.6 profile tab stats lock (Collection slot → Referral count), favorites feature spec'd (heart icon wiring pending), §2.7 confirms 20/day submission cap stays. Earlier 2026-05-10 moved voucher minting from per-cycle-close to per-Visit-Badge-level-up (12 lifetime per user vs uncapped before); Rewards subtab restructured as fixed 4-tier catalog with "Redeem ×N" buttons; admin gains a Redeem Req tab in Tasks. Previous 2026-05-08 added voucher redemption + asset bundling. 2026-05-06 aligned terminology to "Badge", 6 → 5 badges, profile picture frame mechanic.)*
