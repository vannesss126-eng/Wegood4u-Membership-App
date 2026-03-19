import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';
import type { 
  Submission, 
  TransformedSubmission, 
  ApprovedCounts, 
  SubmissionStats,
  UseSubmissionsOptions 
} from '@/types';

// Base hook for fetching submissions with flexible filtering
export function useSubmissions(options: UseSubmissionsOptions = {}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      console.log('Refreshing submissions...');
    } else {
      setIsLoading(true);
    }

    try {
      setError(null);
      
      let query = supabase.from('submissions').select(
        options.includeUserProfiles 
          ? `*, profiles:user_id (username, full_name)`
          : '*'
      );

      // Apply filters
      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }

      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      // Order by creation date (newest first)
      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching submissions:', fetchError);
        throw new Error('Failed to fetch submissions');
      }

      setSubmissions(data || []);
    } catch (err: any) {
      console.error('Error in fetchSubmissions:', err);
      setError(err.message);
      Alert.alert('Error', 'Failed to fetch submissions');
    } finally {
      setIsLoading(false);
    }
  }, [options.userId, options.status, options.includeUserProfiles]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  return {
    submissions,
    isLoading,
    error,
    refetch: fetchSubmissions,
  };
}

// Hook specifically for user submissions (verified members)
export function useUserSubmissions(userId: string) {
  const { submissions, isLoading, error, refetch } = useSubmissions({
    userId,
    status: 'all',
    includeUserProfiles: false,
  });

  // Transform submissions for UI components
  const transformedSubmissions: TransformedSubmission[] = submissions.map((item, index) => ({
    id: item.id || index,
    submissionDate: new Date(item.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }),
    restaurantName: item.partner_store_name || 'Unknown',
    receiptPhoto: item.receipt_url || '',
    selfiePhoto: item.selfie_url || '',
    status: item.status as 'approved' | 'pending' | 'rejected',
    category: item.partner_store_category || 'others'
  }));

  // Calculate approved counts for badges
  const approvedSubmissions = transformedSubmissions.filter(s => s.status === 'approved');
  const approvedCounts: ApprovedCounts = {
    total: approvedSubmissions.length,
    restaurant: approvedSubmissions.filter(s => s.category === 'restaurant').length,
    cafe: approvedSubmissions.filter(s => s.category === 'cafe').length,
    bar: approvedSubmissions.filter(s => s.category === 'bar').length,
    hotel: approvedSubmissions.filter(s => s.category === 'hotel').length,
    // Track any remaining categories as 'others'
    others: approvedSubmissions.filter(s => s.category === 'others' || !['restaurant', 'cafe', 'bar', 'hotel', 'others'].includes(s.category)).length,
  };

  // Statistics for UI
  const stats = {
    total: transformedSubmissions.length,
    approved: transformedSubmissions.filter(s => s.status === 'approved').length,
    pending: transformedSubmissions.filter(s => s.status === 'pending').length,
    rejected: transformedSubmissions.filter(s => s.status === 'rejected').length,
  };

  return {
    submissions: transformedSubmissions,
    approvedCounts,
    stats,
    isLoading,
    error,
    refetch,
  };
}

// Hook specifically for admin pending submissions
export function usePendingSubmissions() {
  const { submissions, isLoading, error, refetch } = useSubmissions({
    status: 'pending',
    includeUserProfiles: true,
  });

  // Update submission status (admin only)
  const updateSubmissionStatus = useCallback(async (
    submissionId: number,
    newStatus: 'approved' | 'rejected',
    adminId: string,
    adminNotes?: string
  ) => {
    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          status: newStatus,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          admin_notes: adminNotes || null,
        })
        .eq('id', submissionId);

      if (error) {
        console.error('Error updating submission:', error);
        throw new Error('Failed to update submission status');
      }

      // Refresh the list after update
      await refetch();
      
      return true;
    } catch (error: any) {
      console.error('Error updating submission:', error);
      Alert.alert('Error', 'Failed to update submission');
      return false;
    }
  }, [refetch]);

  return {
    pendingSubmissions: submissions,
    isLoading,
    error,
    refetch,
    updateSubmissionStatus,
  };
}

// Hook specifically for admin pending submissions pagination
// Uses Supabase `range()` to avoid loading the entire pending list at once.
export function usePendingSubmissionsPaginated(pageSize: number = 5) {
  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPendingCount, setTotalPendingCount] = useState<number | null>(null);

  const PENDING_SELECT = `*, profiles:user_id (username, full_name)`;

  const fetchTotalPendingCount = useCallback(async () => {
    const { count, error: countError } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (countError) {
      throw new Error(countError.message || 'Failed to fetch pending submissions count');
    }

    setTotalPendingCount(count ?? 0);
  }, []);

  const loadPage = useCallback(
    async (pageIndex: number, mode: 'initial' | 'refresh' | 'more') => {
      const from = pageIndex * pageSize;
      const to = from + pageSize - 1;

      const query = supabase
        .from('submissions')
        .select(PENDING_SELECT)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error: fetchError } = await query;
      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch pending submissions');
      }

      const page = data || [];

      if (mode === 'more') {
        setPendingSubmissions((prev) => [...prev, ...page]);
      } else {
        setPendingSubmissions(page);
      }

      setHasMore(page.length === pageSize);
      setError(null);
    },
    [pageSize]
  );

  const refresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setHasMore(true);
      await Promise.all([fetchTotalPendingCount(), loadPage(0, 'refresh')]);
    } catch (err: any) {
      console.error('Error refreshing pending submissions:', err);
      setError(err?.message || 'Failed to refresh pending submissions');
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchTotalPendingCount, loadPage]);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        setIsLoadingInitial(true);
        setError(null);
        setHasMore(true);

        await Promise.all([fetchTotalPendingCount(), loadPage(0, 'initial')]);
      } catch (err: any) {
        console.error('Error loading pending submissions:', err);
        if (!mounted) return;
        setError(err?.message || 'Failed to load pending submissions');
      } finally {
        if (!mounted) return;
        setIsLoadingInitial(false);
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [fetchTotalPendingCount, loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    try {
      setIsLoadingMore(true);
      const nextPageIndex = Math.floor(pendingSubmissions.length / pageSize);
      await loadPage(nextPageIndex, 'more');
    } catch (err: any) {
      console.error('Error loading more pending submissions:', err);
      setError(err?.message || 'Failed to load more pending submissions');
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, loadPage, pageSize, pendingSubmissions.length]);

  // Update submission status (admin only)
  const updateSubmissionStatus = useCallback(
    async (
      submissionId: number,
      newStatus: 'approved' | 'rejected',
      adminId: string,
      adminNotes?: string
    ) => {
      try {
        const { error: updateError } = await supabase
          .from('submissions')
          .update({
            status: newStatus,
            reviewed_by: adminId,
            reviewed_at: new Date().toISOString(),
            admin_notes: adminNotes || null,
          })
          .eq('id', submissionId);

        if (updateError) {
          console.error('Error updating submission:', updateError);
          throw new Error('Failed to update submission status');
        }

        // Refresh the first page (handles removal from pending list)
        await refresh();

        return true;
      } catch (err: any) {
        console.error('Error updating submission:', err);
        Alert.alert('Error', 'Failed to update submission');
        return false;
      }
    },
    [refresh]
  );

  return {
    pendingSubmissions,
    totalPendingCount,
    isLoading: isLoadingInitial,
    isRefreshing,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    updateSubmissionStatus,
  };
}

// Hook specifically for admin pending submissions count (fast; avoids fetching full list)
export function usePendingSubmissionsCount() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCount = useCallback(async () => {
    setError(null);
    const { count, error: countError } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (countError) {
      throw new Error(countError.message || 'Failed to fetch pending submissions count');
    }

    setPendingCount(count ?? 0);
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setIsLoading(true);
        await fetchCount();
      } catch (err: any) {
        console.error('Error fetching pending submissions count:', err);
        if (!mounted) return;
        setError(err?.message || 'Failed to fetch pending submissions count');
      } finally {
        if (!mounted) return;
        setIsLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [fetchCount]);

  return {
    pendingCount,
    isLoading,
    error,
    refetch: fetchCount,
  };
}

// Hook for submission statistics (can be used for dashboards)
export function useSubmissionStats(userId?: string) {
  const { submissions, isLoading, error } = useSubmissions({
    userId,
    status: 'all',
    includeUserProfiles: false,
  });

  const stats = {
    total: submissions.length,
    approved: submissions.filter(s => s.status === 'approved').length,
    pending: submissions.filter(s => s.status === 'pending').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
    byCategory: {
      cafe: submissions.filter(s => s.partner_store_category === 'cafe').length,
      restaurant: submissions.filter(s => s.partner_store_category === 'restaurant').length,
      others: submissions.filter(s => s.partner_store_category === 'others').length,
    },
  };

  return {
    stats,
    isLoading,
    error,
  };
}