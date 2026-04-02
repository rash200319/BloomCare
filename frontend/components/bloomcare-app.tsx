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
  'FRONTLINE_STAFF': 'frontline',
  'CLINICAL_SPECIALIST': 'doctor',
  'ADMIN': 'admin',
  'PATIENT': 'patient'
}

export default function BloomCareApp() {
  const [currentRole, setCurrentRole] = useState<UserRole>(null)
  const [currentView, setCurrentView] = useState<AppView>("home")
  const [isLoading, setIsLoading] = useState(true)

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

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  // Show home page
  if (currentView === "home") {
    return (
      <HomePage 
        onNavigateToLogin={handleNavigateToLogin}
      />
    )
  }

  // Show login page
  if (currentView === "login") {
    return (
      <LoginPage 
        onLogin={handleLogin} 
        onBack={handleNavigateToHome}
      />
    )
  }

  // ✅ ROLE ENFORCEMENT: Only render the dashboard that matches user's actual role
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
      return (
        <HomePage 
          onNavigateToLogin={handleNavigateToLogin}
        />
      )
  }
}
