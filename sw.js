const ROOT = new URL(self.registration.scope);
const PREFIX = "inspecao-pages-" + ROOT.pathname + "-";
const CACHE = PREFIX + "3b0ea5aab4dd";
const APP_SHELL = ["", "index.html", "manifest.webmanifest", "favicon.svg", "railway-segments-v2.bin", ...["assets/index-BpMVqc6d.css","assets/index-Dh9jGWSH.js"]]
  .map(path => new URL(path, ROOT).href);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(new URL("index.html", ROOT).href)));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy))); }
    return response;
  })));
});

