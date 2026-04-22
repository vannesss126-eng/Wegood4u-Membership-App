# Partner Stores (Firebase catalog)

> The Firebase half of the dual backend. Pair with [`project-overview.md`](project-overview.md).

---

## What this covers

The catalog of partner businesses users can visit. Stored in **Firebase Firestore** (not Supabase). Used by:
- Category browse screens (Restaurant / Cafe / Bar / Experience)
- The Map tab (markers)
- The submission flow (the user picks a store before uploading proof)

Why Firestore: NoSQL flexibility for nested fields like `menu-images` arrays, days, and price ranges without a relational image table.

---

## Data model

**Collection:** `partner_store` (Firestore root collection). Read in [data/partnerStore.ts:39-66](data/partnerStore.ts#L39-L66).

**Document shape** (typed in [types/store.ts](types/store.ts)):

| Field | Type | Notes |
|---|---|---|
| `id` | string | Firestore doc ID |
| `name` | string | Store name |
| `type` | string | Free-text type — e.g. `"Restaurant"`, `"Bar"`, `"Coffee"`, `"Dessert"`. Filtering is done client-side via keyword match. |
| `city` | string | e.g. `"Chiang Mai"`, `"Kuala Lumpur"` |
| `address` | string | Full address |
| `latitude` | number | For map markers |
| `longitude` | number | For map markers |
| `rating` | number | 0+ float |
| `image` | string | Main image URL (not Firebase Storage — external URLs) |
| `phone` | string | Contact number |
| `hours` | string | Free-text operating hours |
| `description` | string | Free text |
| `days` | string? | Optional days-of-operation field |
| `priceRange` | string? | Optional `"$"`/`"$$"`/`"$$$"` |
| `menu-images` | string[]? | Array of menu photo URLs |

**Image strategy:** All image fields are URL strings — Firebase Storage is **not** used. Images live on whatever CDN the operator chose when creating the doc. No upload UI in the app — partner-store docs are managed externally.

---

## Key files

| File | Purpose |
|---|---|
| [data/partnerStore.ts](data/partnerStore.ts) | Firebase queries: `fetchPartnerStores()` (all docs), `fetchPartnerStoreById(id)` |
| [types/store.ts](types/store.ts) | `PartnerStore`, `GroupedStores` type defs |
| [components/partner-store/PartnerStoreCategoryScreen.tsx](components/partner-store/PartnerStoreCategoryScreen.tsx) | Reusable list screen — search, sort (rating / A–Z), location filter, grid/list toggle |
| [components/partner-store/PartnerStoreDetailContent.tsx](components/partner-store/PartnerStoreDetailContent.tsx) | Detail view — all fields + menu image gallery + share/distance |
| [app/partner-store/bar/index.tsx](app/partner-store/bar/index.tsx) | Bar list — filters by `"beverage"` or `"bar"` in `type` |
| [app/partner-store/cafe/index.tsx](app/partner-store/cafe/index.tsx) | Cafe list — filters by `"coffee"`, `"dessert"`, or `"cafe"` |
| [app/partner-store/restaurant/index.tsx](app/partner-store/restaurant/index.tsx) | Restaurant list — multiple keyword match |
| [app/partner-store/experience/index.tsx](app/partner-store/experience/index.tsx) | **Experience** is special — shuffles all stores and returns first 20 (no type filter) |
| [app/partner-store/[category]/[id].tsx](app/partner-store/[category]/[id].tsx) | Detail route per category |
| [app/(tabs)/map.native.tsx](app/(tabs)/map.native.tsx) | Map tab — pulls full store list and renders markers |

---

## Categories — what's actually wired

The four route folders under [app/partner-store/](app/partner-store/) are: **bar, cafe, restaurant, experience**.

There is **no `hotel` route folder** — hotel is handled differently (and per [`credits-overview.md`](credits-overview.md), hotel sits on the separate "bigger claims" reward path).

| Route | Filter against `type` |
|---|---|
| Bar | `"beverage"` OR `"bar"` |
| Cafe | `"coffee"` OR `"dessert"` OR `"cafe"` |
| Restaurant | multiple restaurant-related keywords |
| Experience | none — shuffle all and slice 20 |

Filtering is **string matching on `type`** done client-side after fetching the full collection. There are no compound Firestore queries.

---

## Submission integration

When a user submits proof in [components/verified-member/submission/index.tsx](components/verified-member/submission/index.tsx):

1. They pick a store from the catalog (search + select UI).
2. The store's `name` is written to Supabase `submissions.partner_store_name` at [submission/index.tsx:217](components/verified-member/submission/index.tsx#L217).
3. The store's `type` is mapped to a category enum via `mapStoreCategory()` at [submission/index.tsx:70-81](components/verified-member/submission/index.tsx#L70-L81):
   - `"restaurant"` → `restaurant`
   - `"coffee"` / `"dessert"` → `cafe`
   - everything else → `others`
4. The mapped category is saved as `submissions.partner_store_category` at [submission/index.tsx:218](components/verified-member/submission/index.tsx#L218).
5. Receipt + selfie are uploaded to Supabase Storage buckets (`submitted-receipt`, `submitted-selfie`).
6. The 20/day RLS limit is enforced at insert time.

**Important:** The submission category enum is `cafe | restaurant | others` — there is **no `bar` or `hotel`** value. A submission against a bar partner store ends up in `others`. This has knock-on effects for badges (see [`badges.md`](badges.md)).

---

## Map integration

[app/(tabs)/map.native.tsx](app/(tabs)/map.native.tsx) calls `fetchPartnerStores()` once on mount, filters out stores with invalid coordinates, and renders one marker per store. See [`map-feature.md`](map-feature.md) for the full map docs (including the platform split with `map.tsx`).

---

## Quirks & gaps

- **No pagination** — `fetchPartnerStores()` calls `getDocs()` on the whole collection. Fine at current scale; will need cursor-based pagination if the catalog grows past a few hundred docs.
- **No server-side filtering** — all sort/filter happens in-memory client-side. Even category routing fetches everything and filters locally.
- **No auth gate** — partner stores are publicly readable from Firestore (no Firebase Auth checks in the read path).
- **No real-time subscription** — data is fetched on mount; updates require a screen remount.
- **Experience category is non-deterministic** — shuffles every load. Users won't see the same list twice.
- **Type field is free-text** — typos in `type` will silently exclude a store from its intended category. There's no admin UI to enforce a vocabulary.
- **No Hotel route** — but the database submission category includes `others`, and partner stores include hotels. Browsing hotels is currently impossible from the category routes; users would need to find them via the map or search.
- **No image upload flow** — operator manages docs externally; the app is read-only against Firestore.
