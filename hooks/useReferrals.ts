import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';

export interface ReferralData {
  affiliate_id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  level: number;
  created_at: string;
  inviter_id: string | null;
}

export interface Level1Referral {
  referral: ReferralData;
  level2Referrals: ReferralData[];
}

export interface UseReferralsReturn {
  level1Referrals: Level1Referral[];
  isLoading: boolean;
  error: string | null;
  refetch: (showRefreshIndicator?: boolean) => Promise<void>;
}

export function useReferrals(userId: string | undefined): UseReferralsReturn {
  const [level1Referrals, setLevel1Referrals] = useState<Level1Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReferrals = useCallback(async (showRefreshIndicator = false) => {
    if (!userId) {
      setLevel1Referrals([]);
      setIsLoading(false);
      return;
    }

    if (!showRefreshIndicator) {
      setIsLoading(true);
    }

    try {
      setError(null);

      // Fetch all referrals for this affiliate (both Level 1 and Level 2)
      // Select columns matching the view structure: affiliate_id, user_id, username, full_name, level, created_at, inviter_id
      const { data, error: fetchError } = await supabase
        .from('referral_tree')
        .select('affiliate_id, user_id, username, full_name, level, created_at, inviter_id')
        .eq('affiliate_id', userId)
        .order('level', { ascending: true })
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('Error fetching referrals:', fetchError);
        throw new Error('Failed to fetch referrals');
      }

      // Transform flat data into tree structure
      const referrals = (data || []) as ReferralData[];

      // Filter Level 1 and Level 2 referrals
      const level1Data = referrals.filter(r => r.level === 1);
      const level2Data = referrals.filter(r => r.level === 2);

      console.log(`[useReferrals] Found ${level1Data.length} Level 1 and ${level2Data.length} Level 2 referrals`);

      // Group Level 2 referrals by their inviter (Level 1 user_id)
      // The inviter_id column in referral_tree view now contains the Level 1 user_id for Level 2 referrals
      const structuredReferrals: Level1Referral[] = level1Data.map(level1Referral => {
        const level2ForThisLevel1 = level2Data.filter(level2Referral => {
          // Level 2's inviter_id should match Level 1's user_id
          return level2Referral.inviter_id === level1Referral.user_id;
        });

        if (level2ForThisLevel1.length > 0) {
          console.log(`[useReferrals] Level 1 ${level1Referral.full_name || level1Referral.username} has ${level2ForThisLevel1.length} Level 2 referrals`);
        }

        return {
          referral: level1Referral,
          level2Referrals: level2ForThisLevel1,
        };
      });

      setLevel1Referrals(structuredReferrals);
    } catch (err: any) {
      console.error('Error in fetchReferrals:', err);
      setError(err.message);
      if (!showRefreshIndicator) {
        Alert.alert('Error', 'Failed to fetch referrals');
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  return {
    level1Referrals,
    isLoading,
    error,
    refetch: fetchReferrals,
  };
}

