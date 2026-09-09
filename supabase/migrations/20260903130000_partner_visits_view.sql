-- partner_visits_view — PII-stripped, per-store-scoped visit source for the Vendors app.
--
-- Plan:   .claude/plans/01_09_vendors-partner-visits-view.plan.md
-- Guards: reviewed with supabase-analyst + supabase-rls-guard (2026-09-03).
--
-- WHY A DEFINER VIEW (not security_invoker):
--   Partners/admins have NO RLS SELECT grant on other users' submissions/profiles, so a
--   security_invoker view would return ZERO rows for them. This view therefore runs as its
--   owner (postgres) — exactly like public.referral_tree in 20260620100000_security_hardening_views.sql
--   — and contains the cross-user exposure with an in-body predicate:
--       is_partner_for_store(store)  OR  is_admin(auth.uid())
--   A partner sees only their own store's rows; an admin sees every store's. auth.uid()
--   resolves per-request under PostgREST even in a definer view, so the predicate gates
--   the REAL caller, not the owner. DO NOT convert this to security_invoker.
--
-- PII RULE: project ONLY anonymised attributes. NEVER add user_id / username / full_name /
--   email / phone / selfie_url / receipt_url / merchant refs. A future `select s.*` would
--   re-expose PII — keep the projection explicit.
--
-- Dependencies verified present in the remote schema (20260604102515_remote_schema.sql):
--   public.is_admin(uuid), public.is_partner_for_store(text), submissions(id, user_id,
--   partner_store_id, created_at, total_amount, status), profiles(id, dob, gender,
--   country_of_residence, role). submission_status includes 'approved'.

begin;

-- (a) Customer city — captured at mobile-app signup (nullable; existing customers have
--     none until they update their profile). Idempotent.
alter table public.profiles add column if not exists city text;

-- (b) The view. APPROVED-only rows; loyalty tier computed in-SQL from the customer's Nth
--     approved visit AT THIS store (1=new, 2=returning, 3+=loyal). age = age AT visit.
create or replace view public.partner_visits_view as
select
    s.id                                            as visit_id,
    s.partner_store_id                              as partner_store_id,
    s.created_at                                    as visited_at,
    case when p.dob is not null
         then extract(year from age(s.created_at::date, p.dob))::int end
                                                    as age,
    p.gender                                        as gender,
    p.city                                          as city,
    p.country_of_residence                          as country,
    s.total_amount                                  as total_amount,
    s.status::text                                  as status,
    case row_number() over (
           partition by s.user_id, s.partner_store_id
           order by s.created_at, s.id)
        when 1 then 'new'
        when 2 then 'returning'
        else 'loyal'
    end                                             as loyalty_tier
from public.submissions s
join public.profiles p on p.id = s.user_id
where s.partner_store_id is not null
  and s.status = 'approved'
  and ( public.is_partner_for_store(s.partner_store_id)
        or (select public.is_admin(auth.uid())) );

alter view public.partner_visits_view owner to postgres;

-- Scoping is the security boundary (base-table RLS is bypassed by the definer view).
-- anon must NEVER read it (that was the exact bug the referral_tree hardening fixed).
revoke all on table public.partner_visits_view from anon, public;
grant  select on table public.partner_visits_view to authenticated, service_role;

commit;
