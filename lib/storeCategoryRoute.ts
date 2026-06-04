export type StoreCategoryRoute = 'restaurant' | 'cafe' | 'bar' | 'experience';

/**
 * Maps a partner store's free-text `type` to the detail-screen route segment.
 * Mirrors the home screen's category buckets (app/(tabs)/index.tsx). All four
 * routes render the same detail content — the segment only drives the label —
 * so anything uncategorised falls through to 'experience'.
 */
export function categoryRouteForType(type: string | undefined | null): StoreCategoryRoute {
  const t = (type ?? '').toLowerCase();

  if (t.includes('coffee') || t.includes('dessert') || t.includes('cafe')) {
    return 'cafe';
  }
  if (t.includes('beverage') || t.includes('bar')) {
    return 'bar';
  }
  if (
    t.includes('restaurant') ||
    t.includes('italian') ||
    t.includes('japanese') ||
    t.includes('fast food') ||
    t.includes('healthy food')
  ) {
    return 'restaurant';
  }
  return 'experience';
}
