const CACHE='kalora-shell-v7';
const PAGES=new Set(['/','/privacy','/terms']);
const PUBLIC_ASSETS=new Set(['/manifest.json','/icon-192.png','/icon-512.png','/icon-maskable.png','/apple-touch-icon.png']);
// Keep one handle for this worker. An older worker finishing after activation
// may write to its deleted cache handle, but cannot reopen that cache or touch
// the new worker's versioned cache.
const shellCache=caches.open(CACHE),pageRequests=new Map(),pageWrites=new Map();
function beginPage(key){const request=(pageRequests.get(key)||0)+1;pageRequests.set(key,request);return request}
const publicResponse=response=>response.ok&&!response.redirected&&!/\bprivate\b/i.test(response.headers.get('Cache-Control')||'')&&!/(?:^|,)\s*(?:Cookie|Authorization|\*)\s*(?:,|$)/i.test(response.headers.get('Vary')||'');
async function savePublicAssets(cache,urls){
 // cache.addAll does not inspect Cache-Control/Vary. Check every asset before
 // storing any of them, including the install-time manifest and icons.
 const resources=await Promise.all([...urls].map(async url=>{
  const response=await fetch(url,{cache:'reload'});
  if(!publicResponse(response))throw new Error('Kalora public asset is unavailable');
  return [url,response];
 }));
 await Promise.all(resources.map(([url,response])=>cache.put(url,response)));
}

// Publish a cached document only after all of its startup assets are available.
// Callers pass an unused copy: the original network body belongs to the browser.
async function savePage(cache,response,key,request){
 if(!publicResponse(response)||!/text\/html/i.test(response.headers.get('Content-Type')||''))throw new Error('Kalora public page is unavailable');
 const html=await response.clone().text(),assets=new Set();
 for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  const url=new URL(match[1],self.location.origin);
  if(url.origin===self.location.origin&&url.pathname.startsWith('/_next/static/'))assets.add(url.href);
 }
 if(!assets.size)throw new Error('Kalora page contains no application assets');
 // Never publish a shell with an unavailable or private startup asset.
 await savePublicAssets(cache,assets);
 // Asset and document responses can finish out of request order across tabs.
 // Serialize publication too: a cache.put already in flight must finish before
 // a newer document is written. Check freshness inside the queue after awaits.
 const write=(pageWrites.get(key)||Promise.resolve()).catch(()=>{}).then(async()=>{
  if(pageRequests.get(key)!==request)return;
  await cache.put(key,response);
 });
 pageWrites.set(key,write);
 try{await write}finally{if(pageWrites.get(key)===write)pageWrites.delete(key)}
}

self.addEventListener('install',e=>{e.waitUntil((async()=>{
 const cache=await shellCache;
 await savePublicAssets(cache,PUBLIC_ASSETS);
 for(const key of PAGES){
  const request=beginPage(key);
  const page=await fetch(key,{cache:'reload'});
  await savePage(cache,page,key,request);
 }
 // A failed new installation never activates or deletes the last working cache.
 await self.skipWaiting();
})())});

self.addEventListener('activate',e=>{e.waitUntil((async()=>{
 await Promise.all((await caches.keys()).filter(k=>k.startsWith('kalora-shell-')&&k!==CACHE).map(k=>caches.delete(k)));
 await self.clients.claim();
})())});

function offlinePage(){
 return new Response('<!doctype html><html lang="hr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Kalora · Izvan mreže</title><main><h1>Stranica nije dostupna izvan mreže</h1><p>Poveži se s internetom i pokušaj ponovno.</p><a href="/">Natrag u Kaloru</a></main></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}

self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||e.request.headers.get('Authorization')||e.request.headers.get('RSC')||u.searchParams.has('_rsc'))return;
 if(e.request.mode==='navigate'){
  const publicPage=PAGES.has(u.pathname)&&!u.search;
  const request=publicPage?beginPage(u.pathname):null;
  const network=fetch(e.request);
  e.waitUntil(network.then(r=>{
   if(!r.ok||!publicPage)return;
   // Clone before waiting for the cache handle lets respondWith consume r.
   const page=r.clone();
   return shellCache.then(cache=>savePage(cache,page,u.pathname,request));
  }).catch(()=>{}));
  e.respondWith(network.catch(async()=>{
   if(publicPage){const cached=await (await shellCache).match(u.pathname);if(cached)return cached}
   return offlinePage();
  }));
  return;
 }
 if(u.pathname.startsWith('/_next/static/')||PUBLIC_ASSETS.has(u.pathname)||/^\/silhouettes\/[a-z0-9-]+\.png$/.test(u.pathname)){
  const resource=shellCache.then(async cache=>{
   const hit=await cache.match(e.request);if(hit)return hit;
   const response=await fetch(e.request);
   if(publicResponse(response))await cache.put(e.request,response.clone());
   return response;
  });
  e.respondWith(resource);e.waitUntil(resource.then(()=>{}).catch(()=>{}));
 }
});
