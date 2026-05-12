---
name: Favorites & Wishlist
overview: "Wire the dead heart icon on partner store pages into a real per-user favorites system, then layer a 'Save for visit' wishlist concept on top. Favorites first per Kasey 2026-05-10."
todos:
  - id: phase0-preflight
    content: Lock open questions — favorites listing surface (Profile subtab vs Map filter), wishlist auto-clear on submission, icon-state visual.
    status: pending
  - id: phase1-favorites-db
    content: Create user_favorite_stores table + RLS + toggle RPC. Migration only, no UI yet.
    status: pending
  - id: phase2-favorites-hook
    content: Build useFavoriteStores hook (list, isFavorited, toggle) with realtime sync. Wire heart icon onPress on partner store detail page.
    status: pending
  - id: phase3-favorites-listing
    content: Build the Favorites listing surface (chosen in Phase 0). Empty state + tap-to-detail flow.
    status: pending
  - id: phase4-wishlist-db
    content: Create user_wishlist_stores table mirroring favorites schema. Migration + hook.
    status: pending
  - id: phase5-wishlist-ui
    content: Wishlist toggle on partner store detail (separate icon from favorites), Tasks tab list to pick from when submitting, optional auto-clear on submission.
    status: pending
  - id: phase6-polish
    content: Empty states, animation on toggle, history-feed entries (optional), notifications doc updates.
    status: pending
isProject: true
---

# Favorites & Wishlist Implementation Plan

## Goal

Two distinct user concepts, built in order:

1. **Favorites** — "I love this place, may visit repeatedly." Wire the heart icon already rendered at [components/partner-store/PartnerStoreDetailContent.tsx:99-106](components/partner-store/PartnerStoreDetailContent.tsx#L99-L106) into a real persistent toggle.
2. **Wishlist (save for visit)** — "I plan to visit this once." Distinct icon + storage; lives in tandem with favorites but has different lifecycle semantics. Lives under Tasks per Kasey.

## Source of truth

- Decision lock: [partner-stores.md](.agent/documentation/partner-stores.md) §"Favorites (heart icon — pending wiring)"
- Profile-stat decision: [app-project-overview.md](.agent/documentation/app-project-overview.md) §2.6
- Memory note: [project_favorites_and_profile_stats.md](.claude/projects/-Users-mac-Documents-3-Work-Saysheji-Apps-Wegood4u-Code/memory/project_favorites_and_profile_stats.md)
- Kasey conversation 2026-05-10 (WhatsApp transcript)

If any of these contradict this plan, the docs win — update the plan.

## Architectural constraint

**Partner stores live in Firebase Firestore** (`partner_store` collection, see [data/partnerStore.ts:39-65](data/partnerStore.ts#L39)). Store IDs are Firestore document IDs (strings). Supabase has no foreign-key visibility into Firestore.

Implication: the favorites + wishlist tables on Supabase reference partner stores by **string ID with no FK**. Joining store metadata (name, image, type, city) is done client-side: fetch the favorited IDs from Supabase, then look them up in the already-loaded `partnerStores` array from `useUser`'s context or `fetchPartnerStores()`.

There is no risk of an "orphaned favorite" causing a hard error — if a Firestore doc is deleted, the Supabase row stays but renders as a fallback UI ("Store no longer available"). Cleanup is a future maintenance task, not a launch blocker.

---

## Phase 0 — Pre-flight decisions (LOCKED 2026-05-10)

### 0.1 Favorites listing surface — **C: both**

- **Profile tab → Favorites screen** (primary, full list with cards) at `app/profile/favorites.tsx`
- **Filter chip on Map / Home stores list** ("Show favorites only" toggle)

Phase 3 ships both surfaces in one go.

### 0.2 Wishlist auto-clear — **A: yes, auto-clear**

When a user's submission for a wishlisted store flips to `approved`, the matching `user_wishlist_stores` row auto-deletes via DB trigger. Matches the "visit it once" framing.

### 0.3 Icon state visual — **locked**

| State | Heart visual | Why |
|---|---|---|
| Not favorited | Outline, **grey** (`color="#94A3B8"`, no `fill`) | Neutral / unselected — not visually competing with the favorited state |
| Favorited | Outline + fill, **red** (`color="#F43F5E"`, `fill="#F43F5E"`) | Saturated red signals action taken; matches Twitter/X / Spotify "save" pattern |

Going from grey-outline → red-filled is a clear state transition; outline-red on both ends would look almost identical and confuse users.

For wishlist, separate icon and color:
| State | Bookmark visual |
|---|---|
| Not wishlisted | Outline, grey (`color="#94A3B8"`) |
| Wishlisted | Outline + fill, **green** (`color="#206E56"`, `fill="#206E56"`) — matches the Wegood4u brand green and clearly differentiates from the red heart |

### 0.4 Profile third stat slot — **Favorites count** (revised 2026-05-10)

Earlier interpretation was Referral count; superseded. Profile third stat = row count from `user_favorite_stores` for current user, label "Favorites", icon Heart. Wired in Phase 6.

### Exit criteria

All four answers locked above. Phase 1 unblocked.

---

## Phase 1 — Favorites: DB foundation

**Goal:** schema + RLS + idempotent toggle RPC. No UI changes yet — testable from SQL editor only.

### Files affected

- `supabase/migrations/{ts}_user_favorite_stores.sql` (new)

### Schema

```sql
CREATE TABLE public.user_favorite_stores (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_store_id text NOT NULL,    -- Firestore doc id; no FK
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, partner_store_id)
);

CREATE INDEX user_favorite_stores_user_idx
  ON public.user_favorite_stores (user_id, created_at DESC);
```

Composite primary key gives free idempotency — `INSERT ... ON CONFLICT DO NOTHING` handles double-tap; toggle behaviour is one INSERT or one DELETE.

### RLS

```sql
ALTER TABLE public.user_favorite_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own favorites"
  ON public.user_favorite_stores FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "users insert own favorites"
  ON public.user_favorite_stores FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "users delete own favorites"
  ON public.user_favorite_stores FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
```

No UPDATE policy — favorites are immutable once created (just delete + re-add if needed).

### Toggle RPC (optional)

Direct INSERT/DELETE via the client works fine with the policies above. An RPC isn't strictly necessary here. Decision: **skip the RPC**, let the hook do INSERT or DELETE based on local state. Simpler, less indirection.

### Realtime publication

Add `user_favorite_stores` to the `supabase_realtime` publication so the hook can sync state across screens (e.g. heart toggled on detail page → favorites list updates without refetch).

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_favorite_stores;
```

### Acceptance

- INSERT as user A succeeds; INSERT same `(user_id, partner_store_id)` errors with PK conflict (idempotency relies on `ON CONFLICT`).
- User B cannot SELECT user A's favorites (RLS).
- DELETE as user B against user A's row affects 0 rows (RLS).

### Rollback

- `DROP TABLE user_favorite_stores CASCADE` — no downstream depends on it yet.

---

## Phase 2 — Favorites: hook + heart icon wiring

**Goal:** make the heart icon interactive on partner store detail page. Tap to toggle, visual state reflects DB.

### Files affected

- `hooks/useFavoriteStores.ts` (new)
- `components/partner-store/PartnerStoreDetailContent.tsx` (edit — add `onPress` to existing TouchableOpacity, drive `fill` from hook state)

### Hook contract

```ts
export function useFavoriteStores(userId: string | undefined): {
  favorites: FavoriteRow[];               // all rows for current user
  favoriteIds: Set<string>;               // for O(1) isFavorited(id) checks
  isFavorited: (storeId: string) => boolean;
  toggle: (storeId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};
```

Pattern mirrors existing hooks (`useVouchers`, `useDailyCheckin`):
- Initial fetch in `useEffect`
- Realtime channel on `user_favorite_stores` filtered by `user_id`
- Optimistic update on toggle (insert local row immediately, rollback on error)
- `isFavorited` uses `favoriteIds.has(storeId)` for fast lookups when rendering many stores

### UI wiring on detail page

```tsx
const { isFavorited, toggle } = useFavoriteStores(userData?.id);
const fav = isFavorited(store.id);

<TouchableOpacity onPress={() => toggle(store.id)} ...>
  <Heart size={18} color="#F43F5E" fill={fav ? "#F43F5E" : "transparent"} />
</TouchableOpacity>
```

Add a subtle haptic (`expo-haptics` already in deps) on toggle for tactile feedback — `Haptics.selectionAsync()`.

### Acceptance

- Tap heart on a partner store detail → heart fills red instantly (optimistic).
- Reopen the same store later → still filled (hot from DB).
- Tap again → unfavorited, fills back to outline.
- Open the same store on a second device (same user) → realtime pushes the change.
- A guest (unauthenticated) seeing the icon: tap should prompt login, not no-op silently. Guard with `userData?.id` check + `Alert.alert('Sign in to save favorites')`.

### Risks

- **Heart icon size/positioning** — currently rendered in an `actionPill` next to a share button. If we change the fill it might look heavier; verify visually that filled-red doesn't dominate the pill.
- **Realtime channel limits** — Supabase free tier caps concurrent realtime channels. The `useVouchers`, `useDailyCheckin`, etc. already open per-user channels. Audit total active channels per user; consolidate into a single `user_realtime_aggregator` channel if approaching limits.

---

## Phase 3 — Favorites: listing surfaces (BOTH)

**Goal:** ship two listing surfaces per Phase 0.1 lock — dedicated Favorites screen reachable from Profile, plus a "favorites only" filter chip on the Map / Home stores list.

### Files affected

- `app/profile/favorites.tsx` (new) — full-screen list page
- `app/(tabs)/profile.tsx` (edit) — add a "Favorites" link in the section list, deep-link to `/profile/favorites`
- `app/(tabs)/index.tsx` (edit) — add a filter chip above the partner-store sections that scopes the list to favorites
- `components/Map.tsx` or wherever the map renders — add the same filter affordance
- Reuse existing partner store card components from [components/partner-store/](components/partner-store/) (do NOT rebuild)

### Page structure

- Header: back button, "Favorites" title, count chip (e.g. "12 saved")
- ScrollView of cards — same visual as the partner store browse list
- Empty state: heart icon + "No favorites yet — tap the heart on any store to save it"
- Tap card → existing partner store detail route

Data flow:
```ts
const { favorites } = useFavoriteStores(userData?.id);
const allStores = useMemo(() => [...], []);  // from context or fetchPartnerStores
const favoriteStores = favorites
  .map(f => allStores.find(s => s.id === f.partner_store_id))
  .filter(Boolean);
```

### Performance note

Joining client-side is O(N×M) where N = favorites count, M = total stores. With <500 favorites and <2000 stores it's fine. If either grows, switch to a `Map<string, PartnerStore>` lookup once on mount.

### Acceptance

- Favorites page lists every store the user has favorited, newest first (mirroring `created_at DESC` index).
- Tapping a card navigates to the existing partner store detail page.
- Removing a favorite from the detail page → card disappears from this list (realtime).
- Empty state renders cleanly with no console errors.

---

## Phase 4 — Wishlist: DB foundation

**Goal:** mirror Phase 1 schema for wishlist. Conceptually distinct from favorites — **two separate tables** keep semantics clean (no `kind` discriminator).

### Files affected

- `supabase/migrations/{ts}_user_wishlist_stores.sql` (new)

### Schema

```sql
CREATE TABLE public.user_wishlist_stores (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_store_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, partner_store_id)
);

CREATE INDEX user_wishlist_stores_user_idx
  ON public.user_wishlist_stores (user_id, created_at DESC);

-- Same 3 RLS policies as favorites (own SELECT/INSERT/DELETE)
-- Same realtime publication add
```

### Optional: auto-clear trigger (depends on Phase 0.2)

If Option A wins for 0.2:

```sql
CREATE OR REPLACE FUNCTION public.clear_wishlist_on_submission_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    DELETE FROM public.user_wishlist_stores
    WHERE user_id = NEW.user_id
      AND partner_store_id = NEW.partner_store_id;  -- if submissions stores Firestore id
  END IF;
  RETURN NEW;
END;
$$;
```

**Catch:** does `submissions` store the partner_store Firestore ID, or only the name? Check schema. If only name, this trigger needs different match logic or the submission flow needs to start storing the FS id (small change to `submitProof()` in `submission/index.tsx`).

### Acceptance

- Same RLS / idempotency tests as Phase 1.
- (If auto-clear): approving a submission for a wishlisted store removes the wishlist row in the same transaction.

---

## Phase 5 — Wishlist: UI

**Goal:** user can save stores to wishlist; pick from wishlist when starting a Submit Proof.

### Files affected

- `hooks/useWishlistStores.ts` (new — clone of `useFavoriteStores` with table swapped)
- `components/partner-store/PartnerStoreDetailContent.tsx` (edit — add a `Bookmark` icon next to the existing heart in the actionPill)
- `components/verified-member/submission/index.tsx` (edit — when user opens the partner-store picker, surface a "From your wishlist" section at the top of the picker modal)
- `app/tasks/wishlist.tsx` (new — optional standalone wishlist screen, deep-linked from Tasks tab; same pattern as favorites listing)

### Submission integration

Per Kasey: *"saved for visit maybe we make it under task? so they can choose which one to visit next time."* The cleanest fit is the existing partner-store picker modal in the Submit form. Add a section at the top:

```
┌─ Select Partner Store ──────────────────┐
│ [search box]                            │
│                                         │
│ FROM YOUR WISHLIST (3)                  │
│   • Pulau Pahawang Cafe                 │
│   • Sunset Restaurant                   │
│   • Hotel Bali Inn                      │
│                                         │
│ ALL STORES                              │
│   📍 Kuala Lumpur                       │
│     • Store A                           │
│     • Store B                           │
│   ...                                   │
└─────────────────────────────────────────┘
```

If wishlist is empty, just don't render the section. No "empty wishlist" copy in the picker.

### Acceptance

- Tap Bookmark icon on partner store detail → store added to wishlist (similar UX to favorites).
- Open Submit → "Select Partner Store" modal → wishlist section appears at the top with the user's saved stores.
- Tap a wishlisted store in the picker → store gets selected (same as picking from the main list).
- (If auto-clear): once that submission is approved by admin, the store drops out of the wishlist on next render.

---

## Phase 6 — Polish

| # | Task |
|---|---|
| 6.1 | Toggle animations — heart "pop" on favorite, bookmark "fold" on wishlist add. `react-native-reanimated` already in deps. |
| 6.2 | Optional: history-feed event types `store_favorited` and `store_wishlisted`. Likely too noisy — skip unless asked. |
| 6.3 | Notifications doc update — add favorites/wishlist as silent (no notif). Update [notifications.md](.agent/documentation/notifications.md). |
| 6.4 | Profile stat slot — wire **Favorites count** to replace "Collection" (locked Phase 0.4). Source: `useFavoriteStores().favorites.length`. Swap the `SquareLibrary` icon for `Heart`, label "Favorites". |

---

## Cross-cutting considerations

### Firestore data freshness

When the favorites list renders, it joins against `partnerStores` from context — which is fetched once on mount in `app/(tabs)/tasks.tsx`. If a store's metadata changes in Firestore mid-session, the favorites list won't reflect it until app restart. Acceptable for v1.

### Guest users

Heart icon is rendered for everyone, including guests. Guard the toggle behind auth check — show a "Sign in to save favorites" prompt instead of silent no-op. Same for bookmark.

### Sync between devices

Realtime subscription on the favorites table covers cross-device sync within the same user. No additional work needed.

### Testing

Seed scenarios:
- User with 0 favorites
- User with 1 favorite (singular copy works)
- User with 50 favorites (perf check on listing page)
- User favorites a store, then admin disables that store in Firestore (orphan)

---

## Open questions tracker

| # | Question | Owner | Blocks phase | Status |
|---|---|---|---|---|
| 1 | ~~Favorites listing surface — A / B / C?~~ | — | — | **Locked: C (both)** 2026-05-10 |
| 2 | ~~Wishlist auto-clear on approved submission?~~ | — | — | **Locked: yes, auto-clear** 2026-05-10 |
| 3 | Does `submissions` table store the Firestore `partner_store_id`, or only the name? | code audit | 4 (auto-clear trigger) | open |
| 4 | Should guest users see the heart icon at all, or hide entirely until logged in? | UX call | 2 | open — recommend keep visible, prompt login on tap |
| 5 | ~~Bookmark icon color~~ | — | — | **Locked: green (#206E56) when wishlisted, grey when not** 2026-05-10 |

---

## Phase order + sequencing chart

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
   │           │           │           │           │           │
   └ resolve   └ favorites └ heart on  └ favorites └ wishlist  └ wishlist
                 schema      detail      list page   schema      icon + picker
                                         live                    integration
```

Phases 1–3 (favorites) ship together as one PR. Phases 4–5 (wishlist) ship as a second PR. Phase 6 polish is incremental and can ride either PR or its own.

Per Kasey: *"we make it favourite 1st."* — favorites must reach production before wishlist starts.
