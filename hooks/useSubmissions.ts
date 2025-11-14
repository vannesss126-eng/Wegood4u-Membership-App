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
    others: approvedSubmissions.filter(s => !['restaurant', 'cafe'].includes(s.category)).length,
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