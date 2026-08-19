const CACHE_PREFIX = 'hangul-playground-';
const CACHE = 'hangul-playground-v05d1';
const ASSETS = [
  './',
  './index.html',
  './curriculum.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const request=e.request;
  if(request.method!=='GET') return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  const wantsHtml=request.mode==='navigate' || url.pathname.endsWith('/index.html');
  if(wantsHtml){
    e.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const response=await fetch(request);
        if(response.ok) await cache.put(request,response.clone());
        return response;
      }catch(error){
        return (await cache.match(request)) || (await cache.match('./index.html')) || (await cache.match('./'));
      }
    })());
    return;
  }

  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(request);
    if(cached) return cached;
    const response=await fetch(request);
    if(response.ok) await cache.put(request,response.clone());
    return response;
  })());
});
