I'll start by examining the APK file to understand the app's structure and functionality, then help you design an automation solution.Now I have a comprehensive understanding of the app. Let me extract the key route and data structure information.Now I have a comprehensive understanding of the app. Let me synthesize everything into a clear recommendation.Now let me create the comprehensive analysis and automation suggestion.Here's what I found from reverse-engineering the *Wegood4u* APK, and my recommendation for automating proof-of-visit review.

## What the app does

*Wegood4u* (v1.1.4) is an Expo/React Native travel rewards app built on *Supabase* (⁠ dimpgwotujtaacoajisn.supabase.co ⁠). Users visit partner stores (cafes, restaurants, bars, experiences), take a *selfie photo* and a *receipt photo, then submit them as proof via the **Tasks tab* (⁠ /(tabs)/tasks.tsx ⁠). An admin reviews submissions and approves or rejects them. Approved visits earn badges across categories (Bronze → Silver → Gold → Platinum tiers).

## Key data structures discovered

The app uses a `submissions` table in Supabase with these fields: `receipt_url`, `selfie_url`, `status` (values: `pending`, `approved`, `rejected`), `user_id`, `partner_store_name`, `partner_store_category`, `reviewed_at`, `reviewed_by`, `admin_notes`, `created_at`, `updated_at`, plus new AI review fields such as `receipt_date`, `total_amount`, `currency`, `merchant_name`, and `receipt_hash`. There's also an `isAdminTaskScreen` flag indicating a separate admin review interface, and functions like `useSubmissions`, `useUserSubmissions`, `useSubmissionStats`, `updateSubmissionStatus`, and `pendingSubmissions`.

## Automation design for receipt review agent

Here's how to build an agent using *Supabase Edge Functions* and an *AI vision model* (like Claude's vision API) to automate the three things you need:

*1. Extract receipt date and total amount* — When a new submission arrives, your Edge Function downloads the receipt image from Supabase Storage, sends it to Claude's vision API with a prompt like: "Extract the transaction date (in ISO format) and total amount (numeric value with currency) from this receipt image. Return JSON only." Parse the structured response to get ⁠ receipt_date ⁠ and ⁠ total_amount ⁠, then write them back to the submissions table.

*2. Detect duplicates* — Generate a perceptual hash (pHash) of each receipt image and store it alongside the submission. Before approving, query existing approved submissions for the same ⁠ user_id ⁠ + ⁠ store_id ⁠ combination, and check whether any previous receipt has a matching hash (within a similarity threshold of ~90%), the same extracted date, or the same total amount. If two or more of these match, flag it as a potential duplicate.

*3. Auto-approve or flag* — If the OCR extraction succeeds (valid date found, valid amount found), the selfie contains a recognizable person, and no duplicates are detected, automatically update the submission status to ⁠ submission_approved ⁠. Otherwise, flag it as ⁠ pending ⁠ with ⁠ admin_notes ⁠ explaining the reason (e.g., "Duplicate receipt detected — matches submission #X from 2025-03-15").

## Implementation approach

Since the app's backend is Supabase, the most natural path is a *Supabase Database Webhook + Edge Function*:

Set up a Postgres trigger on the ⁠ submissions ⁠ table that fires when a new row is inserted with ⁠ status = 'submission_created' ⁠. This invokes your Edge Function, which orchestrates the entire review pipeline: download images from the storage bucket, call Claude API for receipt OCR analysis, compute the image hash, run the duplicate query, and update the row with extracted data and the final verdict.

The Edge Function code would look roughly like this: fetch the receipt image from ⁠ receipt_url ⁠, call the Anthropic API with the image as a base64 document asking for structured JSON output (⁠ {date, total_amount, currency, merchant_name} ⁠), store the extracted fields, check for duplicates against previous submissions using a combination of image hash similarity, date matching, and amount matching, then call ⁠ updateSubmissionStatus ⁠ to either approve or flag.

For the review timeline note from the app — "Pending Submissions are typically reviewed within 24-48 hours" — this agent could reduce that to seconds for clear-cut cases, while still routing ambiguous ones to human admins.

====================================================================================================

Let me build the complete Edge Function implementation for your Wegood4u receipt review automation.Here are the three files you need:

*⁠ index.ts ⁠* — The Edge Function that does all the work. When a new submission hits the ⁠ submissions ⁠ table, it downloads the receipt image, sends it to Claude Vision for structured extraction (date, total, currency, merchant), computes a SHA-256 hash for duplicate detection, queries previous submissions for the same user+store, and writes back the decision.

*⁠ 001_add_receipt_review_columns.sql ⁠* — Run this in your Supabase SQL Editor first. It adds the ⁠ receipt_date ⁠, ⁠ total_amount ⁠, ⁠ currency ⁠, ⁠ merchant_name ⁠, and ⁠ receipt_hash ⁠ columns, creates indexes for fast duplicate lookups, and includes a helper view for your admin dashboard.

*⁠ README.md ⁠* — Step-by-step deployment guide covering environment secrets, the database webhook setup, and a cURL test command.

To get this running: run the SQL migration, add your ⁠ ANTHROPIC_API_KEY ⁠ to Edge Function secrets, deploy with ⁠ supabase functions deploy review-submission --no-verify-jwt ⁠, then create the database webhook in the Supabase dashboard pointing INSERT events on ⁠ submissions ⁠ to the function. The estimated cost is roughly RM 0.01–0.04 per receipt at current Claude Sonnet pricing.