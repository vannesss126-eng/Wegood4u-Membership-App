import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface UseStarWalletReturn {
  balance: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStarWallet(userId: string | undefined): UseStarWalletReturn {
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      const { data, error: rowError } = await supabase
        .from('star_wallet')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

      if (rowError) throw rowError;
      setBalance(data?.balance ?? 0);
    } catch (err: any) {
      console.error('[useStarWallet] fetch failed:', err);
      setError(err?.message ?? 'Failed to load star wallet');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`star_wallet:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'star_wallet', filter: `user_id=eq.${userId}` },
        () => fetchBalance()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchBalance]);

  return { balance, isLoading, error, refetch: fetchBalance };
}
