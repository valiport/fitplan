-- ============================================================
-- Sammlungs-System: Gewichtsplatten, Coins, Trades, Marktplatz
-- Idempotent — im Supabase-Dashboard (SQL Editor) NACH setup.sql ausführen.
-- ============================================================

-- Wallet + Inventar (eine Zeile pro User; inventory = plateId → Stückzahl)
create table if not exists public.collections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  inventory jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint collections_inventory_object check (jsonb_typeof(inventory) = 'object')
);

alter table public.collections enable row level security;
revoke insert, update, delete on public.collections from authenticated;
grant select on public.collections to authenticated;
grant all on public.collections to service_role;

drop policy if exists "Users read own collection" on public.collections;
create policy "Users read own collection"
  on public.collections for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users insert own collection" on public.collections;
drop policy if exists "Users update own collection" on public.collections;
drop policy if exists "Users manage own collection" on public.collections;

-- Freundschaften: pending/accepted, alphabetisch sortierte Paare
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id_a uuid not null references auth.users(id) on delete cascade,
  user_id_b uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  constraint friends_ordered check (user_id_a < user_id_b),
  constraint friends_not_self check (user_id_a <> user_id_b),
  constraint friends_unique unique (user_id_a, user_id_b)
);

-- Migration from earlier draft: preserve existing accepted pairs; no direct
-- client writes are permitted (all requests go through the RPCs below).
alter table public.friends add column if not exists requested_by uuid references auth.users(id) on delete cascade;
update public.friends set requested_by = user_id_a where requested_by is null;
alter table public.friends alter column requested_by set not null;

alter table public.friends enable row level security;
revoke insert, update, delete on public.friends from authenticated;
grant select on public.friends to authenticated;

drop policy if exists "Users read own friendships" on public.friends;
create policy "Users read own friendships"
  on public.friends for select to authenticated
  using ((select auth.uid()) in (user_id_a, user_id_b));
drop policy if exists "Users create friendship requests" on public.friends;
drop policy if exists "Users update own friendships" on public.friends;
drop policy if exists "Users delete own friendships" on public.friends;

-- An accepted friend may see only profile rows connected by an accepted pair.
drop policy if exists "Users read accepted friends profiles" on public.user_profiles;
create policy "Users read accepted friends profiles" on public.user_profiles
  for select to authenticated using (
    exists (select 1 from public.friends f
      where f.status = 'accepted'
        and user_profiles.user_id in (f.user_id_a, f.user_id_b)
        and (select auth.uid()) in (f.user_id_a, f.user_id_b))
  );

-- Tausch-Angebote (beidseitige Bestätigung)
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  offered_items jsonb not null,
  requested_items jsonb not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trades_items_object check (jsonb_typeof(offered_items) = 'object' and jsonb_typeof(requested_items) = 'object'),
  constraint trades_not_self check (from_user_id <> to_user_id)
);

create index if not exists trades_from_idx on public.trades (from_user_id, created_at desc);
create index if not exists trades_to_idx on public.trades (to_user_id, created_at desc);

alter table public.trades enable row level security;
revoke insert, update, delete on public.trades from authenticated;
grant select on public.trades to authenticated;

drop policy if exists "Users read involved trades" on public.trades;
create policy "Users read involved trades"
  on public.trades for select to authenticated
  using ((select auth.uid()) in (from_user_id, to_user_id));
drop policy if exists "Users create own trades" on public.trades;

-- Marktplatz-Angebote
create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  plate_id text not null,
  price integer not null check (price > 0),
  status text not null default 'active' check (status in ('active','sold','removed')),
  created_at timestamptz not null default now()
);

create index if not exists market_listings_active_idx on public.market_listings (status, created_at desc);

alter table public.market_listings enable row level security;
revoke insert, update, delete on public.market_listings from authenticated;
grant select on public.market_listings to authenticated;

drop policy if exists "Anyone signed-in reads listings" on public.market_listings;
create policy "Anyone signed-in reads listings"
  on public.market_listings for select to authenticated
  using (true);
drop policy if exists "Users create own listings" on public.market_listings;
drop policy if exists "Users manage own listings" on public.market_listings;
drop policy if exists "Users delete own listings" on public.market_listings;

-- Markt-Transaktionen (unveränderliche Historie)
create table if not exists public.market_transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  plate_id text not null,
  price integer not null,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists market_tx_buyer_idx on public.market_transactions (buyer_id, created_at desc);
create index if not exists market_tx_seller_idx on public.market_transactions (seller_id, created_at desc);

alter table public.market_transactions enable row level security;
revoke insert, update, delete on public.market_transactions from authenticated;
grant select on public.market_transactions to authenticated;

drop policy if exists "Users read own transactions" on public.market_transactions;
create policy "Users read own transactions"
  on public.market_transactions for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

-- One-time rewards prevent re-toggle/reload farming. Claims are immutable
-- audit records; only the authenticated owner can read their own.
create table if not exists public.collection_reward_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  check_id text not null,
  plate_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start, check_id)
);
alter table public.collection_reward_claims enable row level security;
revoke insert, update, delete on public.collection_reward_claims from authenticated;
grant select on public.collection_reward_claims to authenticated;
drop policy if exists "Users read own collection reward claims" on public.collection_reward_claims;
create policy "Users read own collection reward claims"
  on public.collection_reward_claims for select to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================
-- Atomare RPC-Funktionen (security definer; prüfen alles serverseitig)
-- ============================================================

-- Inventar-Wert lesen (0, falls Schlüssel fehlt)
create or replace function public.inv_get(inv jsonb, plate text)
returns integer language sql immutable as $$
  select coalesce((inv ->> plate)::int, 0)
$$;

-- Inventar-Wert setzen (0 = Schlüssel entfernen)
create or replace function public.inv_set(inv jsonb, plate text, qty int)
returns jsonb language sql immutable as $$
  case
    when qty <= 0 then coalesce(inv - plate, '{}'::jsonb)
    else jsonb_set(coalesce(inv, '{}'::jsonb), array[plate], to_jsonb(qty), true)
  end
$$;

-- Tausch erstellen: Freundesprüfung + Angebots-Bestandsprüfung
create or replace function public.create_trade(p_to uuid, p_offered jsonb, p_requested jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_inv jsonb;
  v_plate text;
  v_qty int;
  v_id uuid;
begin
  if v_me is null then raise exception 'Nicht angemeldet.'; end if;
  if p_to is null or p_to = v_me then
    raise exception 'Ungültiger Tauschpartner.';
  end if;
  if not exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and (f.user_id_a, f.user_id_b) in ((v_me, p_to), (p_to, v_me))
  ) then
    raise exception 'Ihr seid keine Freunde.';
  end if;
  if jsonb_typeof(p_offered) <> 'object' or jsonb_typeof(p_requested) <> 'object'
     or p_offered = '{}'::jsonb or p_requested = '{}'::jsonb then
    raise exception 'Tausch braucht beidseitig mindestens eine Platte.';
  end if;

  insert into public.collections (user_id) values (v_me) on conflict (user_id) do nothing;
  select coalesce(inventory, '{}'::jsonb) into v_inv
    from public.collections where user_id = v_me for update;
  for v_plate, v_qty in select key, value::int from jsonb_each_text(p_offered) loop
    if v_plate not in ('cp-125','cp-25','gp-5','gp-10','bp-15','bp-20','carbon-25','glow-25','gold-50','edition-50')
       or v_qty < 1 or v_qty > 10 then
      raise exception 'Ungültiges Tausch-Item: %', v_plate;
    end if;
    if public.inv_get(v_inv, v_plate) < v_qty then
      raise exception 'Platte nicht im Bestand: %', v_plate;
    end if;
  end loop;
  for v_plate, v_qty in select key, value::int from jsonb_each_text(p_requested) loop
    if v_plate not in ('cp-125','cp-25','gp-5','gp-10','bp-15','bp-20','carbon-25','glow-25','gold-50','edition-50')
       or v_qty < 1 or v_qty > 10 then
      raise exception 'Ungültiges Wunsch-Item: %', v_plate;
    end if;
  end loop;

  insert into public.trades (from_user_id, to_user_id, offered_items, requested_items)
  values (v_me, p_to, p_offered, p_requested)
  returning id into v_id;
  return v_id;
end;
$$;

-- Tausch beantworten (nur Empfänger; sperrt beide Inventare, atomar)
create or replace function public.respond_trade(p_trade uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_trade public.trades%rowtype;
  v_from_inv jsonb;
  v_to_inv jsonb;
  v_plate text;
  v_qty int;
begin
  select * into v_trade from public.trades where id = p_trade for update;
  if not found then raise exception 'Tausch nicht gefunden.'; end if;
  if v_trade.to_user_id <> v_me then raise exception 'Nur der Empfänger kann antworten.'; end if;
  if v_trade.status <> 'pending' then raise exception 'Tausch ist nicht mehr offen.'; end if;

  if not p_accept then
    update public.trades set status = 'declined', updated_at = now() where id = p_trade;
    return;
  end if;

  select coalesce(inventory, '{}'::jsonb) into v_from_inv from public.collections
    where user_id = v_trade.from_user_id for update;
  select coalesce(inventory, '{}'::jsonb) into v_to_inv from public.collections
    where user_id = v_trade.to_user_id for update;

  for v_plate, v_qty in select * from jsonb_each_text(v_trade.offered_items) loop
    if public.inv_get(v_from_inv, v_plate) < v_qty::int then
      raise exception 'Anbieter hat die Platte nicht mehr: %', v_plate;
    end if;
  end loop;
  for v_plate, v_qty in select * from jsonb_each_text(v_trade.requested_items) loop
    if public.inv_get(v_to_inv, v_plate) < v_qty::int then
      raise exception 'Du hast die angefragte Platte nicht mehr: %', v_plate;
    end if;
  end loop;

  for v_plate, v_qty in select * from jsonb_each_text(v_trade.offered_items) loop
    v_from_inv := public.inv_set(v_from_inv, v_plate, public.inv_get(v_from_inv, v_plate) - v_qty::int);
    v_to_inv := public.inv_set(v_to_inv, v_plate, public.inv_get(v_to_inv, v_plate) + v_qty::int);
  end loop;
  for v_plate, v_qty in select * from jsonb_each_text(v_trade.requested_items) loop
    v_to_inv := public.inv_set(v_to_inv, v_plate, public.inv_get(v_to_inv, v_plate) - v_qty::int);
    v_from_inv := public.inv_set(v_from_inv, v_plate, public.inv_get(v_from_inv, v_plate) + v_qty::int);
  end loop;

  update public.collections set inventory = v_from_inv, updated_at = now()
    where user_id = v_trade.from_user_id;
  update public.collections set inventory = v_to_inv, updated_at = now()
    where user_id = v_trade.to_user_id;
  update public.trades set status = 'accepted', updated_at = now() where id = p_trade;
end;
$$;

-- Offenen Tausch zurückziehen (nur Ersteller)
create or replace function public.cancel_trade(p_trade uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trades
    set status = 'cancelled', updated_at = now()
    where id = p_trade
      and from_user_id = (select auth.uid())
      and status = 'pending';
  if not found then raise exception 'Offener Tausch nicht gefunden.'; end if;
end;
$$;

-- Verkaufsangebot einstellen (Platte wird sofort reserviert)
create or replace function public.create_listing(p_plate text, p_price int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_inv jsonb;
  v_min_price int;
begin
  if v_me is null then raise exception 'Nicht angemeldet.'; end if;
  v_min_price := case p_plate
    when 'cp-125' then 15 when 'cp-25' then 15
    when 'gp-5' then 60 when 'gp-10' then 60
    when 'bp-15' then 250 when 'bp-20' then 250
    when 'carbon-25' then 900 when 'glow-25' then 900
    when 'gold-50' then 4000 when 'edition-50' then 4000
    else null end;
  if v_min_price is null then raise exception 'Unbekannte Platte.'; end if;
  if p_price is null or p_price < v_min_price then raise exception 'Mindestpreis: % Coins.', v_min_price; end if;
  insert into public.collections (user_id) values (v_me) on conflict (user_id) do nothing;
  select coalesce(inventory, '{}'::jsonb) into v_inv from public.collections
    where user_id = v_me for update;
  if public.inv_get(v_inv, p_plate) < 1 then
    raise exception 'Platte nicht im Bestand.';
  end if;
  v_inv := public.inv_set(v_inv, p_plate, public.inv_get(v_inv, p_plate) - 1);
  update public.collections set inventory = v_inv, updated_at = now() where user_id = v_me;
  insert into public.market_listings (seller_id, plate_id, price) values (v_me, p_plate, p_price);
end;
$$;

-- Verkauf abbrechen: nur eigenes aktives Angebot; Platte wird zurückgegeben.
create or replace function public.cancel_listing(p_listing uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_listing public.market_listings%rowtype;
  v_inv jsonb;
begin
  select * into v_listing from public.market_listings where id = p_listing for update;
  if not found or v_listing.seller_id <> v_me or v_listing.status <> 'active' then
    raise exception 'Aktives eigenes Angebot nicht gefunden.';
  end if;
  insert into public.collections (user_id) values (v_me) on conflict (user_id) do nothing;
  select inventory into v_inv from public.collections where user_id = v_me for update;
  update public.collections set inventory = public.inv_set(v_inv, v_listing.plate_id,
    public.inv_get(v_inv, v_listing.plate_id) + 1), updated_at = now() where user_id = v_me;
  update public.market_listings set status = 'removed' where id = p_listing;
end;
$$;

-- Angebot kaufen: Coins + Inventar + Historie, alles atomar
create or replace function public.buy_listing(p_listing uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_listing public.market_listings%rowtype;
  v_my_coins int;
  v_seller_inv jsonb;
  v_my_inv jsonb;
begin
  select * into v_listing from public.market_listings where id = p_listing for update;
  if not found then raise exception 'Angebot nicht gefunden.'; end if;
  if v_listing.status <> 'active' then raise exception 'Angebot ist nicht mehr verfügbar.'; end if;
  if v_listing.seller_id = v_me then raise exception 'Eigenes Angebot kann nicht gekauft werden.'; end if;

  select coins into v_my_coins from public.collections where user_id = v_me for update;
  v_my_coins := coalesce(v_my_coins, 0);
  if v_my_coins < v_listing.price then
    raise exception 'Nicht genug Coins (% benötigt).', v_listing.price;
  end if;

  select coalesce(inventory, '{}'::jsonb) into v_seller_inv from public.collections
    where user_id = v_listing.seller_id for update;
  if not found then raise exception 'Verkäufer-Inventar fehlt.'; end if;
  -- Defense in Depth: Die Reservierung in create_listing sollte die Platte
  -- immer vorhalten; ohne diese Prüfung könnte ein Umgehungsweg Platten aus
  -- dem Nichts erzeugen (Käufer +1, Verkäufer -1 unter Null → Schlüsselwegfall).
  if public.inv_get(v_seller_inv, v_listing.plate_id) < 1 then
    raise exception 'Die Platte ist beim Verkäufer nicht mehr im Bestand.';
  end if;

  update public.collections set coins = coins - v_listing.price, updated_at = now()
    where user_id = v_me;
  update public.collections set coins = coins + v_listing.price, updated_at = now()
    where user_id = v_listing.seller_id;

  select coalesce(inventory, '{}'::jsonb) into v_my_inv from public.collections
    where user_id = v_me for update;
  update public.collections
    set inventory = public.inv_set(v_my_inv, v_listing.plate_id, public.inv_get(v_my_inv, v_listing.plate_id) + 1)
    where user_id = v_me;
  update public.collections
    set inventory = public.inv_set(v_seller_inv, v_listing.plate_id, public.inv_get(v_seller_inv, v_listing.plate_id) - 1)
    where user_id = v_listing.seller_id;

  update public.market_listings set status = 'sold' where id = p_listing;
  insert into public.market_transactions (listing_id, plate_id, price, buyer_id, seller_id)
    values (p_listing, v_listing.plate_id, v_listing.price, v_me, v_listing.seller_id);
end;
$$;

-- Send/accept friend requests; normalized pairs never imply consent.
create or replace function public.send_friend_request(p_to uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if v_me is null or p_to is null or p_to = v_me then raise exception 'Ungültige Freundschaftsanfrage.'; end if;
  v_a := least(v_me, p_to); v_b := greatest(v_me, p_to);
  insert into public.friends (user_id_a, user_id_b, requested_by, status)
    values (v_a, v_b, v_me, 'pending') returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Für diesen Nutzer besteht bereits eine Anfrage oder Freundschaft.';
end;
$$;

create or replace function public.respond_friend_request(p_friend uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_friend public.friends%rowtype;
begin
  select * into v_friend from public.friends where id = p_friend for update;
  if not found or v_friend.status <> 'pending' or v_friend.requested_by = v_me
     or v_me not in (v_friend.user_id_a, v_friend.user_id_b) then
    raise exception 'Eingehende Freundschaftsanfrage nicht gefunden.';
  end if;
  if p_accept then
    update public.friends set status = 'accepted' where id = p_friend;
  else
    delete from public.friends where id = p_friend;
  end if;
end;
$$;

-- Freundschaft entfernen: beide Seiten dürfen die Beziehung beenden (oder eine
-- eigene offene Anfrage zurückziehen). Löscht die Zeile endgültig.
create or replace function public.remove_friend(p_friend uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then raise exception 'Nicht angemeldet.'; end if;
  delete from public.friends
    where id = p_friend
      and v_me in (user_id_a, user_id_b);
  if not found then raise exception 'Freundschaft nicht gefunden.'; end if;
end;
$$;

-- Idempotent reward grant: only a just-completed check can claim once.
-- The server chooses the reward; the caller cannot supply another user ID,
-- item ID, rarity, or coin amount.
drop function if exists public.grant_check_reward(uuid, date, text);
drop function if exists public.claim_check_reward(date, text);
create function public.claim_check_reward(p_week date, p_check text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_roll numeric;
  v_rarity text;
  v_pool text[];
  v_plate text;
  v_inserted text;
  v_updated timestamptz;
begin
  if v_me is null then raise exception 'Nicht angemeldet.'; end if;
  if p_week is null or p_check !~ '^d[0-6]-(workout-0|meal-[0-3])$'
     or extract(isodow from p_week) <> 1 then
    raise exception 'Ungültiger Aufgaben-Check.';
  end if;
  select d.updated_at into v_updated from public.day_checks d
    where d.user_id = v_me and d.week_start = p_week and d.check_id = p_check and d.is_checked;
  if not found then raise exception 'Aufgabe ist nicht erledigt.'; end if;
  if v_updated < now() - interval '10 minutes' then
    raise exception 'Die Aufgabe ist zu alt für einen neuen Belohnungs-Claim.';
  end if;

  v_roll := random() * 100;
  v_rarity := case when v_roll < 60 then 'common'
    when v_roll < 85 then 'uncommon' when v_roll < 95 then 'rare'
    when v_roll < 99 then 'epic' else 'legendary' end;
  v_pool := case v_rarity
    when 'common' then array['cp-125','cp-25']
    when 'uncommon' then array['gp-5','gp-10']
    when 'rare' then array['bp-15','bp-20']
    when 'epic' then array['carbon-25','glow-25']
    else array['gold-50','edition-50'] end;
  v_plate := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];

  insert into public.collection_reward_claims (user_id, week_start, check_id, plate_id)
    values (v_me, p_week, p_check, v_plate)
    on conflict (user_id, week_start, check_id) do nothing
    returning plate_id into v_inserted;
  if v_inserted is null then
    select plate_id into v_inserted from public.collection_reward_claims
      where user_id = v_me and week_start = p_week and check_id = p_check;
    return jsonb_build_object('plate_id', v_inserted, 'granted', false);
  end if;

  insert into public.collections (user_id) values (v_me) on conflict (user_id) do nothing;
  update public.collections set coins = coins + 5,
    inventory = public.inv_set(inventory, v_inserted, public.inv_get(inventory, v_inserted) + 1),
    updated_at = now() where user_id = v_me;
  return jsonb_build_object('plate_id', v_inserted, 'granted', true);
end;
$$;

create or replace function public.upgrade_collection(p_rarity text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_from text[];
  v_to text[];
  v_inv jsonb;
  v_total int;
  v_remaining int := 3;
  v_plate text;
  v_qty int;
  v_target text;
begin
  if v_me is null then raise exception 'Nicht angemeldet.'; end if;
  v_from := case p_rarity when 'common' then array['cp-125','cp-25']
    when 'uncommon' then array['gp-5','gp-10'] when 'rare' then array['bp-15','bp-20']
    when 'epic' then array['carbon-25','glow-25'] else null end;
  v_to := case p_rarity when 'common' then array['gp-5','gp-10']
    when 'uncommon' then array['bp-15','bp-20'] when 'rare' then array['carbon-25','glow-25']
    when 'epic' then array['gold-50','edition-50'] else null end;
  if v_from is null then raise exception 'Diese Seltenheit kann nicht verbessert werden.'; end if;
  select inventory into v_inv from public.collections where user_id = v_me for update;
  if not found then raise exception 'Inventar nicht gefunden.'; end if;
  select coalesce(sum(public.inv_get(v_inv, id)), 0) into v_total from unnest(v_from) id;
  if v_total < 3 then raise exception 'Mindestens drei Platten dieser Stufe nötig.'; end if;
  foreach v_plate in array v_from loop
    exit when v_remaining = 0;
    v_qty := least(public.inv_get(v_inv, v_plate), v_remaining);
    if v_qty > 0 then
      v_inv := public.inv_set(v_inv, v_plate, public.inv_get(v_inv, v_plate) - v_qty);
      v_remaining := v_remaining - v_qty;
    end if;
  end loop;
  v_target := v_to[1 + floor(random() * array_length(v_to, 1))::int];
  v_inv := public.inv_set(v_inv, v_target, public.inv_get(v_inv, v_target) + 1);
  update public.collections set inventory = v_inv, updated_at = now() where user_id = v_me;
  return v_target;
end;
$$;

-- All writes are server RPCs; clients cannot bypass validation via table DML.
revoke all on function public.send_friend_request(uuid) from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.create_trade(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.respond_trade(uuid, boolean) from public, anon;
revoke all on function public.cancel_trade(uuid) from public, anon;
revoke all on function public.create_listing(text, integer) from public, anon;
revoke all on function public.cancel_listing(uuid) from public, anon;
revoke all on function public.buy_listing(uuid) from public, anon;
revoke all on function public.claim_check_reward(date, text) from public, anon;
revoke all on function public.upgrade_collection(text) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.create_trade(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.respond_trade(uuid, boolean) to authenticated;
grant execute on function public.cancel_trade(uuid) to authenticated;
grant execute on function public.create_listing(text, integer) to authenticated;
grant execute on function public.cancel_listing(uuid) to authenticated;
grant execute on function public.buy_listing(uuid) to authenticated;
grant execute on function public.claim_check_reward(date, text) to authenticated;
grant execute on function public.upgrade_collection(text) to authenticated;

do $$
declare
  t text;
begin
  -- Social-Tabellen auch live: Freunde/Trades/Markt-Änderungen des
  -- Partners erscheinen ohne Reload. Idempotent pro Tabelle.
  foreach t in array array['collections', 'friends', 'trades', 'market_listings', 'market_transactions'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then
        raise notice 'Publication supabase_realtime is unavailable; enable Realtime for public.% in the Supabase Dashboard.', t;
    end;
  end loop;
end $$;
