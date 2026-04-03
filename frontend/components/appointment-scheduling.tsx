"use client"

import { useEffect, useState } from "react"
import {
  Calendar,
  Clock,
  User,
  Search,
  CheckCircle,
  AlertCircle,
  Stethoscope,
  ChevronRight,
  Globe,
  LogOut,
  Trash2,
  Bell,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type Language = "EN" | "SI" | "TA"

interface AppointmentSchedulingProps {
  patientId: string
  patientName: string
  onLogout: () => void
  onBack?: () => void
}

interface Specialization {
  specialization: string
  specialist_count: number
}

interface Specialist {
  user_id: string
  full_name: string
  specialization: string
  contact?: string
}

interface TimeSlot {
  time: string
  available: boolean
  label: string
}

interface Appointment {
  id: string
  patient_id: string
  specialist_id: string
  specialist_name: string
  appointment_type?: string
  appointment_date: string
  duration_minutes: number
  queue_number: number
  status: string
  notes?: string
  created_at: string
}

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "")

function getApiBaseCandidates(): string[] {
  const candidates = [configuredApiBase, "http://localhost:8005/api/v1", "http://127.0.0.1:8005/api/v1"]

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:"
    const host = window.location.hostname || "localhost"
    candidates.push(`${protocol}//${host}:8005/api/v1`)
  }

  candidates.push("http://localhost:8005/api/v1", "http://127.0.0.1:8005/api/v1")

  return candidates.filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value as string) === index)
}

const languages = [
  { code: "EN", label: "English" },
  { code: "SI", label: "Sinhala" },
  { code: "TA", label: "Tamil" },
]

export default function AppointmentScheduling({
  patientId,
  patientName,
  onLogout,
  onBack,
}: AppointmentSchedulingProps) {
  const [viewerRole, setViewerRole] = useState<"frontline" | "doctor" | "admin" | "patient" | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("EN")
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [activeStep, setActiveStep] = useState<"specialization" | "specialist" | "date" | "confirm">(
    "specialization"
  )
  const [specializations, setSpecializations] = useState<Specialization[]>([])
  const [specialists, setSpecialists] = useState<Specialist[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([])
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null)
  const [isDeletingAppointment, setIsDeletingAppointment] = useState(false)

  const [selectedSpecialization, setSelectedSpecialization] = useState<string | null>(null)
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null)
  const [notes, setNotes] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [searchSpecialist, setSearchSpecialist] = useState("")
  
  // Notifications
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const storedProfile = window.localStorage.getItem("bloomcare_user_profile")
      if (!storedProfile) return

      const profile = JSON.parse(storedProfile)
      const role = String(profile?.role || "").toUpperCase()

      if (role === "FRONTLINE_STAFF") setViewerRole("frontline")
      else if (role === "DOCTOR" || role === "CLINICAL_SPECIALIST") setViewerRole("doctor")
      else if (role === "ADMIN") setViewerRole("admin")
      else if (role === "PATIENT") setViewerRole("patient")
    } catch {
      setViewerRole(null)
    }
  }, [])

  const getText = (en: string, si: string, ta: string) => {
    if (selectedLanguage === "SI") return si
    if (selectedLanguage === "TA") return ta
    return en
  }

  const getAccessToken = (): string | null => {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem("bloomcare_access_token")
  }

  const apiRequest = async (path: string, init?: RequestInit): Promise<Response> => {
    const token = getAccessToken()
    if (!token) {
      throw new Error("No active session found. Please login again.")
    }

    const headers = new Headers(init?.headers)
    headers.set("Authorization", `Bearer ${token}`)
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }

    const candidates = getApiBaseCandidates()
    let lastError: unknown = null

    for (const base of candidates) {
      try {
        const response = await fetch(`${base}${path}`, {
          ...init,
          headers,
        })
        if (response.status === 404) {
          continue
        }
        return response
      } catch (error) {
        lastError = error
      }
    }

    if (lastError instanceof Error) {
      throw new Error(`Unable to reach backend API. ${lastError.message}`)
    }
    throw new Error("Unable to reach backend API.")
  }

  // Load specializations on mount
  useEffect(() => {
    const loadSpecializations = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await apiRequest("/appointments/specializations")
        const data = await response.json()
        setSpecializations(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load specializations")
      } finally {
        setIsLoading(false)
      }
    }
    loadSpecializations()
  }, [])

  // Load specialists when specialization is selected
  useEffect(() => {
    if (!selectedSpecialization) return

    const loadSpecialists = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await apiRequest(`/appointments/specialists/${selectedSpecialization}`)
        const data = await response.json()
        setSpecialists(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load specialists")
      } finally {
        setIsLoading(false)
      }
    }
    loadSpecialists()
  }, [selectedSpecialization])

  // Load availability when specialist is selected
  useEffect(() => {
    if (!selectedSpecialist) return

    const loadAvailability = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await apiRequest(`/appointments/availability/${selectedSpecialist.full_name}?days_ahead=14`)
        const data = await response.json()
        // Convert availability response to time slots
        if (Array.isArray(data)) {
          const slots: TimeSlot[] = data.flatMap((daySlot: any) =>
            (daySlot.available_slots || []).map((slot: any) => {
              // Extract time from slot - handle both ISO datetime and plain time formats
              let timeStr = typeof slot === 'string' ? slot : (slot.start_time || slot.time || '')

              // If it's a full ISO datetime (contains T), extract just the time part
              if (timeStr && timeStr.includes('T')) {
                const parts = timeStr.split('T')
                const timePortion = parts[1] || ''
                // Remove Z and split by period to remove milliseconds
                timeStr = timePortion.split('.')[0].replace('Z', '').trim()
              }

              const isAvailable = typeof slot === 'string' ? true : (slot.is_available !== false)
              return {
                time: timeStr,
                available: isAvailable,
                label: timeStr,
              }
            })
          )
          setAvailableTimeSlots(slots)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load availability")
      } finally {
        setIsLoading(false)
      }
    }
    loadAvailability()
  }, [selectedSpecialist])

  // Load existing appointments
  useEffect(() => {
    const loadAppointments = async () => {
      try {
        setError(null)
        const response = await apiRequest(`/appointments/patient/${patientId}`)
        const data = await response.json()
        setAppointments(data)
      } catch (err) {
        console.warn("Failed to load appointments:", err)
      }
    }
    loadAppointments()
  }, [patientId])

  // Load and poll for notifications (for FLS)
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await apiRequest(`/notifications/?limit=10&unread_only=true`)
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadNotificationCount(data.unread_count || 0)
      } catch (err) {
        console.warn("Failed to load notifications:", err)
      }
    }

    // Load notifications immediately
    loadNotifications()

    // Poll for new notifications every 30 seconds
    const notificationInterval = setInterval(loadNotifications, 30000)
    return () => clearInterval(notificationInterval)
  }, [])

  const handleNotificationClick = async (notificationId: string) => {
    try {
      await apiRequest(`/notifications/${notificationId}/read`, {
        method: "PATCH",
      })
      // Remove from unread notifications
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.warn("Failed to mark notification as read:", err)
    }
  }

  const handleMarkAllNotificationsRead = async () => {
    try {
      await apiRequest(`/notifications/read-all`, {
        method: "POST",
      })
      setNotifications([])
      setUnreadNotificationCount(0)
    } catch (err) {
      console.warn("Failed to mark all notifications as read:", err)
    }
  }

  const handleBookAppointment = async () => {
    if (viewerRole === "patient") {
      setError("Patients can only view appointments. Please contact frontline staff to request one.")
      return
    }

    if (!selectedSpecialist || !selectedDate || !selectedTimeSlot) {
      setError("Please complete all selection steps")
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Time slot format: either HH:MM:SS or ISO datetime string
      let timeStr = String(selectedTimeSlot).trim()
      
      // If timeStr is an ISO datetime, extract just the time part
      if (timeStr.includes('T')) {
        const timePart = timeStr.split('T')[1] || timeStr
        // Remove Z and any milliseconds: "14:30:00Z" -> "14:30:00"
        timeStr = timePart.split('.')[0].replace('Z', '').trim()
      }
      
      if (!timeStr || !timeStr.includes(':')) {
        throw new Error("Invalid time slot selected")
      }

      // Create ISO 8601 datetime - combine date and time
      const dateStr = String(selectedDate).trim()
      const appointmentDateTime = new Date(`${dateStr}T${timeStr}Z`)

      // Validate the date is correct
      if (isNaN(appointmentDateTime.getTime())) {
        throw new Error("Invalid date or time value")
      }

      const isoDateTime = appointmentDateTime.toISOString()

      const response = await apiRequest("/appointments/", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId,
          specialist_name: selectedSpecialist.full_name,
          appointment_date: isoDateTime,
          duration_minutes: 30,
          notes: notes || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to book appointment: ${response.statusText}`)
      }

      const data = await response.json()
      setAppointments([...appointments, data])
      setSuccessMessage("Appointment booked successfully!")

      // Reset form
      setTimeout(() => {
        setActiveStep("specialization")
        setSelectedSpecialization(null)
        setSelectedSpecialist(null)
        setSelectedDate(null)
        setSelectedTimeSlot(null)
        setNotes("")
        setSuccessMessage(null)
      }, 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book appointment")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelAppointment = async (appointmentId: string) => {
    if (viewerRole === "patient") {
      setError("Patients cannot cancel appointments. Please contact frontline staff.")
      return
    }

    if (!window.confirm(getText(
      "Are you sure you want to cancel this appointment?",
      "ඔබ විශ්වාසද මෙම නියුතුව අවලංගු කිරීමට?",
      "இந்த நியமனத்தை ரத்து செய்ய நீங்கள் உறுதியா?"
    ))) {
      return
    }

    try {
      setIsDeletingAppointment(true)
      setError(null)
      console.log(`[CANCEL] Starting cancel for appointment: ${appointmentId}`)
      const response = await apiRequest(`/appointments/${appointmentId}`, {
        method: "DELETE",
      })
      console.log(`[CANCEL] Response status: ${response.status}`, response)

      if (!response.ok) {
        throw new Error(`Failed to cancel appointment: ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`[CANCEL] Success response:`, data)
      setAppointments(appointments.filter((apt) => apt.id !== appointmentId))
      setAppointmentToDelete(null)
      setSuccessMessage(getText(
        "Appointment cancelled successfully!",
        "නියුතුව සාර්ථකව අවලංගු කරන ලදී!",
        "நியமனம் வெற்றிகரமாக ரத்து செய்யப்பட்டது!"
      ))
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      console.error(`[CANCEL] Error:`, err)
      setError(err instanceof Error ? err.message : "Failed to cancel appointment")
    } finally {
      setIsDeletingAppointment(false)
    }
  }

  const filteredSpecialists = specialists.filter((spec) =>
    spec.full_name.toLowerCase().includes(searchSpecialist.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {onBack && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBack}
                  className="flex items-center gap-2"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  Back
                </Button>
              )}
              <Calendar className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                {getText("Appointment Booking", "නිয়োජනය වෙන්කරගැනීම", "நியமனம் பதிவு")}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                  className="flex items-center gap-2"
                >
                  <Globe className="w-4 h-4" />
                  {selectedLanguage}
                </Button>
                {showLanguageDropdown && (
                  <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    {languages.map((lang, index) => (
                      <button
                        key={`lang-${lang.code}-${index}`}
                        onClick={() => {
                          setSelectedLanguage(lang.code as Language)
                          setShowLanguageDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Notifications Bell */}
              {viewerRole === "frontline" && (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative flex items-center gap-2"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadNotificationCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadNotificationCount}
                      </span>
                    )}
                  </Button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        {unreadNotificationCount > 0 && (
                          <button
                            onClick={handleMarkAllNotificationsRead}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-500">
                          No new notifications
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 border-b border-gray-100 hover:bg-opacity-75 cursor-pointer flex items-start gap-3 transition-colors ${
                              notification.notification_type === "APPOINTMENT_CONFIRMED"
                                ? "bg-green-50 hover:bg-green-100"
                                : notification.notification_type === "APPOINTMENT_CANCELLED"
                                  ? "bg-red-50 hover:bg-red-100"
                                  : "hover:bg-gray-50"
                            }`}
                            onClick={() => handleNotificationClick(notification.id)}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {notification.notification_type === "APPOINTMENT_CONFIRMED" ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : notification.notification_type === "APPOINTMENT_CANCELLED" ? (
                                <AlertCircle className="w-4 h-4 text-red-600" />
                              ) : (
                                <Bell className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                              <p className="text-xs text-gray-600 line-clamp-2">{notification.message}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(notification.created_at).toLocaleString()}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleNotificationClick(notification.id)
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                </Button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">{patientName}</p>
                      <p className="text-xs text-gray-500">{patientId}</p>
                    </div>
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-b-lg"
                    >
                      <LogOut className="w-4 h-4" />
                      {getText("Logout", "ලොගআउට්", "விளக்கம்")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Booking Steps */}
          <div className="lg:col-span-2">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-900">{error}</h3>
                </div>
              </div>
            )}

            {/* Step 1: Specialization Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">
                    1
                  </span>
                  {getText("Select Specialization", "විශේෂીකරණ තෝරන්න", "நிபுணதை தேர்வு செய்யவும்")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {specializations.map((spec, index) => (
                    <button
                      key={`spec-${spec.specialization}-${index}`}
                      onClick={() => {
                        setSelectedSpecialization(spec.specialization)
                        setActiveStep("specialist")
                      }}
                      className={cn(
                        "p-4 rounded-lg border-2 text-left transition-all",
                        selectedSpecialization === spec.specialization
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-blue-400"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{spec.specialization}</p>
                          <p className="text-sm text-gray-500">
                            {getText(
                              `${spec.specialist_count} specialist${spec.specialist_count !== 1 ? "s" : ""}`,
                              `විශේෂඥ ${spec.specialist_count}`,
                              `நிபுணர் ${spec.specialist_count}`
                            )}
                          </p>
                        </div>
                        <Stethoscope className="w-5 h-5 text-blue-600" />
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Specialist Selection */}
            {selectedSpecialization && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">
                      2
                    </span>
                    {getText("Select Specialist", "විශේෂඥයා තෝරන්න", "நிபுணர் தேர்வு செய்யவும்")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Input
                      placeholder={getText("Search specialists...", "විශේෂඥයා සොයන්න...", "நிபுணர்களைத் தேடুங்கள்...")}
                      value={searchSpecialist}
                      onChange={(e) => setSearchSpecialist(e.target.value)}
                      className="mb-4"
                    />
                  </div>
                  <div className="space-y-2">
                    {filteredSpecialists.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        {getText("No specialists found", "විශේෂඥයා නොමැත", "நிபுணர்கள் পাওয়া যায়নি")}
                      </p>
                    ) : (
                      filteredSpecialists.map((specialist, index) => (
                        <button
                          key={`specialist-${specialist.user_id}-${index}`}
                          onClick={() => {
                            setSelectedSpecialist(specialist)
                            setActiveStep("date")
                          }}
                          className={cn(
                            "w-full p-4 rounded-lg border-2 text-left transition-all",
                            selectedSpecialist?.user_id === specialist.user_id
                              ? "border-blue-600 bg-blue-50"
                              : "border-gray-200 bg-white hover:border-blue-400"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{specialist.full_name}</p>
                              <p className="text-sm text-gray-500">{specialist.specialization}</p>
                            </div>
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Date & Time Selection */}
            {selectedSpecialist && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">
                      3
                    </span>
                    {getText("Select Date & Time", "දිනය සහ වේලාව තෝරන්න", "தேதி மற்றும் நேரத்தைத் தேர்வு செய்யவும்")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText("Appointment Date", "නියුතු දිනය", "நியமன தேதி")}
                      </label>
                      <Input
                        type="date"
                        value={selectedDate || ""}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>

                    {selectedDate && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText("Preferred Time", "선호하는 시간", "விருப்பமான நேரம்")}
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {availableTimeSlots.length === 0 ? (
                            <p className="col-span-4 text-gray-500 text-center py-4">
                              {getText("No slots available", "ස්ලට්ටු නැත", "இடங்கள் கிடைக்கவில்லை")}
                            </p>
                          ) : (
                            availableTimeSlots.map((slot, index) => (
                              <button
                                key={`slot-${slot.time}-${index}`}
                                onClick={() => setSelectedTimeSlot(slot.time)}
                                disabled={!slot.available}
                                className={cn(
                                  "p-2 rounded-lg border text-sm font-medium transition-all",
                                  selectedTimeSlot === slot.time
                                    ? "border-blue-600 bg-blue-50 text-blue-900"
                                    : "border-gray-200 text-gray-700 hover:border-blue-400"
                                )}
                              >
                                {slot.label}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText("Notes (Optional)", "සටහන් (විකල්පක)", "குறிப்புகள் (விரும்பினால்)")}
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={getText(
                          "Add any additional notes...",
                          "අতිරේක සටහන් එක් කරන්න...",
                          "கூடுதல் குறிப்புகளை சேர்க்கவும்..."
                        )}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Confirmation */}
            {selectedSpecialist && selectedDate && selectedTimeSlot && (
              <Card className="mt-6 border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white text-sm font-bold">
                      4
                    </span>
                    {getText("Review & Confirm", "පරීක්ෂා කරන්න සහ තහවුරු කරන්න", "மதிப்பாய்வு மற்றும் உறுதிப்படுத்தவும்")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                      <span className="text-gray-600">
                        {getText("Specialist", "විශේෂඥයා", "நிபுணர்")}
                      </span>
                      <span className="font-medium">{selectedSpecialist.full_name}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                      <span className="text-gray-600">
                        {getText("Specialization", "විශේෂීකරණ", "சிறப்பு")}
                      </span>
                      <span className="font-medium">{selectedSpecialization}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                      <span className="text-gray-600">{getText("Date", "දිනය", "தேதி")}</span>
                      <span className="font-medium">{new Date(selectedDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                      <span className="text-gray-600">{getText("Time", "වේලාව", "நேரம்")}</span>
                      <span className="font-medium">{selectedTimeSlot}</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleBookAppointment}
                    disabled={isLoading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg"
                  >
                    {viewerRole === "patient"
                      ? getText("Patients can only view appointments", "රෝගීන්ට නියුතු බැලිය හැකියි පමණි", "நோயாளிகள் நியமனங்களை மட்டும் காண முடியும்")
                      : isLoading
                        ? "Booking..."
                        : getText("Confirm Booking", "වෙන්කරගැනීම තහවුරු කරන්න", "நியமனத்தை உறுதிப்படுத்தவும்")}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Upcoming Appointments Sidebar */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {getText("Your Appointments", "ඔබේ නියුතු", "உங்கள் நியமனங்கள்")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {appointments.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    {getText("No appointments yet", "තවම නියුතු නැත", "இதுவரை நியமனங்கள் இல்லை")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {appointments.map((apt) => (
                      <div key={apt.id} className="p-3 border border-gray-200 rounded-lg hover:border-red-200 hover:bg-red-50/30 transition-all">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-medium text-gray-900 text-sm flex-1">{apt.specialist_name}</p>
                          {viewerRole !== "patient" && (apt.status === "PENDING" || apt.status === "CONFIRMED" || apt.status === "SCHEDULED") && (
                            <button
                              onClick={() => handleCancelAppointment(apt.id)}
                              disabled={isDeletingAppointment && appointmentToDelete === apt.id}
                              className="text-red-500 hover:text-red-700 hover:bg-red-100 p-1.5 rounded transition-all disabled:opacity-50"
                              title={getText("Cancel Appointment", "නියුතුව අවලංගු කරන්න", "நியமனத்தை ரத்து செய்யவும்")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(apt.appointment_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(apt.appointment_date).toLocaleTimeString()}
                        </p>
                        <Badge className="mt-2 text-xs" variant={apt.status === "PENDING" || apt.status === "CONFIRMED" ? "default" : "secondary"}>
                          {apt.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Success Notification - Fixed at Bottom */}
      {successMessage && (
        <div className="fixed bottom-6 left-6 right-6 max-w-md mx-auto p-4 bg-green-50 border border-green-200 rounded-lg shadow-lg flex items-start gap-3 animate-in slide-in-from-bottom">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-green-900">{successMessage}</h3>
          </div>
        </div>
      )}
    </div>
  )
}
