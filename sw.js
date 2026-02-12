
const CACHE_NAME = 'edugen-pro-v5.2.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/5832/5832416.png',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];

// External libraries to cache
const EXTERNAL_LIBS = [
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@^19.2.4',
  'https://esm.sh/react-dom@^19.2.4/',
  'https://esm.sh/@google/genai@^1.40.0',
  'https://esm.sh/recharts@^3.7.0',
  'https://esm.sh/react-router-dom@^7.2.0'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets and libraries');
      return cache.addAll([...STATIC_ASSETS, ...EXTERNAL_LIBS]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removing legacy cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-First strategy for the main application shell
  if (event.request.mode === 'navigate' || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-First strategy for fonts, images, and external libraries
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached, but update in background for next time
        fetch(event.request).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          // If it's an external library from esm.sh or cdn, we still want to cache it
          if (url.origin.includes('esm.sh') || url.origin.includes('tailwindcss.com') || url.origin.includes('gstatic.com')) {
             const clonedResponse = networkResponse.clone();
             caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse));
          }
          return networkResponse;
        }
        const clonedResponse = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse));
        return networkResponse;
      });
    })
  );
});
