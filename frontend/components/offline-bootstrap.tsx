"use client"

import { useEffect } from "react"

/**
 * Registers the offline service worker for Stage-1 offline AI shell assets.
 * Set NEXT_PUBLIC_ENABLE_OFFLINE_SW=false to disable (useful if a stale SW
 * is masking a Vercel deploy during demos).
 */
export default function OfflineBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    const enabled = process.env.NEXT_PUBLIC_ENABLE_OFFLINE_SW !== "false"

    const onLoad = () => {
      if (!enabled) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => reg.unregister())
        })
        return
      }

      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service worker registration failed:", error)
      })
    }

    window.addEventListener("load", onLoad)
    return () => window.removeEventListener("load", onLoad)
  }, [])

  return null
}
