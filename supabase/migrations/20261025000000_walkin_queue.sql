-- Walk-in queue: parties waiting in line at the door. The host adds them (or guests join from a QR code), and marks
-- them "table ready"; their phone number is kept so the host can call or text. Guests never touch the table directly:
-- the server joins and reads for them with the service-role key after validating the request.

create type public.walkin_status as enum ('waiting', 'ready', 'seated', 'cancelled');

alter table public.restaurants add column queue_open boolean not null default false;   -- guests may join the line from their phone

create table public.walkins (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  guest_name text not null check (char_length(guest_name) between 1 and 120),
  party_size int not null check (party_size between 1 and 50),
  phone text,
  email text,
  notes text,
  quoted_minutes int check (quoted_minutes between 0 and 600),
  status public.walkin_status not null default 'waiting',
  source text not null default 'host' check (source in ('host', 'online')),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  joined_at timestamptz not null default clock_timestamp(),
  ready_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index walkins_open_idx on public.walkins (restaurant_id, joined_at) where status in ('waiting', 'ready');

alter table public.walkins enable row level security;
create policy walkins_select on public.walkins for select to authenticated using (public.is_member(restaurant_id));
create policy walkins_update on public.walkins for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));
