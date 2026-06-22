-- ============================================================================
-- Security hardening — Phase 2A: server-side profile creation (F3)
-- Plan: .claude/plans/good-day-i-want-rustling-haven.md
--
-- The anon policy "Anon can manage profiles at signup" (USING(true)
-- WITH CHECK(true)) existed only because the client wrote the profile row while
-- still anon during the email-confirm signup flow. We move ALL of that into the
-- handle_new_user trigger (which already created the row) — now it also persists
-- full_name and resolves inviter_id / referred_by_store_id from signup metadata,
-- server-side and tamper-resistant — then drop the skeleton-key policy.
--
-- Deploy AFTER the matching client change (AuthContext.tsx stops writing profiles
-- and passes referral_code + outlet_ref via signUp metadata).
-- ============================================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code   text := nullif(btrim(new.raw_user_meta_data ->> 'referral_code'), '');
  v_outlet text := nullif(btrim(new.raw_user_meta_data ->> 'outlet_ref'), '');
  v_inviter_id uuid;
  v_store_id   text;
  v_kind text;
  v_uid  uuid;
  v_sid  text;
begin
  -- Resolve the "Invitation Code" field (may be a USER code or a STORE code).
  -- Wrapped so a referral hiccup can never block account creation.
  if v_code is not null then
    begin
      select kind, user_id, partner_store_id
        into v_kind, v_uid, v_sid
        from public.resolve_referral_code(v_code) limit 1;
      if v_kind = 'user' then
        v_inviter_id := v_uid;
      elsif v_kind = 'store' then
        v_store_id := v_sid;
      end if;
    exception when others then
      null; -- attribution is best-effort
    end;
  end if;

  -- A QR/deep-link outlet ref attributes the signup to a store and takes
  -- precedence over a store code typed in the invitation field. Unknown ref is
  -- ignored (must never block signup).
  if v_outlet is not null then
    begin
      select kind, partner_store_id
        into v_kind, v_sid
        from public.resolve_referral_code(v_outlet) limit 1;
      if v_kind = 'store' then
        v_store_id := v_sid;
      end if;
    exception when others then
      null;
    end;
  end if;

  insert into public.profiles (
    id, username, full_name, role, dob, gender, avatar_url,
    inviter_id, referred_by_store_id
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name',
    'subscriber',
    nullif(new.raw_user_meta_data ->> 'dob', '')::date,
    new.raw_user_meta_data ->> 'gender',
    'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/others/default.png',
    v_inviter_id,
    v_store_id
  );

  return new;
end;
$$;

-- Trigger fn runs as owner; no client EXECUTE needed (re-asserted from Phase 1).
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- F3: the client no longer touches profiles, so anon needs no access at all.
drop policy if exists "Anon can manage profiles at signup" on public.profiles;

commit;
