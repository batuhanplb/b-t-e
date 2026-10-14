const V = "butce-v12";
const SHELL = ["/", "/index.html", "/butce-theme.css?v=11", "/app.js", "/core.js", "/transaction-input.js", "/cloud-store.js", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.origin === location.origin) {
    if (url.pathname.startsWith("/__/") || url.pathname.startsWith("/~oauth")) return; // sign-in: always network
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); } return r; }).catch(() => caches.match(req).then(r => r || caches.match("/index.html"))));
    return;
  }
});
