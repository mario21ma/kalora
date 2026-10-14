import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import {initialState,makeWaterEntry,withWaterEntries} from '../lib/domain.ts';

const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const ids={a:'00000000-0000-4000-8000-000000000001',b:'00000000-0000-4000-8000-000000000002',orphan:'00000000-0000-4000-8000-000000000003'};
const tables=['profiles','food_items','meals','meal_items','daily_targets','weight_entries','daily_water','water_entries','favorite_meals','favorite_meal_items','ai_conversations','ai_messages','ai_usage'];
const readSql=name=>readFile(new URL('../supabase/'+name,import.meta.url),'utf8');
const cleanup=await readSql('ai_quota_account_cleanup.sql');
const count=async(db,table,id)=>(await db.query(`select count(*)::integer as count from public.${table} where user_id=$1`,[id])).rows[0].count;
const login=async(db,id)=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
const reserve=async(db,id)=>(await db.query('select public.consume_ai_request_quota($1,$2,6,40,200,30,100,500) as quota',['user:'+id,id])).rows[0].quota;
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await db.exec(await readSql('schema.sql')); // Base schema intentionally runs once.
 for(const name of ['water_entries_migration.sql','ai_rate_limit_migration.sql']){
  const migration=await readSql(name);await db.exec(migration);await db.exec(migration);
 }
 await db.query('insert into auth.users values($1),($2)',[ids.a,ids.b]);
 for(const id of [ids.a,ids.b]){
  const state=withWaterEntries(initialState(),[makeWaterEntry(250,'2026-10-01',new Date('2026-10-01T08:00:00Z'))]);
  state.profile={...state.profile,name:id===ids.a?'Account A':'Account B'};
  state.foods=[{id:'owned-food',name:'Own banana',brand:'',aliases:[],serving:120,fiber:2,calories:89,protein:1.1,carbs:22.8,fat:.3,source:'user',verified:false}];
  state.targets={'2026-10-01':state.profile.targets};
  state.favorites=[{id:'favorite',name:'Breakfast',items:[state.items[0]]}];
  state.messages=[{role:'user',content:'My diary'},{role:'assistant',content:'Saved'}];
  await login(db,id);await db.query('select public.save_diary($1::jsonb,0)',[JSON.stringify(state)]);
  await db.query('select public.consume_ai_quota()');
 }
 await db.exec('reset role');
 for(const id of [ids.a,ids.b,ids.orphan])for(const period of ['minute','hour','day']){
  await db.query('insert into public.ai_request_usage values($1,now(),7)',[`user:${id}:${period}`]);
 }
 for(const scope of ['global:minute','global:hour','global:day','anon:'+'a'.repeat(64)+':day',`user:${ids.orphan}:invalid`,'user:not-a-uuid:day','unrelated']){
  await db.query('insert into public.ai_request_usage values($1,now(),19)',[scope]);
 }
 return db;
}

test('account deletion removes diary and own AI quota scopes without resetting other counts',async t=>{
 const db=await fixture();t.after(()=>db.close());
 for(const table of tables){assert.ok(await count(db,table,ids.a)>0,table+' populated for A');assert.ok(await count(db,table,ids.b)>0,table+' populated for B');}
 const otherData=await Promise.all(tables.map(async table=>(await db.query(`select * from public.${table} where user_id=$1`,[ids.b])).rows));
 await db.exec(cleanup);await db.exec(cleanup);
 const remaining=await db.query('select scope,bucket,requests from public.ai_request_usage where scope not like $1 order by scope,bucket',['user:'+ids.a+':%']);
 await db.query('delete from auth.users where id=$1',[ids.a]);
 for(let index=0;index<tables.length;index++){
  assert.equal(await count(db,tables[index],ids.a),0,tables[index]+' cleared');
  assert.deepEqual((await db.query(`select * from public.${tables[index]} where user_id=$1`,[ids.b])).rows,otherData[index],tables[index]+' B unchanged');
 }
 assert.equal((await db.query('select * from public.ai_request_usage where scope in ($1,$2,$3)',['user:'+ids.a+':minute','user:'+ids.a+':hour','user:'+ids.a+':day'])).rows.length,0);
 assert.deepEqual((await db.query('select scope,bucket,requests from public.ai_request_usage order by scope,bucket')).rows,remaining.rows);
});

test('cleanup migration is repeatable and removes only historical canonical orphan scopes',async t=>{
 const db=await fixture();t.after(()=>db.close());
 const before=(await db.query('select scope,bucket,requests from public.ai_request_usage order by scope,bucket')).rows;
 const expected=before.filter(row=>!['minute','hour','day'].some(period=>row.scope===`user:${ids.orphan}:${period}`));
 await db.exec(cleanup);assert.deepEqual((await db.query('select scope,bucket,requests from public.ai_request_usage order by scope,bucket')).rows,expected);
 await db.exec(cleanup);assert.deepEqual((await db.query('select scope,bucket,requests from public.ai_request_usage order by scope,bucket')).rows,expected);
 const functions=await db.query("select proname,prosecdef,proconfig from pg_catalog.pg_proc where proname in ('delete_ai_quota_after_account_deletion','check_ai_quota_account_owner')");
 assert.equal(functions.rows.length,2);assert.ok(functions.rows.every(row=>row.prosecdef&&row.proconfig.includes('search_path=""')));
 assert.equal((await db.query("select count(*)::integer as count from pg_catalog.pg_trigger where tgname in ('kalora_delete_ai_quota','kalora_check_ai_quota_account')")).rows[0].count,2);
});

test('anonymous/authenticated roles cannot read quota records, invoke cleanup or delete another account',async t=>{
 const db=await fixture();t.after(()=>db.close());await db.exec(cleanup);
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  await assert.rejects(()=>db.query('select * from public.ai_request_usage'),/permission denied/);
  await assert.rejects(()=>db.query('select public.delete_ai_quota_after_account_deletion()'),/permission denied/);
  await assert.rejects(()=>db.query('select public.check_ai_quota_account_owner()'),/permission denied/);
  await assert.rejects(()=>db.query('delete from auth.users where id=$1',[ids.a]),/permission denied/);
  await db.exec('reset role');
 }
 await login(db,ids.b);assert.equal((await db.query('select user_id from public.profiles')).rows[0].user_id,ids.b);
 for(const table of tables.filter(table=>table!=='ai_usage'))assert.ok((await db.query(`select user_id from public.${table}`)).rows.every(row=>row.user_id===ids.b),table+' owner isolation');
 assert.equal((await db.query('delete from public.profiles where user_id=$1 returning *',[ids.a])).rows.length,0);
 await db.exec('reset role');assert.equal(await count(db,'profiles',ids.a),1);
});

test('a request authorized before deletion cannot recreate account quota afterward',async t=>{
 const db=await fixture();t.after(()=>db.close());await db.exec(cleanup);
 await db.exec('set role service_role');assert.equal((await reserve(db,ids.b)).allowed,true);await db.exec('reset role');
 const before=(await db.query('select scope,bucket,requests from public.ai_request_usage where scope not like $1 order by scope,bucket',['user:'+ids.a+':%'])).rows;
 await db.query('delete from auth.users where id=$1',[ids.a]);
 await db.exec('set role service_role');await assert.rejects(()=>reserve(db,ids.a),/account no longer exists/);await db.exec('reset role');
 assert.deepEqual((await db.query('select scope,bucket,requests from public.ai_request_usage order by scope,bucket')).rows,before);
});
