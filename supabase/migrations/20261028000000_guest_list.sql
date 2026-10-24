-- Guest list: one place to see everyone who reached the restaurant (reservation, waitlist, walk-in line, or a "get updates"
-- sign-up), when they were added, how, and what happened (showed up, no-show, and so on), plus whether they agreed to marketing.
-- It is a view over the existing tables, so it can never drift out of date, and it follows the same team-only access rules.

alter table public.reservations add column marketing_opt_in boolean not null default false;
alter table public.waitlist add column marketing_opt_in boolean not null default false;
alter table public.walkins add column marketing_opt_in boolean not null default false;

create table public.guest_signups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  guest_name text not null default '' check (char_length(guest_name) <= 120),
  email text not null check (char_length(email) between 3 and 200),
  marketing_opt_in boolean not null default true,   -- signing up is the agreement
  created_at timestamptz not null default now()
);
create unique index guest_signups_email_idx on public.guest_signups (restaurant_id, lower(email));
alter table public.guest_signups enable row level security;
create policy guest_signups_select on public.guest_signups for select to authenticated using (public.is_member(restaurant_id));

create view public.guest_log with (security_invoker = true) as
  select r.id, r.restaurant_id, 'reservation'::text as mode, r.guest_name, r.email, r.phone, r.party_size,
         r.created_at as added_at, r.starts_at as event_at,
         case when r.status in ('completed', 'seated') then 'showed'
              when r.status = 'no_show' then 'no_show'
              when r.status = 'cancelled' then 'cancelled'
              when r.ends_at < now() then 'unmarked'
              else 'upcoming' end as outcome,
         r.marketing_opt_in, r.source
    from public.reservations r
  union all
  select w.id, w.restaurant_id, 'waitlist', w.guest_name, w.email, w.phone, w.party_size,
         w.created_at, (w.wanted_date + w.from_time) at time zone rs.timezone,
         case w.status when 'booked' then 'booked'
                       when 'notified' then 'notified'
                       when 'expired' then 'expired'
                       when 'cancelled' then 'cancelled'
                       else 'waiting' end,
         w.marketing_opt_in, 'online'
    from public.waitlist w join public.restaurants rs on rs.id = w.restaurant_id
  union all
  select k.id, k.restaurant_id, 'walk_in', k.guest_name, k.email, k.phone, k.party_size,
         k.joined_at, k.joined_at,
         case when k.status = 'seated' then 'showed'
              when k.status = 'cancelled' and k.ready_at is not null then 'no_show'
              when k.status = 'cancelled' then 'left'
              else 'waiting' end,
         k.marketing_opt_in, k.source
    from public.walkins k
  union all
  select s.id, s.restaurant_id, 'signup', s.guest_name, s.email, null::text, null::int,
         s.created_at, null::timestamptz, 'subscribed', s.marketing_opt_in, 'online'
    from public.guest_signups s;

grant select on public.guest_log to authenticated;
