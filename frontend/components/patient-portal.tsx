"use client"

import { getApiBaseCandidates } from "@/lib/api"

import { useState, useEffect, useMemo } from "react"
import {
  User,
  Globe,
  ChevronDown,
  Baby,
  Heart,
  Activity,
  Calendar,
  Clock,
  Settings,
  LogOut,
  CheckCircle,
  AlertCircle,
  FileText,
  Phone,
  MapPin,
  ChevronRight,
  MessageSquare,
  Pill,
  Scale,
  Thermometer,
  Droplets,
  Info,
  Sparkles,
  Building2,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { getWeeklyInsight } from "@/lib/weekly-insights"
import ProfileSettingsDialog from "./profile-settings-dialog"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

type Language = "EN" | "SI" | "TA"
type ExplainLanguage = "en" | "si" | "ta"

interface ScreeningHistoryItem {
  primary_disease_checked?: string | null
  dominant_condition?: string | null
  explainability_data?: {
    features?: Array<{ feature?: string; importance?: number; contribution?: number }>
    [key: string]: unknown
  }
  stage1?: {
    systolic?: number | null
    diastolic?: number | null
    bmi?: number | null
    heart_rate?: number | null
    temperature?: number | null
    blood_sugar?: number | null
    hemoglobin?: number | null
    edge_risk_score?: number | null
  }
}

interface LatestScreeningsPayload {
  patient_id?: string
  latest_stage2?: ScreeningHistoryItem | null
  latest_stage1?: ScreeningHistoryItem["stage1"] | null
  latest_screening_report?: {
    id?: string
    screened_at?: string
    general_risk_flag?: string
    probability_score?: number
    triggers?: unknown[]
  } | null
}

interface BackendStage1HistoryItem {
  screening_id?: string
  patient_id?: string
  patient_name?: string | null
  collected_at?: string | null
  gestational_age_weeks?: number | null
  systolic?: number | null
  diastolic?: number | null
  heart_rate?: number | null
  temperature?: number | null
  blood_sugar?: number | null
  edge_risk_score?: number | null
  edge_risk_classification?: string | null
  risk_label?: string | null
}

interface PatientPortalProps {
  onLogout: () => void
}

interface PatientDisplayData {
  name: string
  email: string
  gestationalWeek: number
  bloodGroup: string
  dueDate: string
  pregnancyStatus: string
}

interface StoredProfile {
  id?: string
  full_name?: string
  email?: string
  national_id?: string
  due_date?: string
  role?: string
}

interface PrescriptionItem {
  id: string
  patient_id: string
  doctor_full_name?: string | null
  doctor_specialization?: string | null
  medication_name: string
  dosage?: string | null
  frequency?: string | null
  route?: string | null
  instructions?: string | null
  start_date?: string | null
  end_date?: string | null
  is_active: boolean
}

interface AppointmentItem {
  id: string
  patient_id: string
  specialist_name?: string | null
  appointment_type?: string | null
  appointment_date: string
  status?: string | null
  notes?: string | null
  queue_number?: number | null
}

interface AppointmentViewItem {
  id: string
  patient_id: string
  type: string
  typeSi: string
  typeTa: string
  doctor: string
  date: string
  time: string
  location: string
  status: string
  notes: string | null
  queue_number: number | null
  appointmentDateValue: number
}

const DEFAULT_PATIENT_DATA: PatientDisplayData = {
  name: "Patient",
  email: "",
  gestationalWeek: 24,
  bloodGroup: "-",
  dueDate: "-",
  pregnancyStatus: "Monitoring",
}

function calculateGestationalWeekFromDueDate(dueDateValue?: string): number | null {
  if (!dueDateValue) return null

  const dueDate = new Date(dueDateValue)
  if (Number.isNaN(dueDate.getTime())) return null

  const conceptionDate = new Date(dueDate)
  conceptionDate.setDate(conceptionDate.getDate() - (40 * 7))

  const now = new Date()
  const elapsedMs = now.getTime() - conceptionDate.getTime()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const elapsedWeeks = Math.floor(elapsedMs / weekMs)

  if (!Number.isFinite(elapsedWeeks)) return null
  if (elapsedWeeks < 0) return 0
  if (elapsedWeeks > 40) return 40
  return elapsedWeeks
}

const PatientPortal = ({ onLogout }: PatientPortalProps) => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("EN")
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [storedProfile, setStoredProfile] = useState<StoredProfile | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [patientData, setPatientData] = useState<PatientDisplayData>(DEFAULT_PATIENT_DATA)
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([])
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [screeningHistory, setScreeningHistory] = useState<BackendStage1HistoryItem[]>([])
  const [latestScreenings, setLatestScreenings] = useState<LatestScreeningsPayload | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentViewItem | null>(null)
  const [isAiExplaining, setIsAiExplaining] = useState(false)
  const [aiScreeningMessages, setAiScreeningMessages] = useState<{ screening1: string; screening2: string }>({
    screening1: "",
    screening2: "",
  })
  const gestationalWeek = useMemo(() => {
    const calculated = calculateGestationalWeekFromDueDate(patientData.dueDate)
    return calculated ?? patientData.gestationalWeek
  }, [patientData.dueDate, patientData.gestationalWeek])
  const daysToWelcome = useMemo(() => {
    if (!patientData.dueDate || patientData.dueDate === "-") return null
    const dueDate = new Date(patientData.dueDate)
    if (Number.isNaN(dueDate.getTime())) return null
    const now = new Date()
    const msPerDay = 24 * 60 * 60 * 1000
    return Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / msPerDay))
  }, [patientData.dueDate])

  const weeklyInsight = useMemo(() => getWeeklyInsight(gestationalWeek), [gestationalWeek])
  const currentWeek = weeklyInsight.week
  const trimesterLabel = currentWeek <= 13 ? "1st" : currentWeek <= 27 ? "2nd" : "3rd"
  const remainingWeeks = Math.max(0, 40 - currentWeek)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine)
      const handleOnline = () => setIsOffline(false)
      const handleOffline = () => setIsOffline(true)
      window.addEventListener("online", handleOnline)
      window.addEventListener("offline", handleOffline)
      return () => {
        window.removeEventListener("online", handleOnline)
        window.removeEventListener("offline", handleOffline)
      }
    }
  }, [])

  const activePrescriptions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return prescriptions.filter((item) => {
      if (!item.is_active) return false

      const start = item.start_date ? new Date(item.start_date) : null
      const end = item.end_date ? new Date(item.end_date) : null

      if (start && Number.isNaN(start.getTime())) return false
      if (end && Number.isNaN(end.getTime())) return false

      const normalizedStart = start ? new Date(start) : null
      const normalizedEnd = end ? new Date(end) : null
      if (normalizedStart) normalizedStart.setHours(0, 0, 0, 0)
      if (normalizedEnd) normalizedEnd.setHours(0, 0, 0, 0)

      if (normalizedStart && today < normalizedStart) return false
      if (normalizedEnd && today > normalizedEnd) return false
      return true
    })
  }, [prescriptions])

  const prescribingDoctor = activePrescriptions[0] ?? prescriptions[0] ?? null

  useEffect(() => {
    if (typeof window === "undefined") return

    const hydratePatientProfile = async () => {
      let baseProfile: StoredProfile | null = null

      const profileRaw = window.localStorage.getItem("bloomcare_user_profile")
      if (profileRaw) {
        try {
          baseProfile = JSON.parse(profileRaw) as StoredProfile
          setStoredProfile(baseProfile)
          setPatientData((prev) => ({
            ...prev,
            name: baseProfile?.full_name || prev.name,
            email: baseProfile?.email || baseProfile?.national_id || prev.email,
            dueDate: (baseProfile as { due_date?: string; dueDate?: string })?.due_date || (baseProfile as { due_date?: string; dueDate?: string })?.dueDate || prev.dueDate,
          }))
        } catch (error) {
          console.error("Failed to parse stored patient profile", error)
        }
      }

      const token = window.localStorage.getItem("bloomcare_access_token")
      if (!token) return

      for (const baseUrl of getApiBaseCandidates()) {
        try {
          const response = await fetch(`${baseUrl}/dashboard/patient/dashboard`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })

          if (!response.ok) {
            if (response.status === 404) continue
            break
          }

          const payload = await response.json()
          setPatientData((prev) => ({
            ...prev,
            name: payload?.full_name || baseProfile?.full_name || prev.name,
            email: baseProfile?.email || baseProfile?.national_id || prev.email,
            dueDate: payload?.due_date || baseProfile?.due_date || prev.dueDate,
          }))
          break
        } catch {
          // Try next candidate URL
        }
      }
    }

    void hydratePatientProfile()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const hydratePrescriptions = async () => {
      const token = window.localStorage.getItem("bloomcare_access_token")
      if (!token) {
        setPrescriptions([])
        return
      }

      const profileRaw = window.localStorage.getItem("bloomcare_user_profile")
      let patientId: string | null = null
      if (profileRaw) {
        try {
          const profile = JSON.parse(profileRaw) as StoredProfile
          patientId = profile.id || null
        } catch {
          patientId = null
        }
      }

      if (!patientId) {
        setPrescriptions([])
        return
      }

      for (const baseUrl of getApiBaseCandidates()) {
        try {
          const response = await fetch(`${baseUrl}/prescriptions/patient/${patientId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })

          if (!response.ok) {
            if (response.status === 404) continue
            break
          }

          const payload = (await response.json()) as PrescriptionItem[]
          setPrescriptions(Array.isArray(payload) ? payload : [])
          break
        } catch {
          // Try next candidate URL
        }
      }
    }

    void hydratePrescriptions()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const hydrateAppointments = async () => {
      const token = window.localStorage.getItem("bloomcare_access_token")
      if (!token) {
        setAppointments([])
        return
      }

      const profileRaw = window.localStorage.getItem("bloomcare_user_profile")
      let patientId: string | null = null
      if (profileRaw) {
        try {
          const profile = JSON.parse(profileRaw) as StoredProfile
          patientId = profile.id || null
        } catch {
          patientId = null
        }
      }

      if (!patientId) {
        setAppointments([])
        return
      }

      for (const baseUrl of getApiBaseCandidates()) {
        try {
          const response = await fetch(`${baseUrl}/appointments/patient/${patientId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })

          if (!response.ok) {
            if (response.status === 404) continue
            break
          }

          const payload = (await response.json()) as AppointmentItem[]
          setAppointments(Array.isArray(payload) ? payload : [])
          break
        } catch {
          // Try next candidate URL
        }
      }
    }

    void hydrateAppointments()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const hydrateScreeningHistory = async () => {
      const token = window.localStorage.getItem("bloomcare_access_token")
      if (!token) {
        setScreeningHistory([])
        return
      }

      for (const baseUrl of getApiBaseCandidates()) {
        try {
          const response = await fetch(`${baseUrl}/triage/history?limit=12`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })

          if (!response.ok) {
            if (response.status === 404) continue
            break
          }

          const payload = (await response.json()) as BackendStage1HistoryItem[]
          setScreeningHistory(Array.isArray(payload) ? payload : [])
          break
        } catch {
          // Try next candidate URL
        }
      }
    }

    void hydrateScreeningHistory()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const hydrateLatestScreenings = async () => {
      const token = window.localStorage.getItem("bloomcare_access_token")
      if (!token) {
        setLatestScreenings(null)
        return
      }

      for (const baseUrl of getApiBaseCandidates()) {
        try {
          const response = await fetch(`${baseUrl}/patients/me/latest-screenings`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })

          if (!response.ok) {
            if (response.status === 404) continue
            break
          }

          setLatestScreenings((await response.json()) as LatestScreeningsPayload)
          break
        } catch {
          // Try next candidate URL
        }
      }
    }

    void hydrateLatestScreenings()
  }, [])

  const getText = (en: string, si: string, ta: string) => {
    if (selectedLanguage === "SI") return si
    if (selectedLanguage === "TA") return ta
    return en
  }

  const getExplainLanguage = (): ExplainLanguage => {
    if (selectedLanguage === "SI") return "si"
    if (selectedLanguage === "TA") return "ta"
    return "en"
  }

  const formatPrescriptionDate = (rawDate?: string | null): string => {
    if (!rawDate) return "--"
    const parsed = new Date(rawDate)
    if (Number.isNaN(parsed.getTime())) return "--"
    return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  }

  const getPrescriptionPeriodLabel = (startDate?: string | null, endDate?: string | null): string => {
    const start = formatPrescriptionDate(startDate)
    const end = formatPrescriptionDate(endDate)
    if (start === "--" && end === "--") return getText("Date not specified", "දිනය සඳහන් කර නොමැත", "தேதி குறிப்பிடப்படவில்லை")
    if (end === "--") return `${start} ${getText("onward", "සිට ඉදිරියට", "முதல் தொடர்ச்சி")}`
    if (start === "--") return `${getText("Until", "දක්වා", "வரை")} ${end}`
    return `${start} - ${end}`
  }

  const explainMedicalData = async (shapJson: Record<string, number>, conditionName: string) => {
    const response = await fetch("/api/patient-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shapJson,
        language: getExplainLanguage(),
        conditionName,
      }),
    })

    const data = (await response.json()) as { explanation?: string; error?: string }
    if (!response.ok || data.error) {
      throw new Error("AI explanation request failed")
    }

    return data.explanation || getText("No explanation available.", "පැහැදිලි කිරීමක් නොමැත.", "விளக்கம் இல்லை.")
  }

  const buildStage1FactorMap = (stage1?: ScreeningHistoryItem["stage1"]): Record<string, number> => {
    if (!stage1) return {}

    const mapped: Record<string, number | null | undefined> = {
      systolic_bp: stage1.systolic,
      diastolic_bp: stage1.diastolic,
      bmi: stage1.bmi,
      heart_rate: stage1.heart_rate,
      temperature: stage1.temperature,
      blood_sugar: stage1.blood_sugar,
      hemoglobin: stage1.hemoglobin,
      edge_risk_score: stage1.edge_risk_score,
    }

    return Object.fromEntries(
      Object.entries(mapped).filter(([, value]) => typeof value === "number" && Number.isFinite(value)),
    ) as Record<string, number>
  }

  const buildReportFactorMap = (report?: LatestScreeningsPayload["latest_screening_report"]): Record<string, number> => {
    if (!report) return {}

    const factors: Record<string, number> = {}
    if (typeof report.probability_score === "number" && Number.isFinite(report.probability_score)) {
      factors.probability_score = report.probability_score
    }
    if (Array.isArray(report.triggers)) {
      factors.trigger_count = report.triggers.length
    }
    return factors
  }

  const buildStage2FactorMap = (explainabilityData?: ScreeningHistoryItem["explainability_data"]): Record<string, number> => {
    if (!explainabilityData) return {}

    const features = Array.isArray(explainabilityData.features) ? explainabilityData.features : []
    if (features.length > 0) {
      const fromFeatures: Record<string, number> = {}
      features.forEach((entry) => {
        const name = (entry.feature || "").toString().trim()
        const importance = typeof entry.importance === "number" ? Math.abs(entry.importance) : null
        const contribution = typeof entry.contribution === "number" ? Math.abs(entry.contribution) : null
        const value = importance ?? contribution
        if (name && value !== null && Number.isFinite(value)) {
          fromFeatures[name] = value
        }
      })
      if (Object.keys(fromFeatures).length > 0) return fromFeatures
    }

    const flatNumeric = Object.entries(explainabilityData).filter(
      ([, value]) => typeof value === "number" && Number.isFinite(value),
    )
    return Object.fromEntries(flatNumeric) as Record<string, number>
  }

  const vitalsHistory = useMemo(() => {
    const mappedFromHistory = screeningHistory
      .map((entry) => {
        const collectedAt = entry.collected_at ? new Date(entry.collected_at) : null
        const hasValidDate = collectedAt !== null && !Number.isNaN(collectedAt.getTime())
        const weekLabel = entry.gestational_age_weeks ? `W${entry.gestational_age_weeks}` : null

        if (entry.systolic == null && entry.diastolic == null) return null

        return {
          week: weekLabel || (hasValidDate ? collectedAt!.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Recorded"),
          systolic: entry.systolic ?? null,
          diastolic: entry.diastolic ?? null,
          collectedAt: hasValidDate ? collectedAt!.getTime() : 0,
        }
      })
      .filter((entry): entry is { week: string; systolic: number | null; diastolic: number | null; collectedAt: number } => entry !== null)
      .sort((left, right) => left.collectedAt - right.collectedAt)

    if (mappedFromHistory.length > 0) {
      return mappedFromHistory.slice(-8)
    }

    const latestStage1 = latestScreenings?.latest_stage1
    if (latestStage1 && (latestStage1.systolic != null || latestStage1.diastolic != null)) {
      const fallbackWeek = gestationalWeek ? `W${gestationalWeek}` : "Latest"
      return [
        {
          week: fallbackWeek,
          systolic: latestStage1.systolic ?? null,
          diastolic: latestStage1.diastolic ?? null,
          collectedAt: 0,
        },
      ]
    }

    return []
  }, [gestationalWeek, latestScreenings, screeningHistory, selectedLanguage])

  const explainLatestScreenings = async () => {
    setIsAiExplaining(true)
    setAiScreeningMessages({ screening1: "", screening2: "" })
    try {
      if (typeof window === "undefined") return

      const token = window.localStorage.getItem("bloomcare_access_token")
      if (!token) {
        setAiScreeningMessages({
          screening1: getText(
            "Please sign in again to load your latest screening explanations.",
            "ඔබගේ නවතම පරීක්ෂණ පැහැදිලි කිරීම ලබාගැනීමට නැවත පිවිසෙන්න.",
            "உங்கள் சமீபத்திய திரையிடல் விளக்கத்தைப் பெற மீண்டும் உள்நுழையவும்.",
          ),
          screening2: "",
        })
        return
      }

      let latestPayload: LatestScreeningsPayload | null = null
      for (const baseUrl of getApiBaseCandidates()) {
        try {
          const response = await fetch(`${baseUrl}/patients/me/latest-screenings`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })

          if (!response.ok) {
            continue
          }

          latestPayload = (await response.json()) as LatestScreeningsPayload
          setLatestScreenings(latestPayload)
          break
        } catch {
          // Try next candidate URL
        }
      }

      if (!latestPayload) {
        setLatestScreenings(null)
        setAiScreeningMessages({
          screening1: getText(
            "No latest screening data found.",
            "නවතම පරීක්ෂණ දත්ත හමු නොවීය.",
            "சமீபத்திய திரையிடல் தரவு கிடைக்கவில்லை.",
          ),
          screening2: "",
        })
        return
      }

      const stage1Factors = buildStage1FactorMap(latestPayload.latest_stage1 || undefined)
      const reportFactors = buildReportFactorMap(latestPayload.latest_screening_report)
      const stage1MergedFactors = { ...stage1Factors, ...reportFactors }
      const latestStage2 = latestPayload.latest_stage2 || undefined
      const stage2Factors = buildStage2FactorMap(latestStage2?.explainability_data)

      const [screening1Text, screening2Text] = await Promise.all([
        Object.keys(stage1MergedFactors).length > 0
          ? explainMedicalData(stage1MergedFactors, "Screening 1")
          : Promise.resolve(
              getText(
                "Screening 1 details are not available yet.",
                "Screening 1 විස්තර තවම ලබාගත නොහැක.",
                "Screening 1 விவரங்கள் இன்னும் கிடைக்கவில்லை.",
              ),
            ),
        Object.keys(stage2Factors).length > 0
          ? explainMedicalData(
              stage2Factors,
              latestStage2?.dominant_condition || latestStage2?.primary_disease_checked || "Screening 2",
            )
          : Promise.resolve(
              getText(
                "Screening 2 explainability data is not available yet.",
                "Screening 2 පැහැදිලි කිරීමේ දත්ත තවම ලබාගත නොහැක.",
                "Screening 2 விளக்கத் தரவு இன்னும் கிடைக்கவில்லை.",
              ),
            ),
      ])

      setAiScreeningMessages({ screening1: screening1Text, screening2: screening2Text })
    } catch {
      setLatestScreenings(null)
      setAiScreeningMessages({
        screening1: getText(
          "Network issue while loading screening explanations.",
          "පරීක්ෂණ පැහැදිලි කිරීම් ලබාගැනීමේදී ජාල දෝෂයක් ඇතිවිය.",
          "திரையிடல் விளக்கங்களைப் பெறும் போது பிணைய சிக்கல் ஏற்பட்டது.",
        ),
        screening2: "",
      })
    } finally {
      setIsAiExplaining(false)
    }
  }

  const upcomingAppointments = useMemo(() => {
    return appointments
      .map((appointment) => {
        const appointmentDate = new Date(appointment.appointment_date)
        if (Number.isNaN(appointmentDate.getTime())) return null

        return {
          id: appointment.id,
          patient_id: appointment.patient_id,
          type: appointment.appointment_type || "Appointment",
          typeSi: appointment.appointment_type || "නියමනය",
          typeTa: appointment.appointment_type || "சந்திப்பு",
          date: appointmentDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
          time: appointmentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          doctor: appointment.specialist_name || "Assigned Specialist",
          location: "University of Moratuwa, Sri Lanka",
          status: (appointment.status || "scheduled").toLowerCase(),
          notes: appointment.notes || null,
          queue_number: appointment.queue_number ?? null,
          appointmentDateValue: appointmentDate.getTime(),
        }
      })
        .filter((appointment): appointment is AppointmentViewItem => appointment !== null)

      .sort((left, right) => left.appointmentDateValue - right.appointmentDateValue)
  }, [appointments])

  const insightFactIcons = [Droplets, Heart, Pill]
  const healthTips = weeklyInsight.facts.map((fact, index) => ({
    id: index + 1,
    title: fact.title,
    titleSi: fact.title,
    titleTa: fact.title,
    description: fact.description,
    descriptionSi: fact.description,
    descriptionTa: fact.description,
    icon: insightFactIcons[index] || Info,
  }))

  const languages = [
    { code: "EN", label: "English" },
    { code: "SI", label: "සිංහල" },
    { code: "TA", label: "தமிழ்" },
  ]

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans selection:bg-rose-500/20 scroll-smooth">
      {/* Background Decorative Elements */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-100 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-50 gap-3">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <div className="flex items-center gap-3 transition-transform hover:scale-105 cursor-pointer group">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 rotate-3 group-hover:rotate-0 transition-transform duration-500">
              <Baby className="w-7 h-7 text-white filter drop-shadow-sm" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-none">Bloom<span className="text-primary">Care</span></h1>
              <p className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">
                {getText("Patient Portal", "රෝගී ද්වාරය", "நோயாளி போர்டல்")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Offline Badge */}
          {isOffline && (
            <Badge variant="outline" className="h-8 rounded-lg bg-rose-50 border-rose-100 text-rose-500 text-[8px] font-black uppercase tracking-widest px-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {getText("Offline", "නොබැඳි", "ஆஃப்லைன்")}
            </Badge>
          )}

          {/* Language Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white rounded-xl border border-slate-200 hover:border-primary/30 transition-all shadow-sm"
            >
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{selectedLanguage}</span>
              <ChevronDown className="w-4 h-4 text-slate-300" />
            </button>
            {showLanguageDropdown && (
              <div className="absolute top-full right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 min-w-[160px] overflow-hidden animate-in fade-in slide-in-from-top-2">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setSelectedLanguage(lang.code as Language)
                      setShowLanguageDropdown(false)
                    }}
                    className={cn(
                      "w-full px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest transition-colors",
                      selectedLanguage === lang.code 
                        ? "bg-primary text-white" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-8 w-px bg-slate-100 mx-1 sm:mx-2" />

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 group"
            >
              <div className="hidden sm:text-right sm:block">
                <p className="text-sm font-black text-slate-900 tracking-tight">{patientData.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Week {gestationalWeek} • {patientData.bloodGroup}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20 transition-transform group-hover:scale-105">
                <User className="w-5 h-5 text-white" />
              </div>
            </button>
            {showUserMenu && (
              <div className="absolute top-full right-0 mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 min-w-[220px] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="px-5 py-4 border-b border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                  <p className="text-xs font-bold text-slate-900">{patientData.name || patientData.email || "N/A"}</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    setShowProfileSettings(true)
                  }}
                  className="w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  My Profile
                </button>
                <button 
                  onClick={onLogout}
                  className="w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-primary hover:bg-rose-50 flex items-center gap-3"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        {/* Welcome Card */}
        <Card className="mb-10 border-0 glass overflow-hidden relative group shadow-2xl shadow-rose-100/20 rounded-[32px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 animate-pulse" />
          <CardContent className="p-10 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div>
                <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full text-[9px] font-black uppercase tracking-widest py-1 px-3 mb-4">
                  {getText("Journey Update", "ගමනේ තත්ත්වය", "பயண மேம்படுத்தல்")}
                </Badge>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">
                  {getText("Hello, ", "ආයුබෝවන්, ", "வணக்கம், ")}
                  <span className="text-primary">{patientData.name.split(' ')[0]}</span>
                </h2>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="bg-white/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                       {getText("Week", "සතිය", "வாரம்")} {gestationalWeek}
                    </span>
                  </div>
                  <div className="bg-white/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
                    <Baby className="w-4 h-4 text-accent" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                       {getText("Due Date:", "ප්‍රසව දිනය:", "பிரசவ தேதி:")} {patientData.dueDate}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl shadow-slate-900/40 transform hover:rotate-1 transition-transform border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest">{getText("Condition Status", "තත්ත්වය", "நிலை")}</h3>
                    <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">{patientData.pregnancyStatus}</p>
                  </div>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed max-w-[240px]">
                  {getText("Your clinical analytics show optimal progression. Maintain routine monitoring.", "ඔබේ සායනික වාර්තාවලට අනුව සෞඛ්‍ය තත්ත්වය යහපත් වේ.", "உங்களின் மருத்துவ பகுப்பாய்வு உகந்த முன்னேற்றத்தைக் காட்டுகிறது.")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <TabsList className="bg-white/50 backdrop-blur-md border border-slate-100 p-1.5 rounded-2xl shadow-sm inline-flex w-full overflow-x-auto">
            <TabsTrigger value="overview" className="h-10 px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all">
              <Activity className="w-4 h-4 mr-2" />
              {getText("Overview", "දළ විශ්ලේෂණය", "கண்ணோட்டம்")}
            </TabsTrigger>
            <TabsTrigger value="health" className="h-10 px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all">
              <FileText className="w-4 h-4 mr-2" />
              {getText("Care Plan", "සත්කාර සැලැස්ම", "சிகிச்சை திட்டம்")}
            </TabsTrigger>
            <TabsTrigger value="appointments" className="h-10 px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all">
              <Calendar className="w-4 h-4 mr-2" />
              {getText("Visits", "හමුවීම්", "சந்திப்புகள்")}
            </TabsTrigger>
            <TabsTrigger value="tips" className="h-10 px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all">
              <Sparkles className="w-4 h-4 mr-2" />
              {getText("Insights", "විදසුන්", "நுண்ணறிவு")}
            </TabsTrigger>
          </TabsList>

          {/* Snapshot Tab */}
          <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden group rounded-[24px]">
                 <div className="h-1 w-full bg-primary" />
                 <CardContent className="p-8">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{getText("Gestational progress", "ප්‍රගතිය", "முன்னேற்றம்")}</p>
                   <div className="flex items-end justify-between">
                    <p className="text-3xl font-black text-slate-900 tracking-tight">{gestationalWeek} <span className="text-sm text-slate-400">weeks</span></p>
                   </div>
                   <div className="w-full h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
                     <div className="h-full bg-primary rounded-full" style={{ width: `${(gestationalWeek / 40) * 100}%` }} />
                   </div>
                 </CardContent>
              </Card>

              <Card className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden group rounded-[24px]">
                 <div className="h-1 w-full bg-accent" />
                 <CardContent className="p-8">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{getText("Estimated Delivery", "දින අපේක්ෂාව", "பிரசவ தேதி")}</p>
                   <div className="flex items-end justify-between">
                     <p className="text-2xl font-black text-slate-900 tracking-tight">{patientData.dueDate}</p>
                   </div>
                   <p className="text-[10px] font-bold text-accent uppercase tracking-widest mt-4">
                     {daysToWelcome !== null ? `${daysToWelcome} Days to welcome` : "Due date not available"}
                   </p>
                 </CardContent>
              </Card>

              <Card className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden group rounded-[24px]">
                 <div className="h-1 w-full bg-emerald-500" />
                 <CardContent className="p-8">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{getText("Next Analytics Sync", "මීළඟ පරීක්ෂාව", "அடுத்த ஸ்கிரீனிங்")}</p>
                   <div className="flex items-end justify-between">
                     <p className="text-2xl font-black text-slate-900 tracking-tight">{upcomingAppointments[0]?.date || "No schedule"}</p>
                   </div>
                   <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-4">
                     {upcomingAppointments[0] ? `${upcomingAppointments[0].time} • ${upcomingAppointments[0].location}` : "Not scheduled"}
                   </p>
                 </CardContent>
              </Card>
            </div>

            {/* Vitals Graph */}
            <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden rounded-[32px]">
               <CardHeader className="border-b border-slate-50/50 pb-6 px-10">
                 <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                    <Activity className="w-5 h-5 text-primary" />
                    {getText("Interactive Health Biometrics", "සෞඛ්‍ය දත්ත විශ්ලේෂණය", "சுகாதார உயிரியல் அளவீடுகள்")}
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-10">
                  <div className="h-80 w-full font-bold">
                    {vitalsHistory.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={vitalsHistory}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800 }} />
                          <Tooltip
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                          />
                          <Line type="monotone" dataKey="systolic" stroke="#F472B6" strokeWidth={4} dot={{ r: 4, fill: '#F472B6', strokeWidth: 2, stroke: '#fff' }} />
                          <Line type="monotone" dataKey="diastolic" stroke="#20847F" strokeWidth={4} dot={{ r: 4, fill: '#20847F', strokeWidth: 2, stroke: '#fff' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/60 px-6 text-center">
                        <div>
                          <p className="text-sm font-black text-slate-900">{getText("No screening history yet", "පරීක්ෂණ ඉතිහාසයක් තවම නැත", "இன்னும் திரையிடல் வரலாறு இல்லை")}</p>
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {getText("The chart will appear after your first recorded screening.", "ඔබගේ පළමු පරීක්ෂණය සුරැකුණු පසු ප්‍රස්තාරය දිස්වෙයි.", "உங்கள் முதல் பதிவுசெய்யப்பட்ட திரையிடலுக்குப் பிறகு வரைபடம் தோன்றும்.")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
               </CardContent>
            </Card>
          </TabsContent>

          {/* Health/Care Plan Tab */}
          <TabsContent value="health" className="space-y-8 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden rounded-[24px]">
                   <CardHeader className="border-b border-slate-50/50 pb-6 px-8">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                           <Pill className="w-5 h-5 text-emerald-500" />
                           {getText("Active Prescriptions", "ක්‍රියාකාරී ප්‍රිස්ක්‍රිප්ෂන්", "செயலில் உள்ள மருந்துச் சீட்டுகள்")}
                        </CardTitle>
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[9px] font-black uppercase tracking-wider px-2.5 py-1">
                          {activePrescriptions.length}
                        </Badge>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                        {getText("Only currently valid prescriptions are shown", "දැනට වලංගු ප්‍රිස්ක්‍රිප්ෂන් පමණක් පෙන්වයි", "தற்போது செல்லுபடியாகும் மருந்துச் சீட்டுகள் மட்டும் காட்டப்படும்")}
                      </p>
                   </CardHeader>
                   <CardContent className="p-0">
                      <div className="divide-y divide-slate-50">
                      {activePrescriptions.map((prescription) => (
                        <div key={prescription.id} className="p-6 sm:p-8 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-start justify-between mb-3 gap-3">
                            <div className="min-w-0">
                              <h4 className="text-base font-black text-emerald-700 truncate">{prescription.medication_name}</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                               {prescription.frequency || getText("Not specified", "සඳහන් කර නොමැත", "குறிப்பிடப்படவில்லை")} • {prescription.route || getText("Route not specified", "මාර්ගය සඳහන් කර නොමැත", "வழி குறிப்பிடப்படவில்லை")}
                              </p>
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-2">
                                {getText("Prescribed By", "නියම කළ වෛද්‍ය", "மருந்தளித்த நிபுணர்")}: {prescription.doctor_full_name || getText("Doctor", "වෛද්‍යවරයා", "மருத்துவர்")}
                              </p>
                              {prescription.doctor_specialization && (
                                <p className="text-[10px] font-semibold text-emerald-700/80 mt-1">
                                  {prescription.doctor_specialization}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[8px] font-black uppercase">{prescription.dosage || "--"}</Badge>
                              <Badge className="bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[8px] font-black uppercase tracking-wider">
                                {getText("Active", "ක්‍රියාකාරී", "செயலில்")}
                              </Badge>
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-100 bg-white p-3 mb-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                              <Info className="w-3.5 h-3.5" />
                              {getText("Instructions", "උපදෙස්", "வழிமுறைகள்")}
                            </p>
                            <p className="text-xs text-slate-600 font-medium leading-relaxed">{prescription.instructions || getText("No additional instructions", "අමතර උපදෙස් නොමැත", "கூடுதல் வழிமுறைகள் இல்லை")}</p>
                          </div>

                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                            {getPrescriptionPeriodLabel(prescription.start_date, prescription.end_date)}
                          </p>
                           </div>
                        ))}
                      {activePrescriptions.length === 0 && (
                        <div className="p-8 text-xs font-bold uppercase tracking-wider text-slate-400">
                          {getText("No active prescriptions", "ක්‍රියාකාරී ප්‍රිස්ක්‍රිප්ෂන් නොමැත", "செயலில் உள்ள மருந்துச் சீட்டுகள் இல்லை")}
                        </div>
                      )}
                      </div>
                   </CardContent>
                </Card>

                <Card className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden rounded-[24px]">
                   <CardHeader className="border-b border-slate-50/50 pb-6 px-8">
                      <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                         <MapPin className="w-5 h-5 text-blue-500" />
                         Clinical Care Points
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-8 space-y-6">
                      <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-4">
                         <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-blue-500" />
                         </div>
                         <div>
                            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Facility</p>
                            <p className="text-sm font-black text-slate-900">University of Moratuwa</p>
                            <p className="text-xs text-slate-500">Sri Lanka</p>
                         </div>
                      </div>
                      <div className="p-6 bg-rose-50/50 rounded-2xl border border-rose-100 flex items-start gap-4">
                         <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-primary" />
                         </div>
                         <div>
                            <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1">
                              {getText("Prescribing Doctor", "නියම කළ වෛද්‍ය", "மருந்தளித்த மருத்துவர்")}
                            </p>
                            <p className="text-sm font-black text-slate-900">
                              {prescribingDoctor?.doctor_full_name || getText("Not assigned yet", "තවම පවරා නැත", "இதுவரை ஒதுக்கப்படவில்லை")}
                            </p>
                            <p className="text-xs text-slate-500">
                              {prescribingDoctor?.doctor_specialization || getText("Specialty not available", "විශේෂතාවය නොමැත", "சிறப்பு விவரம் இல்லை")}
                            </p>
                         </div>
                      </div>
                   </CardContent>
                </Card>
             </div>

             <Card className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden rounded-[24px]">
               <CardHeader className="border-b border-slate-50/50 pb-6 px-8">
                 <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                   <Sparkles className="w-5 h-5 text-primary" />
                   {getText("AI Explain My Risk Factors", "AI මගේ අවදානම් සාධක පැහැදිලි කරන්න", "AI என் ஆபத்து காரணிகளை விளக்குக")}
                 </CardTitle>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                   {getText(
                     "Get a simple explanation from your latest model factors.",
                     "ඔබගේ නවතම මාදිලි සාධක වලින් සරල පැහැදිලි කිරීමක් ලබාගන්න.",
                     "உங்கள் சமீபத்திய மாதிரி காரணிகளிலிருந்து எளிய விளக்கத்தை பெறுங்கள்.",
                   )}
                 </p>
               </CardHeader>
               <CardContent className="p-8">
                 <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                   <Button
                     onClick={() => void explainLatestScreenings()}
                     disabled={isAiExplaining}
                     className="rounded-xl"
                   >
                     {isAiExplaining ? (
                       <>
                         <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                         {getText("Generating...", "සකසමින්...", "உருவாக்குகிறது...")}
                       </>
                     ) : (
                       <>
                         <MessageSquare className="w-4 h-4 mr-2" />
                         {getText(
                           "Explain Latest Screening 1 & 2",
                           "නවතම Screening 1 සහ 2 පැහැදිලි කරන්න",
                           "சமீபத்திய Screening 1 மற்றும் 2 ஐ விளக்குக",
                         )}
                       </>
                     )}
                   </Button>
                 </div>

                 {(aiScreeningMessages.screening1 || aiScreeningMessages.screening2) && (
                   <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                     <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">AI</p>
                     {aiScreeningMessages.screening1 && (
                       <p className="text-sm font-medium text-slate-700 leading-relaxed mb-2">
                         <span className="font-black">{getText("Screening 1:", "Screening 1:", "Screening 1:")}</span>{" "}
                         {aiScreeningMessages.screening1}
                       </p>
                     )}
                     {aiScreeningMessages.screening2 && (
                       <p className="text-sm font-medium text-slate-700 leading-relaxed">
                         <span className="font-black">{getText("Screening 2:", "Screening 2:", "Screening 2:")}</span>{" "}
                         {aiScreeningMessages.screening2}
                       </p>
                     )}
                   </div>
                 )}
               </CardContent>
             </Card>
          </TabsContent>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-6">
              {upcomingAppointments.map((appointment) => (
                <Card key={appointment.id} className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden group hover:translate-x-2 transition-transform rounded-[24px]">
                  <CardContent className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-8">
                       <div className="w-16 h-16 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center shadow-sm">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{appointment.date.split(' ')[0]}</span>
                          <span className="text-xl font-black text-slate-900">{appointment.date.split(' ')[1].replace(',', '')}</span>
                       </div>
                       <div>
                          <h3 className="text-lg font-black text-slate-900 tracking-tight">
                            {selectedLanguage === "EN" ? appointment.type : selectedLanguage === "SI" ? appointment.typeSi : appointment.typeTa}
                          </h3>
                          <div className="flex items-center gap-6 mt-2">
                             <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-300" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{appointment.time}</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-primary/40" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{appointment.doctor}</span>
                             </div>
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-6">
                       <div className="text-right hidden md:block">
                          <Badge className={cn(
                             "rounded-lg px-4 py-1.5 text-[9px] font-black uppercase tracking-widest",
                             appointment.status === "confirmed" ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                          )}>
                             {appointment.status}
                          </Badge>
                       </div>
                        <Button
                          size="icon"
                          className="w-12 h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                          onClick={() => setSelectedAppointment(appointment)}
                          aria-label={`View details for ${appointment.type}`}
                        >
                          <ChevronRight className="w-6 h-6" />
                       </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Insights (Tips) Tab */}
          <TabsContent value="tips" className="space-y-8 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {healthTips.map((tip) => (
                  <Card key={tip.id} className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden group hover:scale-[1.03] transition-all duration-300 rounded-[24px]">
                    <CardContent className="p-8">
                      <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                        <tip.icon className="w-8 h-8 text-primary group-hover:text-white" />
                      </div>
                      <h4 className="text-lg font-black text-slate-900 tracking-tight mb-3">
                         {selectedLanguage === "EN" ? tip.title : selectedLanguage === "SI" ? tip.titleSi : tip.titleTa}
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-bold">
                         {selectedLanguage === "EN" ? tip.description : selectedLanguage === "SI" ? tip.descriptionSi : tip.descriptionTa}
                      </p>
                    </CardContent>
                  </Card>
                ))}
             </div>

             <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden rounded-[32px]">
                <CardContent className="p-0 flex flex-col md:flex-row divide-x divide-slate-100">
                   <div className="md:w-1/3 bg-slate-900 p-12 flex flex-col justify-center items-center text-center text-white relative overflow-hidden">
                      <div className="absolute inset-0">
                         <img 
                            src="/images/baby-painting.png" 
                            alt="" 
                            className="w-full h-full object-cover opacity-30"
                         />
                         <div className="absolute inset-0 bg-slate-900/40" />
                      </div>
                      <Baby className="w-24 h-24 text-primary relative z-10 mb-6 animate-pulse" />
                      <h3 className="text-3xl font-black relative z-10 tracking-tight">Week {currentWeek}</h3>
                      <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] relative z-10 mt-2">Corn Ear Size</p>
                   </div>
                   <div className="flex-1 p-12 bg-white/40">
                      <h3 className="text-2xl font-black text-slate-900 mb-6 tracking-tight">Development This Week</h3>
                      <p className="text-slate-500 leading-relaxed mb-8 font-bold">{weeklyInsight.description}</p>
                      <div className="grid grid-cols-3 gap-6">
                         {[
                           { val: `W${currentWeek}`, label: "Current Week" },
                           { val: trimesterLabel, label: "Trimester" },
                           { val: `${remainingWeeks}`, label: "Weeks Left" },
                         ].map(stat => (
                           <div key={stat.label} className="p-6 bg-white/50 rounded-2xl border border-slate-100 text-center shadow-sm">
                              <p className="text-xl font-black text-slate-900 tracking-tight">{stat.val}</p>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
                           </div>
                         ))}
                      </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Emergency Footer */}
      <footer className="bg-white/80 backdrop-blur-md border-t border-slate-100 p-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="flex items-center gap-10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <a href="#" className="hover:text-primary transition-colors">Digital Records</a>
              <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-primary transition-colors">Support Center</a>
           </div>
        </div>
      </footer>

      <ProfileSettingsDialog
        open={showProfileSettings}
        onOpenChange={setShowProfileSettings}
        userProfile={{
          ...(storedProfile || {}),
          full_name: patientData.name,
        }}
        onProfileSaved={(profile) => {
          setStoredProfile(profile)
          setPatientData((prev) => ({
            ...prev,
            name: profile.full_name || prev.name,
          }))
        }}
      />

      <Dialog open={Boolean(selectedAppointment)} onOpenChange={(open) => !open && setSelectedAppointment(null)}>
        <DialogContent className="sm:max-w-lg rounded-3xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900">Appointment Details</DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Specialist</p>
                    <p className="text-lg font-black text-slate-900">{selectedAppointment.doctor}</p>
                  </div>
                  <Badge className={cn(
                    "rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest border-0",
                    selectedAppointment.status === "confirmed"
                      ? "bg-emerald-500 text-white"
                      : selectedAppointment.status === "pending"
                        ? "bg-amber-500 text-white"
                        : "bg-slate-200 text-slate-700"
                  )}>
                    {selectedAppointment.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</p>
                  <p className="font-bold text-slate-900 mt-1">{selectedAppointment.date}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time</p>
                  <p className="font-bold text-slate-900 mt-1">{selectedAppointment.time}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type</p>
                  <p className="font-bold text-slate-900 mt-1">{selectedAppointment.type}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Queue</p>
                  <p className="font-bold text-slate-900 mt-1">{selectedAppointment.queue_number ?? "-"}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</p>
                <p className="font-bold text-slate-900 mt-1">{selectedAppointment.location}</p>
              </div>

              {selectedAppointment.notes && (
                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</p>
                  <p className="text-sm text-slate-700 mt-2 leading-relaxed">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PatientPortal
