import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const KL_TZ = 'Asia/Kuala_Lumpur';

// ISO yyyy-mm-dd in KL TZ. en-CA gives us the correct format directly.
function klDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

interface CheckinResult {
  streak: number;
  awardedStars: number;
}

export interface UseDailyCheckinReturn {
  currentStreak: number;
  lastCheckinAt: string | null;
  canCheckinToday: boolean;
  /** Days completed in the current 14-day window (1..14, or 0 when streak is 0). */
  progressInWindow: number;
  /** Streak count at which the next +50 ★ milestone fires. */
  nextMilestoneAt: number;
  isLoading: boolean;
  isCheckingIn: boolean;
  error: string | null;
  checkin: () => Promise<CheckinResult | null>;
  refresh: () => Promise<void>;
}

export function useDailyCheckin(userId: string | undefined): UseDailyCheckinReturn {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [lastCheckinAt, setLastCheckinAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-derive on every render (cheap) so UI stays correct across day boundaries
  // even without a refetch — e.g. the user keeps the screen open past midnight.
  const today = klDateString(new Date());
  const lastDate = lastCheckinAt ? klDateString(new Date(lastCheckinAt)) : null;
  const canCheckinToday = lastDate !== today;

  const progressInWindow = currentStreak === 0 ? 0 : ((currentStreak - 1) % 14) + 1;
  const nextMilestoneAt = Math.ceil((currentStreak + 1) / 14) * 14;

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('current_streak, last_checkin_at')
        .eq('id', userId)
        .single();
      if (fetchError) throw fetchError;
      if (mountedRef.current) {
        setCurrentStreak(data?.current_streak ?? 0);
        setLastCheckinAt(data?.last_checkin_at ?? null);
      }
    } catch (err: any) {
      console.error('[useDailyCheckin] fetch failed:', err);
      if (mountedRef.current) setError(err.message ?? 'Failed to load streak');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Realtime: profiles is in the supabase_realtime publication (base schema).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`daily_checkin:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as { current_streak?: number; last_checkin_at?: string | null };
          if (!mountedRef.current) return;
          if (typeof next.current_streak === 'number') setCurrentStreak(next.current_streak);
          if (next.last_checkin_at !== undefined) setLastCheckinAt(next.last_checkin_at);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const checkin = useCallback(async (): Promise<CheckinResult | null> => {
    if (!userId || isCheckingIn) return null;
    setIsCheckingIn(true);
    try {
      setError(null);
      const { data, error: rpcError } = await supabase.rpc('record_daily_checkin');
      if (rpcError) throw rpcError;
      const payload = data as {
        success: boolean;
        reason?: string;
        streak: number;
        awarded_stars?: number;
      };
      if (mountedRef.current) {
        setCurrentStreak(payload.streak);
        setLastCheckinAt(new Date().toISOString());
      }
      return {
        streak: payload.streak,
        awardedStars: payload.awarded_stars ?? 0,
      };
    } catch (err: any) {
      console.error('[useDailyCheckin] checkin failed:', err);
      if (mountedRef.current) setError(err.message ?? 'Check-in failed');
      return null;
    } finally {
      if (mountedRef.current) setIsCheckingIn(false);
    }
  }, [userId, isCheckingIn]);

  return {
    currentStreak,
    lastCheckinAt,
    canCheckinToday,
    progressInWindow,
    nextMilestoneAt,
    isLoading,
    isCheckingIn,
    error,
    checkin,
    refresh: fetchProfile,
  };
}
