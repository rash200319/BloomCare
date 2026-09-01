"use client"

import { useEffect } from "react"

/**
 * Offline SW is opt-in. A stale worker was serving old Mark as Reviewed
 * code (POST /triage/history + /review-screening) after Vercel deploys.
 * Set NEXT_PUBLIC_ENABLE_OFFLINE_SW=true only for the frontline offline demo.
 */
export default function OfflineBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return

    const enabled = process.env.NEXT_PUBLIC_ENABLE_OFFLINE_SW === "true"

    const onLoad = () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          if (enabled) {
            navigator.serviceWorker.register("/sw.js").catch((error) => {
              console.error("Service worker registration failed:", error)
            })
            return
          }
          regs.forEach((reg) => {
            void reg.unregister()
          })
        })
      }

      if ("caches" in window && !enabled) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            void caches.delete(key)
          })
        })
      }
    }

    window.addEventListener("load", onLoad)
    return () => window.removeEventListener("load", onLoad)
  }, [])

  return null
}
