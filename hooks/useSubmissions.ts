import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';
import type { 
  Submission, 
  TransformedSubmission, 
  ApprovedCounts, 
  SubmissionStats,
  UseSubmissionsOptions 
} from '@/types';

const RECEIPT_BUCKET = 'submitted-receipt';
const SELFIE_BUCKET = 'submitted-selfie';
const SIGNED_MEDIA_TTL_SECONDS = 3600;

// Receipts/selfies live in PRIVATE storage buckets; submissions.*_url columns now
// hold the object path. Resolve short-lived signed URLs for display. Legacy rows
// that still hold a full public URL (http...) are passed through unchanged.
async function signOne(bucket: string, value: string | null | undefined): Promise<string> {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(value, SIGNED_MEDIA_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.warn(`Failed to sign ${bucket} URL:`, error?.message);
    return '';
  }
  return data.signedUrl;
}

export async function signSubmissionMedia<
  T extends { receipt_url?: string | null; selfie_url?: string | null }
>(rows: T[]): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      receipt_url: await signOne(RECEIPT_BUCKET, row.receipt_url),
      selfie_url: await signOne(SELFIE_BUCKET, row.selfie_url),
    }))
  );
}

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
// Uses Supabase `range()` — one page at a time (not infinite scroll).
export function usePendingSubmissionsPaginated(pageSize: number = 3) {
  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
  const [currentPage, setCurrentPage] = useState(0); // 0-based index
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPendingCount, setTotalPendingCount] = useState<number | null>(null);

  const currentPageRef = useRef(0);
  currentPageRef.current = currentPage;

  /** Only the first bootstrap should use full-screen loading; pageSize changes use inline spinner */
  const isFirstBootstrapRef = useRef(true);

  const PENDING_SELECT = `*, profiles:user_id (username, full_name)`;

  const fetchTotalPendingCount = useCallback(async (): Promise<number> => {
    const { count, error: countError } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (countError) {
      throw new Error(countError.message || 'Failed to fetch pending submissions count');
    }

    const n = count ?? 0;
    setTotalPendingCount(n);
    return n;
  }, []);

  const loadPageForIndex = useCallback(
    async (pageIndex: number, options?: { showPageSpinner?: boolean }) => {
      const showSpinner = options?.showPageSpinner ?? false;
      if (showSpinner) setIsLoadingPage(true);

      try {
        const from = pageIndex * pageSize;
        const to = from + pageSize - 1;

        const { data, error: fetchError } = await supabase
          .from('submissions')
          .select(PENDING_SELECT)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .range(from, to);

        if (fetchError) {
          throw new Error(fetchError.message || 'Failed to fetch pending submissions');
        }

        setPendingSubmissions(await signSubmissionMedia(data || []));
        setCurrentPage(pageIndex);
        currentPageRef.current = pageIndex;
        setError(null);
      } finally {
        if (showSpinner) setIsLoadingPage(false);
      }
    },
    [pageSize]
  );

  const totalPages = useMemo(() => {
    if (totalPendingCount === null) return 1;
    if (totalPendingCount === 0) return 1;
    return Math.max(1, Math.ceil(totalPendingCount / pageSize));
  }, [totalPendingCount, pageSize]);

  const goToPage = useCallback(
    async (pageIndex: number) => {
      const count = totalPendingCount ?? 0;
      const maxPage = count === 0 ? 0 : Math.max(0, Math.ceil(count / pageSize) - 1);
      if (pageIndex < 0 || pageIndex > maxPage) return;
      await loadPageForIndex(pageIndex, { showPageSpinner: true });
    },
    [totalPendingCount, pageSize, loadPageForIndex]
  );

  const nextPage = useCallback(async () => {
    await goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(async () => {
    await goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const refresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const count = await fetchTotalPendingCount();
      const maxPage = count === 0 ? 0 : Math.max(0, Math.ceil(count / pageSize) - 1);
      const targetPage = Math.min(currentPageRef.current, maxPage);
      await loadPageForIndex(targetPage);
    } catch (err: any) {
      console.error('Error refreshing pending submissions:', err);
      setError(err?.message || 'Failed to refresh pending submissions');
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchTotalPendingCount, loadPageForIndex, pageSize]);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const showFullScreenLoader = isFirstBootstrapRef.current;
      try {
        if (showFullScreenLoader) {
          setIsLoadingInitial(true);
        }
        setError(null);
        const count = await fetchTotalPendingCount();
        if (!mounted) return;
        const maxPage = count === 0 ? 0 : Math.max(0, Math.ceil(count / pageSize) - 1);
        const startPage = Math.min(currentPageRef.current, maxPage);
        await loadPageForIndex(startPage, {
          showPageSpinner: !showFullScreenLoader,
        });
      } catch (err: any) {
        console.error('Error loading pending submissions:', err);
        if (!mounted) return;
        setError(err?.message || 'Failed to load pending submissions');
      } finally {
        if (!mounted) return;
        if (showFullScreenLoader) {
          setIsLoadingInitial(false);
          isFirstBootstrapRef.current = false;
        }
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [fetchTotalPendingCount, loadPageForIndex, pageSize]);

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
    currentPage,
    totalPages,
    isLoading: isLoadingInitial,
    isRefreshing,
    isLoadingPage,
    error,
    refresh,
    goToPage,
    nextPage,
    prevPage,
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
      bar: submissions.filter(s => s.partner_store_category === 'bar').length,
      hotel: submissions.filter(s => s.partner_store_category === 'hotel').length,
      others: submissions.filter(s => s.partner_store_category === 'others').length,
    },
  };

  return {
    stats,
    isLoading,
    error,
  };
}