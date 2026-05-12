import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type VisitBadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type VisitBadgeLevel = 1 | 2 | 3;

export interface UseVisitBadgeReturn {
  tier: VisitBadgeTier | null;
  level: VisitBadgeLevel | null;
  completedCycles: number;
  cyclesToNextLevel: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Mirrors public._visit_badge_tier_level in stars_v1_rpcs.sql.
// Source of truth: .agent/documentation/badges.md "Visit Badge tier table".
const TIER_TABLE: Array<{ min: number; tier: VisitBadgeTier; level: VisitBadgeLevel }> = [
  { min: 1,  tier: 'bronze',   level: 1 },
  { min: 2,  tier: 'bronze',   level: 2 },
  { min: 3,  tier: 'bronze',   level: 3 },
  { min: 5,  tier: 'silver',   level: 1 },
  { min: 8,  tier: 'silver',   level: 2 },
  { min: 11, tier: 'silver',   level: 3 },
  { min: 15, tier: 'gold',     level: 1 },
  { min: 20, tier: 'gold',     level: 2 },
  { min: 27, tier: 'gold',     level: 3 },
  { min: 35, tier: 'platinum', level: 1 },
  { min: 40, tier: 'platinum', level: 2 },
  { min: 45, tier: 'platinum', level: 3 },
];

export function tierLevelFor(
  cycles: number
): { tier: VisitBadgeTier; level: VisitBadgeLevel } | null {
  if (cycles <= 0) return null;
  let match: { tier: VisitBadgeTier; level: VisitBadgeLevel } | null = null;
  for (const row of TIER_TABLE) {
    if (cycles >= row.min) match = { tier: row.tier, level: row.level };
  }
  return match;
}

function cyclesToNextLevelFor(cycles: number): number | null {
  for (const row of TIER_TABLE) {
    if (cycles < row.min) return row.min - cycles;
  }
  return null; // already at max (Platinum L3)
}

export function useVisitBadge(userId: string | undefined): UseVisitBadgeReturn {
  const [completedCycles, setCompletedCycles] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCycles = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      const { count, error: countError } = await supabase
        .from('visit_progress')
        .select('cycle_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('closed_at', 'is', null);

      if (countError) throw countError;
      setCompletedCycles(count ?? 0);
    } catch (err: any) {
      console.error('[useVisitBadge] fetch failed:', err);
      setError(err?.message ?? 'Failed to load Visit Badge state');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`visit_badge:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visit_progress', filter: `user_id=eq.${userId}` },
        () => fetchCycles()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchCycles]);

  const tl = tierLevelFor(completedCycles);

  return {
    tier: tl?.tier ?? null,
    level: tl?.level ?? null,
    completedCycles,
    cyclesToNextLevel: cyclesToNextLevelFor(completedCycles),
    isLoading,
    error,
    refetch: fetchCycles,
  };
}
