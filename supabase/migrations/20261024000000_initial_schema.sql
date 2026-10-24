-- Table Ready: restaurants, tables, opening hours, reservations, waitlist.
-- Row Level Security everywhere. Guests never touch the database directly: the server books and reads for them with the
-- service-role key after validating the request.

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.org_role as enum ('owner', 'admin', 'member');
create type public.reservation_status as enum ('confirmed', 'seated', 'completed', 'cancelled', 'no_show');
create type public.waitlist_status as enum ('waiting', 'notified', 'booked', 'cancelled', 'expired');

-- ───────────────────────────── Restaurants ─────────────────────────────
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  description text,
  timezone text not null default 'America/Toronto',
  address text,
  phone text,
  website text,
  -- online booking rules
  online_enabled boolean not null default true,
  min_notice_minutes int not null default 60 check (min_notice_minutes >= 0),
  max_advance_days int not null default 60 check (max_advance_days between 1 and 365),
  slot_interval_minutes int not null default 15 check (slot_interval_minutes in (10, 15, 20, 30, 60)),
  max_party_size int not null default 8 check (max_party_size between 1 and 50),
  cancellation_window_hours int not null default 2 check (cancellation_window_hours >= 0),
  -- how long a party keeps its table: the first entry whose upTo is at least the party size applies
  turn_times jsonb not null default '[{"upTo":2,"minutes":75},{"upTo":4,"minutes":90},{"upTo":6,"minutes":105},{"upTo":99,"minutes":120}]',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'member',
  display_name text not null default '',
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create or replace function public.is_member(p_restaurant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.restaurant_id = p_restaurant and m.user_id = (select auth.uid()));
$$;

create or replace function public.is_admin(p_restaurant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
    where m.restaurant_id = p_restaurant and m.user_id = (select auth.uid()) and m.role in ('owner', 'admin'));
$$;

-- ───────────────────────────── Tables, hours, closures ─────────────────────────────
create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  seats int not null check (seats between 1 and 50),
  online boolean not null default true,      -- offered to guests who book online
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);
create index dining_tables_restaurant_idx on public.dining_tables (restaurant_id);

-- A service period is an opening window on some weekdays, e.g. "Dinner", Tue-Sun, 17:00 to 21:30 (last seating).
create table public.service_periods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  days smallint[] not null check (cardinality(days) between 1 and 7 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),  -- 0 = Sunday
  opens time not null,
  last_seating time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (last_seating >= opens)
);
create index service_periods_restaurant_idx on public.service_periods (restaurant_id);

create table public.closures (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  on_date date not null,
  note text,
  unique (restaurant_id, on_date)
);

-- ───────────────────────────── Reservations ─────────────────────────────
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid references public.dining_tables (id) on delete set null,
  guest_name text not null check (char_length(guest_name) between 1 and 120),
  email text,
  phone text,
  party_size int not null check (party_size between 1 and 50),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.reservation_status not null default 'confirmed',
  notes text,
  source text not null default 'online' check (source in ('online', 'host')),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index reservations_day_idx on public.reservations (restaurant_id, starts_at);

-- The database itself refuses to seat two live parties at one table at the same time.
alter table public.reservations add constraint reservations_no_overlap
  exclude using gist (table_id with =, tstzrange(starts_at, ends_at) with &&)
  where (table_id is not null and status in ('confirmed', 'seated'));

-- ───────────────────────────── Waitlist (for full times) ─────────────────────────────
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  guest_name text not null check (char_length(guest_name) between 1 and 120),
  email text not null,
  phone text,
  party_size int not null check (party_size between 1 and 50),
  wanted_date date not null,
  from_time time not null,
  to_time time not null,
  status public.waitlist_status not null default 'waiting',
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  notified_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check (to_time >= from_time)
);
create index waitlist_open_idx on public.waitlist (restaurant_id, wanted_date) where status = 'waiting';

-- ───────────────────────────── Row Level Security ─────────────────────────────
alter table public.restaurants enable row level security;
alter table public.memberships enable row level security;
alter table public.dining_tables enable row level security;
alter table public.service_periods enable row level security;
alter table public.closures enable row level security;
alter table public.reservations enable row level security;
alter table public.waitlist enable row level security;

create policy restaurants_select on public.restaurants for select to authenticated using (public.is_member(id));
create policy restaurants_update on public.restaurants for update to authenticated using (public.is_admin(id)) with check (public.is_admin(id));

create policy memberships_select on public.memberships for select to authenticated using (public.is_member(restaurant_id));

create policy tables_all on public.dining_tables for all to authenticated
  using (public.is_admin(restaurant_id)) with check (public.is_admin(restaurant_id));
create policy tables_select on public.dining_tables for select to authenticated using (public.is_member(restaurant_id));

create policy periods_all on public.service_periods for all to authenticated
  using (public.is_admin(restaurant_id)) with check (public.is_admin(restaurant_id));
create policy periods_select on public.service_periods for select to authenticated using (public.is_member(restaurant_id));

create policy closures_all on public.closures for all to authenticated
  using (public.is_admin(restaurant_id)) with check (public.is_admin(restaurant_id));
create policy closures_select on public.closures for select to authenticated using (public.is_member(restaurant_id));

-- Any member can run the floor: see and update reservations and the waitlist. Creating one goes through book_table().
create policy reservations_select on public.reservations for select to authenticated using (public.is_member(restaurant_id));
create policy reservations_update on public.reservations for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));
create policy waitlist_select on public.waitlist for select to authenticated using (public.is_member(restaurant_id));
create policy waitlist_update on public.waitlist for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));

-- ───────────────────────────── Creating a restaurant ─────────────────────────────
-- The signed-in person becomes its owner. Starts with a sensible set of tables and dinner hours to edit.
create or replace function public.create_restaurant(p_name text, p_slug text, p_timezone text, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  rid uuid;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if (select count(*) from public.memberships where user_id = uid and role = 'owner') >= 5 then
    raise exception 'Too many restaurants' using errcode = 'P0001';
  end if;
  insert into public.restaurants (name, slug, timezone, created_by) values (p_name, p_slug, p_timezone, uid) returning id into rid;
  insert into public.memberships (restaurant_id, user_id, role, display_name) values (rid, uid, 'owner', coalesce(p_display_name, ''));
  insert into public.dining_tables (restaurant_id, name, seats, position) values
    (rid, 'T1', 2, 0), (rid, 'T2', 2, 1), (rid, 'T3', 4, 2), (rid, 'T4', 4, 3), (rid, 'T5', 4, 4), (rid, 'T6', 6, 5);
  insert into public.service_periods (restaurant_id, name, days, opens, last_seating)
    values (rid, 'Dinner', array[0, 1, 2, 3, 4, 5, 6]::smallint[], '17:00', '21:00');
  return rid;
end;
$$;
revoke all on function public.create_restaurant(text, text, text, text) from public, anon;
grant execute on function public.create_restaurant(text, text, text, text) to authenticated;

-- ───────────────────────────── Booking a table ─────────────────────────────
-- Checks the rules, picks the smallest free table that fits, and books it. The exclusion constraint is the final word on
-- double-booking: if two guests race for the same table, the loser tries the next table or gets "no table".
-- Only the server (service role) can call this; it has already validated the guest's input.
create or replace function public.book_table(
  p_restaurant uuid, p_name text, p_email text, p_phone text, p_party int, p_starts timestamptz,
  p_notes text, p_source text default 'online', p_table uuid default null
) returns table (reservation_id uuid, token text, table_name text, ends_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  r public.restaurants;
  local_ts timestamp;
  mins int;
  ends timestamptz;
  t record;
  new_id uuid;
  new_token text;
begin
  select * into r from public.restaurants where id = p_restaurant;
  if not found then raise exception 'unknown_restaurant'; end if;
  if p_source = 'online' then
    if not r.online_enabled then raise exception 'online_closed'; end if;
    if p_party > r.max_party_size then raise exception 'party_too_large'; end if;
    if p_starts < now() + make_interval(mins => r.min_notice_minutes) then raise exception 'too_soon'; end if;
    if p_starts > now() + make_interval(days => r.max_advance_days) then raise exception 'too_far'; end if;
  end if;
  if p_party < 1 then raise exception 'bad_party'; end if;

  local_ts := p_starts at time zone r.timezone;
  if exists (select 1 from public.closures c where c.restaurant_id = r.id and c.on_date = local_ts::date) and p_source = 'online' then
    raise exception 'closed_that_day';
  end if;
  if p_source = 'online' and not exists (
    select 1 from public.service_periods sp
    where sp.restaurant_id = r.id and sp.active
      and extract(dow from local_ts)::smallint = any (sp.days)
      and local_ts::time >= sp.opens and local_ts::time <= sp.last_seating
  ) then raise exception 'outside_hours'; end if;

  select (e ->> 'minutes')::int into mins
    from jsonb_array_elements(r.turn_times) e
    where (e ->> 'upTo')::int >= p_party
    order by (e ->> 'upTo')::int limit 1;
  mins := coalesce(mins, 120);
  ends := p_starts + make_interval(mins => mins);

  -- A host can pick a table (or none); online guests get the smallest online table that fits.
  for t in
    select dt.id, dt.name from public.dining_tables dt
    where dt.restaurant_id = r.id and dt.active
      and (case when p_table is not null then dt.id = p_table
                when p_source = 'online' then dt.online and dt.seats >= p_party
                else dt.seats >= p_party end)
    order by dt.seats, dt.position, dt.name
  loop
    begin
      insert into public.reservations (restaurant_id, table_id, guest_name, email, phone, party_size, starts_at, ends_at, notes, source)
      values (r.id, t.id, p_name, nullif(p_email, ''), nullif(p_phone, ''), p_party, p_starts, ends, nullif(p_notes, ''), p_source)
      returning id, public.reservations.token into new_id, new_token;
      return query select new_id, new_token, t.name::text, ends;
      return;
    exception when exclusion_violation then
      continue;   -- that table is taken for this time: try the next one
    end;
  end loop;

  -- A host may still record a party with no table assigned (for example a walk-up they will seat by eye).
  if p_source = 'host' and p_table is null then
    insert into public.reservations (restaurant_id, table_id, guest_name, email, phone, party_size, starts_at, ends_at, notes, source)
    values (r.id, null, p_name, nullif(p_email, ''), nullif(p_phone, ''), p_party, p_starts, ends, nullif(p_notes, ''), p_source)
    returning id, public.reservations.token into new_id, new_token;
    return query select new_id, new_token, null::text, ends;
    return;
  end if;
  raise exception 'no_table';
end;
$$;
revoke all on function public.book_table(uuid, text, text, text, int, timestamptz, text, text, uuid) from public, anon, authenticated;
grant execute on function public.book_table(uuid, text, text, text, int, timestamptz, text, text, uuid) to service_role;
