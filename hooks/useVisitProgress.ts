import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface VisitProgressCycle {
  cycleId: string;
  realVisits: number;
  extrasApplied: number;
  total: number;
  openedAt: string;
}

export interface UseVisitProgressReturn {
  cycle: VisitProgressCycle | null;
  realVisits: number;
  extrasApplied: number;
  total: number;
  isClaimable: boolean;
  trade: () => Promise<{ newBalance: number; newExtrasApplied: number }>;
  claim: () => Promise<{ voucherId: string }>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY: VisitProgressCycle = {
  cycleId: '',
  realVisits: 0,
  extrasApplied: 0,
  total: 0,
  openedAt: '',
};

export function useVisitProgress(userId: string | undefined): UseVisitProgressReturn {
  const [cycle, setCycle] = useState<VisitProgressCycle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCycle = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      const { data, error: rowError } = await supabase
        .from('visit_progress')
        .select('cycle_id, real_visits, extras_applied, opened_at')
        .eq('user_id', userId)
        .is('closed_at', null)
        .maybeSingle();

      if (rowError) throw rowError;

      if (data) {
        setCycle({
          cycleId: data.cycle_id,
          realVisits: data.real_visits,
          extrasApplied: data.extras_applied,
          total: data.real_visits + data.extras_applied,
          openedAt: data.opened_at,
        });
      } else {
        setCycle(null);
      }
    } catch (err: any) {
      console.error('[useVisitProgress] fetch failed:', err);
      setError(err?.message ?? 'Failed to load Visit 10 progress');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCycle();
  }, [fetchCycle]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`visit_progress:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visit_progress', filter: `user_id=eq.${userId}` },
        () => fetchCycle()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchCycle]);

  const trade = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('trade_stars_for_progress');
    if (rpcError) throw rpcError;
    await fetchCycle();
    return {
      newBalance: data?.new_balance ?? 0,
      newExtrasApplied: data?.new_extras_applied ?? 0,
    };
  }, [fetchCycle]);

  const claim = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('complete_visit_task');
    if (rpcError) throw rpcError;
    await fetchCycle();
    return { voucherId: (data as string) ?? '' };
  }, [fetchCycle]);

  const view = cycle ?? EMPTY;
  const total = view.realVisits + view.extrasApplied;

  return {
    cycle,
    realVisits: view.realVisits,
    extrasApplied: view.extrasApplied,
    total,
    isClaimable: total >= 10,
    trade,
    claim,
    isLoading,
    error,
    refetch: fetchCycle,
  };
}
