---
name: Partner Store Detail Rollout
overview: "Implement partner store detail navigation in small, safe phases: clickable cards, separate detail routes, then detail content and distance logic."
todos:
  - id: phase1-nav-clickables
    content: Make homepage and category list cards clickable; route to separate detail routes by store id.
    status: completed
  - id: phase2-data-address
    content: Add address to PartnerStore type and Firestore mapping.
    status: completed
  - id: phase3-detail-screens
    content: Create restaurant and cafe detail route screens matching screenshot structure and required fields.
    status: completed
  - id: phase4-distance
    content: Implement distance calculation from user location with permission/error fallbacks.
    status: completed
  - id: phase5-qa
    content: Run end-to-end navigation and UI validation, then fix lint/regression issues.
    status: completed
isProject: false
---

# Partner Store Detail Implementation Plan

## Goal

Make Restaurant/Cafe flows consistent: category opens its list page, each list card opens its own detail page, and detail pages follow your design with banner image + core store info.

## Phase 1: Enable navigation flow (no design-heavy work yet)

- Update Home behavior in [app/(tabs)/index.tsx](/Users/mac/Documents/Saysheji/Apps/Wegood4u/Code/app/(tabs)/index.tsx):
  - Keep section-level navigation as-is:
    - `Recommended Restaurant` -> `../partner-store/Restaurant`
    - `Recommended Cafe` -> `../partner-store/Cafe`
  - Make each homepage store card clickable and navigate to category detail route by store id.
- Update list pages to make cards clickable:
  - [app/partner-store/Restaurant.tsx](/Users/mac/Documents/Saysheji/Apps/Wegood4u/Code/app/partner-store/Restaurant.tsx)
  - [app/partner-store/Cafe.tsx](/Users/mac/Documents/Saysheji/Apps/Wegood4u/Code/app/partner-store/Cafe.tsx)
- Route targets:
  - `/partner-store/restaurant/[id]`
  - `/partner-store/cafe/[id]`

## Phase 2: Data model + fetching support for detail page

- Extend `PartnerStore` model to include `address` in [types/store.ts](/Users/mac/Documents/Saysheji/Apps/Wegood4u/Code/types/store.ts).
- Update Firestore mapping in [data/partnerStore.ts](/Users/mac/Documents/Saysheji/Apps/Wegood4u/Code/data/partnerStore.ts) to read `address` safely (`''` fallback).
- Add helper for lookup-by-id (or fetch all then find in screen) so detail pages can load a single store reliably.

## Phase 3: Build separate detail screens (restaurant/cafe)

- Create:
  - `app/partner-store/restaurant/[id].tsx`
  - `app/partner-store/cafe/[id].tsx`
- Shared UI structure based on your screenshots:
  - Top banner/header image = `store.image`
  - Back button and action icons row
  - Store meta block:
    - label (Restaurant/Cafe)
    - `name`
    - rating (`rating`)
    - `description`
  - Info rows:
    - phone (`phone`)
    - address (`address`)
    - computed distance (from user location)
    - hours (`hours`)
    - default day range (`Mon - Sun`)
    - default price range (`$$$`)
- Skip menu section for now.
- Add robust empty/error states:
  - invalid id
  - store not found
  - missing fields fallbacks

## Phase 4: Distance calculation from user location

- Reuse location approach already used in [app/(tabs)/map.native.tsx](/Users/mac/Documents/Saysheji/Apps/Wegood4u/Code/app/(tabs)/map.native.tsx) (`expo-location` permissions + current coords).
- Add a small distance utility (Haversine formula), then show human-readable distance text on detail screens.
- Fallback behavior:
  - permission denied / location unavailable -> show `Distance unavailable`
  - invalid store lat/lng -> show `Distance unavailable`

## Phase 5: QA + consistency pass

- Verify navigation end-to-end:
  - Home section button -> list
  - list card -> correct detail page
  - back navigation works
- Validate both categories with multiple records.
- Check lints for changed files and resolve introduced warnings/errors.
- Visual pass against screenshots: spacing, hierarchy, icon placement, typography weight.

## Execution order recommendation

1. Phase 1 (navigation wiring)
2. Phase 2 (address in model/fetch)
3. Phase 3 (detail screens)
4. Phase 4 (distance logic)
5. Phase 5 (QA/polish)

## Notes for incremental delivery

- Keep each phase in a small PR/commit-sized chunk.
- After each phase, do a quick manual test before moving forward.
- If needed later, we can refactor both detail screens to share one reusable `PartnerStoreDetail` component while keeping separate routes.

