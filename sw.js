// Keeps the scoreboard loadable at the lanes even with no signal.
// The page itself: try the network first (so updates arrive), fall back to the saved copy after 3s.
// The Firebase library: saved copy first (it never changes).
const CACHE = 'strikeapose-v1';
const FILES = ['./', './index.html', './vendor/firebase-app.js', './vendor/firebase-firestore.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/vendor/')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
    return;
  }
  e.respondWith(new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(e.request, { ignoreSearch: true })
      .then(hit => hit || caches.match('./index.html'))
      .then(hit => { if (!done && hit) { done = true; resolve(hit); } });
    const timer = setTimeout(fallback, 3000);
    fetch(e.request).then(res => {
      clearTimeout(timer);
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      if (!done) { done = true; resolve(res); }
    }).catch(() => { clearTimeout(timer); fallback().then(() => { if (!done) { done = true; resolve(Response.error()); } }); });
  }));
});
