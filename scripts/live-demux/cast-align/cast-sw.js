/* Grok Cast Remote · service worker (PWA shell)
 * Mirrors Memory Glass phone-pwa pattern: cache shell, network-first APIs.
 */
const CACHE = "grok-cast-shell-v3";
const SHELL = [
  "/box",
  "/news",
  "/tv",
  "/devices",
  "/setup.html",
  "/manifest.webmanifest",
  "/qrcode-generator.js",
  "/device-kit.js",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("grok-cast-") && k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // never cache live APIs / media / SSE
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/media/") ||
    event.request.headers.get("accept") === "text/event-stream"
  ) {
    event.respondWith(fetch(event.request));
    return;
  }
  // network-first for HTML shells
  if (
    event.request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname === "/box" ||
    url.pathname === "/news" ||
    url.pathname === "/tv" ||
    url.pathname === "/devices"
  ) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
