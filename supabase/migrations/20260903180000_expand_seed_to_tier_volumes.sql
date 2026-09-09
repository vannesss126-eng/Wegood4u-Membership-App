-- 20260903180000_expand_seed_to_tier_volumes.sql
--
-- Bring the 6 seeded test stores up to the per-tier submission volumes the team
-- asked for (Kasey, Saysheji IT group):
--     Starter  → ~110 approved receipts   (spec: 100–120)
--     Growth   → ~65                       (spec: 60–70)
--     Premium  → ~45                       (spec: 40+)
-- applied to BOTH countries. Also bumps the Malaysia Growth fee to RM 5.50 (spec).
--
-- Adds ~40 more mock customers per country (varied dob / gender / city) so the
-- high-volume stores have realistic demographics rather than the same 10 people.
-- Deterministic uuids (md5) + on-conflict/greatest() make this safe to re-run.
--
-- VERIFY:
--   select partner_store_id, count(*) from public.submissions
--    where partner_store_id in ('mee-rebus-haji-wajid','fatt-kee-roast-fish','sunsan-bake',
--          'kanom-jeen-san-pa-khoi','forest-bake','ohkajhu-sansai')
--      and status='approved' group by 1;

begin;

-- 1) Malaysia Growth fee → RM 5.50 (per spec). THB tiers stay 25/45/70.
update public.partner_store_settings set per_visit_fee = 5.50, updated_at = now()
 where partner_store_id = 'fatt-kee-roast-fish';

-- 2) Extra mock customers: wg_my_011..050 and wg_th_011..050 (40 per country).
do $$
declare
  v_cities_my text[] := array['Kuala Lumpur','Petaling Jaya','Shah Alam','Klang',
    'Subang Jaya','Cheras','Ampang','Puchong','Kajang','Seremban'];
  v_cities_th text[] := array['Chiang Mai','Bangkok','Chiang Rai','Lampang',
    'Nonthaburi','Phuket','Khon Kaen','Udon Thani'];
  v_genders text[] := array['male','female','female','male','other'];  -- weighted-ish
  v_pool text; v_prefix text; v_country text; v_cities text[];
  i int; v_username text; v_uid uuid; v_dob date; v_gender text; v_city text;
begin
  perform setseed(0.73);
  foreach v_pool in array array['MY','TH'] loop
    if v_pool = 'MY' then v_prefix := 'wg_my_'; v_cities := v_cities_my; v_country := 'Malaysia';
    else                  v_prefix := 'wg_th_'; v_cities := v_cities_th; v_country := 'Thailand'; end if;
    for i in 11..50 loop
      v_username := v_prefix || lpad(i::text, 3, '0');
      v_uid   := md5('wgseed:' || v_username)::uuid;
      v_dob   := date '1965-01-01' + (floor(random() * 15000))::int;             -- ~1965–2006
      v_gender := v_genders[1 + floor(random() * array_length(v_genders,1))::int];
      v_city  := v_cities[1 + floor(random() * array_length(v_cities,1))::int];
      insert into auth.users
        (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
         created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
         confirmation_token, recovery_token, email_change_token_new, email_change)
      values
        ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
         v_username || '@seed.wegood4u.com',
         extensions.crypt('seed-no-login', extensions.gen_salt('bf')), now(), now(), now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('username', v_username, 'full_name', 'Mock ' || v_username,
                            'dob', to_char(v_dob,'YYYY-MM-DD'), 'gender', v_gender),
         '', '', '', '')
      on conflict (id) do nothing;
      update public.profiles set city = v_city, country_of_residence = v_country, updated_at = now()
       where id = v_uid;
    end loop;
  end loop;
end $$;

-- 3) Top up each store's approved submissions to its tier target.
alter table public.submissions disable trigger user;

do $$
declare
  s        record;
  v_target int; v_existing int; v_toadd int;
  custs    uuid[]; ncust int;
  i int; v_cust uuid; v_ts timestamptz; v_amt numeric;
  ph text := 'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/others/default.png';
begin
  perform setseed(0.51);
  for s in
    select * from (values
      ('mee-rebus-haji-wajid','Mee Rebus Haji Wajid','restaurant','MYR', 12, 25,'MY','starter'),
      ('fatt-kee-roast-fish','Fatt Kee Roast Fish','restaurant','MYR', 40,100,'MY','growth'),
      ('sunsan-bake','Sunsan Bake','cafe','MYR', 25, 55,'MY','premium'),
      ('kanom-jeen-san-pa-khoi','Kanom Jeen San Pa Khoi','restaurant','THB', 40,100,'TH','starter'),
      ('forest-bake','Forest Bake','cafe','THB',120,350,'TH','growth'),
      ('ohkajhu-sansai','Ohkajhu Organic Farm Sansai','others','THB',200,400,'TH','premium')
    ) as t(store_id, name, category, currency, price_min, price_max, pool, tier)
  loop
    v_target := case s.tier when 'starter' then 110 when 'growth' then 65 else 45 end;
    select count(*) into v_existing
      from public.submissions where partner_store_id = s.store_id and status = 'approved';
    v_toadd := greatest(0, v_target - v_existing);

    select array_agg(id) into custs from public.profiles
     where username like (case when s.pool = 'MY' then 'wg\_my\_%' else 'wg\_th\_%' end);
    ncust := coalesce(array_length(custs, 1), 0);
    continue when ncust = 0 or v_toadd = 0;

    for i in 1..v_toadd loop
      v_cust := custs[1 + (i % ncust)];   -- cycle all ~50 customers → varied demographics + loyalty
      v_ts := timestamptz '2026-05-01 09:00:00+08'
              + (i % 4)                    * interval '1 month'
              + (floor(random() * 27))::int * interval '1 day'
              + (floor(random() * 12))::int * interval '1 hour'
              + (floor(random() * 60))::int * interval '1 minute';
      v_amt := round((s.price_min + random() * (s.price_max - s.price_min))::numeric, 2);
      insert into public.submissions
        (user_id, partner_store_name, partner_store_category, status, selfie_url, receipt_url,
         created_at, updated_at, receipt_date, total_amount, currency, merchant_name, partner_store_id)
      values
        (v_cust, s.name, s.category::public.store_category, 'approved'::public.submission_status,
         ph, ph, v_ts, v_ts, v_ts::date, v_amt, s.currency, s.name, s.store_id);
    end loop;
  end loop;
end $$;

alter table public.submissions enable trigger user;

commit;
