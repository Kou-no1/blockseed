const CACHE = 'blockseed-expeditions-v3-c747f2b5fb57';
const FILES = ["./assets/namib.webp", "./assets/patagonia.webp", "./assets/yakushima.webp", "./boot.js", "./css/base.css", "./css/blocks.css", "./css/expedition.css", "./css/layout.css", "./css/levels.css", "./css/print.css", "./icon.svg", "./index.html", "./manifest.webmanifest", "./modules-3b16b9acfc76da26.pack", "./sw.js"];

self.addEventListener('install', function (event) {
  const requests = FILES.map(file => new Request(new URL(file, self.location.href), { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await cache.addAll(requests);
    const archive = await cache.match('./modules-3b16b9acfc76da26.pack');
    const modules = await new Response(archive.body.pipeThrough(new DecompressionStream('deflate'))).json();
    await Promise.all(Object.entries(modules).map(([name, source]) =>
      cache.put('./' + name, new Response(source, {headers: {'Content-Type': 'text/javascript; charset=utf-8'}}))));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (key) { return key.indexOf('blockseed-') === 0 && key !== CACHE; }).map(function (key) { return caches.delete(key); })); }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async function (cache) {
    const path = new URL(event.request.url).pathname;
    const base = new URL('./', self.location.href).pathname;
    if (event.request.mode === 'navigate' && (path === base || path === base + 'index.html')) {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      return await fetch(event.request);
    } catch (error) {
      if (event.request.mode === 'navigate') return await cache.match('./index.html') || Response.error();
      return Response.error();
    }
  }));
});

self.addEventListener('message', e => { if (e.data === 'blockseed:release') e.ports[0]?.postMessage(CACHE); });
