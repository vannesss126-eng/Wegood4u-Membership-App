import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CategoryTier, CategoryLevel } from '@/lib/categoryBadgeTiers';

export type VoucherRewardKind =
  | 'airbnb_3star'
  | 'hotel_3_4star'
  | 'hotel_4_5star'
  | 'specialty_5star_resort';

export interface VoucherRow {
  id: string;
  user_id: string;
  badge_kind: string;
  tier: CategoryTier;
  level: CategoryLevel | null;
  reward_kind: VoucherRewardKind;
  earned_from_cycle_id: string | null;
  earned_from_badge_id: number | null;
  redeemed_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
}

export type UnredeemedByTier = Record<CategoryTier, number>;

export interface UseVouchersReturn {
  active: VoucherRow[];   // not yet redeemed
  redeemed: VoucherRow[]; // already redeemed (admin may still be fulfilling)
  /** Counts of unredeemed vouchers per tier — drives the "Redeem ×N" pill on each catalog card. */
  unredeemedByTier: UnredeemedByTier;
  isLoading: boolean;
  error: string | null;
  /** Redeem a specific voucher by id. */
  redeem: (voucherId: string) => Promise<VoucherRow | null>;
  /** Redeem the oldest unredeemed voucher of the given tier (FIFO). Returns null if none available. */
  redeemByTier: (tier: CategoryTier) => Promise<VoucherRow | null>;
  refresh: () => Promise<void>;
}

const ZERO_BY_TIER: UnredeemedByTier = { bronze: 0, silver: 0, gold: 0, platinum: 0 };

export function useVouchers(userId: string | undefined): UseVouchersReturn {
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('vouchers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      if (mountedRef.current) setRows((data ?? []) as VoucherRow[]);
    } catch (err: any) {
      console.error('[useVouchers] fetch failed:', err);
      if (mountedRef.current) setError(err.message ?? 'Failed to load vouchers');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: visit_progress closing mints new vouchers; we want them to
  // appear without a manual refresh.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`vouchers:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vouchers',
          filter: `user_id=eq.${userId}`,
        },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const redeem = useCallback(
    async (voucherId: string): Promise<VoucherRow | null> => {
      try {
        setError(null);
        const { data, error: rpcError } = await supabase.rpc('redeem_voucher', {
          p_voucher_id: voucherId,
        });
        if (rpcError) throw rpcError;
        const result = data as {
          success: boolean;
          reason?: string;
          redeemed_at?: string;
          already_redeemed?: boolean;
        };
        if (!result?.success) {
          if (result?.reason === 'forbidden') throw new Error('You do not own this voucher.');
          if (result?.reason === 'not_found') throw new Error('Voucher not found.');
          throw new Error('Could not redeem voucher.');
        }
        // Optimistic update so the UI flips immediately without waiting for
        // the realtime echo.
        if (mountedRef.current) {
          setRows((prev) =>
            prev.map((v) =>
              v.id === voucherId
                ? { ...v, redeemed_at: result.redeemed_at ?? new Date().toISOString() }
                : v,
            ),
          );
        }
        return rows.find((v) => v.id === voucherId) ?? null;
      } catch (err: any) {
        console.error('[useVouchers] redeem failed:', err);
        if (mountedRef.current) setError(err.message ?? 'Redemption failed');
        return null;
      }
    },
    [rows],
  );

  const active = rows.filter((v) => !v.redeemed_at);
  const redeemed = rows.filter((v) => v.redeemed_at);

  const unredeemedByTier: UnredeemedByTier = { ...ZERO_BY_TIER };
  for (const v of active) {
    unredeemedByTier[v.tier] = (unredeemedByTier[v.tier] ?? 0) + 1;
  }

  const redeemByTier = useCallback(
    async (tier: CategoryTier): Promise<VoucherRow | null> => {
      // FIFO: oldest unredeemed of that tier.
      const candidate = rows
        .filter((v) => !v.redeemed_at && v.tier === tier)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[0];
      if (!candidate) {
        if (mountedRef.current) setError(`No ${tier} voucher available to redeem.`);
        return null;
      }
      return redeem(candidate.id);
    },
    [rows, redeem],
  );

  return { active, redeemed, unredeemedByTier, isLoading, error, redeem, redeemByTier, refresh: load };
}
