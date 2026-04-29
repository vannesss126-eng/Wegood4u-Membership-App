import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Derived per-category task progress. Submissions and referrals are tracked
// separately so the UI can render `5 (+1) / 10` with a gold tick overlay for
// the referral portion. Denominator is a constant 10 per
// .agent/documentation/credits-overview.md.
export interface CategoryProgress {
  category: 'restaurant' | 'cafe' | 'bar' | 'hotel';
  numeratorFromSubmissions: number;
  numeratorFromReferrals: number;
  // numeratorFromSubmissions + numeratorFromReferrals, capped at 10
  numeratorTotal: number;
  denominator: number; // always 10 for eligible categories, 10 for hotel visibility counter too
  cycleId: string | null;
  // Lifetime count of approved submissions in this category, across all cycles
  // (pre-cycle-reset). Drives the "N total visit(s)" copy on the badge share card.
  totalApprovedSubmissions: number;
  // For hotel: alias of totalApprovedSubmissions (kept for back-compat).
  hotelApprovedCount?: number;
}

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type BadgeLevel = 1 | 2 | 3;

export interface UnredeemedVoucher {
  id: string;
  tier: BadgeTier;
  reward_kind: 'airbnb' | '3_star_hotel' | '4_star_hotel' | 'specialty';
  earned_from_cycle_id: string;
  created_at: string;
}

export interface UseTasksReturn {
  categories: Record<CategoryProgress['category'], CategoryProgress>;
  completedTasks: number;
  // null when the user has 0 completed tasks (no badge yet).
  tier: BadgeTier | null;
  level: BadgeLevel | null;
  unredeemedVouchers: UnredeemedVoucher[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ELIGIBLE_CATEGORIES: Array<'restaurant' | 'cafe' | 'bar'> = ['restaurant', 'cafe', 'bar'];

// Source of truth: .agent/documentation/badges.md "Tier + level table".
// Single global value per user, derived from cumulative R/C/B task count.
export function tierLevelFor(
  tasks: number
): { tier: BadgeTier; level: BadgeLevel } | null {
  if (tasks <= 0)  return null;
  if (tasks === 1) return { tier: 'bronze',   level: 1 };
  if (tasks === 2) return { tier: 'bronze',   level: 2 };
  if (tasks <= 4)  return { tier: 'bronze',   level: 3 };
  if (tasks <= 6)  return { tier: 'silver',   level: 1 };
  if (tasks <= 9)  return { tier: 'silver',   level: 2 };
  if (tasks <= 14) return { tier: 'silver',   level: 3 };
  if (tasks <= 19) return { tier: 'gold',     level: 1 };
  if (tasks <= 26) return { tier: 'gold',     level: 2 };
  if (tasks <= 34) return { tier: 'gold',     level: 3 };
  if (tasks <= 39) return { tier: 'platinum', level: 1 };
  if (tasks <= 44) return { tier: 'platinum', level: 2 };
  return             { tier: 'platinum', level: 3 };
}

function emptyCategory(cat: CategoryProgress['category']): CategoryProgress {
  return {
    category: cat,
    numeratorFromSubmissions: 0,
    numeratorFromReferrals: 0,
    numeratorTotal: 0,
    denominator: 10,
    cycleId: null,
    totalApprovedSubmissions: 0,
  };
}

export function useTasks(userId: string | undefined): UseTasksReturn {
  const [categories, setCategories] = useState<UseTasksReturn['categories']>({
    restaurant: emptyCategory('restaurant'),
    cafe: emptyCategory('cafe'),
    bar: emptyCategory('bar'),
    hotel: emptyCategory('hotel'),
  });
  const [completedTasks, setCompletedTasks] = useState(0);
  const [unredeemedVouchers, setUnredeemedVouchers] = useState<UnredeemedVoucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Pull the full ledger for this user — small per-user volume makes
      //    this cheaper than multiple grouped RPC calls for the common case.
      const { data: ledgerRows, error: ledgerError } = await supabase
        .from('credits_ledger')
        .select('category, delta_numerator, reason, cycle_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (ledgerError) throw ledgerError;

      // 2. Group rows by (category, cycle_id) to find active cycles + closed cycles.
      const rows = ledgerRows ?? [];
      const cyclesByCategory = new Map<
        string,
        Array<{ cycleId: string; total: number; submissions: number; referrals: number; lastAt: string }>
      >();

      for (const row of rows) {
        const key = row.category as string;
        const bucket = cyclesByCategory.get(key) ?? [];
        let entry = bucket.find(b => b.cycleId === row.cycle_id);
        if (!entry) {
          entry = { cycleId: row.cycle_id, total: 0, submissions: 0, referrals: 0, lastAt: row.created_at };
          bucket.push(entry);
        }
        entry.total += row.delta_numerator;
        if (row.reason === 'approved_submission') entry.submissions += 1;
        else entry.referrals += 1;
        if (row.created_at > entry.lastAt) entry.lastAt = row.created_at;
        cyclesByCategory.set(key, bucket);
      }

      let tasksDone = 0;
      const next: UseTasksReturn['categories'] = {
        restaurant: emptyCategory('restaurant'),
        cafe: emptyCategory('cafe'),
        bar: emptyCategory('bar'),
        hotel: emptyCategory('hotel'),
      };

      for (const cat of ELIGIBLE_CATEGORIES) {
        const bucket = cyclesByCategory.get(cat) ?? [];
        // Closed cycles contribute to task count; active cycle drives UI.
        const closed = bucket.filter(b => b.total >= 10);
        tasksDone += closed.length;
        const active = bucket
          .filter(b => b.total < 10)
          .sort((a, b) => (a.lastAt > b.lastAt ? -1 : 1))[0];

        // Lifetime approved submissions across all cycles for this category.
        const totalApproved = bucket.reduce((acc, c) => acc + c.submissions, 0);

        if (active) {
          next[cat] = {
            category: cat,
            numeratorFromSubmissions: active.submissions,
            numeratorFromReferrals: active.referrals,
            numeratorTotal: Math.min(active.total, 10),
            denominator: 10,
            cycleId: active.cycleId,
            totalApprovedSubmissions: totalApproved,
          };
        } else {
          next[cat] = {
            ...emptyCategory(cat),
            totalApprovedSubmissions: totalApproved,
          };
        }
      }

      // 3. Hotel is a visibility-only counter — not in the ledger. Count
      //    approved Hotel submissions lifetime.
      const { count: hotelCount, error: hotelError } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('partner_store_category', 'hotel')
        .eq('status', 'approved');

      if (hotelError) throw hotelError;

      next.hotel = {
        ...emptyCategory('hotel'),
        hotelApprovedCount: hotelCount ?? 0,
        totalApprovedSubmissions: hotelCount ?? 0,
        // Numerator/denominator mirrors the cycle UI: start over at every 10.
        numeratorFromSubmissions: (hotelCount ?? 0) % 10,
        numeratorTotal: (hotelCount ?? 0) % 10,
      };

      // 4. Unredeemed vouchers for the Rewards subtab.
      const { data: voucherRows, error: voucherError } = await supabase
        .from('vouchers')
        .select('id, tier, reward_kind, earned_from_cycle_id, created_at')
        .eq('user_id', userId)
        .is('redeemed_at', null)
        .order('created_at', { ascending: false });

      if (voucherError) throw voucherError;

      setCategories(next);
      setCompletedTasks(tasksDone);
      setUnredeemedVouchers((voucherRows ?? []) as UnredeemedVoucher[]);
    } catch (err: any) {
      console.error('[useTasks] fetch failed:', err);
      setError(err?.message ?? 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Realtime: refetch when the ledger or vouchers change for this user.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`tasks:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'credits_ledger', filter: `user_id=eq.${userId}` },
        () => fetchState()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vouchers', filter: `user_id=eq.${userId}` },
        () => fetchState()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchState]);

  return {
    categories,
    completedTasks,
    tier: tierLevelFor(completedTasks)?.tier ?? null,
    level: tierLevelFor(completedTasks)?.level ?? null,
    unredeemedVouchers,
    isLoading,
    error,
    refetch: fetchState,
  };
}
