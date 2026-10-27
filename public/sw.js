const V = "butce-v56";
const SHELL = ["/", "/index.html", "/butce-theme.css?v=30", "/app.js", "/core.js", "/transaction-input.js", "/statement.js", "/cash-sim.js", "/cloud-store.js", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("butce-") && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Network first with a short timeout; on failure/slow network serve the cached copy so the app always opens.
const net = (req, ms) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("timeout")), ms);
  fetch(req).then(r => { clearTimeout(t); res(r); }, err => { clearTimeout(t); rej(err); });
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/__/") || url.pathname.startsWith("/~oauth")) return;
  const nav = req.mode === "navigate";
  e.respondWith(
    net(req, nav ? 3500 : 6000)
      .then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(nav ? "/index.html" : req, c)); } return r; })
      .catch(async () => (await caches.match(nav ? "/index.html" : req, { ignoreSearch: nav })) || (await caches.match(req, { ignoreSearch: true })) || (nav ? caches.match("/") : Response.error()))
  );
});
