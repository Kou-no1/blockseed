// Build replaces the release identifiers. Native ES modules are served at
// their original same-origin URLs after the local worker installs the pack.
const release = 'blockseed-expeditions-v3-adca7e3966e5';
const pack = './modules-0620c711d2f01280.pack';

async function workerControlsPage() {
  if (!('serviceWorker' in navigator) || !('DecompressionStream' in window)) return false;
  const service = navigator.serviceWorker;
  const registration = await service.register('./sw.js', { updateViaCache: 'none' });
  return new Promise(resolve => {
    let channel;
    const timeout = setTimeout(() => finish(false), 4500);
    function finish(ready) {
      clearTimeout(timeout);
      service.removeEventListener('controllerchange', check);
      if (channel) channel.port1.close();
      resolve(ready);
    }
    function check() {
      const controller = service.controller;
      if (!controller) return;
      if (channel) channel.port1.close();
      channel = new MessageChannel();
      channel.port1.onmessage = event => { if (event.data === release) finish(true); };
      controller.postMessage('blockseed:release', [channel.port2]);
    }
    service.addEventListener('controllerchange', check);
    if (registration.installing) registration.installing.addEventListener('statechange', event => {
      if (event.target.state === 'redundant' && !service.controller) finish(false);
    });
    check();
  });
}

// Browsers with workers disabled can still run the same local, immutable
// modules. Only their relative import URLs change, as in the standalone file.
async function withoutWorker() {
  const response = await fetch(pack);
  if (!response.ok) throw Error('Module pack unavailable');
  const modules = await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).json();
  const urls = new Map();
  function link(name) {
    if (urls.has(name)) return urls.get(name);
    if (!Object.hasOwn(modules,name)) throw Error('Missing module');
    const source = modules[name].replace(/^(\s*import\s+(?:[^'";]+?\s+from\s*)?)(['"])(\.[^'"]+)\2/gm,
      (_, lead, quote, spec) => {
        const child = new URL(spec, new URL(name, location.origin + '/')).pathname.slice(1);
        return lead + quote + link(child) + quote;
      });
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    urls.set(name,url);
    return url;
  }
  await import(link('js/main.js'));
}

async function boot() {
  try {
    if (await workerControlsPage().catch(() => false)) await import('./js/main.js');
    else await withoutWorker();
  } catch {
    const standalone = new URL('./blockseed-single.html', location.href);
    standalone.search = location.search;
    standalone.hash = location.hash;
    location.replace(standalone.href);
  }
}
boot();
