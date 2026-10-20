const CACHE_NAME = 'english-vs-shell-v21';
const BASE = new URL('./', self.location.href);
const APP_FILES = [
  './', './index.html', './favicon.svg', './styles.css?v=15', './manifest.webmanifest', './src/main.js?v=20', './src/ai.js?v=15', './src/data.js',
  './src/storage.js', './src/import.js', './src/words.js?v=15', './src/games.js', './src/ui.js?v=14',
  './vendor/mammoth/mammoth.browser.min.js', './vendor/pdfjs/pdf.min.mjs', './vendor/pdfjs/pdf.worker.min.mjs',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES.map(file => new URL(file, BASE).href))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('english-vs-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (new URL(request.url).pathname.startsWith('/api/')) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok && new URL(request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => request.mode === 'navigate' ? caches.match(new URL('./index.html', BASE)) : Promise.reject(new Error('离线缓存中没有该资源。')))));
});

