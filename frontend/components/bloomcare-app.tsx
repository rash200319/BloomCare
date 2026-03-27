"use client"

import { useState } from "react"
import HomePage from "./home-page"
import LoginPage from "./login-page"
import FrontlineTriageDashboard from "./frontline-triage-dashboard"
import ClinicalDashboard from "./clinical-dashboard"
import AdminDashboard from "./admin-dashboard"
import PatientPortal from "./patient-portal"

type UserRole = "frontline" | "doctor" | "admin" | "patient" | null
type AppView = "home" | "login" | "signup" | "dashboard"

export default function BloomCareApp() {
  const [currentRole, setCurrentRole] = useState<UserRole>(null)
  const [currentView, setCurrentView] = useState<AppView>("home")

  const handleLogin = (role: UserRole) => {
    setCurrentRole(role)
    setCurrentView("dashboard")
  }

  const handleLogout = () => {
    setCurrentRole(null)
    setCurrentView("home")
  }

  const handleNavigateToLogin = () => {
    setCurrentView("login")
  }

  const handleNavigateToSignup = () => {
    setCurrentView("signup")
  }

  const handleNavigateToHome = () => {
    setCurrentView("home")
  }

  // Show home page
  if (currentView === "home") {
    return (
      <HomePage 
        onNavigateToLogin={handleNavigateToLogin} 
        onNavigateToSignup={handleNavigateToSignup}
      />
    )
  }

  // Show login or signup page
  if (currentView === "login" || currentView === "signup") {
    return (
      <LoginPage 
        onLogin={handleLogin} 
        onBack={handleNavigateToHome}
        isSignup={currentView === "signup"}
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
          onNavigateToSignup={handleNavigateToSignup}
        />
      )
  }
}
