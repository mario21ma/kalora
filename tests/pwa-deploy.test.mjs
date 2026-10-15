import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const worker=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
const cacheName=worker.match(/^const CACHE='(kalora-shell-v\d+)';/m)?.[1];
assert(cacheName,'Worker must declare a versioned shell cache');
const cacheVersion=cacheName.slice('kalora-shell-'.length),previousVersion=`v${Number(cacheVersion.slice(1))-1}`,previousCache=`kalora-shell-${previousVersion}`;
// Observe the native background lifetime so race assertions run after the old
// navigation has finished saving. CacheStorage, fetch and Response stay native.
const completionObserver=`self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate')return;
 const waitUntil=event.waitUntil.bind(event);
 event.waitUntil=work=>{
  waitUntil(work);
  waitUntil(Promise.resolve(work).then(async()=>{
   const client=await self.clients.get(event.resultingClientId);
   client?.postMessage({type:'fixture-navigation-complete'});
  },()=>{}));
 };
});\n`;
let browser;
before(async()=>{browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),headless:true,args:['--no-sandbox']})});
after(async()=>{await browser?.close()});

// Real browser, native Response bodies, real CacheStorage and service worker.
// Only the deployment server is synthetic; no real production/AI data is used.
async function fixture(run,{cacheVersion:initialVersion=cacheVersion}={}){
 const deployment={revision:1,ready:true,cacheVersion:initialVersion,privateRoot:false,privateAsset:false},holds=new Map(),pending=new Set();
 const holdNext=path=>{
  let resolve,release;
  const held=new Promise(done=>{resolve=done});
  holds.set(path,publish=>{release=publish;pending.add(publish);resolve()});
  return {held,release:()=>{assert(release,'Held response must have arrived');pending.delete(release);release()}};
 };
 const serve=(path,response,status,headers,body)=>{
  const hold=holds.get(path);
  // Send no-store headers before holding a document body, so Chromium does not
  // coalesce a second tab's request behind the first HTTP cache transaction.
  response.writeHead(status,headers);
  if(hold){response.flushHeaders();holds.delete(path);hold(()=>response.end(body))}else response.end(body);
 };
 const server=createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost'),path=url.pathname;
  if(path==='/sw.js'){response.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-cache'});return response.end(completionObserver+worker.replace(`'${cacheName}'`,`'kalora-shell-${deployment.cacheVersion}'`))}
  if(path==='/manifest.json'){response.writeHead(200,{'Content-Type':'application/json'});return response.end('{}')}
  if(path.endsWith('.png')){response.writeHead(200,{'Content-Type':'image/png'});return response.end('fixture asset')}
  if(path.startsWith('/_next/static/')){
   if(!deployment.ready&&path.endsWith('v2b.js')){response.writeHead(404);return response.end('missing asset')}
   return serve(path,response,200,{'Content-Type':'text/javascript',...(path.endsWith('private.js')?{'Cache-Control':'private'}:{})},`window.assetVersions=(window.assetVersions||[]).concat(${JSON.stringify(path)});`);
  }
  if(path.startsWith('/api/')||request.headers.rsc||url.searchParams.has('_rsc')){response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private'});return response.end('{"private":true}')}
  const heading=path==='/'?`Shell-v${deployment.revision}`:path==='/privacy'?`Politika privatnosti-v${deployment.revision}`:path==='/terms'?`Uvjeti korištenja-v${deployment.revision}`:'Other page';
  serve(path,response,200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':deployment.privateRoot&&path==='/'?'private, no-store':'no-store'},`<!doctype html><html lang="hr"><h1>${heading}</h1><script src="/_next/static/v${deployment.revision}a.js"></script>${deployment.revision===2?'<script src="/_next/static/v2b.js"></script>':''}${deployment.privateAsset?'<script src="/_next/static/private.js"></script>':''}<script>navigator.serviceWorker.register('/sw.js')</script></html>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`,context=await browser.newContext();
 await context.addInitScript(()=>{
  window.fixtureNavigationComplete=new Promise(resolve=>{
   const complete=event=>{if(event.data?.type==='fixture-navigation-complete'){navigator.serviceWorker.removeEventListener('message',complete);resolve()}};
   navigator.serviceWorker.addEventListener('message',complete);
  });
 });
 const page=await context.newPage();
 context.setDefaultTimeout(8000);
 try{await run({deployment,origin,context,page,holdNext})}
 finally{for(const publish of pending)publish();await context.close();await new Promise(resolve=>server.close(resolve))}
}
async function install(page,origin){
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}))});
}
const cachedRoot=(page,name=cacheName)=>page.evaluate(async name=>(await(await caches.open(name)).match('/'))?.text(),name);
async function waitCachedVersion(page,version,name=cacheName){
 await page.waitForFunction(async({version,name})=>{const response=await(await caches.open(name)).match('/');return response&&(await response.text()).includes(`Shell-v${version}`)},{version,name});
}
const waitNavigationSave=page=>page.evaluate(()=>window.fixtureNavigationComplete);

test('V1 → incomplete V2 retains V1; complete V2 survives offline reopening',{timeout:30000},async()=>{
 await fixture(async({deployment,origin,context,page})=>{
  await install(page,origin);await waitCachedVersion(page,1);
  deployment.revision=2;deployment.ready=false;
  await page.goto(origin,{waitUntil:'networkidle'});assert.equal(await page.locator('h1').textContent(),'Shell-v2');
  await context.setOffline(true);await page.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await page.locator('h1').textContent(),'Shell-v1');assert.match(await cachedRoot(page),/Shell-v1/);
  await context.setOffline(false);deployment.ready=true;
  await page.goto(origin,{waitUntil:'networkidle'});await waitCachedVersion(page,2);
  await context.setOffline(true);await page.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await page.locator('h1').textContent(),'Shell-v2');
  assert.deepEqual(await page.evaluate(()=>window.assetVersions),['/_next/static/v2a.js','/_next/static/v2b.js']);
  // Closing/reopening a page exercises persistent shell and asset storage.
  await page.close();const reopened=await context.newPage();await reopened.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await reopened.locator('h1').textContent(),'Shell-v2');
 });
});

test('two tabs keep complete V2 after an older V1 startup asset finishes late',{timeout:30000},async()=>{
 await fixture(async({deployment,origin,context,page:tabA,holdNext})=>{
  await install(tabA,origin);await waitCachedVersion(tabA,1);
  const delayed=holdNext('/_next/static/v1a.js');
  await tabA.goto(origin,{waitUntil:'load'});await delayed.held;
  assert.equal(await tabA.locator('h1').textContent(),'Shell-v1');
  deployment.revision=2;
  const tabB=await context.newPage();await tabB.goto(origin,{waitUntil:'networkidle'});await waitCachedVersion(tabB,2);
  assert.equal(await tabB.locator('h1').textContent(),'Shell-v2');
  delayed.release();await waitNavigationSave(tabA);
  assert.match(await cachedRoot(tabB),/Shell-v2/);
  await context.setOffline(true);await tabA.close();await tabB.close();
  const reopened=await context.newPage();await reopened.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await reopened.locator('h1').textContent(),'Shell-v2');
  assert.deepEqual(await reopened.evaluate(()=>window.assetVersions),['/_next/static/v2a.js','/_next/static/v2b.js']);
 });
});

test('two tabs keep the newest shell when an older document body arrives late',{timeout:30000},async()=>{
 await fixture(async({deployment,origin,context,page:tabA,holdNext})=>{
  await install(tabA,origin);await waitCachedVersion(tabA,1);
  const delayed=holdNext('/'),navigation=tabA.goto(origin,{waitUntil:'networkidle'});
  await delayed.held;deployment.revision=2;
  const tabB=await context.newPage();await tabB.goto(origin,{waitUntil:'networkidle'});await waitCachedVersion(tabB,2);
  delayed.release();await navigation;await waitNavigationSave(tabA);
  assert.equal(await tabA.locator('h1').textContent(),'Shell-v1');
  assert.match(await cachedRoot(tabB),/Shell-v2/);
  await context.setOffline(true);await tabB.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await tabB.locator('h1').textContent(),'Shell-v2');
  assert.deepEqual(await tabB.evaluate(()=>window.assetVersions),['/_next/static/v2a.js','/_next/static/v2b.js']);
 });
});

test('failed installation preserves the previous active cache until a complete upgrade',{timeout:30000},async()=>{
 await fixture(async({deployment,origin,context,page})=>{
  await install(page,origin);await waitCachedVersion(page,1,previousCache);
  deployment.revision=2;deployment.ready=false;deployment.cacheVersion=cacheVersion;
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();if(registration.installing)await new Promise(resolve=>{const worker=registration.installing;worker.addEventListener('statechange',()=>{if(worker.state==='redundant')resolve()})})});
  assert((await page.evaluate(()=>caches.keys())).includes(previousCache));
  await context.setOffline(true);await page.goto(origin,{waitUntil:'networkidle'});assert.equal(await page.locator('h1').textContent(),'Shell-v1');
  await context.setOffline(false);deployment.ready=true;
  await page.evaluate(async()=>{
   const registration=await navigator.serviceWorker.getRegistration();await registration.update();
   // Cache deletion happens inside activate before clients.claim(). Waiting for
   // active===controller alone can therefore accidentally accept the old worker.
   const updated=registration.installing||registration.waiting||registration.active;
   if(updated.state!=='activated')await new Promise((resolve,reject)=>updated.addEventListener('statechange',()=>{if(updated.state==='activated')resolve();if(updated.state==='redundant')reject(new Error('Updated worker failed installation'))}));
   if(navigator.serviceWorker.controller!==updated)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>{if(navigator.serviceWorker.controller===updated)resolve()}));
  });
  await page.waitForFunction(async({cacheName,previousCache})=>{const keys=await caches.keys();return keys.includes(cacheName)&&!keys.includes(previousCache)},{cacheName,previousCache});
  await waitCachedVersion(page,2);
  await page.waitForFunction(async()=>{const registration=await navigator.serviceWorker.getRegistration();return registration.active?.state==='activated'&&navigator.serviceWorker.controller===registration.active});
  await context.setOffline(true);await page.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await page.locator('h1').textContent(),'Shell-v2');
 },{cacheVersion:previousVersion});
});

test('a worker upgrade preserves the new cache while older work is still pending',{timeout:30000},async()=>{
 await fixture(async({deployment,origin,context,page,holdNext})=>{
  await install(page,origin);await waitCachedVersion(page,1,previousCache);
  const delayed=holdNext('/_next/static/v1a.js');
  await page.goto(origin,{waitUntil:'load'});await delayed.held;
  deployment.revision=2;deployment.cacheVersion=cacheVersion;
  const upgrading=page.evaluate(async()=>{
   const registration=await navigator.serviceWorker.getRegistration();await registration.update();
   const updated=registration.installing||registration.waiting||registration.active;
   if(updated.state!=='activated')await new Promise((resolve,reject)=>updated.addEventListener('statechange',()=>{if(updated.state==='activated')resolve();if(updated.state==='redundant')reject(new Error('Updated worker failed installation'))}));
   if(navigator.serviceWorker.controller!==updated)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>{if(navigator.serviceWorker.controller===updated)resolve()}));
  });
  // Chromium can defer activation until the older fetch lifetime completes.
  // Installation has its own versioned cache before that lifetime ends.
  await waitCachedVersion(page,2);delayed.release();await waitNavigationSave(page);await upgrading;
  assert.match(await cachedRoot(page),/Shell-v2/);
  assert(!(await page.evaluate(()=>caches.keys())).includes(previousCache));
  await context.setOffline(true);await page.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await page.locator('h1').textContent(),'Shell-v2');
  assert.deepEqual(await page.evaluate(()=>window.assetVersions),['/_next/static/v2a.js','/_next/static/v2b.js']);
 },{cacheVersion:previousVersion});
});

test('a page with a private startup asset never replaces the public cached shell',{timeout:30000},async()=>{
 await fixture(async({deployment,origin,context,page})=>{
  await install(page,origin);await waitCachedVersion(page,1);
  deployment.revision=2;deployment.privateAsset=true;
  await page.goto(origin,{waitUntil:'networkidle'});assert.equal(await page.locator('h1').textContent(),'Shell-v2');
  const keys=await page.evaluate(async()=>Promise.all((await caches.keys()).map(async name=>(await(await caches.open(name)).keys()).map(request=>request.url))));
  assert(!keys.flat().some(url=>url.includes('private.js')));
  await context.setOffline(true);await page.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await page.locator('h1').textContent(),'Shell-v1');
 });
});

test('offline privacy and terms keep their own documents; an unknown route returns 503',{timeout:30000},async()=>{
 await fixture(async({origin,context,page})=>{
  await install(page,origin);await context.setOffline(true);
  for(const [path,heading] of [['/privacy','Politika privatnosti-v1'],['/terms','Uvjeti korištenja-v1']]){
   const response=await page.goto(origin+path,{waitUntil:'networkidle'});assert.equal(response.status(),200);assert.equal(await page.locator('h1').textContent(),heading);
  }
  const unavailable=await page.goto(origin+'/uncached-page',{waitUntil:'networkidle'});
  assert.equal(unavailable.status(),503);assert.equal(await page.locator('h1').textContent(),'Stranica nije dostupna izvan mreže');
  assert.equal(await page.getByRole('link',{name:'Natrag u Kaloru'}).getAttribute('href'),'/');
 });
});

test('private/API/RSC responses never replace the public offline shell',{timeout:30000},async()=>{
 await fixture(async({deployment,origin,context,page})=>{
  await install(page,origin);deployment.privateRoot=true;deployment.revision=2;
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
   await fetch('/api/private');await fetch('/? _rsc=private'.replace(' ',''));await fetch('/',{headers:{RSC:'1'}});
   await fetch('/',{headers:{Authorization:'Bearer fake-token'}});await fetch('/_next/static/private.js');
  });
  const keys=await page.evaluate(async()=>Promise.all((await caches.keys()).map(async name=>(await(await caches.open(name)).keys()).map(request=>request.url))));
  assert(!keys.flat().some(url=>url.includes('/api/')||url.includes('_rsc=')||url.includes('private.js')));
  await context.setOffline(true);await page.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await page.locator('h1').textContent(),'Shell-v1');
 });
});
