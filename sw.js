const ROOT = new URL(self.registration.scope);
const PREFIX = ROOT.pathname === "/" ? "inspecao-ferroviaria-" : "inspecao-pages-" + ROOT.pathname + "-";
const BUILD_ASSETS = ["assets/html2canvas-DGxc0aul.js","assets/index-RDQ1gvra.css","assets/index-U75lJlAI.js","assets/index.es-DN8YdN-1.js","assets/purify.es-D0jS7ypB.js"]; // Replaced with the published build's offline assets.
const CACHE = PREFIX + "v24-91a3c9b41e96";
const APP_SHELL = ["", "manifest.webmanifest", "favicon.svg", "railway-segments-v2.bin", ...BUILD_ASSETS]
  .map((path) => new URL(path, ROOT).href);
let cacheWritesEnabled = true;
let clearingCache = false;
const pendingWrites = new Set();

function saveCachedResponse(key, response) {
  if (!cacheWritesEnabled) return Promise.resolve();
  const write = caches.open(CACHE).then(async (cache) => {
    if (cacheWritesEnabled) await cache.put(key, response);
  });
  pendingWrites.add(write);
  write.then(() => pendingWrites.delete(write), () => pendingWrites.delete(write));
  return write;
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "RESUME_APP_CACHE") { if (!clearingCache) cacheWritesEnabled = true; return; }
  if (event.data?.type !== "CLEAR_APP_FILE_CACHE" || !event.ports[0]) return;
  cacheWritesEnabled = false;
  clearingCache = true;
  event.waitUntil((async () => {
    try {
      await Promise.allSettled([...pendingWrites]);
      const keys = (await caches.keys()).filter(key => key.startsWith(PREFIX));
      const files = await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).length));
      await Promise.all(keys.map(key => caches.delete(key)));
      if ((await caches.keys()).some(key => key.startsWith(PREFIX))) throw new Error("O cache foi recriado por outra aba. Feche as outras abas e tente novamente.");
      event.ports[0].postMessage({ ok: true, cacheCount: keys.length, fileCount: files.reduce((a, b) => a + b, 0) });
    } catch (error) { event.ports[0].postMessage({ ok: false, error: error.message || "Não foi possível limpar o cache." }); }
    finally { clearingCache = false; }
  })());
});

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)
      || url.pathname.startsWith(new URL("notas-lc-campo/", ROOT).pathname)) return;
  if (request.mode === "navigate") {
    if (url.pathname !== ROOT.pathname && url.pathname !== new URL("index.html", ROOT).pathname) return;
    const network = fetch(request)
        .then(async (response) => {
          const copy = response.clone();
          if (response.ok) await saveCachedResponse(ROOT.href, copy);
          return response;
        })
        .catch(async () => (await caches.match(ROOT.href)) || Response.error());
    event.waitUntil(network.then(() => undefined));
    event.respondWith(network);
    return;
  }
  const network = fetch(request)
        .then(async (response) => {
          if (response.ok) {
            await saveCachedResponse(request, response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || Response.error());
  event.waitUntil(network.then(() => undefined));
  event.respondWith(caches.match(request).then(cached => cached || network));
});
