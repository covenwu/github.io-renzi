const VERSION = 'renzi-v1'; // 每次发版改这个字符串触发缓存更新
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/scheduler.js', 'js/util.js', 'js/db.js',
  'js/backup.js', 'js/photo.js', 'js/speech.js',
  'js/views/home.js', 'js/views/input.js', 'js/views/review.js',
  'js/views/library.js',
  'vendor/idb.js', 'vendor/jszip.min.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then(r => r || fetch(e.request)));
});
