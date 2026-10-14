-- Apply after schema.sql and ai_rate_limit_migration.sql, before the beta release.
-- Removes only canonical account scopes; keeps all active, anonymous and global counts.
begin;

create or replace function public.delete_ai_quota_after_account_deletion()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.ai_request_usage
 where scope in ('user:'||old.id::text||':minute',
                 'user:'||old.id::text||':hour',
                 'user:'||old.id::text||':day');
 return old;
end $$;
revoke all on function public.delete_ai_quota_after_account_deletion() from public,anon,authenticated;

drop trigger if exists kalora_delete_ai_quota on auth.users;
create trigger kalora_delete_ai_quota after delete on auth.users
 for each row execute function public.delete_ai_quota_after_account_deletion();

-- Like a foreign key, this row lock closes the race with a request authenticated
-- immediately before account deletion. If reservation wins, deletion later removes
-- its user counts; if deletion wins, the reservation cannot recreate an orphan.
create or replace function public.check_ai_quota_account_owner()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.scope ~ '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(minute|hour|day)$' then
  perform 1 from auth.users where id::text=substring(new.scope from 6 for 36) for key share;
  if not found then raise exception 'AI quota account no longer exists';end if;
 end if;
 return new;
end $$;
revoke all on function public.check_ai_quota_account_owner() from public,anon,authenticated;

drop trigger if exists kalora_check_ai_quota_account on public.ai_request_usage;
create trigger kalora_check_ai_quota_account before insert on public.ai_request_usage
 for each row execute function public.check_ai_quota_account_owner();

-- Remove historical orphan account scopes without parsing arbitrary text as a UUID.
delete from public.ai_request_usage as usage
 where usage.scope ~ '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(minute|hour|day)$'
 and not exists(select 1 from auth.users where id::text=substring(usage.scope from 6 for 36));

commit;
