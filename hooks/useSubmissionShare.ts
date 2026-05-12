import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SharePlatform } from '@/lib/shareConfig';

const BUCKET = 'submission-share-screenshots';

export type ShareStatus = 'pending' | 'verified' | 'rejected';

export interface SubmissionShareRow {
  id: number;
  submission_id: number;
  user_id: string;
  platform: SharePlatform;
  post_url: string | null;
  screenshot_path: string | null;
  status: ShareStatus;
  verified_at: string | null;
  created_at: string;
}

export interface SubmitShareInput {
  postUrl: string;
  /** local file URI from expo-image-picker / camera. Optional. */
  screenshotUri?: string | null;
}

export interface UseSubmissionShareReturn {
  shares: SubmissionShareRow[];
  byPlatform: Record<SharePlatform, SubmissionShareRow | undefined>;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  submitShare: (platform: SharePlatform, input: SubmitShareInput) => Promise<SubmissionShareRow | null>;
  refresh: () => Promise<void>;
}

export function useSubmissionShare(
  userId: string | undefined,
  submissionId: number | null,
): UseSubmissionShareReturn {
  const [shares, setShares] = useState<SubmissionShareRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchShares = useCallback(async () => {
    if (!userId || !submissionId) {
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('submission_shares')
        .select('*')
        .eq('user_id', userId)
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true });
      if (fetchError) throw fetchError;
      if (mountedRef.current) setShares((data ?? []) as SubmissionShareRow[]);
    } catch (err: any) {
      console.error('[useSubmissionShare] fetch failed:', err);
      if (mountedRef.current) setError(err.message ?? 'Failed to load shares');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [userId, submissionId]);

  useEffect(() => { fetchShares(); }, [fetchShares]);

  // Realtime: catch trigger-driven status flips without re-polling.
  useEffect(() => {
    if (!userId || !submissionId) return;
    const channel = supabase
      .channel(`submission_shares:${userId}:${submissionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submission_shares',
          filter: `submission_id=eq.${submissionId}`,
        },
        () => fetchShares()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, submissionId, fetchShares]);

  const uploadScreenshot = useCallback(
    async (uri: string, platform: SharePlatform): Promise<string> => {
      if (!userId || !submissionId) throw new Error('Missing user or submission');
      const response = await fetch(uri);
      const arrayBuffer = await (response as any).arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const ts = Date.now();
      const path = `${userId}/${submissionId}/${platform}_${ts}.webp`;

      const { data, error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: 'image/webp', upsert: false });
      if (uploadError || !data) {
        throw new Error(uploadError?.message ?? 'Failed to upload screenshot');
      }
      return data.path;
    },
    [userId, submissionId],
  );

  const submitShare = useCallback(
    async (
      platform: SharePlatform,
      input: SubmitShareInput,
    ): Promise<SubmissionShareRow | null> => {
      if (!userId || !submissionId) return null;
      if (!input.postUrl?.trim()) {
        setError('Please paste the post URL');
        return null;
      }
      setIsSubmitting(true);
      try {
        setError(null);

        let screenshotPath: string | null = null;
        if (input.screenshotUri) {
          screenshotPath = await uploadScreenshot(input.screenshotUri, platform);
        }

        // Edge function does input validation + URL dedup, then writes
        // the row as status='pending'. The on_submission_share_verified
        // trigger only fires once an admin (or the future AI path) flips
        // status to 'verified'.
        const { data, error: invokeError } = await supabase.functions.invoke('verify-share', {
          body: {
            submission_id: submissionId,
            platform,
            post_url: input.postUrl.trim(),
            screenshot_path: screenshotPath,
          },
        });

        if (invokeError) throw invokeError;
        const result = data as { row?: SubmissionShareRow; error?: string };
        if (result?.error) throw new Error(result.error);

        if (mountedRef.current && result?.row) {
          setShares((prev) => {
            // Dedup by (submission_id, platform).
            const filtered = prev.filter(
              (s) => !(s.submission_id === result.row!.submission_id && s.platform === result.row!.platform),
            );
            return [...filtered, result.row!];
          });
        }
        return result?.row ?? null;
      } catch (err: any) {
        console.error('[useSubmissionShare] submit failed:', err);
        if (mountedRef.current) setError(err.message ?? 'Submission failed');
        return null;
      } finally {
        if (mountedRef.current) setIsSubmitting(false);
      }
    },
    [userId, submissionId, uploadScreenshot],
  );

  const byPlatform: Record<SharePlatform, SubmissionShareRow | undefined> = {
    facebook: shares.find((s) => s.platform === 'facebook'),
    instagram: shares.find((s) => s.platform === 'instagram'),
    tiktok: shares.find((s) => s.platform === 'tiktok'),
  };

  return {
    shares,
    byPlatform,
    isLoading,
    isSubmitting,
    error,
    submitShare,
    refresh: fetchShares,
  };
}
