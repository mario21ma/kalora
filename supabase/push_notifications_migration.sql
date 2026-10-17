-- Additive setup for cross-device Web Push. Apply only after reviewing on staging.
begin;
create table if not exists public.push_subscriptions (
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(endpoint ~ '^https://'),
 subscription jsonb not null check(jsonb_typeof(subscription)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,endpoint)
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon,authenticated;
grant select,insert,update,delete on public.push_subscriptions to service_role;

create table if not exists public.push_delivery_log (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('weighing','goal','progress','plateau')),
 period text not null check(length(period) between 1 and 80),
 delivered_at timestamptz not null default now(),
 primary key(user_id,kind,period)
);
alter table public.push_delivery_log enable row level security;
revoke all on public.push_delivery_log from anon,authenticated;
grant select,insert,update,delete on public.push_delivery_log to service_role;

create or replace function public.pending_push_weigh_reminders(p_today date)
returns table(user_id uuid,period text)
language sql stable security definer set search_path=public as $$
 select p.user_id,
  w.date::text||':'||floor((p_today-w.date)::numeric/greatest(7,least(30,(p.profile->>'weighReminderDays')::integer)))::text
 from public.profiles p
 cross join lateral (select max(date) as date from public.weight_entries where weight_entries.user_id=p.user_id) w
 where coalesce((p.profile->'notifications'->>'weighing')::boolean,false)
  and coalesce(p.profile->>'weighReminderDays','7') ~ '^(7|14|30)$'
  and w.date is not null
  and p_today-w.date >= greatest(7,least(30,(p.profile->>'weighReminderDays')::integer))
$$;
revoke all on function public.pending_push_weigh_reminders(date) from public,anon,authenticated;
grant execute on function public.pending_push_weigh_reminders(date) to service_role;
commit;
