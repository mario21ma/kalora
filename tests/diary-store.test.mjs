import test from 'node:test';
import assert from 'node:assert/strict';
import {DiaryStore} from '../lib/diary-store.ts';
import {getSession,saveSession,subscribeAuth} from '../lib/cloud.ts';
import {initialState,makeWaterEntry,withWaterEntries} from '../lib/domain.ts';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i]??null,get length(){return m.size}}};
const response=(status,data)=>new Response(JSON.stringify(data),{status});
const valid=id=>({access_token:id,refresh_token:id+'-refresh',expires_at:Date.now()/1000+3600,user:{id}});
const record=(name,dirty=false,revision=1)=>{const state=initialState(false);state.profile.name=name;return {state,dirty,revision}};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function reset(){globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.window=new EventTarget();Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});}
function storeRecord(id,value){localStorage.setItem('kalora-v1-'+id,JSON.stringify(value))}
test('diary account isolation and stale actions',async t=>{
 await t.test('two tabs switching A to B cannot save or mutate old A view',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('A'));storeRecord('B',record('B'));
  const calls=[];globalThis.fetch=async(url,opts)=>{calls.push({url,opts});return response(200,{state:record(getSession().user.id).state,revision:1})};
  const store=new DiaryStore();await store.boot();const oldAction=store.captureAction();
  const stop=subscribeAuth(()=>void store.boot());
  // Storage changes before event delivery, so owner guard must work immediately.
  localStorage.setItem('kalora-session',JSON.stringify(valid('B')));
  assert.equal(store.update(s=>({...s,profile:{...s.profile,name:'wrong'}}),oldAction),false);
  await store.sync(oldAction);assert.equal(calls.filter(c=>c.url.includes('save_diary')).length,0);
  const event=new Event('storage');Object.defineProperty(event,'key',{value:'kalora-session'});window.dispatchEvent(event);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(store.getView().state.profile.name,'B');
  assert.equal(JSON.parse(localStorage.getItem('kalora-v1-A')).state.profile.name,'A');stop();
 });
 await t.test('late load and save cannot apply A results after switching to B',async()=>{
  for(const kind of ['load','save']){
   reset();saveSession(valid('A'));storeRecord('A',record('A'));storeRecord('B',record('B'));
   const delayed=deferred(),started=deferred();let delay=kind==='load';
   globalThis.fetch=async(url,opts)=>{const owner=opts.headers.Authorization.slice(7);if(owner==='A'&&delay){started.resolve();return delayed.promise}return response(200,{state:record(owner).state,revision:owner==='B'?3:1})};
   const store=new DiaryStore();let pending;
   if(kind==='load')pending=store.boot();else{await store.boot();store.update(s=>withWaterEntries(s,[makeWaterEntry(250,'2026-10-14')]));delay=true;pending=store.sync()}
   await started.promise;saveSession(valid('B'));await store.boot();delayed.resolve(response(200,{state:record('stale A').state,revision:99}));await pending;
   assert.equal(store.getView().state.profile.name,'B');assert.equal(JSON.parse(localStorage.getItem('kalora-v1-B')).revision,3);
  }
 });
 await t.test('render-bound Undo callback cannot mutate B after A -> B -> A reboot',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('A'));globalThis.fetch=async()=>response(200,{state:record('A').state,revision:1});
  const store=new DiaryStore();await store.boot();const action=store.captureAction();
  saveSession(valid('B'));saveSession(valid('A'));await store.boot();
  assert.equal(store.update(s=>({...s,profile:{...s.profile,name:'stale undo'}}),action),false);assert.equal(store.getView().state.profile.name,'A');
 });
 await t.test('edits made while same-account save is pending remain dirty with new revision',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('A'));globalThis.fetch=async()=>response(200,{state:record('A').state,revision:1});
  const store=new DiaryStore();await store.boot();store.update(s=>withWaterEntries(s,[makeWaterEntry(250,'2026-10-14')]));
  const delayed=deferred(),started=deferred();globalThis.fetch=async()=>{started.resolve();return delayed.promise};const pending=store.sync();await started.promise;
  store.update(s=>withWaterEntries(s,[...s.waterEntries,makeWaterEntry(500,'2026-10-14')]));delayed.resolve(response(200,{revision:2}));await pending;
  const local=JSON.parse(localStorage.getItem('kalora-v1-A'));assert.equal(local.state.water['2026-10-14'],750);assert.equal(local.revision,2);assert.equal(local.dirty,true);
 });
});

test('diary recovery, revision conflicts and clean pulls',async t=>{
 await t.test('corrupt main is preserved and cloud is checked before explicit recovery',async()=>{
  reset();saveSession(valid('A'));localStorage.setItem('kalora-v1-A','{original corrupt');const calls=[];
  globalThis.fetch=async(url)=>{calls.push(url);return response(200,{state:record('cloud A').state,revision:7})};
  const store=new DiaryStore();await store.boot();assert.equal(calls.length,1);assert.equal(store.getView().state,null);assert.equal(store.getView().recovery,'corrupt');assert.equal(store.getView().cloudAvailable,true);
  assert.equal(localStorage.getItem('kalora-v1-A'),'{original corrupt');assert.equal(store.getBackups().length,1);assert.equal(store.getRecoveryExport().content,'{original corrupt');
  await store.reloadCloud();assert.equal(store.getView().state.profile.name,'cloud A');assert.equal(store.getView().recovery,null);
  assert.equal(store.getRecoveryExport(store.getBackups()[0].id).content,'{original corrupt');assert.equal(JSON.parse(localStorage.getItem('kalora-v1-A')).revision,7);
 });
 await t.test('corrupt offline record stays intact; explicit reset keeps its recovery backup',async()=>{
  reset();navigator.onLine=false;saveSession(valid('A'));localStorage.setItem('kalora-v1-A','[broken');
  globalThis.fetch=async()=>assert.fail('offline boot must not call cloud');const store=new DiaryStore();await store.boot();
  assert.equal(localStorage.getItem('kalora-v1-A'),'[broken');assert.equal(store.getView().state,null);assert.equal(store.resetCorruptLocal(),true);
  assert.ok(store.getView().state);assert.equal(store.getRecoveryExport(store.getBackups().find(b=>!b.readable).id).content,'[broken');
 });
 await t.test('boot conflict automatically preserves exact local before cloud replacement',async()=>{
  reset();saveSession(valid('A'));const local=record('local A',true,2);local.state=withWaterEntries(local.state,[makeWaterEntry(500,'2026-10-14')]);storeRecord('A',local);const raw=localStorage.getItem('kalora-v1-A');
  globalThis.fetch=async()=>response(200,{state:record('remote A').state,revision:3});const store=new DiaryStore();await store.boot();
  assert.equal(store.getView().state.profile.name,'local A');assert.equal(store.getView().recovery,'conflict');assert.equal(store.getBackups().filter(b=>b.reason==='conflict').length,1);
  const conflictBackup=store.getBackups().find(b=>b.reason==='conflict');const envelope=JSON.parse(localStorage.getItem(conflictBackup.id));assert.equal(envelope.raw,raw);
  const exported=store.getRecoveryExport(conflictBackup.id);assert.equal(exported.readable,true);assert.equal(JSON.parse(exported.content).water['2026-10-14'],500);
  await store.reloadCloud();assert.equal(store.getView().state.profile.name,'remote A');assert.equal(store.getView().recovery,null);
  assert.ok(store.getBackups().some(backup=>JSON.parse(store.getRecoveryExport(backup.id).content).profile.name==='local A'));
 });
 await t.test('save conflict backs up local state and blocks repeated overwrite attempts',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('local A'));globalThis.fetch=async()=>response(200,{state:record('local A').state,revision:1});const store=new DiaryStore();await store.boot();
  store.update(s=>withWaterEntries(s,[makeWaterEntry(750,'2026-10-14')]));let calls=0;globalThis.fetch=async()=>{calls++;return response(409,{message:'CONFLICT'})};
  await assert.rejects(store.sync(),/CONFLICT/);assert.equal(store.getBackups().filter(b=>b.reason==='conflict').length,1);assert.equal(JSON.parse(store.getRecoveryExport(store.getBackups().find(b=>b.reason==='conflict').id).content).water['2026-10-14'],750);
  await assert.rejects(store.sync(),/sukob/);assert.equal(calls,1);
 });
 await t.test('manual synchronization pulls changes when the local diary is clean',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('local',false,1));let remote=record('local',false,1);const calls=[];
  globalThis.fetch=async(url)=>{calls.push(url);return response(200,{state:remote.state,revision:remote.revision})};const store=new DiaryStore();await store.boot();
  remote=record('another device',false,2);await store.sync();assert.equal(store.getView().state.profile.name,'another device');assert.equal(calls.length,2);assert.ok(calls.every(url=>url.includes('load_diary')));
 });
 await t.test('clean pull cannot overwrite edits added while request is pending',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('local'));globalThis.fetch=async()=>response(200,{state:record('local').state,revision:1});const store=new DiaryStore();await store.boot();
  const delayed=deferred(),started=deferred();globalThis.fetch=async()=>{started.resolve();return delayed.promise};const pending=store.sync();await started.promise;
  store.update(s=>withWaterEntries(s,[makeWaterEntry(250,'2026-10-14')]));delayed.resolve(response(200,{state:record('remote').state,revision:2}));await pending;
  assert.equal(store.getView().state.water['2026-10-14'],250);assert.equal(store.getView().recovery,'conflict');assert.equal(store.getBackups().filter(b=>b.reason==='conflict').length,1);
 });
 await t.test('reload must be repeated if the user adds entries while it is loading',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('local'));globalThis.fetch=async()=>response(200,{state:record('local').state,revision:1});const store=new DiaryStore();await store.boot();
  const delayed=deferred(),started=deferred();globalThis.fetch=async()=>{started.resolve();return delayed.promise};const pending=store.reloadCloud();await started.promise;
  store.update(s=>withWaterEntries(s,[makeWaterEntry(250,'2026-10-14')]));delayed.resolve(response(200,{state:record('remote').state,revision:2}));await pending;
  assert.equal(store.getView().state.water['2026-10-14'],250);assert.match(store.getView().error,/tijekom učitavanja/);
 });
 await t.test('storage-full prevents cloud replacement instead of discarding unsaved local state',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('local',true,1));globalThis.fetch=async()=>response(200,{state:record('remote').state,revision:2});const store=new DiaryStore();await store.boot();
  // Existing auto conflict backup means next snapshot must differ to test a write.
  store.update(s=>withWaterEntries(s,[makeWaterEntry(250,'2026-10-14')]));const set=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key.startsWith('kalora-backup'))throw new Error('quota');set(key,value)};
  await store.reloadCloud();assert.equal(store.getView().state.profile.name,'local');assert.equal(store.getView().state.water['2026-10-14'],250);assert.match(store.getView().error,/Sigurnosnu kopiju/);
 });
 await t.test('backup restoration is account-scoped and preserved local exports are importable',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('A'));globalThis.fetch=async()=>response(200,{state:record('A').state,revision:1});const store=new DiaryStore();await store.boot();
  assert.equal(store.backupCurrent('before-import'),true);const backup=store.getBackups()[0];store.update(s=>({...s,profile:{...s.profile,name:'imported'}}));assert.equal(store.restoreBackup(backup.id),true);assert.equal(store.getView().state.profile.name,'A');assert.equal(store.getView().dirty,true);
  saveSession(valid('B'));globalThis.fetch=async()=>response(200,{state:record('B').state,revision:1});await store.boot();assert.equal(store.getBackups().length,0);assert.equal(store.getRecoveryExport(backup.id),null);assert.equal(store.restoreBackup(backup.id),false);assert.equal(store.getView().state.profile.name,'B');
 });
 await t.test('disposed controller cannot boot, apply replies or persist old callbacks',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('A'));const delayed=deferred(),started=deferred();globalThis.fetch=async()=>{started.resolve();return delayed.promise};const store=new DiaryStore();const pending=store.boot();await started.promise;store.dispose();delayed.resolve(response(200,{state:record('late').state,revision:8}));await pending;
  assert.equal(store.update(s=>s),false);await store.boot();assert.equal(JSON.parse(localStorage.getItem('kalora-v1-A')).state.profile.name,'A');
 });
});

test('cloud validation failure leaves the current diary and revisions recoverable',async()=>{
 reset();saveSession(valid('A'));storeRecord('A',record('local'));globalThis.fetch=async()=>response(200,{state:record('local').state,revision:1});const store=new DiaryStore();await store.boot();
 globalThis.fetch=async()=>response(200,{state:record('invalid revision').state,revision:'NaN'});await assert.rejects(store.sync(),/nevaljanu reviziju/);assert.equal(store.getView().state.profile.name,'local');assert.equal(JSON.parse(localStorage.getItem('kalora-v1-A')).revision,1);
 store.update(s=>withWaterEntries(s,[makeWaterEntry(250,'2026-10-14')]));await assert.rejects(store.sync(),/nevaljanu reviziju/);assert.equal(store.getView().state.water['2026-10-14'],250);assert.equal(JSON.parse(localStorage.getItem('kalora-v1-A')).dirty,true);
});

test('same-account tabs preserve both local branches before replacing the main diary',async t=>{
 await t.test('write-ahead journals retain both operations when both main checks pass before writes',async()=>{
  reset();navigator.onLine=false;saveSession(valid('A'));storeRecord('A',record('A'));const one=new DiaryStore(),two=new DiaryStore();await Promise.all([one.boot(),two.boot()]);
  const set=localStorage.setItem;let interleaved=false;
  localStorage.setItem=(key,value)=>{
   if(key==='kalora-v1-A'&&!interleaved){interleaved=true;two.update(s=>withWaterEntries(s,[makeWaterEntry(500,'2026-10-14')]))}
   set(key,value);
  };
  one.update(s=>withWaterEntries(s,[makeWaterEntry(250,'2026-10-14')]));
  // Both stores read the original main before either main write committed. The
  // ordinary CAS check misses that window, but their distinct journals survive.
  assert.equal(interleaved,true);assert.equal(JSON.parse(localStorage.getItem('kalora-v1-A')).state.water['2026-10-14'],250);
  const journals=one.getBackups().filter(b=>b.reason==='pending-tab');assert.equal(journals.length,2);
  assert.deepEqual(journals.map(b=>JSON.parse(one.getRecoveryExport(b.id).content).water['2026-10-14']).sort((a,b)=>a-b),[250,500]);
  const reopened=new DiaryStore();await reopened.boot();assert.equal(reopened.getView().recovery,'conflict');assert.ok(reopened.getBackups().some(b=>JSON.parse(reopened.getRecoveryExport(b.id).content).water['2026-10-14']===500));
 });
 await t.test('one latest journal per tab is updated in place and only own acknowledged branch is removed',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('A'));globalThis.fetch=async()=>response(200,{state:record('A').state,revision:1});const one=new DiaryStore(),two=new DiaryStore();await Promise.all([one.boot(),two.boot()]);
  one.update(s=>withWaterEntries(s,[makeWaterEntry(250,'2026-10-14')]));const first=one.getBackups().find(b=>b.reason==='pending-tab').id;
  one.update(s=>withWaterEntries(s,[...s.waterEntries,makeWaterEntry(100,'2026-10-14')]));assert.equal(one.getBackups().filter(b=>b.reason==='pending-tab').length,1);assert.equal(one.getBackups().find(b=>b.reason==='pending-tab').id,first);
  // An independent pending branch exists before the save, but the main remains
  // this store's exact snapshot. Its ACK may clear only this store's journal.
  const {writeDiaryJournal}=await import('../lib/diary-storage.ts');writeDiaryJournal('A','other-writer',JSON.stringify(record('other branch',true,1)),null);
  globalThis.fetch=async()=>response(200,{revision:2});await one.sync();const pending=one.getBackups().filter(b=>b.reason==='pending-tab');assert.equal(pending.length,1);assert.ok(pending[0].id.endsWith('other-writer'));assert.equal(localStorage.getItem(first),null);
 });
 await t.test('explicit conflict resolution freezes pending branches and does not reflag unchanged journals',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('A'));const {writeDiaryJournal}=await import('../lib/diary-storage.ts');const branch=record('other branch',true,1);writeDiaryJournal('A','other-writer',JSON.stringify(branch),null);
  globalThis.fetch=async()=>response(200,{state:record('cloud').state,revision:2});const store=new DiaryStore();await store.boot();assert.equal(store.getView().recovery,'conflict');await store.reloadCloud();assert.equal(store.getView().recovery,null);
  const reopened=new DiaryStore();await reopened.boot();assert.equal(reopened.getView().recovery,null);assert.ok(reopened.getBackups().some(b=>JSON.parse(reopened.getRecoveryExport(b.id).content).profile.name==='other branch'));
  branch.state.profile.name='new operation after resolution';writeDiaryJournal('A','other-writer',JSON.stringify(branch),JSON.stringify(record('other branch',true,1)));await reopened.boot();assert.equal(reopened.getView().recovery,'conflict');
 });
 await t.test('offline stale tab keeps the other tab main and archives its new water operation',async()=>{
  reset();navigator.onLine=false;saveSession(valid('A'));storeRecord('A',record('A'));
  const one=new DiaryStore(),two=new DiaryStore();await Promise.all([one.boot(),two.boot()]);
  one.update(s=>withWaterEntries(s,[...s.waterEntries,makeWaterEntry(250,'2026-10-14')]));const firstRaw=localStorage.getItem('kalora-v1-A');
  assert.equal(two.update(s=>withWaterEntries(s,[...s.waterEntries,makeWaterEntry(500,'2026-10-14')])),true);
  assert.equal(localStorage.getItem('kalora-v1-A'),firstRaw);assert.equal(two.getView().state.water['2026-10-14'],500);assert.equal(two.getView().recovery,'conflict');
  const totals=two.getBackups().map(b=>JSON.parse(two.getRecoveryExport(b.id).content).water['2026-10-14']??0);
  assert.ok(totals.includes(250));assert.ok(totals.includes(500));await assert.rejects(two.sync(),/sukob/);
  const reopened=new DiaryStore();await reopened.boot();assert.equal(reopened.getView().state.water['2026-10-14'],250);assert.ok(reopened.getBackups().some(b=>JSON.parse(reopened.getRecoveryExport(b.id).content).water['2026-10-14']===500));
 });
 await t.test('late same-account cloud save cannot erase another tab unsaved main',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('A'));globalThis.fetch=async()=>response(200,{state:record('A').state,revision:1});
  const one=new DiaryStore(),two=new DiaryStore();await Promise.all([one.boot(),two.boot()]);
  one.update(s=>withWaterEntries(s,[makeWaterEntry(250,'2026-10-14')]));
  const delayed=deferred(),started=deferred();globalThis.fetch=async()=>{started.resolve();return delayed.promise};const pending=one.sync();await started.promise;
  // A separate tab has a branch from the same revision, written before it knows
  // about the first tab's save. It must remain recoverable after that save reply.
  const other=record('other tab',true,1);other.state=withWaterEntries(other.state,[makeWaterEntry(500,'2026-10-14')]);storeRecord('A',other);const otherRaw=localStorage.getItem('kalora-v1-A');
  delayed.resolve(response(200,{revision:2}));await pending;
  assert.equal(localStorage.getItem('kalora-v1-A'),otherRaw);assert.equal(one.getView().recovery,'conflict');assert.equal(one.getView().state.water['2026-10-14'],250);
  const totals=one.getBackups().map(b=>JSON.parse(one.getRecoveryExport(b.id).content).water['2026-10-14']);assert.ok(totals.includes(250));assert.ok(totals.includes(500));
 });
 await t.test('cloud boot cannot overwrite same-account edits made while it loads',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('A'));const delayed=deferred(),started=deferred();globalThis.fetch=async()=>{started.resolve();return delayed.promise};
  const store=new DiaryStore();const pending=store.boot();await started.promise;
  const other=record('other tab',true,1);other.state=withWaterEntries(other.state,[makeWaterEntry(500,'2026-10-14')]);storeRecord('A',other);const raw=localStorage.getItem('kalora-v1-A');
  delayed.resolve(response(200,{state:record('A').state,revision:1}));await pending;
  assert.equal(localStorage.getItem('kalora-v1-A'),raw);assert.equal(store.getView().recovery,'conflict');assert.ok(store.getBackups().some(b=>JSON.parse(store.getRecoveryExport(b.id).content).water['2026-10-14']===500));
 });
 await t.test('full storage retains other tab main and visible new operation with an export warning',async()=>{
  reset();navigator.onLine=false;saveSession(valid('A'));storeRecord('A',record('A'));const store=new DiaryStore();await store.boot();
  const other=record('other tab',true,1);storeRecord('A',other);const raw=localStorage.getItem('kalora-v1-A');const set=localStorage.setItem;
  localStorage.setItem=(key,value)=>{if(key.startsWith('kalora-backup'))throw new Error('quota');set(key,value)};
  store.update(s=>withWaterEntries(s,[makeWaterEntry(500,'2026-10-14')]));assert.equal(localStorage.getItem('kalora-v1-A'),raw);assert.equal(store.getView().state.water['2026-10-14'],500);assert.match(store.getView().error,/Izvezi trenutačni dnevnik/);
 });
 await t.test('failed main write during explicit recovery keeps the persistence warning and original',async()=>{
  reset();saveSession(valid('A'));storeRecord('A',record('local',true,1));globalThis.fetch=async()=>response(200,{state:record('remote').state,revision:2});const store=new DiaryStore();await store.boot();const raw=localStorage.getItem('kalora-v1-A');const set=localStorage.setItem;
  localStorage.setItem=(key,value)=>{if(key==='kalora-v1-A')throw new Error('quota');set(key,value)};
  await store.reloadCloud();assert.equal(localStorage.getItem('kalora-v1-A'),raw);assert.match(store.getView().error,/Spremanje na uređaj nije uspjelo/);assert.equal(store.getView().recovery,'conflict');assert.ok(store.getBackups().some(b=>JSON.parse(store.getRecoveryExport(b.id).content).profile.name==='local'));
 });
});

test('a writer already inside persistence cannot recreate data after confirmed deletion',async t=>{
 const {markAccountDiaryDeleted,clearAccountDiary}=await import('../lib/diary-storage.ts');
 for(const boundary of ['read-main','write-journal','write-main','write-backup'])await t.test(boundary,async()=>{
  reset();navigator.onLine=false;saveSession(valid('delete-mid-write-A'));storeRecord('delete-mid-write-A',record('A'));localStorage.setItem('kalora-v1-keep-B','B diary');localStorage.setItem('kalora-v1-guest','guest diary');const store=new DiaryStore();await store.boot();const before=store.getView();let publications=0;store.subscribe(()=>publications++);
  if(boundary==='write-backup')storeRecord('delete-mid-write-A',record('other A tab',true,1));
  const get=localStorage.getItem,set=localStorage.setItem;let interleaved=false;
  const confirmedDelete=()=>{interleaved=true;markAccountDiaryDeleted('delete-mid-write-A');saveSession(null);clearAccountDiary('delete-mid-write-A')};
  localStorage.getItem=key=>{const value=get(key);if(boundary==='read-main'&&key==='kalora-v1-delete-mid-write-A'&&!interleaved)confirmedDelete();return value};
  localStorage.setItem=(key,value)=>{
   const matches=boundary==='write-main'?key==='kalora-v1-delete-mid-write-A':boundary==='write-journal'?key.startsWith('kalora-backup-v1-delete-mid-write-A-journal-'):boundary==='write-backup'?key.startsWith('kalora-backup-v1-delete-mid-write-A-')&&!key.includes('-journal-'):false;
   if(matches&&!interleaved)confirmedDelete();set(key,value);
  };
  assert.equal(store.update(s=>withWaterEntries(s,[makeWaterEntry(500,'2026-10-14')])),false);assert.equal(interleaved,true);assert.equal(publications,0);assert.equal(store.getView(),before);assert.equal(getSession(),null);
  assert.equal(localStorage.getItem('kalora-v1-delete-mid-write-A'),null);assert.equal(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(key=>key.startsWith('kalora-backup-v1-delete-mid-write-A-')).length,0);assert.equal(localStorage.getItem('kalora-v1-keep-B'),'B diary');assert.equal(localStorage.getItem('kalora-v1-guest'),'guest diary');
  localStorage.getItem=get;localStorage.setItem=set;
 });
 await t.test('ordinary account switch during a write preserves A recovery data and B main',async()=>{
  reset();navigator.onLine=false;saveSession(valid('A'));storeRecord('A',record('A'));storeRecord('B',record('B'));const store=new DiaryStore();await store.boot();const before=store.getView(),bRaw=localStorage.getItem('kalora-v1-B');const set=localStorage.setItem;let switched=false;
  localStorage.setItem=(key,value)=>{if(key.startsWith('kalora-backup-v1-A-journal-')&&!switched){switched=true;saveSession(valid('B'))}set(key,value)};
  assert.equal(store.update(s=>withWaterEntries(s,[makeWaterEntry(500,'2026-10-14')])),false);assert.equal(getSession().user.id,'B');assert.equal(store.getView(),before);assert.equal(localStorage.getItem('kalora-v1-B'),bRaw);assert.ok(localStorage.getItem('kalora-v1-A'));assert.ok(store.getBackups(store.captureAction()).length===0);assert.ok(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).some(key=>key.startsWith('kalora-backup-v1-A-journal-')));
  localStorage.setItem=set;
 });
 await t.test('save acknowledgement cannot publish or recreate A data if deletion interrupts main persistence',async()=>{
  reset();saveSession(valid('ack-delete-A'));storeRecord('ack-delete-A',record('A'));localStorage.setItem('kalora-v1-keep-B','B diary');localStorage.setItem('kalora-v1-guest','guest diary');globalThis.fetch=async()=>response(200,{state:record('A').state,revision:1});const store=new DiaryStore();await store.boot();store.update(s=>withWaterEntries(s,[makeWaterEntry(500,'2026-10-14')]));
  const delayed=deferred(),started=deferred();globalThis.fetch=async()=>{started.resolve();return delayed.promise};const pending=store.sync();await started.promise;const before=store.getView();let publications=0;store.subscribe(()=>publications++);const set=localStorage.setItem;let deleted=false;
  localStorage.setItem=(key,value)=>{if(key==='kalora-v1-ack-delete-A'&&!deleted){deleted=true;markAccountDiaryDeleted('ack-delete-A');saveSession(null);clearAccountDiary('ack-delete-A')}set(key,value)};
  delayed.resolve(response(200,{revision:2}));await pending;assert.equal(deleted,true);assert.equal(store.getView(),before);assert.equal(publications,0);assert.equal(localStorage.getItem('kalora-v1-ack-delete-A'),null);assert.equal(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(key=>key.startsWith('kalora-backup-v1-ack-delete-A-')).length,0);assert.equal(localStorage.getItem('kalora-v1-keep-B'),'B diary');assert.equal(localStorage.getItem('kalora-v1-guest'),'guest diary');
  localStorage.setItem=set;
 });
});
