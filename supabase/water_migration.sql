-- Kalora hydration migration. Run once in Supabase SQL Editor on an existing Kalora database.
begin;
create table if not exists public.daily_water (
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 date date not null,
 ml integer not null check(ml between 0 and 20000),
 primary key(user_id,date)
);
alter table public.daily_water enable row level security;
drop policy if exists own_rows on public.daily_water;
create policy own_rows on public.daily_water for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.daily_water to authenticated;
revoke all on public.daily_water from anon;

create or replace function public.load_diary() returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('revision',p.revision,'state',jsonb_build_object(
 'version',1,'profile',p.profile,'onboarded',p.onboarded,'demo',p.demo,
 'items',coalesce((select jsonb_agg(i.payload order by m.date,m.meal_type,i.id) from meal_items i join meals m on m.user_id=i.user_id and m.id=i.meal_id where i.user_id=auth.uid()),'[]'::jsonb),
 'foods',coalesce((select jsonb_agg(f.payload) from food_items f where f.user_id=auth.uid()),'[]'::jsonb),
 'weights',coalesce((select jsonb_agg(jsonb_build_object('date',w.date,'kg',w.kg) order by w.date) from weight_entries w where w.user_id=auth.uid()),'[]'::jsonb),
 'water',coalesce((select jsonb_object_agg(w.date::text,w.ml) from daily_water w where w.user_id=auth.uid()),'{}'::jsonb),
 'targets',coalesce((select jsonb_object_agg(d.date::text,d.payload) from daily_targets d where d.user_id=auth.uid()),'{}'::jsonb),
 'favorites',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'items',coalesce((select jsonb_agg(i.payload order by i.position) from favorite_meal_items i where i.user_id=f.user_id and i.favorite_id=f.id),'[]'::jsonb))) from favorite_meals f where f.user_id=auth.uid()),'[]'::jsonb),
 'messages',coalesce((select jsonb_agg(jsonb_build_object('role',m.role,'content',m.content) order by m.position) from ai_messages m where m.user_id=auth.uid()),'[]'::jsonb)
 )) from profiles p where p.user_id=auth.uid()
$$;

create or replace function public.save_diary(document jsonb,expected_revision bigint) returns jsonb language plpgsql security invoker set search_path=public as $$
declare owner_id uuid:=auth.uid();rev bigint; entry jsonb;fav jsonb;idx int; begin
 if owner_id is null then raise exception 'Unauthorized';end if;
 if document->>'version' <> '1' or jsonb_typeof(document->'profile') <> 'object' or octet_length(document::text)>5000000 then raise exception 'Invalid document';end if;
 if jsonb_array_length(document->'items')>20000 or jsonb_array_length(document->'foods')>2000 or jsonb_array_length(document->'messages')>200 then raise exception 'Document too large';end if;
 if not ((document->'profile'->'targets'->>'calories')::numeric between 800 and 8000) then raise exception 'Invalid target';end if;
 insert into profiles(user_id,profile) values(owner_id,document->'profile') on conflict(user_id) do nothing;
 select revision into rev from profiles where user_id=owner_id for update;
 if rev<>expected_revision then raise exception 'CONFLICT: reload before saving';end if;
 update profiles set profile=document->'profile',onboarded=(document->>'onboarded')::boolean,demo=(document->>'demo')::boolean,revision=rev+1,updated_at=now() where user_id=owner_id;
 delete from meals where user_id=owner_id;
 delete from food_items where user_id=owner_id;
 delete from daily_targets where user_id=owner_id;
 delete from weight_entries where user_id=owner_id;
 delete from daily_water where user_id=owner_id;
 delete from favorite_meals where user_id=owner_id;
 delete from ai_messages where user_id=owner_id;
 for entry in select value from jsonb_array_elements(document->'foods') loop insert into food_items(user_id,id,payload) values(owner_id,entry->>'id',entry); end loop;
 for entry in select value from jsonb_array_elements(document->'items') loop
  insert into meals(user_id,id,date,meal_type) values(owner_id,(entry->>'date')||':'||(entry->>'meal'),(entry->>'date')::date,entry->>'meal') on conflict do nothing;
  insert into meal_items(user_id,id,meal_id,payload) values(owner_id,entry->>'id',(entry->>'date')||':'||(entry->>'meal'),entry);
 end loop;
 insert into daily_targets(user_id,date,payload) select owner_id,key::date,value from jsonb_each(document->'targets');
 insert into weight_entries(user_id,date,kg) select owner_id,(value->>'date')::date,(value->>'kg')::numeric from jsonb_array_elements(document->'weights');
 insert into daily_water(user_id,date,ml) select owner_id,key::date,(value::text)::integer from jsonb_each(coalesce(document->'water','{}'::jsonb));
 for fav in select value from jsonb_array_elements(document->'favorites') loop
  insert into favorite_meals(user_id,id,name) values(owner_id,fav->>'id',fav->>'name');idx:=0;
  for entry in select value from jsonb_array_elements(fav->'items') loop insert into favorite_meal_items(user_id,favorite_id,position,payload) values(owner_id,fav->>'id',idx,entry);idx:=idx+1; end loop;
 end loop;
 insert into ai_conversations(user_id) values(owner_id) on conflict do nothing;
 idx:=0;for entry in select value from jsonb_array_elements(document->'messages') loop insert into ai_messages(user_id,position,role,content) values(owner_id,idx,entry->>'role',entry->>'content');idx:=idx+1; end loop;
 return jsonb_build_object('revision',rev+1);
end $$;

revoke all on function public.load_diary(),public.save_diary(jsonb,bigint) from public,anon;
grant execute on function public.load_diary(),public.save_diary(jsonb,bigint) to authenticated;
commit;
