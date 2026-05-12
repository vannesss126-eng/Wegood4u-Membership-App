import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ActivityEventType =
  | 'submission_approved'
  | 'submission_rejected'
  | 'share_verified'
  | 'daily_streak_milestone'
  | 'referral_qualified'
  | 'stars_converted'
  | 'cycle_completed'
  | 'visit_badge_earned'
  | 'category_badge_earned'
  | 'voucher_redemption_requested';

export interface ActivityEvent {
  event_type: ActivityEventType;
  event_at: string; // ISO timestamp
  target: string;
  metadata: Record<string, any>;
}

export interface UseActivityOptions {
  page?: number;   // 1-indexed
  pageSize?: number;
  enabled?: boolean;
}

export interface UseActivityReturn {
  events: ActivityEvent[];
  totalCount: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  refetch: () => Promise<void>;
}

interface RawActivityRow extends ActivityEvent {
  total_count: number | string; // bigint comes back as string from postgrest
}

export function useActivity(options: UseActivityOptions = {}): UseActivityReturn {
  const { page = 1, pageSize = 10, enabled = true } = options;

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_user_activity', {
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      });

      if (rpcError) throw rpcError;

      const rows = (data ?? []) as RawActivityRow[];

      // total_count is the same on every row (window function); read from the
      // first row, or fall back to 0 when the page is empty.
      const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;

      setEvents(
        rows.map(({ total_count: _total, ...event }) => event as ActivityEvent)
      );
      setTotalCount(total);
    } catch (err: any) {
      console.error('[useActivity] fetch failed:', err);
      setError(err?.message ?? 'Failed to load activity');
      setEvents([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, enabled]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasMore = page < totalPages;

  return {
    events,
    totalCount,
    totalPages,
    hasMore,
    isLoading,
    error,
    refetch: fetchEvents,
  };
}
