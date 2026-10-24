-- Guest notices: a short message the restaurant shows at the top of its public pages for a set time, for example
-- "The kitchen is backed up: waits are longer than quoted". It appears at starts_at and disappears by itself at ends_at.
-- Guests never read this table directly: the server reads active notices for them with the service-role key.

create table public.guest_notices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 300),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  show_reservations boolean not null default true,   -- the reservation page (which also holds the waitlist)
  show_queue boolean not null default true,          -- the walk-in line pages
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (show_reservations or show_queue)
);
create index guest_notices_active_idx on public.guest_notices (restaurant_id, ends_at);

alter table public.guest_notices enable row level security;

-- Anyone on the team can post and end a notice: when the kitchen is backed up, the floor should not wait for an admin.
create policy guest_notices_select on public.guest_notices for select to authenticated using (public.is_member(restaurant_id));
create policy guest_notices_insert on public.guest_notices for insert to authenticated with check (public.is_member(restaurant_id));
create policy guest_notices_update on public.guest_notices for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));
create policy guest_notices_delete on public.guest_notices for delete to authenticated using (public.is_member(restaurant_id));
