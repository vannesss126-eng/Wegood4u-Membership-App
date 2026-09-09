-- 20260903140000_seed_vendor_test_accounts.sql
--
-- Seeds the Vendors web app with TEST data (requested by supervisor, 2026-09-03):
--   • 3 login accounts, emails PRE-CONFIRMED, password '@Saysheji5432':
--       stellatan@wegood4u.com     — vendors — "Malaysia mock"  → 3 Malaysia stores
--       intern1saysheji@gmail.com  — vendors — "Thailand mock"  → 3 Thailand stores
--       christine@saysheji.com     — admin   — "admin Christine"→ all stores (super-view)
--   • 6 partner stores (3 MY / 3 TH) + settings (enrolled 2026-05-01).
--   • 20 mock CUSTOMER accounts (MY + TH pools) with real dob/gender/city so the
--     demographics populate (they never log in → no auth.identities).
--   • ~15 approved submissions per store (May–Aug 2026), amounts in each store's
--     price range, in the store's own currency, with repeat visitors for loyalty.
--   • partner_stores.currency column (the 6 seeded stores set explicitly MYR/THB).
--     A follow-up migration backfills currency for ALL stores by country.
--
-- Notes / delicate bits
-- ---------------------
--   • auth.users + auth.identities are seeded directly. GoTrue is picky: token
--     columns are set to '' (not null), identities carry provider_id + sub.
--     VERIFY BY LOGGING IN as each of the 3 accounts after push.
--   • bcrypt via extensions.crypt / extensions.gen_salt (pgcrypto lives in the
--     'extensions' schema on Supabase).
--   • handle_new_user() auto-creates each profile (role hardcoded 'subscriber');
--     we then promote roles past prevent_role_escalation via the sanctioned
--     transaction-local flag app.role_change_ok (see 20260619140000 / 20260903120000).
--   • Submission user-triggers are DISABLED during the bulk insert so the seed
--     doesn't fan out 90× admin notifications or award stars to mock customers.
--
-- VERIFY (after push):
--   select u.email, p.role, u.email_confirmed_at is not null as confirmed
--     from auth.users u join public.profiles p on p.id=u.id
--    where u.email in ('stellatan@wegood4u.com','christine@saysheji.com','intern1saysheji@gmail.com');
--   select partner_store_id, count(*) from public.submissions
--    where partner_store_id in ('mee-rebus-haji-wajid','fatt-kee-roast-fish','sunsan-bake',
--          'kanom-jeen-san-pa-khoi','forest-bake','ohkajhu-sansai') group by 1;

begin;

-- ============================================================ A0. currency column
alter table public.partner_stores add column if not exists currency text not null default 'MYR';

-- ============================================================ A1. stores + settings
insert into public.partner_stores
  (id, name, type, city, address, rating, image, phone, hours, description, price_range, days, active, currency)
values
  ('mee-rebus-haji-wajid','Mee Rebus Haji Wajid','restaurant','Kuala Lumpur',
   'Kampung Baru, 50300 Kuala Lumpur',4.60,null,'+60 3-2691 2233','Daily 07:00–15:00',
   'Kampung Baru institution famed for its mee rebus, nasi lemak and teh tarik.','RM 12 – 25','Mon – Sun',true,'MYR'),
  ('fatt-kee-roast-fish','Fatt Kee Roast Fish','restaurant','Kuala Lumpur',
   'Jalan Pudu, 55100 Kuala Lumpur',4.50,null,'+60 3-2141 8080','Daily 17:00–23:30',
   'Charcoal-grilled tilapia and zi-char classics, a Pudu late-night favourite.','RM 40 – 100','Mon – Sun',true,'MYR'),
  ('sunsan-bake','Sunsan Bake','cafe','Petaling Jaya',
   'Damansara Uptown, 47400 Petaling Jaya, Selangor',4.70,null,'+60 3-7728 5561','Tue–Sun 10:00–19:00',
   'Artisanal bakery and coffee bar — sourdough, cruffins and seasonal tarts.','RM 25 – 55','Tue – Sun',true,'MYR'),
  ('kanom-jeen-san-pa-khoi','Kanom Jeen San Pa Khoi','restaurant','Chiang Mai',
   'San Pa Khoi, Mueang Chiang Mai District, Chiang Mai 50000',4.40,null,'+66 53 247 001','Daily 08:00–16:00',
   'Long-running kanom jeen (rice-noodle) shop with northern Thai curries.','฿40 – 100','Mon – Sun',true,'THB'),
  ('forest-bake','Forest Bake','cafe','Chiang Mai',
   'Nimmanhaemin Rd, Su Thep, Mueang Chiang Mai District, Chiang Mai 50200',4.80,null,'+66 88 251 4400','Wed–Mon 10:00–18:00',
   'Cottage-style bakery cafe known for cakes, pies and forest-themed interiors.','฿120 – 350','Wed – Mon',true,'THB'),
  ('ohkajhu-sansai','Ohkajhu Organic Farm Sansai','others','Chiang Mai',
   'San Sai, San Sai District, Chiang Mai 50210',4.60,null,'+66 52 000 733','Daily 10:00–21:00',
   'Farm-to-table organic restaurant — its own-grown salads, grills and juices.','฿200 – 400','Mon – Sun',true,'THB')
on conflict (id) do nothing;

insert into public.partner_store_settings (partner_store_id, per_visit_fee, active, enrolled_at)
values
  ('mee-rebus-haji-wajid',  3.00, true, '2026-05-01T00:00:00+08'),
  ('fatt-kee-roast-fish',   3.00, true, '2026-05-01T00:00:00+08'),
  ('sunsan-bake',           3.00, true, '2026-05-01T00:00:00+08'),
  ('kanom-jeen-san-pa-khoi',10.00,true, '2026-05-01T00:00:00+08'),
  ('forest-bake',           10.00,true, '2026-05-01T00:00:00+08'),
  ('ohkajhu-sansai',        10.00,true, '2026-05-01T00:00:00+08')
on conflict (partner_store_id) do nothing;

-- ============================================================ A2. login accounts
create temporary table _seed_login (id uuid, email text, username text, role text) on commit drop;
insert into _seed_login values
  ('a0000000-0000-4000-a000-000000000001','stellatan@wegood4u.com',   'Malaysia mock',   'vendors'),
  ('a0000000-0000-4000-a000-000000000002','christine@saysheji.com',   'admin Christine', 'admin'),
  ('a0000000-0000-4000-a000-000000000003','intern1saysheji@gmail.com','Thailand mock',   'vendors');

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
   confirmation_token, recovery_token, email_change_token_new, email_change)
select
  '00000000-0000-0000-0000-000000000000', l.id, 'authenticated', 'authenticated',
  l.email, extensions.crypt('@Saysheji5432', extensions.gen_salt('bf')), now(),
  now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('username', l.username),
  '', '', '', ''
from _seed_login l
on conflict (id) do nothing;

-- identities — required for email/password login in current GoTrue.
insert into auth.identities
  (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
select
  gen_random_uuid(), l.id, l.id::text,
  jsonb_build_object('sub', l.id::text, 'email', l.email),
  'email', now(), now(), now()
from _seed_login l
on conflict do nothing;

-- ============================================================ A3. promote roles
select set_config('app.role_change_ok', '1', true);   -- transaction-local escape hatch
update public.profiles p
   set role = l.role::public.user_role, updated_at = now()
  from _seed_login l
 where p.id = l.id;

-- ============================================================ A4. partner_accounts
insert into public.partner_accounts (user_id, partner_store_id, role)
select l.id, s.id, 'owner'
from _seed_login l
join public.partner_stores s
  on ( (l.email = 'stellatan@wegood4u.com'    and s.id in ('mee-rebus-haji-wajid','fatt-kee-roast-fish','sunsan-bake'))
    or (l.email = 'intern1saysheji@gmail.com' and s.id in ('kanom-jeen-san-pa-khoi','forest-bake','ohkajhu-sansai')) )
on conflict do nothing;

-- ============================================================ A5. mock customers
create temporary table _seed_cust
  (id uuid, username text, full_name text, dob date, gender text, city text, country text, pool text)
  on commit drop;
insert into _seed_cust values
  ('c1000000-0000-4000-a000-000000000001','wg_my_01','Aisyah Rahman','1996-04-12','female','Kuala Lumpur','Malaysia','MY'),
  ('c1000000-0000-4000-a000-000000000002','wg_my_02','Daniel Tan',   '1989-11-03','male',  'Petaling Jaya','Malaysia','MY'),
  ('c1000000-0000-4000-a000-000000000003','wg_my_03','Nurul Huda',   '2001-07-21','female','Shah Alam','Malaysia','MY'),
  ('c1000000-0000-4000-a000-000000000004','wg_my_04','Wei Jie Lim',  '1994-02-15','male',  'Cheras','Malaysia','MY'),
  ('c1000000-0000-4000-a000-000000000005','wg_my_05','Priya Nair',   '1985-09-30','female','Subang Jaya','Malaysia','MY'),
  ('c1000000-0000-4000-a000-000000000006','wg_my_06','Farid Azman',  '1978-06-08','male',  'Klang','Malaysia','MY'),
  ('c1000000-0000-4000-a000-000000000007','wg_my_07','Chloe Wong',   '2003-12-19','other', 'Puchong','Malaysia','MY'),
  ('c1000000-0000-4000-a000-000000000008','wg_my_08','Iskandar Yusof','1992-03-25','male', 'Ampang','Malaysia','MY'),
  ('c1000000-0000-4000-a000-000000000009','wg_my_09','Mei Ling Chong','1999-08-14','female','Kuala Lumpur','Malaysia','MY'),
  ('c1000000-0000-4000-a000-000000000010','wg_my_10','Ravi Kumar',   '1974-01-05','male',  'Petaling Jaya','Malaysia','MY'),
  ('c2000000-0000-4000-a000-000000000001','wg_th_01','Somchai Prasert','1990-05-10','male', 'Chiang Mai','Thailand','TH'),
  ('c2000000-0000-4000-a000-000000000002','wg_th_02','Nattaya Suwan','1997-10-02','female','Chiang Mai','Thailand','TH'),
  ('c2000000-0000-4000-a000-000000000003','wg_th_03','Kittipong Sri','1983-03-18','male',  'Bangkok','Thailand','TH'),
  ('c2000000-0000-4000-a000-000000000004','wg_th_04','Pimchanok Chai','2002-01-27','female','Chiang Rai','Thailand','TH'),
  ('c2000000-0000-4000-a000-000000000005','wg_th_05','Anan Wattana', '1979-07-11','male',  'Lampang','Thailand','TH'),
  ('c2000000-0000-4000-a000-000000000006','wg_th_06','Suda Meesuk',  '1994-09-06','female','Nonthaburi','Thailand','TH'),
  ('c2000000-0000-4000-a000-000000000007','wg_th_07','Thanapon Rat', '2000-04-22','other', 'Chiang Mai','Thailand','TH'),
  ('c2000000-0000-4000-a000-000000000008','wg_th_08','Wanida Boon',  '1987-12-13','female','Bangkok','Thailand','TH'),
  ('c2000000-0000-4000-a000-000000000009','wg_th_09','Chaiwat Piti', '1995-06-29','male',  'Chiang Mai','Thailand','TH'),
  ('c2000000-0000-4000-a000-000000000010','wg_th_10','Ratana Kul',   '1972-02-08','female','Chiang Rai','Thailand','TH');

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
   confirmation_token, recovery_token, email_change_token_new, email_change)
select
  '00000000-0000-0000-0000-000000000000', c.id, 'authenticated', 'authenticated',
  c.username || '@seed.wegood4u.com',
  extensions.crypt('seed-no-login-' || c.username, extensions.gen_salt('bf')), now(),
  now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('username', c.username, 'full_name', c.full_name,
                     'dob', to_char(c.dob,'YYYY-MM-DD'), 'gender', c.gender),
  '', '', '', ''
from _seed_cust c
on conflict (id) do nothing;

-- handle_new_user() set username/full_name/dob/gender; set the rest here.
update public.profiles p
   set city = c.city, country_of_residence = c.country, updated_at = now()
  from _seed_cust c
 where p.id = c.id;

-- ============================================================ A6. submissions
create temporary table _seed_stores
  (store_id text, name text, category text, currency text, price_min numeric, price_max numeric, pool text, ord int)
  on commit drop;
insert into _seed_stores values
  ('mee-rebus-haji-wajid','Mee Rebus Haji Wajid','restaurant','MYR', 12, 25,'MY',1),
  ('fatt-kee-roast-fish','Fatt Kee Roast Fish','restaurant','MYR', 40,100,'MY',2),
  ('sunsan-bake','Sunsan Bake','cafe','MYR', 25, 55,'MY',3),
  ('kanom-jeen-san-pa-khoi','Kanom Jeen San Pa Khoi','restaurant','THB', 40,100,'TH',4),
  ('forest-bake','Forest Bake','cafe','THB',120,350,'TH',5),
  ('ohkajhu-sansai','Ohkajhu Organic Farm Sansai','others','THB',200,400,'TH',6);

-- Don't fan out notifications / award stars for synthetic rows.
alter table public.submissions disable trigger user;

do $$
declare
  s          record;
  cust_ids   uuid[];
  n_cust     int;
  i          int;
  pick       int;
  cust_id    uuid;
  ts         timestamptz;
  amt        numeric;
  n_per      int := 15;
  placeholder text := 'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/others/default.png';
begin
  perform setseed(0.42);
  for s in select * from _seed_stores order by ord loop
    select array_agg(id order by id) into cust_ids from _seed_cust where pool = s.pool;
    n_cust := coalesce(array_length(cust_ids, 1), 0);
    continue when n_cust = 0;
    for i in 1..n_per loop
      -- cycle through the first ~7 customers so some repeat -> returning/loyal tiers
      pick    := 1 + ((i * 3 + s.ord) % least(7, n_cust));
      cust_id := cust_ids[pick];
      ts := timestamptz '2026-05-01 09:00:00+08'
            + ((i + s.ord) % 4)              * interval '1 month'
            + (floor(random() * 27))::int    * interval '1 day'
            + (floor(random() * 11))::int    * interval '1 hour'
            + (floor(random() * 60))::int    * interval '1 minute';
      amt := round((s.price_min + random() * (s.price_max - s.price_min))::numeric, 2);
      insert into public.submissions
        (user_id, partner_store_name, partner_store_category, status, selfie_url, receipt_url,
         created_at, updated_at, receipt_date, total_amount, currency, merchant_name, partner_store_id)
      values
        (cust_id, s.name, s.category::public.store_category, 'approved'::public.submission_status,
         placeholder, placeholder, ts, ts, ts::date, amt, s.currency, s.name, s.store_id);
    end loop;
  end loop;
end $$;

alter table public.submissions enable trigger user;

commit;
