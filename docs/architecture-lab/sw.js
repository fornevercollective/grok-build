/* Grok Build Lab service worker — offline shell + lazy asset cache
 * CACHE name is rewritten per GitHub Pages deploy (see workflow). */
const CACHE = "grok-lab-voice2";
const PRECACHE = [
  "./",
  "./index.html",
  "./nav.json",
  "./version.json",
  "./manifest.webmanifest",
  "./assets/style.css",
  "./assets/walkie-dock.css",
  "./assets/video-feed.css",
  "./assets/tools.css",
  "./assets/mobile-pwa.css",
  "./assets/app.js",
  "./assets/video-feed.js",
  "./assets/walkie-dock.js",
  "./assets/grok-listen.js",
  "./assets/tools.js",
  "./assets/mesh-collab.js",
  "./assets/mobile-pwa.js",
  "./assets/lab-update.js",
  "./assets/brand/grok-logomark-light.svg",
  "./assets/brand/grok-wordmark-light.svg",
  "./assets/brand/spacexai-symbol-white-transparent.svg",
  "./content/00-overview.md",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never cache live APIs
  if (url.pathname.includes("/api/")) return;

  // Always network-first for version stamp (Pages + local auto-reload)
  if (url.pathname.endsWith("/version.json") || url.pathname.endsWith("version.json")) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => res)
        .catch(() => caches.match("./version.json"))
    );
    return;
  }

  // Network-first for navigations; cache-first for static
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        // stale-while-revalidate for content/*.md and assets
        event.waitUntil(
          fetch(req)
            .then((res) => {
              if (res && res.ok) {
                return caches.open(CACHE).then((c) => c.put(req, res.clone()));
              }
            })
            .catch(() => {})
        );
        return hit;
      }
      return fetch(req)
        .then((res) => {
          if (
            res &&
            res.ok &&
            (url.pathname.includes("/content/") || url.pathname.includes("/assets/"))
          ) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
