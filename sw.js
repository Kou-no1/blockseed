const CACHE = 'blockseed-expeditions-v3-dev';
const FILES = [
  './index.html', './manifest.webmanifest', './icon.svg', './sw.js',
  './css/base.css', './css/blocks.css', './css/layout.css', './css/levels.css', './css/expedition.css', './css/print.css',
  './js/main.js', './js/expedition.js',
  './js/field/worlds.js', './js/field/stage.js', './js/field/living.js', './js/field/sky.js', './js/field/voyages.js',
  './assets/patagonia.webp', './assets/namib.webp', './assets/yakushima.webp',
  './js/core/events.js', './js/core/errors.js', './js/core/project.js', './js/core/history.js', './js/core/store.js', './js/core/share.js',
  './js/blocks/defs.helpers.js', './js/blocks/defs.event.js', './js/blocks/defs.motion.js', './js/blocks/defs.looks.js', './js/blocks/defs.sound.js', './js/blocks/defs.control.js', './js/blocks/defs.sensing.js', './js/blocks/defs.device.js', './js/blocks/defs.operators.js', './js/blocks/defs.data.js', './js/blocks/defs.function.js', './js/blocks/registry.js',
  './js/ui/labels.js', './js/ui/dialogs.js', './js/ui/inputs.js', './js/ui/blockview.js', './js/ui/palette.js', './js/ui/tapinsert.js', './js/ui/drag.js', './js/ui/canvas.js', './js/ui/toolbar.js', './js/ui/growth.js',
  './js/runtime/interpreter.js', './js/runtime/scheduler.js', './js/runtime/tojs.js',
  './js/stages/stage.js', './js/stages/turtle.js', './js/stages/sprite.js', './js/stages/device.js',
  './js/audio/synth.js', './js/missions/missions.js', './js/missions/data/core.js'
];

self.addEventListener('install', function (event) {
  const requests = FILES.map(file => new Request(new URL(file, self.location.href), { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
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
