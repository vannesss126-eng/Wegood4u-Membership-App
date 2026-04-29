-- Automatically invoke the `review-submission` Edge Function whenever a new
-- submission is inserted with status='pending'. Uses pg_net for async HTTP
-- so the INSERT doesn't block on the Anthropic call.

-- 1) Ensure pg_net is available. On Supabase Cloud it's usually pre-enabled;
--    this is idempotent.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Trigger function: fires an async POST to the Edge Function with the
--    submission ID. The Edge Function is deployed with --no-verify-jwt, so no
--    Authorization header is required.
CREATE OR REPLACE FUNCTION public.trigger_ai_review_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_function_url text := 'https://dimpgwotujtaacoajisn.supabase.co/functions/v1/review-submission';
BEGIN
  PERFORM net.http_post(
    url := v_function_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('submission_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the INSERT on webhook-delivery failures. The admin can
  -- manually invoke review-submission later for any row with null receipt_hash.
  RAISE WARNING 'AI review trigger failed for submission %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 3) The trigger itself: only fires on INSERT of pending submissions.
DROP TRIGGER IF EXISTS trg_ai_review_on_submission_insert ON public.submissions;

CREATE TRIGGER trg_ai_review_on_submission_insert
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.trigger_ai_review_submission();

COMMENT ON FUNCTION public.trigger_ai_review_submission() IS
  'Fires async HTTP POST to review-submission Edge Function for AI auto-review on new pending submissions.';
