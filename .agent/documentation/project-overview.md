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
When an admin approves a submission, a Postgres trigger automatically calculates experience and awards badges if thresholds are met.
*   **Categories:** Bar Explorer, Coffee Lover, Foodie, Hotel Explorer.
*   **Tiers & Ranks:** Bronze, Silver, Gold, Platinum (Ranks 1 to 3 in each).
*   **Scaling:** Thresholds range deeply from 5 visits (Bronze 1) to 120 visits (Platinum 3) per category.
*   **Asset Storage:** Badge image URLs are constructed dynamically pulling from the Supabase Storage public bucket.

### 2.4 Affiliate & Referral System
Tracks relationships via an `inviter_id` field in the user profile.
*   Affiliates can distribute unique generated codes. 
*   The system actively records direct (Level 1) and indirect (Level 2) referrals via recursive SQL Views (`referral_tree`).

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
- **`check_and_award_badges`**: Triggers upon a submission going `approved`, counting the total approved visits, and automatically inserting unlocked badges into `user_badges`.

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

*(Last Updated: 2026-04-07 based on the addition of days, priceRange, and menu-images to partner-store)*
