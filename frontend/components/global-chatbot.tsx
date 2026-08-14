"use client"

import { useEffect, useState } from "react"
import SiteChatbot from "./site-chatbot"

type UserRole = "frontline" | "doctor" | "admin" | "patient" | null
type AppView = "home" | "login" | "dashboard"

function roleFromProfile(): UserRole {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem("bloomcare_user_profile")
    if (!raw) return null
    const profile = JSON.parse(raw)
    const role = String(profile?.role || "").toUpperCase()
    if (role === "FRONTLINE_STAFF") return "frontline"
    if (role === "ADMIN") return "admin"
    if (role === "PATIENT") return "patient"
    if (
      role === "CLINICAL_SPECIALIST" ||
      role === "DOCTOR" ||
      role === "OBSERTITIAN"
    ) {
      return "doctor"
    }
  } catch {
    return null
  }
  return null
}

/**
 * Global chatbot host mounted from the root layout so the assistant
 * appears on every screen (home, login, and all role dashboards).
 * Role/view are synced from BloomCareApp via `bloomcare-context` events.
 */
export default function GlobalChatbot() {
  const [currentView, setCurrentView] = useState<AppView>("home")
  const [currentRole, setCurrentRole] = useState<UserRole>(null)

  useEffect(() => {
    const syncFromStorage = () => {
      const role = roleFromProfile()
      setCurrentRole(role)
      setCurrentView(role ? "dashboard" : "home")
    }

    syncFromStorage()

    const onContext = (event: Event) => {
      const custom = event as CustomEvent<{ currentView?: AppView; currentRole?: UserRole }>
      if (!custom.detail) return
      if (custom.detail.currentView) setCurrentView(custom.detail.currentView)
      if ("currentRole" in custom.detail) setCurrentRole(custom.detail.currentRole ?? null)
    }

    const onNavigate = (event: Event) => {
      const custom = event as CustomEvent<"home" | "login" | "features" | "conditions" | "dashboard">
      if (custom.detail === "home" || custom.detail === "features" || custom.detail === "conditions") {
        setCurrentView("home")
      } else if (custom.detail === "login") {
        setCurrentView("login")
      } else if (custom.detail === "dashboard") {
        setCurrentView("dashboard")
      }
    }

    window.addEventListener("bloomcare-context", onContext as EventListener)
    window.addEventListener("bloomcare-navigate", onNavigate as EventListener)
    window.addEventListener("storage", syncFromStorage)
    return () => {
      window.removeEventListener("bloomcare-context", onContext as EventListener)
      window.removeEventListener("bloomcare-navigate", onNavigate as EventListener)
      window.removeEventListener("storage", syncFromStorage)
    }
  }, [])

  return <SiteChatbot currentView={currentView} currentRole={currentRole} />
}
