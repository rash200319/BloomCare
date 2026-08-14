const CACHE_NAME = "bloomcare-offline-v3"
const APP_SHELL = [
  "/manifest.json",
  "/scripts/stage1_offline_ai.js",
  "/images/mother-baby-shadow.png",
  "/images/baby-painting.png",
  "/icon-light-32x32.png",
  "/apple-icon.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
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

  // Always network-first for HTML navigations so chatbot/UI deploys are not stuck on stale cache.
  if (event.request.mode === "navigate" || requestUrl.pathname === "/" || requestUrl.pathname.endsWith(".html")) {
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
        })
    )
    return
  }

  // Do not cache Next.js build assets forever; prefer network so redeploys show up.
  if (requestUrl.pathname.startsWith("/_next/")) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request)
        return (
          cached ||
          new Response("Offline", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/plain" },
          })
        )
      })
    )
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const clone = networkResponse.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return networkResponse
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) {
          return cached
        }

        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/plain" },
        })
      })
  )
})
