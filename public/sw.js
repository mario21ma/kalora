const CACHE='kalora-shell-v4';
// Publish a cached page only after all of its startup scripts are available.
async function saveShell(cache,response,key='/'){
 const html=await response.clone().text(),assets=new Set();
 for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  const url=new URL(match[1],self.location.origin);
  if(url.origin===self.location.origin&&url.pathname.startsWith('/_next/static/'))assets.add(url.href);
 }
 if(!assets.size)throw new Error('Kalora shell contains no application assets');
 await cache.addAll([...assets]);
 await cache.put(key,response.clone());
}
self.addEventListener('install',e=>{e.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(['/manifest.json','/icon-192.png','/icon-512.png','/apple-touch-icon.png']);
 const shell=await fetch('/',{cache:'reload'});
 if(!shell.ok)throw new Error('Kalora shell is unavailable');
 await saveShell(cache,shell);
 await self.skipWaiting();
})())});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kalora-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||e.request.headers.get('RSC'))return;if(e.request.mode==='navigate'){
 const network=fetch(e.request);
 e.waitUntil(network.then(async r=>{if(r.ok&&u.pathname==='/')await saveShell(await caches.open(CACHE),r)}).catch(()=>{}));
 e.respondWith(network.catch(async()=>{const cache=await caches.open(CACHE);return (await cache.match(e.request))||(await cache.match('/'))}));return
}if(u.pathname.startsWith('/_next/static/')||/\.(png|woff2|css|js)$/.test(u.pathname)){
 const resource=caches.open(CACHE).then(async c=>{const hit=await c.match(e.request);if(hit)return hit;const r=await fetch(e.request);if(r.ok)await c.put(e.request,r.clone());return r});
 e.respondWith(resource);e.waitUntil(resource.then(()=>{}).catch(()=>{}));
} });
