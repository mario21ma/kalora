import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;
create table public.ai_usage(user_id uuid,hour timestamptz,requests integer);`);
const sql=await readFile(new URL('../supabase/ai_rate_limit_migration.sql',import.meta.url),'utf8');
await db.exec(sql);await db.exec(sql); // migration is safe to rerun
const user='00000000-0000-4000-8000-000000000001',anon='anon:'+'a'.repeat(64);
const args=(subject=anon,id=null,caps=[3,10,20,30,100,500])=>[subject,id,...caps];
const call=async(values=args())=>(await db.query('select public.consume_ai_request_quota($1,$2,$3,$4,$5,$6,$7,$8) as quota',values)).rows[0].quota;
for(const role of ['anon','authenticated']){
 await db.exec('set role '+role);
 await assert.rejects(()=>call(),/permission denied/);
 await assert.rejects(()=>db.query('select * from public.ai_request_usage'),/permission denied/);
 await db.exec('reset role');
}
await db.exec('set role service_role');
const parallel=await Promise.all(Array.from({length:20},()=>call()));
assert.equal(parallel.filter(r=>r.allowed).length,3);
assert.ok(parallel.filter(r=>!r.allowed).every(r=>r.retry_after>=1&&r.retry_after<=60));
await db.exec('reset role');
let rows=await db.query('select requests from public.ai_request_usage');assert.ok(rows.rows.every(r=>r.requests===3));
await db.exec('truncate public.ai_request_usage');
for(const caps of [[100,2,100,100,100,100],[100,100,2,100,100,100],[100,100,100,100,2,100],[100,100,100,100,100,2]]){
 await db.exec('truncate public.ai_request_usage');assert.equal((await call(args(anon,null,caps))).allowed,true);assert.equal((await call(args(anon,null,caps))).allowed,true);const denied=await call(args(anon,null,caps));assert.equal(denied.allowed,false);assert.ok(denied.retry_after>0);
}
await db.exec('truncate public.ai_request_usage');
await call(args(anon,null,[100,100,100,1,100,100]));assert.equal((await call(args('anon:'+'b'.repeat(64),null,[100,100,100,1,100,100]))).scope,'global');
await db.exec('truncate public.ai_request_usage');
await db.query("insert into public.ai_usage values($1,date_trunc('hour',now(),'UTC'),40)",[user]);
assert.equal((await call(args('user:'+user,user,[100,40,100,100,100,100]))).allowed,false);
await db.exec('truncate public.ai_request_usage,public.ai_usage');
for(let i=0;i<40;i++)assert.equal((await call(args('user:'+user,user,[100,40,200,100,100,500]))).allowed,true);
assert.equal((await call(args('user:'+user,user,[100,40,200,100,100,500]))).allowed,false);
for(const values of [args('invalid'),args('user:'+user),args(anon,user),args(anon,null,[0,10,20,30,100,500])])await assert.rejects(()=>call(values),/Invalid quota/);
await db.exec('truncate public.ai_request_usage');
await db.exec("insert into public.ai_request_usage values('expired',now()-interval '3 days',500)");
await call();assert.equal((await db.query("select * from public.ai_request_usage where scope='expired'")).rows.length,0);
console.log('PASS: SQL migration/re-run, role isolation, concurrent reservations, no denied-request increments, hourly/daily/global limits, legacy 40/hour carryover, invalid input, retention cleanup');
await db.close();
