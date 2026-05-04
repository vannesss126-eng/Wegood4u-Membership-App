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
The app is mid-transition from a submission-count model to a stars + Visit 10 cycle model. Both are documented here honestly so devs know the difference.

**Current code (source of truth: [`badges.md`](badges.md)):**
*   **Categories:** Bar Explorer, Coffee Lover, Foodie, Hotel Explorer.
*   **Tiers & Ranks:** Bronze, Silver, Gold, Platinum (Ranks 1 to 3 in each).
*   **Scaling:** Thresholds 5 (Bronze 1) to 120 (Platinum 3) per-category approved submissions.
*   **Asset Storage:** Badge image URLs pulled dynamically from the Supabase Storage public bucket.
*   Known issue: Bar and Hotel badges are currently unreachable (schema enum gap).

**Target model (source of truth: [`credits-overview.md`](credits-overview.md), [`extra-tasks.md`](extra-tasks.md), [`badges.md`](badges.md), [`badge-rewards.md`](badge-rewards.md), locked 2026-05-04, **not yet implemented**):**
*   **Single cumulative Visit 10 cycle:** one counter across Restaurant + Cafe + Bar (any mix). 10 progress = 1 voucher. Floor of 6 real visits per cycle. Hotel is a separate "bigger claims" track (TBD); Experience is off-system.
*   **Stars** are the unit earned by extra tasks. **Manual trade: user taps "Use 100 ★ for +1 Progress"** on the Visit 10 card. Cycle accepts a maximum of **+4 trades**; leftover stars stay in wallet.
*   **Three extra tasks** earn stars: Social Media Share (15 / 15 / 15 + 5 bonus per approved submission across Facebook / Instagram / TikTok / all-three), Daily Log-In Streak (**50 stars per 14-day streak**, recurring, KL TZ, open to all verified members), Referral (L1 = 100 stars, L2 = 50 stars per qualified invitee).
*   **Manual claim:** at 10/10, user taps a "Complete Tasks" button to mint the voucher; cycle resets to 0/10.
*   **Six ranks total:**
    - **Visit Rank** — driven by completed cycles (1–4 / 5–14 / 15–34 / 35+ for Bronze/Silver/Gold/Platinum). Drives voucher kind on cycle claim.
    - **Cafe / Bar / Restaurant / Hotel / Experience Ranks** — each driven by real approved submissions in that category. Thresholds: B1=5, B2=10, B3=20, S1=30, S2=40, S3=50, G1=60, G2=70, G3=80, P1=90, P2=100, P3=120. Per-category rewards are **"coming soon"** (vendor sponsorship pending).
*   **Voucher kinds (Visit Rank tier):** Bronze = 3-star/Airbnb; Silver = 3–4 star hotel/Airbnb; Gold = 4–5 star hotel/Airbnb; Platinum = Specialty/5-star/resort + Airbnb equivalent. Tier snapshot at mint.
*   **Approvals are final** — admin cannot revert approved → rejected. No claw-back logic for stars, progress, vouchers, or rank badges.
*   **No backfill on launch** — verified members start at 0/10 Visit 10 progress. Existing approved submissions DO carry into per-category rank counters.

### 2.4 Activity History
Unified, paginated activity feed surfaced as the **History** snippet on My Tasks and the standalone **/tasks/history** page. Backed by a `SECURITY DEFINER` Postgres RPC (`get_user_activity`) that UNIONs submissions, badges, completed cycles, and redeemed vouchers into one chronological list. Full spec in [`history-feed.md`](history-feed.md).

### 2.5 Affiliate & Referral System
Tracks relationships via an `inviter_id` field in the user profile. Full rules in [`referral-system.md`](referral-system.md).
*   Affiliates can distribute unique generated codes.
*   The system records direct (Level 1) and indirect (Level 2) referrals via recursive SQL Views (`referral_tree`).
*   Qualifying event = invitee verified **and** first submission approved. On qualification: **+100 stars** to the invitee, **+100 stars** to the L1 inviter, **+50 stars** to the L2 affiliate (if any).
*   Stars feed the same wallet used by Social Media Share and Daily Log-In Streak. 100 stars auto-converts to +1 Visit 10 progress (capped at +4 per cycle, leftover carries forward). Full mechanic in [`credits-overview.md`](credits-overview.md) and [`extra-tasks.md`](extra-tasks.md).

---

## 3. Database Schema Overview (Supabase / PostgreSQL)

The entire application state runs securely using Supabase Row Level Security (RLS) policies.

- `profiles`: The central user record, linked 1:1 with `auth.users`. Contains the user's role, personal details, contact preferences, and their parent affiliate (`inviter_id`).
- `invitation_codes`: Stores the unique affiliate string codes, and usage count statistics. Linked to the user who requested the code.
- `submissions`: Central record of visits containing image URLs, store category, approval status (`pending`, `approved`, `rejected`), admin notes, and auto-review metadata such as `receipt_date`, `total_amount`, `currency`, `merchant_name`, and `receipt_hash`.
- `badges`: A static lookup table defining possible badges.
- `user_badges`: A junction table indicating which user has unlocked which badge.

### Automated Triggers
- **`handle_new_user`**: Creates a new profile immediately when Supabase Auth completes signup.
- **`increment_invitation_usage`**: Updates the parent's code usage count automatically when a new sub-user is attached.
- **`check_and_award_badges`**: Legacy. Triggered on submission `approved`, counting per-category submissions and inserting unlocked badges. Will be replaced under the new model — tier badges mint only on Visit 10 cycle close, not on every approved submission. See [`badges.md`](badges.md) "Trigger wiring."

### Pending tables (locked 2026-05-03, not yet built)
- **`star_wallet`** — per-user star balance + queued-extras counter for stars converted past the +4 cap.
- **`star_ledger`** — audit trail of every star award and conversion-to-progress event.
- **`visit_progress`** — active Visit 10 cycle per user; `closed_at` set on Complete Tasks tap.
- **`submission_shares`** — verified shares per (submission, platform); unique key on the pair.
- **`daily_checkins`** — audit table for daily log-ins; one row per (user, KL-day).
- **`vouchers`** — minted on cycle close; tier snapshotted at mint time.
Full schemas in [`credits-overview.md`](credits-overview.md) "Storage model."

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

*(Last Updated: 2026-05-04 — synced section 2.3 (Gamification) with the 6-rank progression model, daily streak revised to 50 stars, voucher kinds upgraded across all tiers, "approvals are final" lock, no-backfill rule. Previous update 2026-05-03 introduced the cumulative Visit 10 cycle and stars model.)*
