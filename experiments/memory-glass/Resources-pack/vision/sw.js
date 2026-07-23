/* Memory Glass Phone PWA · service worker
 * Offline shell + pull-to-refresh friendly updates.
 * VER: phone-sw-v2
 */
const CACHE = "mg-phone-pwa-v15-rock-wave";
const PRECACHE = [
  "/phone.html",
  "/phone-talk.html",
  "/phone-chat.html",
  "/phone-setup.html",
  "/phone-mg.css",
  "/phone-speak.js?v=3",
  "/phone-speak.js",
  "/phone-wave.js",
  "/fleet.html",
  "/relay.html",
  "/manifest.webmanifest",
  "/sw.js",
  "/phone-pwa.js",
  "/apple-touch-icon.png",
  "/favicon.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/icon-1024.png",
];

/* API / live streams — never cache */
function isLivePath(url) {
  const p = url.pathname;
  return (
    p === "/upload" ||
    p === "/health" ||
    p === "/audio" ||
    p === "/mic" ||
    p === "/upload-audio" ||
    p === "/transcript" ||
    p === "/stt" ||
    p === "/say" ||
    p === "/reply" ||
    p === "/conversation" ||
    p === "/chat" ||
    p === "/conv" ||
    p === "/audio-levels" ||
    p === "/levels" ||
    p === "/wave" ||
    p === "/fleet" ||
    p === "/peers" ||
    p === "/live.jpg" ||
    p === "/glass.jpg" ||
    p.indexOf("/live") === 0 ||
    p.indexOf("/ego/") === 0 ||
    p.indexOf("/shares/") === 0 ||
    p.indexOf("/snaps/") === 0 ||
    p.indexOf("/tts/") === 0 ||
    p.indexOf("phone-live") >= 0
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        Promise.all(
          PRECACHE.map((u) =>
            c.add(u).catch(() => c.add(new Request(u, { cache: "reload" })).catch(() => null))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const d = event.data || {};
  if (d === "SKIP_WAITING" || d.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (d === "CLAIM" || d.type === "CLAIM") {
    self.clients.claim();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  /* live / API — network only */
  if (isLivePath(url)) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(JSON.stringify({ ok: false, offline: true }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  /* HTML / shell — network first (iteration), cache fallback (offline) */
  const isShell =
    url.pathname.endsWith(".html") ||
    url.pathname === "/" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".json");

  if (isShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (hit) =>
              hit ||
              caches.match("/phone.html") ||
              new Response("Offline · pull to refresh when back online", {
                status: 503,
                headers: { "Content-Type": "text/plain" },
              })
          )
        )
    );
    return;
  }

  /* default: cache then network */
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("/phone.html"));
    })
  );
});
