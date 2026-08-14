"use client"

import { useState, useEffect } from "react"
import HomePage from "./home-page"
import LoginPage from "./login-page"
import FrontlineTriageDashboard from "./frontline-triage-dashboard"
import ClinicalDashboard from "./clinical-dashboard"
import AdminDashboard from "./admin-dashboard"
import PatientPortal from "./patient-portal"

type UserRole = "frontline" | "doctor" | "admin" | "patient" | null
type AppView = "home" | "login" | "dashboard"

// Map backend roles to frontend roles
const ROLE_MAP: Record<string, UserRole> = {
  FRONTLINE_STAFF: "frontline",
  DOCTOR: "doctor",
  CLINICAL_SPECIALIST: "doctor",
  // Legacy seed/DB value — migrate with backend/db/migrate_roles.py
  OBSERTITIAN: "doctor",
  ADMIN: "admin",
  PATIENT: "patient",
}

export default function BloomCareApp() {
  const [currentRole, setCurrentRole] = useState<UserRole>(null)
  const [currentView, setCurrentView] = useState<AppView>("home")
  const [isLoading, setIsLoading] = useState(true)
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null)

  // Restore session on app mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedProfile = localStorage.getItem("bloomcare_user_profile")
      const token = localStorage.getItem("bloomcare_access_token")
      
      if (storedProfile && token) {
        try {
          const profile = JSON.parse(storedProfile)
          const actualRole = ROLE_MAP[profile.role]
          
          if (actualRole) {
            setCurrentRole(actualRole)
            setCurrentView("dashboard")
          } else {
            // Invalid role, clear storage
            localStorage.removeItem("bloomcare_access_token")
            localStorage.removeItem("bloomcare_user_profile")
            setCurrentRole(null)
            setCurrentView("home")
          }
        } catch (error) {
          console.error("Failed to restore session:", error)
          localStorage.removeItem("bloomcare_access_token")
          localStorage.removeItem("bloomcare_user_profile")
          setCurrentRole(null)
          setCurrentView("home")
        }
      }
    }
    setIsLoading(false)
  }, [])

  const handleLogin = () => {
    // ✅ Login handler - extracts role from stored profile
    if (typeof window !== "undefined") {
      const storedProfile = localStorage.getItem("bloomcare_user_profile")
      
      if (storedProfile) {
        try {
          const profile = JSON.parse(storedProfile)
          const actualRole = ROLE_MAP[profile.role]
          
          if (actualRole) {
            setCurrentRole(actualRole)
            setCurrentView("dashboard")
            return
          }
        } catch (error) {
          console.error("Failed to process login:", error)
        }
      }
    }
    
    // Fallback to home on error
    setCurrentRole(null)
    setCurrentView("home")
  }

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("bloomcare_access_token")
      window.localStorage.removeItem("bloomcare_user_profile")
    }
    setCurrentRole(null)
    setCurrentView("home")
  }

  const handleNavigateToLogin = () => {
    setCurrentView("login")
  }

  const handleNavigateToHome = () => {
    setCurrentRole(null)
    setCurrentView("home")
  }

  const handleChatbotNavigate = (target: "home" | "login" | "features" | "conditions" | "dashboard") => {
    if (target === "home") {
      setCurrentRole(null)
      setCurrentView("home")
      setPendingSectionId(null)
      return
    }

    if (target === "login") {
      setCurrentView("login")
      setPendingSectionId(null)
      return
    }

    if (target === "features" || target === "conditions") {
      setCurrentRole(null)
      setCurrentView("home")
      setPendingSectionId(target)
      return
    }

    if (target === "dashboard") {
      if (currentRole) {
        setCurrentView("dashboard")
      } else {
        setCurrentView("login")
      }
      setPendingSectionId(null)
    }
  }

  useEffect(() => {
    if (currentView !== "home" || !pendingSectionId || typeof window === "undefined") return

    const timeout = window.setTimeout(() => {
      const section = document.getElementById(pendingSectionId)
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      setPendingSectionId(null)
    }, 100)

    return () => window.clearTimeout(timeout)
  }, [currentView, pendingSectionId])

  // Global layout chatbot navigates via this event so it works on every UI.
  useEffect(() => {
    if (typeof window === "undefined") return

    const onChatbotNavigate = (event: Event) => {
      const custom = event as CustomEvent<"home" | "login" | "features" | "conditions" | "dashboard">
      if (!custom.detail) return
      handleChatbotNavigate(custom.detail)
    }

    window.addEventListener("bloomcare-navigate", onChatbotNavigate as EventListener)
    return () => {
      window.removeEventListener("bloomcare-navigate", onChatbotNavigate as EventListener)
    }
  }, [currentRole])

  const renderMainView = () => {
    if (currentView === "home") {
      return <HomePage onNavigateToLogin={handleNavigateToLogin} />
    }

    if (currentView === "login") {
      return <LoginPage onLogin={handleLogin} onBack={handleNavigateToHome} />
    }

    switch (currentRole) {
      case "frontline":
        return <FrontlineTriageDashboard onLogout={handleLogout} />
      case "doctor":
        return <ClinicalDashboard onLogout={handleLogout} />
      case "admin":
        return <AdminDashboard onLogout={handleLogout} />
      case "patient":
        return <PatientPortal onLogout={handleLogout} />
      default:
        return <HomePage onNavigateToLogin={handleNavigateToLogin} />
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return <>{renderMainView()}</>
}
