const CACHE_NAME = 'grades-register-v2';
const APP_SHELL = [
  './grades-register.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

self.addEventListener('install', function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return Promise.all(APP_SHELL.map(function(url){
        return cache.add(url).catch(function(){ /* ignore individual failures */ });
      }));
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event){
  const req = event.request;
  if(req.method !== 'GET') return; // never intercept writes (Firestore sync etc.)

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isAppShellFile = APP_SHELL.some(function(p){ return req.url.indexOf(p.replace('./','')) !== -1; });

  // Only manage caching for our own app-shell files. Everything else
  // (Firebase Auth/Firestore calls, analytics, etc.) goes straight to the network.
  if(!isSameOrigin && !isAppShellFile) return;

  event.respondWith(
    caches.match(req).then(function(cached){
      const fetchPromise = fetch(req).then(function(networkRes){
        if(networkRes && networkRes.status === 200){
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        }
        return networkRes;
      }).catch(function(){ return cached; });
      // Cache-first for instant offline load; refresh cache in background when online.
      return cached || fetchPromise;
    })
  );
});
