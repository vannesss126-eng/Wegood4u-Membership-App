-- Migration: Add restrictive RLS policy to limit submissions to 10 per day per user (UTC-based)
-- This policy is restrictive and combines with the existing permissive "Members can create submissions" policy
-- to enforce the daily quota at the database level.

CREATE POLICY "Limit submissions to 20 per day (UTC)"
ON public.submissions
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    SELECT COUNT(*)
    FROM public.submissions s
    WHERE s.user_id = auth.uid()
      AND (timezone('UTC', s.created_at))::date = (timezone('UTC', now()))::date
  ) < 20
);