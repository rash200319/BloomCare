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
}: AppointmentSchedulingProps) {
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

  const [selectedSpecialization, setSelectedSpecialization] = useState<string | null>(null)
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null)
  const [notes, setNotes] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [searchSpecialist, setSearchSpecialist] = useState("")

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
            (daySlot.available_slots || []).map((slot: any) => ({
              time: slot,
              available: true,
              label: slot,
            }))
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

  const handleBookAppointment = async () => {
    if (!selectedSpecialist || !selectedDate || !selectedTimeSlot) {
      setError("Please complete all selection steps")
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const response = await apiRequest("/appointments/", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId,
          specialist_name: selectedSpecialist.full_name,
          appointment_date: `${selectedDate}T${selectedTimeSlot}:00`,
          duration_minutes: 30,
          notes: notes || null,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to book appointment: ${response.statusText}`)
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
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book appointment")
    } finally {
      setIsLoading(false)
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
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
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
            {successMessage && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-900">{successMessage}</h3>
                </div>
              </div>
            )}

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
                  {specializations.map((spec) => (
                    <button
                      key={spec.specialization}
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
                      filteredSpecialists.map((specialist) => (
                        <button
                          key={specialist.user_id}
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
                            availableTimeSlots.map((slot) => (
                              <button
                                key={slot.time}
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
                    {isLoading ? "Booking..." : getText("Confirm Booking", "වෙන්කරගැනීම තහවුරු කරන්න", "நியமனத்தை உறுதிப்படுத්தவும்")}
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
                      <div key={apt.id} className="p-3 border border-gray-200 rounded-lg">
                        <p className="font-medium text-gray-900 text-sm">{apt.specialist_name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(apt.appointment_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(apt.appointment_date).toLocaleTimeString()}
                        </p>
                        <Badge className="mt-2 text-xs" variant={apt.status === "SCHEDULED" ? "default" : "secondary"}>
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
    </div>
  )
}
