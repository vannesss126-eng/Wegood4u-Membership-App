-- ============================================================================
-- Security hardening — Phase 2C: lock down review-submission + abuse ceiling
-- Plan: .claude/plans/good-day-i-want-rustling-haven.md
--
-- (F6) review-submission has no auth and its trigger sent no secret, so it was
-- invocable by anyone. We add a shared secret: the trigger reads it from Supabase
-- Vault and sends it as x-webhook-secret; the edge fn rejects mismatches (it
-- enforces only when its WEBHOOK_SECRET env is set — see manual steps below).
--
-- (F12) Re-add a GENEROUS daily abuse ceiling purely as a cost backstop (the AI
-- vision call is metered) — NOT a product limit. The diner cap + AI review still
-- handle reward fairness.
--
-- MANUAL STEPS (do these BEFORE/ALONGSIDE deploying, in order):
--   1. Create the Vault secret (SQL editor), with a strong random value:
--        select vault.create_secret('<STRONG_RANDOM>', 'review_submission_webhook_secret');
--   2. Set the same value on the edge function:
--        supabase secrets set WEBHOOK_SECRET='<STRONG_RANDOM>'
--   3. Deploy the updated review-submission edge function.
--   4. Apply this migration (updates the trigger to send the secret).
-- ============================================================================

begin;

-- F6: trigger now reads the shared secret from Vault and forwards it.
create or replace function public.trigger_ai_review_submission()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_function_url text := 'https://dimpgwotujtaacoajisn.supabase.co/functions/v1/review-submission';
  v_secret text;
begin
  -- Read the shared secret from Vault. Authenticated users cannot read Vault;
  -- this function runs as its owner (postgres). Tolerate absence so review still
  -- fires during initial rollout (the edge fn enforces only when configured).
  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'review_submission_webhook_secret'
    limit 1;
  exception when others then
    v_secret := null;
  end;

  perform net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object('submission_id', new.id)
  );
  return new;
exception when others then
  -- Never block the INSERT on webhook-delivery failures.
  raise warning 'AI review trigger failed for submission %: %', new.id, sqlerrm;
  return new;
end;
$$;

-- F12: generous daily abuse ceiling (cost backstop, not a product limit).
-- RESTRICTIVE → ANDs with the permissive "Members can create submissions".
drop policy if exists "Daily submission abuse ceiling" on public.submissions;
create policy "Daily submission abuse ceiling"
  on public.submissions
  as restrictive
  for insert to authenticated
  with check (public.user_daily_submission_count(auth.uid()) < 40);

commit;
