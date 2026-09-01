const CACHE_NAME = "bloomcare-offline-v5"
const APP_SHELL = [
  "/manifest.json",
  "/scripts/stage1_offline_ai.js",
  "/images/mother-baby-shadow.png",
  "/images/baby-painting.png",
  "/images/mother-baby-painting.png",
  "/images/shadow-pregnancy.png",
  "/icon-light-32x32.png",
  "/apple-icon.png",
]

async function precacheShell(cache) {
  // Never fail install if one asset 404s — that previously broke SW activation.
  await Promise.all(
    APP_SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-cache" })
        if (response.ok) {
          await cache.put(url, response.clone())
        }
      } catch (_error) {
        // ignore individual shell failures
      }
    }),
  )
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => precacheShell(cache)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return
  }

  const requestUrl = new URL(event.request.url)

  if (requestUrl.origin !== self.location.origin) {
    return
  }

  // Never intercept API / backend proxy traffic.
  if (
    requestUrl.pathname.startsWith("/api/") ||
    requestUrl.pathname.startsWith("/docs") ||
    requestUrl.pathname.startsWith("/openapi")
  ) {
    return
  }

  // Always network-first for HTML navigations so UI deploys are not stuck on stale cache.
  if (
    event.request.mode === "navigate" ||
    requestUrl.pathname === "/" ||
    requestUrl.pathname.endsWith(".html")
  ) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => networkResponse)
        .catch(async () => {
          const cached = await caches.match(event.request)
          if (cached) return cached
          return new Response("Offline", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/plain" },
          })
        }),
    )
    return
  }

  if (requestUrl.pathname.startsWith("/_next/") || requestUrl.pathname.endsWith(".js")) {
    event.respondWith(fetch(event.request))
    return
  }

  // Cache-first only for static public assets (images/icons/scripts).
  const isStaticAsset =
    requestUrl.pathname.startsWith("/images/") ||
    requestUrl.pathname.startsWith("/scripts/") ||
    requestUrl.pathname.endsWith(".png") ||
    requestUrl.pathname.endsWith(".jpg") ||
    requestUrl.pathname.endsWith(".jpeg") ||
    requestUrl.pathname.endsWith(".svg") ||
    requestUrl.pathname === "/manifest.json"

  if (!isStaticAsset) {
    return
  }

  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached
      try {
        const networkResponse = await fetch(event.request)
        if (networkResponse.ok) {
          const clone = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return networkResponse
      } catch (_error) {
        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/plain" },
        })
      }
    }),
  )
})
