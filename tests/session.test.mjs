import test from 'node:test';
import assert from 'node:assert/strict';
import {getSession,saveSession,session,cloudCall,SessionExpiredError,sessionRecoveryMessage,StaleSessionError,getAuthScope,subscribeAuth,authRequest,aiCall,signOut,deleteAccount,consumeMagicLink} from '../lib/cloud.ts';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i]??null,get length(){return m.size}}};
globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.window=new EventTarget();
const old=()=>({access_token:'old',refresh_token:'refresh',expires_at:0,user:{id:'a'}});
const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('session recovery and refresh concurrency',async t=>{
 await t.test('400 clears only auth, preserves diary and revision, and permits login',async()=>{const diary=JSON.stringify({state:{water:1250,items:['food']},dirty:true,revision:4});localStorage.setItem('kalora-v1-a',diary);saveSession(old());globalThis.fetch=async()=>response(400,{error_code:'refresh_token_not_found'});await assert.rejects(session(),SessionExpiredError);assert.equal(getSession(),null);assert.equal(localStorage.getItem('kalora-v1-a'),diary);assert.match(sessionRecoveryMessage(),/Sesija je istekla/);saveSession({...old(),access_token:'new',expires_at:Date.now()/1000+3600});assert.equal(sessionRecoveryMessage(),'');globalThis.fetch=async()=>response(200,{revision:5});assert.deepEqual(await cloudCall('save_diary',{}),{revision:5})});
 await t.test('network and server errors retain session',async()=>{for(const failure of [async()=>{throw new TypeError('offline')},async()=>response(503,{message:'unavailable'})]){saveSession(old());globalThis.fetch=failure;await assert.rejects(session());assert.equal(getSession().access_token,'old')}});
 await t.test('concurrent refreshes use one request',async()=>{saveSession(old());let count=0;globalThis.fetch=async()=>{count++;return response(200,{...old(),access_token:'fresh',expires_in:3600})};const results=await Promise.all([session(),session(),session()]);assert.equal(count,1);assert.ok(results.every(s=>s.access_token==='fresh'))});
 await t.test('late refresh cannot restore logout or replace a new login',async()=>{for(const next of [null,{...old(),access_token:'other',expires_at:Date.now()/1000+3600}]){saveSession(old());let finish;globalThis.fetch=()=>new Promise(resolve=>finish=resolve);const pending=session();saveSession(next);finish(response(200,{...old(),access_token:'stale',expires_in:3600}));await assert.rejects(pending,StaleSessionError);assert.equal(getSession()?.access_token,next?.access_token)}});
 await t.test('RPC 401 retries refreshed token once and invalid second token expires',async()=>{saveSession({...old(),expires_at:Date.now()/1000+3600});let count=0;globalThis.fetch=async url=>{count++;return url.includes('/auth/')?response(200,{...old(),access_token:'fresh',expires_in:3600}):response(401,{code:'PGRST301'})};await assert.rejects(cloudCall('load_diary',{}),SessionExpiredError);assert.equal(count,3);assert.equal(getSession(),null)});
 await t.test('permission errors do not log out',async()=>{saveSession({...old(),expires_at:Date.now()/1000+3600});globalThis.fetch=async()=>response(403,{message:'permission denied'});await assert.rejects(cloudCall('load_diary',{}),/permission denied/);assert.ok(getSession())});
 await t.test('corrupt auth is removed without clearing unrelated storage',async()=>{localStorage.setItem('kalora-session','broken');localStorage.setItem('kalora-theme','dark');await assert.rejects(session(),SessionExpiredError);assert.equal(localStorage.getItem('kalora-session'),null);assert.equal(localStorage.getItem('kalora-theme'),'dark')});
});

const valid=(id,token=id)=>({access_token:token,refresh_token:id+'-refresh',expires_at:Date.now()/1000+3600,user:{id}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
test('account-bound requests and cross-tab identity',async t=>{
 await t.test('late RPC401 cannot restore A or retry A document using B token',async()=>{
  saveSession(valid('A'));const result=deferred(),started=deferred();const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,options});started.resolve();return result.promise};
  const pending=cloudCall('save_diary',{document:{owner:'A'}});await started.promise;
  saveSession(valid('B'));result.resolve(response(401,{}));
  await assert.rejects(pending,StaleSessionError);assert.equal(calls.length,1);assert.equal(getSession().user.id,'B');
 });
 await t.test('account change during refresh never sends original document',async()=>{
  saveSession({...valid('A'),expires_at:0});const result=deferred(),started=deferred();const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,options});started.resolve();return result.promise};
  const pending=cloudCall('save_diary',{document:{owner:'A'}});await started.promise;
  saveSession(valid('B'));result.resolve(response(200,{...valid('A','A-fresh'),expires_in:3600}));
  await assert.rejects(pending,StaleSessionError);assert.equal(calls.length,1);assert.equal(getSession().user.id,'B');
 });
 await t.test('A -> B -> A invalidates captured requests despite same owner',async()=>{
  saveSession(valid('A'));const scope=getAuthScope();saveSession(valid('B'));saveSession(valid('A'));
  let calls=0;globalThis.fetch=async()=>{calls++;return response(200,{})};
  await assert.rejects(cloudCall('save_diary',{},scope),StaleSessionError);assert.equal(calls,0);
 });
 await t.test('storage auth change is announced; token-only renewal is not an identity change',()=>{
  saveSession(valid('A'));let changes=0;const stop=subscribeAuth(()=>changes++);
  localStorage.setItem('kalora-session',JSON.stringify(valid('B')));
  const event=new Event('storage');Object.defineProperty(event,'key',{value:'kalora-session'});window.dispatchEvent(event);
  assert.equal(changes,1);localStorage.setItem('kalora-session',JSON.stringify(valid('B','B-new')));window.dispatchEvent(event);
  assert.equal(changes,1);stop();
 });
 await t.test('same-account cross-tab token renewal is reused after a late401',async()=>{
  saveSession(valid('A'));let calls=0;const first=deferred(),started=deferred();
  globalThis.fetch=async(url,options)=>{calls++;if(calls===1){started.resolve();return first.promise}assert.equal(options.headers.Authorization,'Bearer renewed');assert.ok(!url.includes('/auth/'));return response(200,{revision:2})};
  const pending=cloudCall('save_diary',{});await started.promise;
  localStorage.setItem('kalora-session',JSON.stringify(valid('A','renewed')));first.resolve(response(401,{}));
  assert.deepEqual(await pending,{revision:2});assert.equal(calls,2);
 });
 await t.test('late AI result and login cannot modify the selected account',async()=>{
  for(const operation of [()=>aiCall('analyze',{text:'banana'}),()=>authRequest('token?grant_type=password',{email:'A'})]){
   saveSession(valid('A'));const result=deferred(),started=deferred();globalThis.fetch=async()=>{started.resolve();return result.promise};
   const pending=operation();await started.promise;saveSession(valid('B'));result.resolve(response(200,{...valid('A'),expires_in:3600,items:[]}));
   await assert.rejects(pending,StaleSessionError);assert.equal(getSession().user.id,'B');
  }
 });
 await t.test('late logout does not clear a new login',async()=>{
  saveSession(valid('A'));const result=deferred();globalThis.fetch=()=>result.promise;
  const pending=signOut();assert.equal(getSession(),null);saveSession(valid('B'));result.resolve(response(200,{}));await pending;
  assert.equal(getSession().user.id,'B');
 });
 await t.test('late successful account deletion clears only deleted owner diary',async()=>{
  saveSession(valid('delete-late-A'));localStorage.setItem('kalora-v1-delete-late-A','A diary');localStorage.setItem('kalora-v1-B','B diary');
  const result=deferred(),started=deferred();globalThis.fetch=async()=>{started.resolve();return result.promise};
  const pending=deleteAccount();await started.promise;saveSession(valid('B'));result.resolve(response(200,{deleted:true}));
  await assert.rejects(pending,StaleSessionError);assert.equal(localStorage.getItem('kalora-v1-delete-late-A'),null);assert.equal(localStorage.getItem('kalora-v1-B'),'B diary');assert.equal(getSession().user.id,'B');
 });
 await t.test('wrong-owner refresh response cannot change the account',async()=>{
  saveSession({...valid('A'),expires_at:0});globalThis.fetch=async()=>response(200,{...valid('B'),expires_in:3600});
  await assert.rejects(session(),SessionExpiredError);assert.equal(getSession(),null);
 });
});

test('refresh coordination and account backup cleanup',async t=>{
 await t.test('two tab modules share Web Lock and rotate refresh token only once',async()=>{
  const otherTab=await import('../lib/cloud.ts?tab-two');
  let queue=Promise.resolve();const previousNavigator=globalThis.navigator;
  Object.defineProperty(globalThis,'navigator',{value:{locks:{request:(_name,callback)=>{const pending=queue.then(callback);queue=pending.catch(()=>{});return pending}}},configurable:true});
  try{
   saveSession({...valid('A'),expires_at:0});let calls=0;const release=deferred(),started=deferred();
   globalThis.fetch=async()=>{calls++;started.resolve();return release.promise};
   const first=session();await started.promise;const second=otherTab.session();
   release.resolve(response(200,{...valid('A','fresh-shared'),expires_in:3600}));
   const results=await Promise.all([first,second]);assert.equal(calls,1);assert.ok(results.every(result=>result.access_token==='fresh-shared'));
  }finally{Object.defineProperty(globalThis,'navigator',{value:previousNavigator,configurable:true})}
 });
 await t.test('successful deletion removes all own backups but retains another user and guest',async()=>{
  const {preserveDiaryBackup,getDiaryBackups}=await import('../lib/diary-storage.ts');
  saveSession(valid('delete-A'));localStorage.setItem('kalora-v1-delete-A','A diary');localStorage.setItem('kalora-v1-keep-B','B diary');localStorage.setItem('kalora-v1-guest','guest diary');
  preserveDiaryBackup('delete-A','A corrupt','corrupt');preserveDiaryBackup('delete-A','A conflict','conflict');preserveDiaryBackup('keep-B','B backup','corrupt');preserveDiaryBackup(null,'guest backup','corrupt');
  globalThis.fetch=async()=>response(200,{deleted:true});await deleteAccount();
  assert.equal(localStorage.getItem('kalora-v1-delete-A'),null);assert.equal(getDiaryBackups('delete-A').length,0);assert.equal(localStorage.getItem('kalora-v1-keep-B'),'B diary');assert.equal(getDiaryBackups('keep-B').length,1);assert.equal(getDiaryBackups(null).length,1);assert.equal(getSession(),null);
 });
});

test('late e-mail callback and anonymous AI response remain bound to their starting identity',async()=>{
 globalThis.location={hash:'#access_token=magic-A&refresh_token=refresh-A&expires_in=3600',pathname:'/'};let cleared=false;globalThis.history={replaceState:()=>cleared=true};
 saveSession(valid('A'));const linkResult=deferred(),linkStarted=deferred();globalThis.fetch=async()=>{linkStarted.resolve();return linkResult.promise};
 const link=consumeMagicLink();await linkStarted.promise;saveSession(valid('B'));linkResult.resolve(response(200,{id:'A'}));
 await assert.rejects(link,StaleSessionError);assert.equal(getSession().user.id,'B');assert.equal(cleared,false);
 saveSession(null);const aiResult=deferred(),aiStarted=deferred();globalThis.fetch=async()=>{aiStarted.resolve();return aiResult.promise};
 const ai=aiCall('analyze',{text:'guest food'});await aiStarted.promise;saveSession(valid('B'));aiResult.resolve(response(200,{items:[]}));await assert.rejects(ai,StaleSessionError);assert.equal(getSession().user.id,'B');
});

test('successful deletion invalidates a reselected same account and its in-memory diary',async()=>{
 const {DiaryStore}=await import('../lib/diary-store.ts');const {initialState,makeWaterEntry,withWaterEntries}=await import('../lib/domain.ts');
 const previousNavigator=globalThis.navigator;Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
 try{
  saveSession(valid('delete-reselected-A'));const state=initialState(false);localStorage.setItem('kalora-v1-delete-reselected-A',JSON.stringify({state,revision:1,dirty:false}));
  const result=deferred(),started=deferred();globalThis.fetch=async()=>{started.resolve();return result.promise};const pending=deleteAccount();await started.promise;
  saveSession(valid('B'));saveSession(valid('delete-reselected-A'));const reopened=new DiaryStore();await reopened.boot();const action=reopened.captureAction();
  result.resolve(response(200,{deleted:true}));assert.deepEqual(await pending,{deleted:true});assert.equal(getSession(),null);assert.equal(localStorage.getItem('kalora-v1-delete-reselected-A'),null);
  assert.equal(reopened.update(s=>withWaterEntries(s,[makeWaterEntry(500,'2026-10-14')]),action),false);assert.equal(localStorage.getItem('kalora-v1-delete-reselected-A'),null);
 }finally{Object.defineProperty(globalThis,'navigator',{value:previousNavigator,configurable:true})}
});

test('successful deletion invalidates other-tab writes before removing account storage',async()=>{
 const {DiaryStore}=await import('../lib/diary-store.ts');const {initialState,makeWaterEntry,withWaterEntries}=await import('../lib/domain.ts');const {getDiaryBackups,preserveDiaryBackup}=await import('../lib/diary-storage.ts');
 const previousNavigator=globalThis.navigator;Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});const originalRemove=localStorage.removeItem;
 try{
  saveSession(valid('cleanup-interleave-A'));const raw=JSON.stringify({state:initialState(false),revision:1,dirty:false});localStorage.setItem('kalora-v1-cleanup-interleave-A',raw);preserveDiaryBackup('cleanup-interleave-A',raw,'before-delete');
  localStorage.setItem('kalora-v1-cleanup-keep-B','B diary');const otherTab=new DiaryStore();await otherTab.boot();let interleaved=false;
  localStorage.removeItem=key=>{
   originalRemove(key);
   if(key==='kalora-v1-cleanup-interleave-A'&&!interleaved){interleaved=true;assert.equal(otherTab.update(s=>withWaterEntries(s,[makeWaterEntry(500,'2026-10-14')])),false)}
  };
  globalThis.fetch=async()=>response(200,{deleted:true});assert.deepEqual(await deleteAccount(),{deleted:true});assert.equal(interleaved,true);assert.equal(getSession(),null);
  assert.equal(localStorage.getItem('kalora-v1-cleanup-interleave-A'),null);assert.equal(getDiaryBackups('cleanup-interleave-A').length,0);assert.equal(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(k=>k.startsWith('kalora-backup-v1-cleanup-interleave-A-')).length,0);assert.equal(localStorage.getItem('kalora-v1-cleanup-keep-B'),'B diary');
 }finally{localStorage.removeItem=originalRemove;Object.defineProperty(globalThis,'navigator',{value:previousNavigator,configurable:true})}
});

test('server-confirmed deletion retries a full-storage tombstone after cleanup and returns success',async()=>{
 const {isAccountDiaryDeleted,preserveDiaryBackup}=await import('../lib/diary-storage.ts');const owner='delete-marker-quota-A';saveSession(valid(owner));localStorage.setItem('kalora-v1-'+owner,'large A diary');preserveDiaryBackup(owner,'A backup','before-delete');localStorage.setItem('kalora-v1-marker-keep-B','B diary');localStorage.setItem('kalora-v1-guest','guest diary');
 const set=localStorage.setItem;let attempts=0;
 localStorage.setItem=(key,value)=>{if(key==='kalora-deleted-account-v1-'+owner&&++attempts===1)throw new DOMException('Full','QuotaExceededError');set(key,value)};
 try{
  globalThis.fetch=async()=>response(200,{deleted:true});assert.deepEqual(await deleteAccount(),{deleted:true});assert.equal(attempts,2);assert.equal(getSession(),null);assert.equal(isAccountDiaryDeleted(owner),true);
  assert.equal(localStorage.getItem('kalora-v1-'+owner),null);assert.equal(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(k=>k.startsWith('kalora-backup-v1-'+owner+'-')).length,0);assert.equal(localStorage.getItem('kalora-v1-marker-keep-B'),'B diary');assert.equal(localStorage.getItem('kalora-v1-guest'),'guest diary');assert.throws(()=>saveSession(valid(owner)),SessionExpiredError);
 }finally{localStorage.setItem=set}
});

test('ordinary logout does not mark the owner deleted or clear its diary and journals',async()=>{
 const {isAccountDiaryDeleted,writeDiaryJournal}=await import('../lib/diary-storage.ts');const owner='logout-keep-A';saveSession(valid(owner));localStorage.setItem('kalora-v1-'+owner,'A diary');const journal=writeDiaryJournal(owner,'writer','A recovery branch',null);
 globalThis.fetch=async()=>response(200,{});await signOut();assert.equal(isAccountDiaryDeleted(owner),false);assert.equal(localStorage.getItem('kalora-v1-'+owner),'A diary');assert.ok(localStorage.getItem(journal));saveSession(valid(owner));assert.equal(getSession().user.id,owner);
});

test('confirmed deletion cleans legacy sessions at a real capacity limit without touching other accounts',async t=>{
 for(const free of [0,180])await t.test('legacy identity missing, free bytes '+free,async()=>{
  const previous=globalThis.localStorage,values=new Map();let capacity=Infinity;
  const store={getItem:key=>values.get(key)??null,setItem:(key,value)=>{
   value=String(value);const next=new Map(values);next.set(key,value);
   const used=[...next].reduce((sum,[k,v])=>sum+2*(k.length+v.length),0);
   if(used>capacity)throw new DOMException('Full','QuotaExceededError');values.set(key,value);
  },removeItem:key=>values.delete(key),key:index=>[...values.keys()][index]??null,get length(){return values.size}};
  globalThis.localStorage=store;
  try{
   const {preserveDiaryBackup,isAccountDiaryDeleted}=await import('../lib/diary-storage.ts');
   const owner='full-legacy-'+free;store.setItem('kalora-session',JSON.stringify(valid(owner)));
   store.setItem('kalora-v1-'+owner,'A diary');preserveDiaryBackup(owner,'A backup','before-delete');
   store.setItem('kalora-v1-keep-full-B','B diary');const otherBackup=preserveDiaryBackup('keep-full-B','B backup','before-delete');
   store.setItem('kalora-v1-guest','guest diary');store.setItem('unrelated-filler','x'.repeat(1000));
   capacity=[...values].reduce((sum,[k,v])=>sum+2*(k.length+v.length),0)+free;
   let changes=0;const changed=()=>changes++;window.addEventListener('authchange',changed);
   try{globalThis.fetch=async()=>response(200,{deleted:true});assert.deepEqual(await deleteAccount(),{deleted:true})}
   finally{window.removeEventListener('authchange',changed)}
   assert.equal(getSession(),null);assert.equal(store.getItem('kalora-session'),null);assert.equal(changes,1);
   assert.equal(store.getItem('kalora-v1-'+owner),null);assert.equal([...values.keys()].filter(k=>k.startsWith('kalora-backup-v1-'+owner+'-')).length,0);
   assert.equal(isAccountDiaryDeleted(owner),true);assert.equal(store.getItem('kalora-deleted-account-v1-'+owner),'1');
   assert.equal(store.getItem('kalora-v1-keep-full-B'),'B diary');assert.ok(store.getItem(otherBackup));assert.equal(store.getItem('kalora-v1-guest'),'guest diary');assert.equal(store.getItem('unrelated-filler'),'x'.repeat(1000));
  }finally{globalThis.localStorage=previous}
 });
});

test('logout removes a legacy session even when identity metadata cannot be written',async()=>{
 const previous=globalThis.localStorage,values=new Map([['kalora-session',JSON.stringify(valid('legacy-logout'))],['kalora-v1-legacy-logout','keep diary']]);
 globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:()=>{throw new DOMException('Full','QuotaExceededError')},removeItem:key=>values.delete(key),key:index=>[...values.keys()][index]??null,get length(){return values.size}};
 try{globalThis.fetch=async()=>response(200,{});await signOut();assert.equal(values.has('kalora-session'),false);assert.equal(getSession(),null);assert.equal(values.get('kalora-v1-legacy-logout'),'keep diary')}
 finally{globalThis.localStorage=previous}
});
