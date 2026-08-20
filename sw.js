/* Offline cache. The whole app is ~700KB, so precache all of it: this is
   for a five-year-old in a car, not a page that needs to be clever.

   The sync files are precached with everything else. The Firebase SDK they pull
   from a CDN is not, deliberately — offline the import fails, the bridge catches
   it, and the app runs local-only. Which is the point: a child in a car with no
   signal must still get a full session. */
const CACHE = 'letter-sounds-v10';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/grownup.css',
  'css/landing.css',
  'js/data.js',
  'js/guides.js',
  'js/progress.js',
  'js/sync-state.js',
  'js/sync.js',
  'js/audio.js',
  'js/modes.js',
  'js/app.js',
  'sync/firebase-config.js',
  'sync/kidsync.js',
  'sync/bridge.js',
  'fonts/andika-400.woff2',
  'fonts/andika-700.woff2',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'audio/a.mp3',
  'audio/ai.mp3',
  'audio/air.mp3',
  'audio/ar.mp3',
  'audio/b.mp3',
  'audio/c.mp3',
  'audio/ch-chair.mp3',
  'audio/d.mp3',
  'audio/e.mp3',
  'audio/ear.mp3',
  'audio/ee.mp3',
  'audio/f.mp3',
  'audio/g.mp3',
  'audio/h.mp3',
  'audio/i.mp3',
  'audio/igh.mp3',
  'audio/j.mp3',
  'audio/l.mp3',
  'audio/m.mp3',
  'audio/n.mp3',
  'audio/ng.mp3',
  'audio/o.mp3',
  'audio/oa.mp3',
  'audio/oi.mp3',
  'audio/oo-book.mp3',
  'audio/oo-moon.mp3',
  'audio/or.mp3',
  'audio/ow-how.mp3',
  'audio/p.mp3',
  'audio/r.mp3',
  'audio/s.mp3',
  'audio/sh.mp3',
  'audio/t.mp3',
  'audio/th-that.mp3',
  'audio/th-thing.mp3',
  'audio/u.mp3',
  'audio/ur.mp3',
  'audio/ure.mp3',
  'audio/v.mp3',
  'audio/w.mp3',
  'audio/y.mp3',
  'audio/z.mp3',
  'audio/zh.mp3',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  /* Audio, fonts and icons never change once shipped -- serve them from
     cache and never pay for them again. */
  const immutable = /\.(mp3|woff2|png)$/.test(url.pathname);

  if (immutable) {
    e.respondWith(
      caches.match(e.request).then(function (hit) {
        return hit || fetch(e.request).then(function (res) {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  /* The app shell goes network-first so a new version actually reaches the
     device. Cache-first here means shipping a fix and having the iPad keep
     running last month's build. Falls back to cache when offline. */
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) {
        return hit || caches.match('index.html');
      });
    })
  );
});
