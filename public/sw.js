const CACHE='kalora-shell-v3';
self.addEventListener('install',e=>{e.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(['/','/manifest.json','/icon-192.png','/icon-512.png','/apple-touch-icon.png']);
 const shell=await cache.match('/'),html=await shell.text(),assets=new Set();
 for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  const url=new URL(match[1],self.location.origin);
  if(url.origin===self.location.origin&&url.pathname.startsWith('/_next/static/'))assets.add(url.href);
 }
 if(!assets.size)throw new Error('Kalora shell contains no application assets');
 await cache.addAll([...assets]);
 await self.skipWaiting();
})())});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kalora-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||e.request.headers.get('RSC'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put('/',r.clone()));return r}).catch(()=>caches.match('/')));return}if(u.pathname.startsWith('/_next/static/')||/\.(png|woff2|css|js)$/.test(u.pathname))e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r}))) });
