import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type StoreCategory = 'restaurant' | 'cafe' | 'bar' | 'hotel';

export interface CategoryCounts {
  restaurant: number;
  cafe: number;
  bar: number;
  hotel: number;
}

export interface UseCategoryStatsReturn {
  counts: CategoryCounts;
  totalApproved: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY: CategoryCounts = { restaurant: 0, cafe: 0, bar: 0, hotel: 0 };

export function useCategoryStats(userId: string | undefined): UseCategoryStatsReturn {
  const [counts, setCounts] = useState<CategoryCounts>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      const { data, error: rowError } = await supabase
        .from('submissions')
        .select('partner_store_category')
        .eq('user_id', userId)
        .eq('status', 'approved');

      if (rowError) throw rowError;

      const next: CategoryCounts = { ...EMPTY };
      for (const row of data ?? []) {
        const cat = row.partner_store_category as StoreCategory;
        if (cat in next) next[cat] += 1;
      }
      setCounts(next);
    } catch (err: any) {
      console.error('[useCategoryStats] fetch failed:', err);
      setError(err?.message ?? 'Failed to load category stats');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const totalApproved = counts.restaurant + counts.cafe + counts.bar + counts.hotel;

  return { counts, totalApproved, isLoading, error, refetch: fetchCounts };
}
