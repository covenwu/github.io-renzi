const VERSION = 'renzi-v7'; // 每次发版改这个字符串触发缓存更新
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/scheduler.js', 'js/util.js', 'js/db.js',
  'js/backup.js', 'js/photo.js', 'js/speech.js', 'js/words.js',
  'js/views/home.js', 'js/views/input.js', 'js/views/review.js',
  'js/views/library.js',
  'vendor/idb.js', 'vendor/jszip.min.js', 'vendor/words2.txt',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  // addAll 整体成败：部署传播期单个 404 会使安装失败、旧版继续服务——这是安全默认，勿改成逐个 catch
  // cache:'reload' 绕过浏览器 HTTP 缓存，否则新版 SW 可能把过期旧文件装进新缓存（Pages 有 10 分钟 HTTP 缓存）
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()));
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
