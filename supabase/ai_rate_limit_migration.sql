-- Run once in Supabase SQL Editor before deploying the new AI server.
begin;
create table if not exists public.ai_request_usage (
 scope text not null, bucket timestamptz not null, requests integer not null check(requests>=0),
 primary key(scope,bucket)
);
alter table public.ai_request_usage enable row level security;
revoke all on public.ai_request_usage from public,anon,authenticated;
create index if not exists ai_request_usage_expiry on public.ai_request_usage(bucket);
create or replace function public.consume_ai_request_quota(
 subject text,user_id uuid,minute_limit integer,hour_limit integer,day_limit integer,
 global_minute_limit integer,global_hour_limit integer,global_day_limit integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 ts timestamptz:=clock_timestamp(); buckets timestamptz[]; scopes text[];
 caps integer[]; durations integer[]:=array[60,3600,86400,60,3600,86400];
 n integer; used integer; wait_seconds integer:=0; blocked_scope text:='subject'; seed integer;
begin
 if subject is null or not coalesce((subject ~ '^anon:[0-9a-f]{64}$' and user_id is null or subject='user:'||user_id::text and user_id is not null),false)
 or minute_limit is null or hour_limit is null or day_limit is null
 or global_minute_limit is null or global_hour_limit is null or global_day_limit is null then raise exception 'Invalid quota parameters';end if;
 caps:=array[minute_limit,hour_limit,day_limit,global_minute_limit,global_hour_limit,global_day_limit];
 for n in 1..6 loop if caps[n]<1 or caps[n]>100000 then raise exception 'Invalid quota limit';end if;end loop;
 buckets:=array[date_trunc('minute',ts,'UTC'),date_trunc('hour',ts,'UTC'),date_trunc('day',ts,'UTC'),date_trunc('minute',ts,'UTC'),date_trunc('hour',ts,'UTC'),date_trunc('day',ts,'UTC')];
 scopes:=array[subject||':minute',subject||':hour',subject||':day','global:minute','global:hour','global:day'];
 -- Serialize the short reservation transaction across all serverless instances.
 perform pg_catalog.pg_advisory_xact_lock(724610238);
 delete from public.ai_request_usage where bucket<ts-interval '2 days';
 for n in 1..6 loop
  seed:=0;
  -- Carry over this hour's existing signed-in usage when deploying the migration.
  if n=2 and user_id is not null then select coalesce(max(u.requests),0) into seed from public.ai_usage u where u.user_id=consume_ai_request_quota.user_id and u.hour=buckets[n];end if;
  insert into public.ai_request_usage(scope,bucket,requests) values(scopes[n],buckets[n],seed) on conflict do nothing;
  select requests into used from public.ai_request_usage where scope=scopes[n] and bucket=buckets[n];
  if used>=caps[n] then
   wait_seconds:=greatest(wait_seconds,ceil(extract(epoch from buckets[n]+durations[n]*interval '1 second'-ts))::integer);
   if n>3 then blocked_scope:='global';end if;
  end if;
 end loop;
 if wait_seconds>0 then return jsonb_build_object('allowed',false,'retry_after',wait_seconds,'scope',blocked_scope);end if;
 for n in 1..6 loop update public.ai_request_usage set requests=requests+1 where scope=scopes[n] and bucket=buckets[n];end loop;
 return jsonb_build_object('allowed',true,'retry_after',0);
end $$;
revoke all on function public.consume_ai_request_quota(text,uuid,integer,integer,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_ai_request_quota(text,uuid,integer,integer,integer,integer,integer,integer) to service_role;
commit;
