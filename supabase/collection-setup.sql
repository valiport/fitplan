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
grant select, insert, update, delete on public.collections to authenticated;

drop policy if exists "Users read own collection" on public.collections;
create policy "Users read own collection"
  on public.collections for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own collection" on public.collections;
create policy "Users insert own collection"
  on public.collections for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own collection" on public.collections;
create policy "Users update own collection"
  on public.collections for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Freundschaften: pending/accepted, alphabetisch sortierte Paare
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id_a uuid not null references auth.users(id) on delete cascade,
  user_id_b uuid not null references auth.users(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  constraint friends_ordered check (user_id_a < user_id_b),
  constraint friends_not_self check (user_id_a <> user_id_b),
  constraint friends_unique unique (user_id_a, user_id_b)
);

alter table public.friends enable row level security;
grant select, insert, update, delete on public.friends to authenticated;

drop policy if exists "Users read own friendships" on public.friends;
create policy "Users read own friendships"
  on public.friends for select to authenticated
  using ((select auth.uid()) in (user_id_a, user_id_b));

drop policy if exists "Users create friendship requests" on public.friends;
create policy "Users create friendship requests"
  on public.friends for insert to authenticated
  with check ((select auth.uid()) = user_id_a);

drop policy if exists "Users update own friendships" on public.friends;
create policy "Users update own friendships"
  on public.friends for update to authenticated
  using ((select auth.uid()) in (user_id_a, user_id_b));

drop policy if exists "Users delete own friendships" on public.friends;
create policy "Users delete own friendships"
  on public.friends for delete to authenticated
  using ((select auth.uid()) in (user_id_a, user_id_b));

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
grant select, insert, update, delete on public.trades to authenticated;

drop policy if exists "Users read involved trades" on public.trades;
create policy "Users read involved trades"
  on public.trades for select to authenticated
  using ((select auth.uid()) in (from_user_id, to_user_id));

drop policy if exists "Users create own trades" on public.trades;
create policy "Users create own trades"
  on public.trades for insert to authenticated
  with check ((select auth.uid()) = from_user_id);

-- Status-Änderungen/Ausführung NUR über die RPCs (security definer).
grant execute on function public.create_trade(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.respond_trade(uuid, boolean) to authenticated;
grant execute on function public.cancel_trade(uuid) to authenticated;

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
grant select, insert, update, delete on public.market_listings to authenticated;

drop policy if exists "Anyone signed-in reads listings" on public.market_listings;
create policy "Anyone signed-in reads listings"
  on public.market_listings for select to authenticated
  using (true);

drop policy if exists "Users create own listings" on public.market_listings;
create policy "Users create own listings"
  on public.market_listings for insert to authenticated
  with check ((select auth.uid()) = seller_id);

drop policy if exists "Users manage own listings" on public.market_listings;
create policy "Users manage own listings"
  on public.market_listings for update to authenticated
  using ((select auth.uid()) = seller_id);

drop policy if exists "Users delete own listings" on public.market_listings;
create policy "Users delete own listings"
  on public.market_listings for delete to authenticated
  using ((select auth.uid()) = seller_id);

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
grant select, insert on public.market_transactions to authenticated;

drop policy if exists "Users read own transactions" on public.market_transactions;
create policy "Users read own transactions"
  on public.market_transactions for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

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

  select coalesce(inventory, '{}'::jsonb) into v_inv
    from public.collections where user_id = v_me;
  for v_plate, v_qty in select * from jsonb_each_text(p_offered) loop
    if public.inv_get(v_inv, v_plate) < v_qty::int then
      raise exception 'Platte nicht im Bestand: %', v_plate;
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
begin
  if p_price is null or p_price <= 0 then raise exception 'Ungültiger Preis.'; end if;
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

do $$
begin
  alter publication supabase_realtime add table public.collections;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Publication supabase_realtime is unavailable; enable Realtime for public.collections in the Supabase Dashboard.';
end $$;
