const CACHE = 'pf-v2';
const ASSETS = ['/', '/pbp-mobile.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return; // never cache API calls
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    })).catch(() => caches.match('/pbp-mobile.html'))
  );
});
self.addEventListener('push', e => {
  const data = e.data?.json() || { title: 'Padel Foundry', body: 'You have a new notification' };
  e.waitUntil(self.registration.showNotification(data.title, {
    body:  data.body,
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    data:  data.url || '/'
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data || '/'));
});
