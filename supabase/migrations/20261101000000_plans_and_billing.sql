-- Plans and billing. Every restaurant starts with 30 days of Pro, then drops to the Free plan (50 reservations a month) unless it subscribes.
-- Kept in its own table that only the server (service role) can read or write: a restaurant admin can never change their own plan,
-- because the table has row level security with no policies. Stripe ids stay private to the server too.

create table public.restaurant_plans (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  trial_ends_at timestamptz not null,
  status text not null default 'none' check (status in ('none', 'active', 'past_due', 'cancelled')),   -- the paid subscription, as Stripe reports it
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  past_due_since timestamptz,
  comped_until timestamptz,                      -- a free Pro period given by hand (for example a launch partner)
  trial_reminder_sent_at timestamptz,
  last_stripe_event_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.restaurant_plans enable row level security;

-- Webhook idempotency: each Stripe event is processed once.
create table public.stripe_billing_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.stripe_billing_events enable row level security;

-- Every new restaurant gets its plan row. The 30-day trial is for a person's FIRST restaurant: a second one made by the same owner
-- starts on the Free plan, so repeating the sign-up does not earn endless trials.
create or replace function public.create_restaurant_plan()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.restaurant_plans (restaurant_id, trial_ends_at)
  values (
    new.id,
    case when new.created_by is not null
              and exists (select 1 from public.restaurants r where r.created_by = new.created_by and r.id <> new.id)
         then now()
         else now() + interval '30 days' end
  );
  return new;
end;
$$;
create trigger restaurants_plan_row after insert on public.restaurants
  for each row execute function public.create_restaurant_plan();

-- Restaurants that already exist get a fresh 30 days from today.
insert into public.restaurant_plans (restaurant_id, trial_ends_at)
select id, now() + interval '30 days' from public.restaurants
on conflict (restaurant_id) do nothing;
