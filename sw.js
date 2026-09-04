const CACHE = 'blockseed-v1.0.2';
const FILES = [
  './', './index.html', './manifest.webmanifest', './icon.svg', './sw.js',
  './css/base.css', './css/blocks.css', './css/layout.css', './css/levels.css', './css/print.css',
  './js/main.js',
  './js/core/events.js', './js/core/errors.js', './js/core/project.js', './js/core/history.js', './js/core/store.js', './js/core/share.js',
  './js/blocks/defs.helpers.js', './js/blocks/defs.event.js', './js/blocks/defs.motion.js', './js/blocks/defs.looks.js', './js/blocks/defs.sound.js', './js/blocks/defs.control.js', './js/blocks/defs.sensing.js', './js/blocks/defs.device.js', './js/blocks/defs.operators.js', './js/blocks/defs.data.js', './js/blocks/defs.function.js', './js/blocks/registry.js',
  './js/ui/labels.js', './js/ui/dialogs.js', './js/ui/inputs.js', './js/ui/blockview.js', './js/ui/palette.js', './js/ui/tapinsert.js', './js/ui/drag.js', './js/ui/canvas.js', './js/ui/toolbar.js',
  './js/runtime/interpreter.js', './js/runtime/scheduler.js', './js/runtime/tojs.js',
  './js/stages/stage.js', './js/stages/turtle.js', './js/stages/sprite.js', './js/stages/device.js',
  './js/audio/synth.js', './js/missions/missions.js', './js/missions/data/core.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (key) { return key.indexOf('blockseed-') === 0 && key !== CACHE; }).map(function (key) { return caches.delete(key); })); }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(function (cached) {
    if (cached) return cached;
    return fetch(event.request).then(function (response) {
      if (response && response.ok) {
        const copy = response.clone(); caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
      }
      return response;
    }).catch(function () { return caches.match('./index.html'); });
  }));
});
