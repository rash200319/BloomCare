"use client"

import { useState } from "react"
import HomePage from "./home-page"
import LoginPage from "./login-page"
import FrontlineTriageDashboard from "./frontline-triage-dashboard"
import ClinicalDashboard from "./clinical-dashboard"
import AdminDashboard from "./admin-dashboard"
import PatientPortal from "./patient-portal"

type UserRole = "frontline" | "doctor" | "admin" | "patient" | null
type AppView = "home" | "login" | "dashboard"

export default function BloomCareApp() {
  const [currentRole, setCurrentRole] = useState<UserRole>(null)
  const [currentView, setCurrentView] = useState<AppView>("home")

  const handleLogin = (role: UserRole) => {
    setCurrentRole(role)
    setCurrentView("dashboard")
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
    setCurrentView("home")
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

  // Render the appropriate dashboard based on the current role
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
