# Promoting "Wellness" to a real store category

**Status:** not started. Written 2026-08-05, when Ola Medica (`ola-medica`) was
added as the first `type = 'Wellness'` partner store in migration
`20260805120000_add_ola_medica_wellness_store.sql`.

## Why this is outstanding

`partner_stores.type` is free text with no CHECK constraint, so the Ola Medica
row is valid and the store is live, submittable and reachable at
`/r/OLAMC78`. What's missing is everywhere the app assumes the food/beverage
category set. Before this, every one of the 118 stores was one of
`Restaurant | Cafe | Beverages | Buffet | Bar | Café & Restaurant`.

Current behaviour for a `Wellness` store, all verified against the live app:

| Surface | Today | Wanted |
| --- | --- | --- |
| `lib/storeCategoryRoute.ts` `categoryRouteForType` | no match → `'experience'` fallback, so the detail screen renders but is labelled **"Experience"** | `'wellness'` route |
| `mapStoreCategory` (`components/verified-member/submission/index.tsx:110`) | no match → `'others'`, a valid `store_category` enum value, so submissions succeed but accrue under "others" | `'wellness'` |
| Browse screens (`app/partner-store/*`) | only `bar`, `cafe`, `restaurant`, `experience` exist. `experience/index.tsx` returns a **random 20 stores**, so a Wellness store surfaces there only by chance | `app/partner-store/wellness/index.tsx` filtering on the type |
| `public.store_category` enum | `cafe, restaurant, others, bar, hotel` — no `wellness` | add `wellness` |
| `types/submission.ts`, `types/supabase.ts` | union types mirror the enum | regenerate / extend |
| `hooks/useCategoryStats.ts`, `hooks/useSubmissions.ts` | `StoreCategory` union and per-category counters have no wellness bucket | add |
| Home tabs (`app/(tabs)/index.tsx`) | category buckets + promo banner filters are food/beverage only | add |
| Badges (`types/badge.ts`, `app/tasks/badges.tsx`) | `BadgeCategoryId` is `bar \| cafe \| restaurant`; `badge_category` enum is `activity, cafe, restaurant, bar, hotel` | needs a decision — see below |

## Suggested order

1. **Migration** — `ALTER TYPE public.store_category ADD VALUE IF NOT EXISTS 'wellness';`
   Note: Postgres forbids *using* a new enum value in the same transaction that
   adds it, so keep this migration to the `ALTER TYPE` alone and do any
   backfill in a later one.
2. **Regenerate types** — `supabase gen types typescript --linked > types/supabase.ts`,
   then widen the `partner_store_category` union in `types/submission.ts`.
3. **Routing + mapping** — add a `wellness` branch to `categoryRouteForType`
   and `mapStoreCategory`. Match on `wellness`, and consider `clinic`,
   `spa`, `massage`, `rehabilitation` so future stores land correctly without
   another code change.
4. **Browse screen** — `app/partner-store/wellness/index.tsx`, copying the
   shape of `app/partner-store/bar/index.tsx` (the simplest of the four).
5. **Stats and home** — add the bucket to `useCategoryStats`, `useSubmissions`
   and the home-screen category list.
6. **Badges** — the open question. Badge artwork exists per category as an
   asset (`assetKey`), so a wellness badge needs new art. Options: ship
   without a wellness badge (points still accrue, no badge track), or
   commission the asset and add `wellness` to `badge_category` too.

## Gotchas

- Do **not** re-case referral codes anywhere in this work — they are
  case-sensitive (`OLAMC78`).
- Existing approved submissions for Ola Medica made before step 1 lands will
  carry `partner_store_category = 'others'`. If wellness stats should include
  them, add a backfill `UPDATE submissions ... WHERE partner_store_id IN
  (SELECT id FROM partner_stores WHERE lower(type) LIKE '%wellness%')`.
- Any future seed migration inserting `partner_stores` must set `country`
  explicitly; `20260801120000` omitted it and needed a backfill in
  `20260805120000`.
