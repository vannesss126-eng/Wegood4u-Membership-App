# Map Feature

> The Map tab. Native and web have separate implementations. Pair with [`partner-stores.md`](partner-stores.md) for the data source.

---

## What this covers

The map shows partner stores as pins so users can find places to visit. Native and web implementations diverge significantly — native is a real interactive map, web is a list-only fallback.

---

## Why the platform split

Expo Router resolves files by extension at bundle time:

| Pattern | Used for |
|---|---|
| `map.native.tsx` | iOS + Android (React Native) |
| `map.tsx` | Web (React DOM) |
| `map.ios.tsx` / `map.android.tsx` | Per-platform native overrides (not used here) |

This is the **platform-extension** pattern — Metro picks the right file per target without conditional `Platform.OS` branching.

The split exists here because [`react-native-maps`](https://github.com/react-native-maps/react-native-maps) doesn't run on web. The web version cannot import `MapView` directly without crashing the bundle, so the codebase ships:
- A dedicated web file that doesn't import the map library at all.
- A web stub at [web-stubs/react-native-maps.js](web-stubs/react-native-maps.js) that exports empty `View`-wrapped components for cases where the import path is shared.

---

## Native version — [app/(tabs)/map.native.tsx](app/(tabs)/map.native.tsx)

Full interactive map.

### What renders
- `MapView` from `react-native-maps@1.20.1` ([map.native.tsx:355-390](app/(tabs)/map.native.tsx#L355-L390)).
- One red `MapPin` `Marker` per partner store with valid coordinates ([map.native.tsx:374](app/(tabs)/map.native.tsx#L374)).
- User location dot via `showsUserLocation` ([map.native.tsx:358](app/(tabs)/map.native.tsx#L358)).
- City/store filter dropdown modal ([map.native.tsx:451-565](app/(tabs)/map.native.tsx#L451-L565)).
- Bottom sheet store-detail panel that slides up on marker tap ([map.native.tsx:396-449](app/(tabs)/map.native.tsx#L396-L449)).

### Data source
Markers come from Firebase Firestore via `fetchPartnerStores()` at [data/partnerStore.ts:39-66](data/partnerStore.ts#L39-L66). Stores with invalid (zero / missing) coordinates are filtered out at [map.native.tsx:354,362](app/(tabs)/map.native.tsx#L354-L362).

Default region: Thailand (`18.79, 98.99`) — used as fallback when no stores load ([map.native.tsx:114-119](app/(tabs)/map.native.tsx#L114-L119)).

### Location permission
- Requested in `useEffect` on mount via `Location.requestForegroundPermissionsAsync()` from `expo-location` ([map.native.tsx:172-200](app/(tabs)/map.native.tsx#L172-L200)).
- On denial: logs a warning and falls back to the default region. **No alert shown** — comment notes this is intentional to "avoid blocking the UI".
- On grant: pulls current position with `Location.Accuracy.Balanced`.

### Marker tap → details sheet
- `onPress={() => setSelectedStore(store)}` ([map.native.tsx:370](app/(tabs)/map.native.tsx#L370)).
- Bottom sheet shows photo, name, hours, phone, description.
- Actions:
  - **Directions** — `Linking.openURL()` to Google Maps ([map.native.tsx:218-230](app/(tabs)/map.native.tsx#L218-L230)).
  - **Call** — Tries the dialer; if unavailable, falls back to manual instructions ([map.native.tsx:249-309](app/(tabs)/map.native.tsx#L249-L309)).
  - **Close (×)** — dismisses the sheet ([map.native.tsx:444](app/(tabs)/map.native.tsx#L444)).

### Filter dropdown
[map.native.tsx:451-565](app/(tabs)/map.native.tsx#L451-L565) — modal with two interaction modes:
- City headers expand/collapse to show stores in that city.
- Tapping a store centers the map on it and selects it.
- "All Locations" resets the filter.

---

## Web version — [app/(tabs)/map.tsx](app/(tabs)/map.tsx)

**No actual map.** Renders a static `webMapPlaceholder` ([map.tsx:98-105](app/(tabs)/map.tsx#L98-L105)) with the text "Map View" and falls back to a scrollable list of partner-store cards ([map.tsx:108-135](app/(tabs)/map.tsx#L108-L135)).

This is a known compromise — there's no integrated web map library (Leaflet, Google Maps JS, etc.). Web users cannot visually browse partner locations.

---

## Fallback component — [components/FallbackMap.tsx](components/FallbackMap.tsx)

Rendered only when the filtered store list has zero valid coordinates. It is **not** used as a permission-denied or network-error fallback — those cases silently fall back to the default region.

---

## Gaps & limitations

- **Web has no real map** — only a list. Considering Leaflet or Google Maps JS would close this gap.
- **No marker clustering** — every store is its own pin regardless of zoom level. Will get crowded once the catalog grows past a few dozen stores in a single city.
- **Permission denial is silent** — users who tap "Don't Allow" see no explanation of what they're missing. Consider an in-context callout.
- **No deep link to store detail** — tapping a marker opens a modal sheet within the map screen; there's no way to share or link to a specific store page from here.
- **Manual phone-dial fallback** — if `Linking` can't open the dialer, the app shows text instructions. Worth checking why `tel:` would ever fail on a real device.
- **No real-time updates** — store data is fetched once on mount; Firestore changes don't propagate until the screen remounts.
- **No clustering / region-based fetch** — entire catalog loads on every mount. Pagination matters once the catalog grows.

---

## Related

- Data source — see [`partner-stores.md`](partner-stores.md).
- The submission flow uses the same partner-store catalog when the user picks a place to log a visit.
