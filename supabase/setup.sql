-- FitPlan cloud meal photo sync + subscriptions (Stripe)
-- Run once in Supabase Dashboard → SQL Editor. Never expose a service_role key in the client.
-- Only the subscriptions part is new; the rest is idempotent and can stay as is.

-- Stripe-Abos: Eine Zeile pro User. Der Stripe-Webhook (Netlify Function
-- stripe-webhook) schreibt hier mit service_role; Clients dürfen nur lesen.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive',
  price_id text,
  interval text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now(),
  -- Zeitstempel des letzten verarbeiteten Stripe-Events (Out-of-Order-Schutz:
  -- verspätete Retries dürfen keinen neueren Stand zurückschreiben).
  last_event_at timestamptz
);

alter table public.subscriptions enable row level security;
grant select on public.subscriptions to authenticated;
grant update on public.subscriptions to service_role;
grant all on public.subscriptions to service_role;
-- Defense in Depth: Clients dürfen Abo-Daten ausschließlich lesen (der
-- Webhook schreibt mit service_role). Auch wenn RLS bereits blockt, werden
-- Schreib-Privilegien explizit entzogen — Default-Privileges könnten sonst
-- bei Tabellenänderungen wieder aufleben.
revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke all on public.subscriptions from anon;
-- Migration für bestehende Tabellen (create table if not exists ergänzt keine Spalten).
alter table public.subscriptions add column if not exists last_event_at timestamptz;

drop policy if exists "Users read own subscription" on public.subscriptions;
create policy "Users read own subscription"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

do $$
begin
  alter publication supabase_realtime add table public.subscriptions;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Publication supabase_realtime is unavailable; enable Realtime for public.subscriptions in the Supabase Dashboard.';
end $$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint user_profile_object check (jsonb_typeof(profile_data) = 'object')
);

alter table public.user_profiles enable row level security;
grant select, insert, update, delete on public.user_profiles to authenticated;
drop policy if exists "Users read own profile" on public.user_profiles;
create policy "Users read own profile" on public.user_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users insert own profile" on public.user_profiles;
drop policy if exists "Users create own profile" on public.user_profiles;
create policy "Users insert own profile" on public.user_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own profile" on public.user_profiles;
create policy "Users update own profile" on public.user_profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users delete own profile" on public.user_profiles;
create policy "Users delete own profile" on public.user_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Geräte-Auswahl (Pro-Feature) pro Sportart, eine Zeile pro user+sport.
create table if not exists public.user_equipment (
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null,
  equipment_data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, sport),
  constraint user_equipment_sport check (sport in ('running','cycling','strength','team','combat')),
  constraint user_equipment_object check (jsonb_typeof(equipment_data) = 'array')
);

alter table public.user_equipment enable row level security;
grant select, insert, update, delete on public.user_equipment to authenticated;

drop policy if exists "Users read own equipment" on public.user_equipment;
create policy "Users read own equipment"
  on public.user_equipment for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own equipment" on public.user_equipment;
create policy "Users insert own equipment"
  on public.user_equipment for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own equipment" on public.user_equipment;
create policy "Users update own equipment"
  on public.user_equipment for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own equipment" on public.user_equipment;
create policy "Users delete own equipment"
  on public.user_equipment for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Gewichts-Verlauf, ein Eintrag pro Tag (gleicher Tag wird ersetzt).
create table if not exists public.weight_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  kg numeric(4,1) not null check (kg between 30 and 300),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_date)
);

create index if not exists weight_entries_user_date_idx
  on public.weight_entries (user_id, entry_date desc);

alter table public.weight_entries enable row level security;
grant select, insert, update, delete on public.weight_entries to authenticated;
alter table public.weight_entries replica identity full;

drop policy if exists "Users read own weight entries" on public.weight_entries;
create policy "Users read own weight entries"
  on public.weight_entries for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own weight entries" on public.weight_entries;
create policy "Users insert own weight entries"
  on public.weight_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own weight entries" on public.weight_entries;
create policy "Users update own weight entries"
  on public.weight_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own weight entries" on public.weight_entries;
create policy "Users delete own weight entries"
  on public.weight_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.day_checks (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  check_id text not null,
  is_checked boolean not null default true,
  photo_path text,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start, check_id),
  constraint day_checks_monday check (extract(isodow from week_start) = 1),
  constraint day_checks_supported_id check (check_id ~ '^d[0-6]-(workout-0|meal-[0-3])$'),
  constraint meal_requires_photo check (
    (check_id ~ '^d[0-6]-meal-[0-3]$' and (not is_checked or photo_path is not null))
    or (check_id ~ '^d[0-6]-workout-0$' and photo_path is null)
  ),
  constraint photo_path_owned check (
    photo_path is null or photo_path like (user_id::text || '/%')
  )
);

create index if not exists day_checks_user_week_idx
  on public.day_checks (user_id, week_start desc);

alter table public.day_checks enable row level security;
grant select, insert, update, delete on public.day_checks to authenticated;
alter table public.day_checks replica identity full;

drop policy if exists "Users read own day checks" on public.day_checks;
create policy "Users read own day checks"
  on public.day_checks for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users create own day checks" on public.day_checks;
create policy "Users create own day checks"
  on public.day_checks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      (check_id ~ '^d[0-6]-meal-[0-3]$' and is_checked and photo_path like (user_id::text || '/%'))
      or (check_id ~ '^d[0-6]-workout-0$' and photo_path is null)
    )
  );

drop policy if exists "Users update own day checks" on public.day_checks;
create policy "Users update own day checks"
  on public.day_checks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      (check_id ~ '^d[0-6]-meal-[0-3]$' and is_checked and photo_path like (user_id::text || '/%'))
      or (check_id ~ '^d[0-6]-workout-0$' and photo_path is null)
    )
  );

drop policy if exists "Users delete own day checks" on public.day_checks;
create policy "Users delete own day checks"
  on public.day_checks for delete to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fitplan-meal-photos', 'fitplan-meal-photos', false, 8388608, array['image/jpeg']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg']::text[];

drop policy if exists "Users read own meal photos" on storage.objects;
create policy "Users read own meal photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'fitplan-meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users upload own meal photos" on storage.objects;
create policy "Users upload own meal photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fitplan-meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) = 'jpg'
  );

drop policy if exists "Users delete own meal photos" on storage.objects;
create policy "Users delete own meal photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'fitplan-meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

do $$
begin
  alter publication supabase_realtime add table public.day_checks;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Publication supabase_realtime is unavailable; enable Realtime for public.day_checks and public.user_profiles in the Supabase Dashboard.';
end $$;

do $$
begin
  alter publication supabase_realtime add table public.user_profiles;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Publication supabase_realtime is unavailable; enable Realtime for public.user_profiles in the Supabase Dashboard.';
end $$;

do $$
begin
  alter publication supabase_realtime add table public.user_equipment;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Publication supabase_realtime is unavailable; enable Realtime for public.user_equipment in the Supabase Dashboard.';
end $$;

do $$
begin
  alter publication supabase_realtime add table public.weight_entries;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Publication supabase_realtime is unavailable; enable Realtime for public.weight_entries in the Supabase Dashboard.';
end $$;
