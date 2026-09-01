"use client"

import { getApiBaseCandidates, toApiUrl } from "@/lib/api"

import { useEffect, useMemo, useState } from "react"
import {
  Search,
  User,
  Globe,
  ChevronDown,
  Heart,
  Activity,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Baby,
  FileText,
  Clock,
  TrendingUp,
  Beaker,
  Brain,
  ChevronRight,
  Filter,
  Calendar,
  Settings,
  LogOut,
  Info,
  Zap,
  Building2,
  Stethoscope,
  MessageSquare,
  Pill,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import ProfileSettingsDialog from "./profile-settings-dialog"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts"

type Language = "EN" | "SI" | "TA"

interface ClinicalDashboardProps {
  onLogout: () => void
}

interface BackendPatient {
  id: string
  full_name: string
  age?: number | null
  date_of_birth?: string | null
}

interface BackendStage1History {
  screening_id: string
  patient_id: string
  patient_name?: string | null
  collected_at?: string | null
  gestational_age_weeks?: number | null
  systolic?: number | null
  diastolic?: number | null
  heart_rate?: number | null
  temperature?: number | null
  blood_sugar?: number | null
  edge_risk_score?: number | null
  risk_label?: string | null
  edge_risk_classification?: string | null
  reviewed_at?: string | null
}

interface EscalatedPatient {
  id: string
  screeningId: string
  appointmentId?: string | null
  name: string
  age: number
  gestationalWeek: number | null
  escalatedFrom: string
  escalatedTime: string
  riskScore: number
  riskLevel: "high"
  primaryRisk: string
  status: "pending" | "completed"
  collectedAt: string | null
  vitals: {
    systolic: number | null
    diastolic: number | null
    heartRate: number | null
    temperature: number | null
    bloodSugar: number | null
  }
}

interface DifferentialRequest {
  patient_id: string
  stage1_screening_id?: string | null
  gestational_age_weeks?: number | null
  age: number
  bmi: number
  systolic_bp: number
  diastolic_bp: number
  heart_rate: number
  blood_sugar: number
  temperature: number
  sflt1_plgf_ratio: number
  serum_creatinine: number
  platelet_count: number
  hba1c: number
  ogtt_1hr: number
  ogtt_2hr: number
  pregnancies_count: number
  cervical_length_mm: number
  ffn_result: boolean
  mean_pulse_pressure: number
}

interface DifferentialConditionResult {
  risk_level: string
  probability: number
}

interface ExplainabilityFeature {
  feature: string
  importance: number
  contribution: number
  direction: "increase" | "decrease" | "neutral"
  value: string
  status: string
  clinical_hint: string
}

interface DifferentialResponse {
  stage2_diagnostic_id?: string | null
  preeclampsia: DifferentialConditionResult
  gdm: DifferentialConditionResult
  preterm_birth: DifferentialConditionResult
  primary_risk: string
  explainability_model: string
  explainability: ExplainabilityFeature[]
}

interface ReportGenerationResponse {
  id: string
  patient_id: string
  report_type: string
  report_title: string
  generated_at: string
  download_url: string
}

interface PrescriptionItem {
  id: string
  patient_id: string
  specialist_id?: string | null
  stage2_diagnostic_id?: string | null
  medication_name: string
  dosage?: string | null
  frequency?: string | null
  route?: string | null
  instructions?: string | null
  start_date?: string | null
  end_date?: string | null
  is_active: boolean
  created_at?: string | null
}

interface PrescriptionFormState {
  medication_name: string
  dosage: string
  frequency: string
  route: string
  instructions: string
  start_date: string
  end_date: string
  is_active: boolean
}

const languages = [
  { code: "EN", label: "English" },
  { code: "SI", label: "Sinhala" },
  { code: "TA", label: "Tamil" },
]

export default function ClinicalDashboard({ onLogout }: ClinicalDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("EN")
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [escalatedPatients, setEscalatedPatients] = useState<EscalatedPatient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<EscalatedPatient | null>(null)
  const [isLoadingCases, setIsLoadingCases] = useState(false)
  const [casesError, setCasesError] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [doctorAppointments, setDoctorAppointments] = useState<any[]>([])
  const [isLoadingDoctorSchedule, setIsLoadingDoctorSchedule] = useState(false)
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<string>("")
  const [todayAppointments, setTodayAppointments] = useState<any[]>([])
  const [isLoadingTodayAppointments, setIsLoadingTodayAppointments] = useState(false)
  const [appointmentStatusError, setAppointmentStatusError] = useState<string | null>(null)
  const [sidebarViewMode, setSidebarViewMode] = useState<"escalated" | "today">("escalated")
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string | null>(null)

  useEffect(() => {
    const profile = localStorage.getItem('bloomcare_user_profile')
    if (profile) {
      setUserProfile(JSON.parse(profile))
    }
  }, [])

  useEffect(() => {
    if (activeTab === "schedule") {
      loadDoctorAppointments()
    }
  }, [activeTab, appointmentStatusFilter])

  useEffect(() => {
    // Load today's appointments on component mount
    loadTodayAppointments()
    // Reload escalated cases
    if (escalatedPatients.length === 0) {
      loadEscalatedCases()
    }
  }, [])

  const loadDoctorAppointments = async () => {
    setIsLoadingDoctorSchedule(true)
    try {
      const statusParam = appointmentStatusFilter
        ? `?appointment_status=${encodeURIComponent(appointmentStatusFilter)}`
        : ""
      // Don't pass specialist_id - let backend use current_user.role to determine filtering
      const response = await apiRequest(`/appointments${statusParam}`)
      if (response.ok) {
        const data = await response.json()
        setDoctorAppointments(Array.isArray(data) ? data.sort((a: any, b: any) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()) : [])
      } else {
        setDoctorAppointments([])
      }
    } catch (error) {
      console.error("Failed to load doctor appointments:", error)
      setDoctorAppointments([])
    } finally {
      setIsLoadingDoctorSchedule(false)
    }
  }

  const loadTodayAppointments = async () => {
    setIsLoadingTodayAppointments(true)
    try {
      // Query without status filter to get all appointments, then filter locally
      const response = await apiRequest(`/appointments`)
      if (response.ok) {
        const data = await response.json()
        // Filter to only today's appointments that are PENDING or CONFIRMED
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const todayApts = Array.isArray(data) ? data.filter((apt: any) => {
          const aptDate = new Date(apt.appointment_date)
          aptDate.setHours(0, 0, 0, 0)
          const isPendingOrConfirmed = apt.status === "PENDING" || apt.status === "SCHEDULED" || apt.status === "CONFIRMED"
          return aptDate.getTime() === today.getTime() && isPendingOrConfirmed
        }).sort((a: any, b: any) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()) : []

        setTodayAppointments(todayApts)
      }
    } catch (error) {
      console.error("Failed to load today's appointments:", error)
    } finally {
      setIsLoadingTodayAppointments(false)
    }
  }

  const updateAppointmentStatus = async (appointmentId: string, newStatus: string) => {
    setAppointmentStatusError(null)
    try {
      const response = await apiRequest(`/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        const updated = await response.json().catch(() => null)
        if (updated?.id) {
          setDoctorAppointments((current) =>
            current.map((apt) => (apt.id === updated.id ? { ...apt, ...updated } : apt)),
          )
          setTodayAppointments((current) =>
            current.map((apt) => (apt.id === updated.id ? { ...apt, ...updated } : apt)),
          )
        }
        await loadDoctorAppointments()
        await loadTodayAppointments()
        return
      }

      const body = await response.json().catch(() => ({}))
      const detail = typeof body.detail === "string" ? body.detail : `Failed to update status (${response.status})`
      setAppointmentStatusError(detail)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update appointment status"
      setAppointmentStatusError(message)
    }
  }

  const [specialistInput, setSpecialistInput] = useState<DifferentialRequest>({
    patient_id: "",
    stage1_screening_id: null,
    gestational_age_weeks: null,
    age: 28,
    bmi: 24,
    systolic_bp: 120,
    diastolic_bp: 80,
    heart_rate: 78,
    blood_sugar: 95,
    temperature: 36.8,
    sflt1_plgf_ratio: 30,
    serum_creatinine: 0.8,
    platelet_count: 180,
    hba1c: 5.4,
    ogtt_1hr: 130,
    ogtt_2hr: 120,
    pregnancies_count: 1,
    cervical_length_mm: 30,
    ffn_result: false,
    mean_pulse_pressure: 40,
  })
  const [differentialResult, setDifferentialResult] = useState<DifferentialResponse | null>(null)
  const [isEvaluatingDifferential, setIsEvaluatingDifferential] = useState(false)
  const [differentialError, setDifferentialError] = useState<string | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [overviewActionMessage, setOverviewActionMessage] = useState<string | null>(null)
  const [patientTimeline, setPatientTimeline] = useState<Array<{
    stage2_diagnostic_id: string
    evaluated_at: string | null
    model_used?: string | null
    primary_disease_checked?: string | null
    overall_severity_score?: number | null
    specialist_id?: string | null
    stage1_screening_id?: string | null
    condition_probabilities?: Record<string, unknown>
  }>>([])
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([])
  const [isLoadingPrescriptions, setIsLoadingPrescriptions] = useState(false)
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null)
  const [isSavingPrescription, setIsSavingPrescription] = useState(false)
  const [prescriptionActionMessage, setPrescriptionActionMessage] = useState<string | null>(null)
  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionFormState>({
    medication_name: "",
    dosage: "",
    frequency: "",
    route: "",
    instructions: "",
    start_date: "",
    end_date: "",
    is_active: true,
  })

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
    let lastNotFoundResponse: Response | null = null

    for (const base of candidates) {
      try {
        const requestInit: RequestInit = {
          ...init,
          headers,
        }
        const method = String(init?.method || "GET").toUpperCase()
        if (method === "GET" || method === "HEAD") {
          requestInit.cache = "no-store"
        }
        const response = await fetch(toApiUrl(path, base), requestInit)
        if (response.status === 404) {
          lastNotFoundResponse = response
          continue
        }
        return response
      } catch (error) {
        lastError = error
      }
    }

    if (lastNotFoundResponse) {
      return lastNotFoundResponse
    }

    if (lastError instanceof Error) {
      throw new Error(`Unable to reach backend API. ${lastError.message}`)
    }
    throw new Error("Unable to reach backend API.")
  }

  const parseDateToAge = (dateOfBirth?: string | null): number => {
    if (!dateOfBirth) return 0
    const birthDate = new Date(dateOfBirth)
    if (Number.isNaN(birthDate.getTime())) return 0
    const now = new Date()
    let years = now.getFullYear() - birthDate.getFullYear()
    if (
      now.getMonth() < birthDate.getMonth() ||
      (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate())
    ) {
      years -= 1
    }
    return Math.max(0, years)
  }

  const relativeTime = (iso?: string | null): string => {
    if (!iso) return "--"
    const ts = new Date(iso).getTime()
    if (Number.isNaN(ts)) return "--"
    const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000))
    if (diffMin < 1) return "just now"
    if (diffMin < 60) return `${diffMin} min ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH} hour${diffH > 1 ? "s" : ""} ago`
    const diffD = Math.floor(diffH / 24)
    return `${diffD} day${diffD > 1 ? "s" : ""} ago`
  }

  const loadEscalatedCases = async () => {
    setIsLoadingCases(true)
    setCasesError(null)
    try {
      const [historyRes, patientsRes] = await Promise.all([
        apiRequest("/triage/history?limit=500"),
        apiRequest("/patients/?limit=500"),
      ])

      if (!historyRes.ok) {
        throw new Error("Unable to load escalated triage history")
      }
      if (!patientsRes.ok) {
        throw new Error("Unable to load patients")
      }

      const historyRows = (await historyRes.json()) as BackendStage1History[]
      const patientRows = (await patientsRes.json()) as BackendPatient[]
      const patientsById = new Map(patientRows.map((patient) => [patient.id, patient]))

      const highRiskRows = historyRows.filter((row) => {
        const score = typeof row.edge_risk_score === "number" ? row.edge_risk_score : 0
        return String(row.risk_label || "").toLowerCase() === "high" || score >= 0.75
      })

      const latestByPatient = new Map<string, BackendStage1History>()
      for (const row of highRiskRows) {
        const existing = latestByPatient.get(row.patient_id)
        if (!existing) {
          latestByPatient.set(row.patient_id, row)
          continue
        }
        const existingTs = existing.collected_at ? new Date(existing.collected_at).getTime() : 0
        const currentTs = row.collected_at ? new Date(row.collected_at).getTime() : 0
        if (currentTs >= existingTs) {
          latestByPatient.set(row.patient_id, row)
        }
      }

      const mappedCases: EscalatedPatient[] = Array.from(latestByPatient.values()).map((row) => {
        const patient = patientsById.get(row.patient_id)
        return {
          id: row.patient_id,
          screeningId: row.screening_id,
          appointmentId: null,
          name: row.patient_name || patient?.full_name || "Unknown Patient",
          age: patient?.age ?? parseDateToAge(patient?.date_of_birth) ?? 0,
          gestationalWeek: row.gestational_age_weeks ?? null,
          escalatedFrom: "Frontline Triage",
          escalatedTime: relativeTime(row.collected_at),
          riskScore: typeof row.edge_risk_score === "number" ? row.edge_risk_score : 0,
          riskLevel: "high",
          primaryRisk: "High Risk",
          status: row.reviewed_at ? "completed" : "pending",
          collectedAt: row.collected_at || null,
          vitals: {
            systolic: row.systolic ?? null,
            diastolic: row.diastolic ?? null,
            heartRate: row.heart_rate ?? null,
            temperature: row.temperature ?? null,
            bloodSugar: row.blood_sugar ?? null,
          },
        }
      })

      setEscalatedPatients(mappedCases)
      setSelectedPatient((current) => {
        if (current) {
          const stillPresent = mappedCases.find((entry) => entry.id === current.id)
          if (stillPresent) return stillPresent
        }
        return mappedCases[0] ?? null
      })
    } catch (error) {
      setCasesError(error instanceof Error ? error.message : "Unable to load escalated cases")
      setEscalatedPatients([])
      setSelectedPatient(null)
    } finally {
      setIsLoadingCases(false)
    }
  }

  useEffect(() => {
    loadEscalatedCases().catch(() => {
      // handled by state setters in loadEscalatedCases
    })
  }, [])

  useEffect(() => {
    const loadPatientTimeline = async () => {
      if (!selectedPatient?.id) {
        setPatientTimeline([])
        setTimelineError(null)
        return
      }

      try {
        setTimelineError(null)
        const response = await apiRequest(`/patients/${selectedPatient.id}/history`)
        if (!response.ok) {
          throw new Error("Unable to load patient timeline")
        }
        const payload = (await response.json()) as {
          diagnostics?: Array<{
            stage2_diagnostic_id: string
            evaluated_at: string
            model_used?: string | null
            primary_disease_checked?: string | null
            overall_severity_score?: number | null
            specialist_id?: string | null
            stage1_screening_id?: string | null
            condition_probabilities?: Record<string, unknown>
          }>
        }
        setPatientTimeline(payload.diagnostics ?? [])
      } catch (error) {
        setTimelineError(error instanceof Error ? error.message : "Unable to load patient timeline")
        setPatientTimeline([])
      }
    }

    loadPatientTimeline().catch(() => {
      // errors are handled in state above
    })
  }, [selectedPatient?.id])

  const loadPatientPrescriptions = async (patientId: string) => {
    setIsLoadingPrescriptions(true)
    setPrescriptionError(null)
    try {
      const response = await apiRequest(`/prescriptions/patient/${patientId}`)
      if (!response.ok) {
        throw new Error("Unable to load prescriptions")
      }
      const payload = (await response.json()) as PrescriptionItem[]
      setPrescriptions(payload)
    } catch (error) {
      setPrescriptionError(error instanceof Error ? error.message : "Unable to load prescriptions")
      setPrescriptions([])
    } finally {
      setIsLoadingPrescriptions(false)
    }
  }

  useEffect(() => {
    if (!selectedPatient?.id) {
      setPrescriptions([])
      setPrescriptionError(null)
      return
    }

    loadPatientPrescriptions(selectedPatient.id).catch(() => {
      // errors are handled in state above
    })
  }, [selectedPatient?.id])

  const filteredPatients = escalatedPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredTodayAppointments = useMemo(() => {
    let filtered = todayAppointments

    // Filter by doctor name if selected
    if (selectedDoctorFilter) {
      filtered = filtered.filter(
        (apt: any) => apt.specialist_name?.toLowerCase().includes(selectedDoctorFilter.toLowerCase())
      )
    }

    // Filter by search query (patient name or NIC)
    if (searchQuery) {
      filtered = filtered.filter(
        (apt: any) =>
          apt.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          apt.patient_id?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }, [todayAppointments, searchQuery, selectedDoctorFilter])

  const uniqueDoctorsInToday = useMemo(() => {
    const doctors = new Map<string, any>()
    todayAppointments.forEach((apt: any) => {
      if (apt.specialist_id && apt.specialist_name) {
        doctors.set(apt.specialist_id, {
          id: apt.specialist_id,
          name: apt.specialist_name,
        })
      }
    })
    return Array.from(doctors.values())
  }, [todayAppointments])

  const activePatient = selectedPatient

  const pendingReviewCount = useMemo(
    () => escalatedPatients.filter((patient) => patient.status === "pending").length,
    [escalatedPatients],
  )

  const featureImportanceData = useMemo(() => {
    if (!differentialResult?.explainability) return [] as ExplainabilityFeature[]
    return differentialResult.explainability
  }, [differentialResult])

  const explainabilityDomainMax = useMemo(() => {
    const maxWeight = featureImportanceData.reduce((currentMax, item) => Math.max(currentMax, item.importance), 0)
    if (maxWeight <= 0) {
      return 0.1
    }
    return Math.max(0.1, maxWeight * 1.1)
  }, [featureImportanceData])

  const topClinicalHint = featureImportanceData[0]?.clinical_hint ?? ""

  const explainabilityByFeature = useMemo(() => {
    const map = new Map<string, ExplainabilityFeature>()
    featureImportanceData.forEach((item) => {
      map.set(item.feature.toLowerCase(), item)
    })
    return map
  }, [featureImportanceData])

  const biomarkerRows = useMemo(() => {
    const rows = [
      {
        name: "Systolic BP",
        value: `${specialistInput.systolic_bp.toFixed(0)} mmHg`,
        range: "90-139",
        status: specialistInput.systolic_bp >= 140 ? "high" : "normal",
      },
      {
        name: "Diastolic BP",
        value: `${specialistInput.diastolic_bp.toFixed(0)} mmHg`,
        range: "60-89",
        status: specialistInput.diastolic_bp >= 90 ? "high" : "normal",
      },
      {
        name: "Heart Rate",
        value: `${specialistInput.heart_rate.toFixed(0)} bpm`,
        range: "60-100",
        status: specialistInput.heart_rate > 100 ? "high" : "normal",
      },
      {
        name: "Temperature",
        value: `${specialistInput.temperature.toFixed(1)} C`,
        range: "36.1-37.2",
        status: specialistInput.temperature >= 38 ? "high" : "normal",
      },
      {
        name: "Blood Sugar",
        value: `${specialistInput.blood_sugar.toFixed(1)} mg/dL`,
        range: "70-139",
        status: specialistInput.blood_sugar >= 140 ? "high" : "normal",
      },
      {
        name: "sFlt-1/PlGF Ratio",
        value: specialistInput.sflt1_plgf_ratio.toFixed(2),
        range: "< 38",
        status: specialistInput.sflt1_plgf_ratio >= 38 ? "high" : "normal",
      },
      {
        name: "Serum Creatinine",
        value: `${specialistInput.serum_creatinine.toFixed(2)} mg/dL`,
        range: "0.5-1.1",
        status: specialistInput.serum_creatinine > 1.1 ? "high" : "normal",
      },
      {
        name: "Platelet Count",
        value: `${specialistInput.platelet_count.toFixed(0)} x10^9/L`,
        range: "150-450",
        status: specialistInput.platelet_count < 150 ? "low" : "normal",
      },
      {
        name: "HbA1c",
        value: `${specialistInput.hba1c.toFixed(1)}%`,
        range: "< 5.7",
        status: specialistInput.hba1c >= 6.5 ? "high" : specialistInput.hba1c >= 5.7 ? "elevated" : "normal",
      },
      {
        name: "OGTT 1hr",
        value: `${specialistInput.ogtt_1hr.toFixed(0)} mg/dL`,
        range: "< 180",
        status: specialistInput.ogtt_1hr >= 180 ? "high" : "normal",
      },
      {
        name: "OGTT 2hr",
        value: `${specialistInput.ogtt_2hr.toFixed(0)} mg/dL`,
        range: "< 153",
        status: specialistInput.ogtt_2hr >= 153 ? "high" : "normal",
      },
      {
        name: "Cervical Length",
        value: `${specialistInput.cervical_length_mm.toFixed(1)} mm`,
        range: "> 25",
        status: specialistInput.cervical_length_mm <= 25 ? "low" : "normal",
      },
      {
        name: "fFN Result",
        value: specialistInput.ffn_result ? "Positive" : "Negative",
        range: "Negative",
        status: specialistInput.ffn_result ? "high" : "normal",
      },
      {
        name: "Mean Pulse Pressure",
        value: `${specialistInput.mean_pulse_pressure.toFixed(0)} mmHg`,
        range: "30-50",
        status: specialistInput.mean_pulse_pressure > 50 ? "high" : "normal",
      },
    ]

    return rows.map((row) => {
      const explainability = explainabilityByFeature.get(row.name.toLowerCase())
      return {
        ...row,
        direction: explainability?.direction ?? "neutral",
        impact: explainability?.importance ?? null,
        clinicalHint: explainability?.clinical_hint ?? null,
      }
    })
  }, [specialistInput, explainabilityByFeature])

  const peProbability = differentialResult?.preeclampsia.probability ?? 0
  const gdmProbability = differentialResult?.gdm.probability ?? 0
  const pretermProbability = differentialResult?.preterm_birth.probability ?? 0
  const primaryRiskKey = differentialResult?.primary_risk ?? ""
  const primaryRiskLabel = primaryRiskKey === "preeclampsia"
    ? "Preeclampsia"
    : primaryRiskKey === "gdm"
      ? "GDM"
      : primaryRiskKey === "preterm_birth"
        ? "Preterm Birth"
        : "Not Evaluated"
  const differentialConfidence = Math.max(peProbability, gdmProbability, pretermProbability)

  const aiRecommendationText = primaryRiskKey === "preeclampsia"
    ? "Differential diagnosis indicates preeclampsia as primary risk. Prioritize BP/proteinuria monitoring, repeat PE biomarkers in 48-72 hours, and consider specialist escalation based on trend."
    : primaryRiskKey === "gdm"
      ? "Differential diagnosis indicates GDM as primary risk. Prioritize glycemic profiling, confirm OGTT pattern, and initiate diet-plus-monitoring plan with diabetes follow-up."
      : primaryRiskKey === "preterm_birth"
        ? "Differential diagnosis indicates preterm birth risk as primary. Prioritize cervical surveillance, evaluate fFN trend, and initiate preterm prevention protocol as clinically indicated."
        : "Run Differential tab evaluation to generate AI-driven condition comparison and specialist recommendation."

  const normalizeApiPath = (pathOrUrl: string): string => {
    try {
      const parsed = new URL(pathOrUrl)
      return normalizeApiPath(parsed.pathname)
    } catch {
      if (pathOrUrl.startsWith("/api/v1/")) return pathOrUrl.replace("/api/v1", "")
      if (pathOrUrl.startsWith("/")) return pathOrUrl
      return `/${pathOrUrl}`
    }
  }

  const handleGenerateReport = async () => {
    if (!activePatient?.id) {
      setOverviewActionMessage("Select a patient before generating a report")
      return
    }

    const stage2DiagnosticId =
      differentialResult?.stage2_diagnostic_id || patientTimeline.find((entry) => entry.stage2_diagnostic_id)?.stage2_diagnostic_id

    if (!stage2DiagnosticId) {
      setOverviewActionMessage("Run Differential first to generate a Stage 2 report")
      return
    }

    setIsGeneratingReport(true)
    setOverviewActionMessage(null)

    try {
      const createResponse = await apiRequest(`/reports/stage2?stage2_diagnostic_id=${encodeURIComponent(stage2DiagnosticId)}`, {
        method: "POST",
      })

      if (!createResponse.ok) {
        const detail = (await createResponse.json().catch(() => ({}))) as { detail?: string }
        throw new Error(detail.detail || "Unable to generate report")
      }

      const createdReport = (await createResponse.json()) as ReportGenerationResponse
      const downloadPath = normalizeApiPath(createdReport.download_url)

      const downloadResponse = await apiRequest(downloadPath)
      if (!downloadResponse.ok) {
        throw new Error("Report created, but download failed")
      }

      const blob = await downloadResponse.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `${activePatient.name.replace(/\s+/g, "_")}_stage2_report.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)

      setOverviewActionMessage("Report generated and downloaded")
    } catch (error) {
      setOverviewActionMessage(error instanceof Error ? error.message : "Unable to generate report")
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleMarkAsReviewed = async () => {
    if (!activePatient?.id) {
      setOverviewActionMessage("Select a patient first")
      return
    }

    setOverviewActionMessage("Saving review...")

    const readDetail = async (response: Response, fallback: string) => {
      const body = await response.json().catch(() => ({} as { detail?: unknown }))
      return typeof body.detail === "string" ? body.detail : fallback
    }

    try {
      const isRealScreening = Boolean(
        activePatient.screeningId && activePatient.escalatedFrom !== "Appointment",
      )
      const reviewPayload = JSON.stringify({
        patient_id: activePatient.id,
        screening_id: isRealScreening ? activePatient.screeningId : null,
      })
      const reviewResponse = await apiRequest("/triage/history", {
        method: "POST",
        body: reviewPayload,
      })

      let saved = reviewResponse.ok
      let lastReviewError = saved
        ? ""
        : await readDetail(reviewResponse, `Unable to save review (${reviewResponse.status})`)

      if (!saved && (reviewResponse.status === 404 || reviewResponse.status === 405)) {
        const fallbackResponse = await apiRequest("/review-screening", {
          method: "POST",
          body: reviewPayload,
        })
        if (fallbackResponse.ok) {
          saved = true
          lastReviewError = ""
        } else {
          lastReviewError = await readDetail(
            fallbackResponse,
            lastReviewError || `Unable to save review (${fallbackResponse.status})`,
          )
        }
      }

      const appointmentIds = new Set<string>()
      if (activePatient.appointmentId) {
        appointmentIds.add(activePatient.appointmentId)
      }

      const appointmentsResponse = await apiRequest("/appointments").catch(() => null)
      if (appointmentsResponse?.ok) {
        const appointments = await appointmentsResponse.json().catch(() => [])
        if (Array.isArray(appointments)) {
          for (const apt of appointments) {
            const samePatient = String(apt.patient_id) === String(activePatient.id)
            const openStatus = ["PENDING", "SCHEDULED", "CONFIRMED"].includes(String(apt.status || "").toUpperCase())
            if (samePatient && openStatus && apt.id) {
              appointmentIds.add(String(apt.id))
            }
          }
        }
      }

      await Promise.all(
        Array.from(appointmentIds).map((appointmentId) =>
          apiRequest(`/appointments/${appointmentId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: "COMPLETED" }),
          }).catch(() => null),
        ),
      )

      if (!saved) {
        throw new Error(lastReviewError || "Unable to save review")
      }

      setEscalatedPatients((current) =>
        current.map((patient) =>
          patient.id === activePatient.id
            ? { ...patient, status: "completed" }
            : patient,
        ),
      )
      setSelectedPatient((current) => (current ? { ...current, status: "completed" } : current))
      setOverviewActionMessage("Case marked as Reviewed")
      await loadEscalatedCases()
      await loadDoctorAppointments()
      await loadTodayAppointments()
    } catch (error) {
      setOverviewActionMessage(error instanceof Error ? error.message : "Unable to mark case as reviewed")
    }
  }

  const handleEvaluateDifferential = async () => {
    if (!activePatient?.id) {
      setDifferentialError("Select a patient before running differential diagnosis")
      return
    }

    setIsEvaluatingDifferential(true)
    setDifferentialError(null)

    try {
      const payloadWithContext: DifferentialRequest = {
        ...specialistInput,
        patient_id: activePatient.id,
        stage1_screening_id: activePatient.screeningId,
        gestational_age_weeks: activePatient.gestationalWeek,
      }

      const response = await apiRequest("/evaluate-differential", {
        method: "POST",
        body: JSON.stringify(payloadWithContext),
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({} as unknown)) as {
          detail?: string | Array<{ loc?: Array<string | number>; msg?: string }>
        }
        const validationMessage = Array.isArray(detail?.detail)
          ? detail.detail
            .map((item) => `${item?.loc ? item.loc.join(".") : "payload"}: ${item?.msg || "validation error"}`)
            .join("; ")
          : detail?.detail
        throw new Error(validationMessage || "Unable to evaluate differential diagnosis")
      }

      const payload = (await response.json()) as DifferentialResponse
      setDifferentialResult(payload)
      const timelineResponse = await apiRequest(`/patients/${activePatient.id}/history`)
      if (timelineResponse.ok) {
        const timelinePayload = (await timelineResponse.json()) as {
          diagnostics?: Array<{
            stage2_diagnostic_id: string
            evaluated_at: string
            model_used?: string | null
            primary_disease_checked?: string | null
            overall_severity_score?: number | null
            specialist_id?: string | null
            stage1_screening_id?: string | null
            condition_probabilities?: Record<string, unknown>
          }>
        }
        setPatientTimeline(timelinePayload.diagnostics ?? [])
      }
    } catch (error) {
      setDifferentialError(error instanceof Error ? error.message : "Unable to evaluate differential diagnosis")
      setDifferentialResult(null)
    } finally {
      setIsEvaluatingDifferential(false)
    }
  }

  const handleCreatePrescription = async () => {
    if (!activePatient?.id) {
      setPrescriptionActionMessage("Select a patient first")
      return
    }

    if (!prescriptionForm.medication_name.trim()) {
      setPrescriptionActionMessage("Medication name is required")
      return
    }

    setIsSavingPrescription(true)
    setPrescriptionActionMessage(null)

    const latestDiagnosticId =
      differentialResult?.stage2_diagnostic_id ||
      patientTimeline.find((entry) => entry.stage2_diagnostic_id)?.stage2_diagnostic_id ||
      null

    try {
      const response = await apiRequest("/prescriptions/", {
        method: "POST",
        body: JSON.stringify({
          patient_id: activePatient.id,
          stage2_diagnostic_id: latestDiagnosticId,
          medication_name: prescriptionForm.medication_name.trim(),
          dosage: prescriptionForm.dosage.trim() || null,
          frequency: prescriptionForm.frequency.trim() || null,
          route: prescriptionForm.route.trim() || null,
          instructions: prescriptionForm.instructions.trim() || null,
          start_date: prescriptionForm.start_date || null,
          end_date: prescriptionForm.end_date || null,
          is_active: prescriptionForm.is_active,
        }),
      })

      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { detail?: string }
        throw new Error(detail.detail || "Unable to create prescription")
      }

      setPrescriptionForm({
        medication_name: "",
        dosage: "",
        frequency: "",
        route: "",
        instructions: "",
        start_date: "",
        end_date: "",
        is_active: true,
      })
      setPrescriptionActionMessage("Prescription added")
      await loadPatientPrescriptions(activePatient.id)
    } catch (error) {
      setPrescriptionActionMessage(error instanceof Error ? error.message : "Unable to create prescription")
    } finally {
      setIsSavingPrescription(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <img
          src="/images/mother-baby-painting.png"
          alt=""
          className="w-full h-full object-cover opacity-[0.03] scale-110 grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/30 to-slate-50/10" />
      </div>

      {/* Top Navigation Bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 rotate-3 group-hover:rotate-0 transition-transform duration-500 transition-all">
              <Stethoscope className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none group-hover:text-primary transition-colors">Bloom<span className="text-primary">Care</span></h1>
              <p className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">BloomCare Intelligence</p>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 mx-2" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            {getText("Clinical Intelligence", "සායනික බුද්ධිය", "மருத்துவ நுண்ணறிவு")}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Language Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <Globe className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">{selectedLanguage}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {showLanguageDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[140px]">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setSelectedLanguage(lang.code as Language)
                      setShowLanguageDropdown(false)
                    }}
                    className={cn(
                      "w-full px-4 py-2 text-left text-xs font-bold uppercase tracking-wider hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg transition-colors",
                      selectedLanguage === lang.code && "bg-primary/10 text-primary"
                    )}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 pl-4 border-l border-slate-200 hover:opacity-80 transition-opacity"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{userProfile?.full_name || "Loading..."}</p>
                <p className="text-[10px] font-bold text-primary uppercase tracking-tighter">{getText("Obstetrician", "ප්‍රසව වෛද්‍ය", "மகப்பேறு மருத்துவர்")}</p>
              </div>
              <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center shadow-md shadow-accent/20 border-2 border-white">
                <User className="w-5 h-5 text-white" />
              </div>
            </button>
            {showUserMenu && (
              <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[200px] py-2">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                  <p className="text-xs font-bold text-slate-900">{userProfile?.full_name || userProfile?.email || "N/A"}</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    setShowProfileSettings(true)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  {getText("Settings", "සැකසුම්", "அமைப்புகள்")}
                </button>
                <hr className="my-2 border-slate-100" />
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-red-600"
                >
                  <LogOut className="w-4 h-4" />
                  {getText("Sign Out", "පිටවීම", "வெளியேறு")}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Escalated Patients & Today Appointments */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-4">
              {sidebarViewMode === "escalated" ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  {getText("Escalated Cases", "උත්සන්න අවස්ථා", "அதிகரிக்கப்பட்ட வழக்குகள்")}
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 text-primary" />
                  {getText("Today's Appointments", "අද දින ප්‍රකාශන", "இன்றைய நியமனங்கள්")}
                </>
              )}            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={
                  sidebarViewMode === "escalated"
                    ? getText("Search ID or Name...", "පෙත්තම් හෝ නම...", "ID அல்லது பெயர் தேடுங்கள்...")
                    : getText("Search Patient or Doctor...", "රෝගීන් හෝ වෛද්‍ය සොයන්න...", "நோயாளி அல்லது மருத்துவர்களைத் தேடுங்கள்...")
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200 h-11 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="p-3 border-b border-slate-100">
            {/* View Mode Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setSidebarViewMode("escalated")}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                  sidebarViewMode === "escalated"
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-150"
                )}
              >
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                {getText("High Risk", "ඉහළ අවදානම", "சிக்கல்")}
              </button>
              <button
                onClick={() => {
                  setSidebarViewMode("today")
                  loadTodayAppointments()
                }}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                  sidebarViewMode === "today"
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-150"
                )}
              >
                <Calendar className="w-3 h-3 inline mr-1" />
                {getText("Today", "අද", "இன்னද")}
              </button>
            </div>

            {/* Doctor Filter for Today's Appointments */}
            {sidebarViewMode === "today" && uniqueDoctorsInToday.length > 0 && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
                  {getText("Doctor", "වෛද්‍ය", "மருத்துவர்")}
                </label>
                <select
                  value={selectedDoctorFilter || ""}
                  onChange={(e) => setSelectedDoctorFilter(e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">{getText("All Doctors", "සියලු වෛද්‍යවරුන්", "அனைத்து மருத்துவர்கள்")}</option>
                  {uniqueDoctorsInToday.map((doctor) => (
                    <option key={doctor.id} value={doctor.name}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {sidebarViewMode === "escalated" && isLoadingCases && (
              <div className="p-6 text-center text-sm font-bold text-slate-500 uppercase tracking-widest">Loading escalated cases...</div>
            )}
            {sidebarViewMode === "today" && isLoadingTodayAppointments && (
              <div className="p-6 text-center text-sm font-bold text-slate-500 uppercase tracking-widest">Loading appointments...</div>
            )}
            {sidebarViewMode === "escalated" && !isLoadingCases && casesError && (
              <div className="p-6 text-center text-sm font-bold text-red-500">{casesError}</div>
            )}
            {sidebarViewMode === "escalated" && !isLoadingCases && !casesError && filteredPatients.length === 0 && (
              <div className="p-6 text-center text-sm font-bold text-slate-500 uppercase tracking-widest">
                {getText("No high-risk cases found", "ඉහළ අවදානම් රෝගීන් හමු නොවීය", "அதிக ஆபத்து வழக்குகள் இல்லை")}
              </div>
            )}
            {sidebarViewMode === "today" && !isLoadingTodayAppointments && filteredTodayAppointments.length === 0 && (
              <div className="p-6 text-center text-sm font-bold text-slate-500 uppercase tracking-widest">
                {getText("No appointments today", "අද දින ප්‍රකාශන නොමැත", "இன்று நியமனங்கள் இல்லை")}
              </div>
            )}

            {/* Escalated Cases Display */}
            {sidebarViewMode === "escalated" && !isLoadingCases && !casesError && filteredPatients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className={cn(
                  "w-full p-4 rounded-xl mb-3 text-left transition-all relative overflow-hidden group",
                  selectedPatient?.id === patient.id
                    ? "bg-white shadow-xl shadow-slate-200/50 border-2 border-primary"
                    : "hover:bg-slate-50 border-2 border-transparent"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-slate-800">{patient.name}</p>
                    <p className="text-xs text-slate-500">{patient.id}</p>
                  </div>
                  <Badge
                    className={cn(
                      "text-[10px] font-bold h-6",
                      "bg-red-500/10 text-red-500 border-red-500/20"
                    )}
                  >
                    {patient.riskScore.toFixed(2)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider">
                  <span className={cn(
                    "px-2 py-1 rounded-md",
                    "bg-primary/10 text-primary"
                  )}>
                    {patient.primaryRisk}
                  </span>
                  <span
                    className={cn(
                      "px-2 py-1 rounded-md",
                      patient.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {patient.status === "completed"
                      ? getText("Completed", "සම්පූර්ණ", "முடிந்தது")
                      : getText("Pending", "අපේක්ෂිත", "நிலுவையில்")}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {patient.escalatedTime}
                </p>
              </button>
            ))}

            {/* Today's Appointments Display */}
            {sidebarViewMode === "today" && !isLoadingTodayAppointments && filteredTodayAppointments.map((apt: any) => (
              <button
                key={apt.id}
                onClick={() => {
                  // Create a pseudo-patient object for display
                  const pseudoPatient: EscalatedPatient = {
                    id: apt.patient_id,
                    screeningId: "",
                    appointmentId: apt.id,
                    name: apt.patient_name || "Unknown Patient",
                    age: 0,
                    gestationalWeek: null,
                    escalatedFrom: "Appointment",
                    escalatedTime: new Date(apt.appointment_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    riskScore: apt.patient_risk_score || 0,
                    riskLevel: "high",
                    primaryRisk: apt.patient_risk_level === "escalate" ? "High Risk" : "Routine Care",
                    status: apt.status.toLowerCase() as "pending" | "completed",
                    collectedAt: apt.appointment_date,
                    vitals: {
                      systolic: null,
                      diastolic: null,
                      heartRate: null,
                      temperature: null,
                      bloodSugar: null,
                    },
                  }
                  setSelectedPatient(pseudoPatient)
                }}
                className={cn(
                  "w-full p-4 rounded-xl mb-3 text-left transition-all relative overflow-hidden group",
                  selectedPatient?.appointmentId === apt.id
                    ? "bg-white shadow-xl shadow-slate-200/50 border-2 border-primary"
                    : "hover:bg-slate-50 border-2 border-transparent"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-slate-800">{apt.patient_name}</p>
                    <p className="text-xs text-slate-500">{apt.specialist_name}</p>
                  </div>
                  <Badge className={cn(
                    "text-[10px] font-bold h-6",
                    apt.patient_risk_level === "escalate"
                      ? "bg-red-500/10 text-red-500 border-red-500/20"
                      : "bg-green-500/10 text-green-500 border-green-500/20"
                  )}>
                    {apt.queue_number > 0 ? `Queue #${apt.queue_number}` : "Unassigned"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider mb-2">
                  <span className={cn(
                    "px-2 py-1 rounded-md",
                    apt.patient_risk_level === "escalate"
                      ? "bg-red-500/10 text-red-500"
                      : "bg-green-500/10 text-green-500"
                  )}>
                    {apt.patient_risk_level === "escalate" ? "🔴 High Risk" : "🟢 Routine"}
                  </span>
                  <span className={cn(
                    "px-2 py-1 rounded-md",
                    apt.status === "COMPLETED"
                      ? "bg-emerald-100 text-emerald-700"
                      : apt.status === "CANCELLED"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-600"
                  )}>
                    {apt.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {new Date(apt.appointment_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between text-sm">
              {sidebarViewMode === "escalated" ? (
                <>
                  <span className="text-slate-600">{getText("Pending Review:", "අපේක්ෂිත සමාලෝචන:", "நிலுவையில் உள்ள மதிப்பாய்வு:")}</span>
                  <span className="font-semibold text-[#F97316]">
                    {pendingReviewCount}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-slate-600">{getText("Today's Total:", "අද මුලු:", "இன்றைய மொத்தம்:")}</span>
                  <span className="font-semibold text-primary">
                    {filteredTodayAppointments.length} / {todayAppointments.length}
                  </span>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white/50 backdrop-blur-sm border border-slate-200 p-1 rounded-xl glass">
              <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg text-xs font-bold uppercase tracking-wider px-6">
                {getText("Overview", "දළ විශ්ලේෂණය", "கண்ணோட்டம்")}
              </TabsTrigger>
              <TabsTrigger value="analysis" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg text-xs font-bold uppercase tracking-wider px-6">
                {getText("AI Analysis", "AI විශ්ලේෂණය", "AI பகுப்பாய்வு")}
              </TabsTrigger>
              <TabsTrigger value="differential" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg text-xs font-bold uppercase tracking-wider px-6">
                {getText("Differential", "වෙනස් නිර්ණය", "வேறுபாட்டு கண்டறிதல்")}
              </TabsTrigger>
              <TabsTrigger value="biomarkers" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg text-xs font-bold uppercase tracking-wider px-6">
                {getText("Biomarkers", "ජෛව සලකුණු", "உயிரியல் குறிப்பான்கள்")}
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg text-xs font-bold uppercase tracking-wider px-6">
                {getText("History", "ඉතිහාසය", "வரலாறு")}
              </TabsTrigger>
              <TabsTrigger value="prescriptions" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg text-xs font-bold uppercase tracking-wider px-6">
                {getText("Prescriptions", "ප්‍රිස්ක්‍රිප්ෂන්", "மருந்துச் சீட்டுகள්")}
              </TabsTrigger>
              <TabsTrigger value="schedule" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg text-xs font-bold uppercase tracking-wider px-6">
                📅 {getText("My Schedule", "මගේ කාලසටහන", "என் அட்டவணை")}
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {!differentialResult && (
                <Card className="border border-amber-200 bg-amber-50/70 rounded-2xl shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-amber-700">
                      {getText(
                        "Differential diagnosis not run yet. Open Differential tab to compute PE, GDM, and Preterm risks.",
                        "තවම Differential diagnosis ධාවනය කර නොමැත. PE, GDM, සහ Preterm අවදානම් ගණනය කිරීමට Differential tab විවෘත කරන්න.",
                        "வேறுபாட்டு மதிப்பீடு இன்னும் இயக்கப்படவில்லை. PE, GDM, மற்றும் Preterm ஆபத்துகளை கணக்கிட Differential தாவலைத் திறக்கவும்."
                      )}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Patient Header Card */}
              <Card className="border-0 glass shadow-2xl shadow-primary/5 overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
                <CardContent className="p-8">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-6">
                      <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-white shadow-inner">
                        <User className="w-10 h-10 text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{activePatient?.name || "--"}</h2>
                          <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 uppercase font-bold text-[10px]">
                            {activePatient?.id || "--"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-6 mt-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getText("Age", "වයස", "வயது")}</span>
                            <span className="text-sm font-bold text-slate-700">{activePatient?.age ?? "--"} {getText("years", "අවුරුදු", "வயது")}</span>
                          </div>
                          <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getText("Gestational Week", "ගැබ් සතිය", "கர்ப்ப வாரம்")}</span>
                            <span className="text-sm font-bold text-slate-700">{activePatient?.gestationalWeek ?? "--"}</span>
                          </div>
                        </div>
                        <p className="text-xs font-medium text-slate-500 mt-4 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-primary" />
                          {getText("Referred from:", "යොමු කළේ:", "பரிந்துரைக்கப்பட்டது:")} <span className="text-slate-700 border-b border-dotted border-slate-300">{activePatient?.escalatedFrom || "--"}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "inline-flex flex-col items-center justify-center w-24 h-24 rounded-2xl shadow-inner",
                        activePatient?.riskLevel === "high" ? "bg-red-50 border border-red-100" : "bg-accent/5 border border-accent/10"
                      )}>
                        <div className="flex items-center gap-1 mb-1">
                          <AlertTriangle className={cn(
                            "w-4 h-4",
                            activePatient?.riskLevel === "high" ? "text-red-500" : "text-accent"
                          )} />
                          <span className={cn(
                            "text-2xl font-black",
                            activePatient?.riskLevel === "high" ? "text-red-500" : "text-accent"
                          )}>
                            {(activePatient?.riskScore ?? 0).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                          {activePatient?.riskLevel === "high"
                            ? getText("High Risk", "ඉහළ අවදානම", "அதிக ஆபத்து")
                            : getText("Moderate Risk", "මධ්‍යම අවදානම", "மிதமான ஆபத்து")}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Summary Cards */}
              <div className="grid grid-cols-3 gap-6">
                <Card className={cn(
                  "border-0 glass shadow-lg transition-all hover:-translate-y-1",
                  primaryRiskKey === "preeclampsia" && "bg-primary/[0.03] ring-1 ring-primary/20"
                )}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{getText("Preeclampsia", "ප්‍රී-එක්ලැම්ප්සියාව", "ப்ரீக்ளாம்ப்சியா")}</span>
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Heart className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-900">{(peProbability * 100).toFixed(1)}%</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">{getText("Probability", "සම්භාවිතාව", "நிகழ்தகவு")}</p>
                  </CardContent>
                </Card>

                <Card className={cn(
                  "border-0 glass shadow-lg transition-all hover:-translate-y-1",
                  primaryRiskKey === "gdm" && "bg-accent/[0.03] ring-1 ring-accent/20"
                )}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{getText("GDM", "ගැබ් දියවැඩියාව", "கர்ப்பகால நீரிழிவு")}</span>
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-accent" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-900">{(gdmProbability * 100).toFixed(1)}%</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">{getText("Probability", "සම්භාවිතාව", "நிகழ்தகவு")}</p>
                  </CardContent>
                </Card>

                <Card className={cn(
                  "border-0 glass shadow-lg transition-all hover:-translate-y-1 rounded-2xl",
                  primaryRiskKey === "preterm_birth" && "bg-highlight/[0.03] ring-1 ring-highlight/20"
                )}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">{getText("Preterm Risk", "කලින් දරු ප්‍රසූතිය", "முன்கூட்டிய பிரசவம்")}</span>
                      <div className="w-8 h-8 rounded-lg bg-highlight/10 flex items-center justify-center">
                        <Baby className="w-4 h-4 text-highlight" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-900">{(pretermProbability * 100).toFixed(1)}%</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">{getText("Probability", "සම්භාවිතාව", "நிகழ்தகவு")}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-primary/20 bg-primary/5 rounded-2xl shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                    {getText("Primary Risk", "ප්‍රධාන අවදානම", "முக்கிய ஆபத்து")}: {primaryRiskLabel}
                  </p>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport}
                  className="bg-bloom-gradient hover:opacity-90 text-white flex-1 h-14 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] border-0 font-black text-xs uppercase tracking-widest disabled:opacity-70"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {isGeneratingReport
                    ? getText("Generating...", "ජනනය වෙමින්...", "உருவாக்கப்படுகிறது...")
                    : getText("Generate Report", "වාර්තාව ජනනය කරන්න", "அறிக்கையை உருவாக்கு")}
                </Button>
                <Button
                  onClick={handleMarkAsReviewed}
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl border-slate-200 hover:bg-slate-50 font-black text-xs uppercase tracking-widest"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {getText("Mark as Reviewed", "සමාලෝචිත ලෙස සලකුණු කරන්න", "மதிப்பாய்வு செய்யப்பட்டதாக குறிக்கவும்")}
                </Button>
              </div>
              {overviewActionMessage && (
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{overviewActionMessage}</p>
              )}
            </TabsContent>

            <TabsContent value="differential" className="space-y-6">
              <Card className="border-0 glass shadow-xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500">
                    <Stethoscope className="w-5 h-5 text-primary" />
                    {getText("Specialist Input Panel", "විශේෂඥ ආදාන පැනලය", "சிறப்பு நிபுணர் உள்ளீட்டு பலகம்")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">{getText("Shared Vitals", "පොදු ජීව දත්ත", "பகிரப்பட்ட உயிர்க்குறிகள்")}</div>
                    {[
                      ["age", "Age"],
                      ["bmi", "BMI"],
                      ["systolic_bp", "Systolic BP"],
                      ["diastolic_bp", "Diastolic BP"],
                      ["heart_rate", "Heart Rate"],
                      ["blood_sugar", "Blood Sugar"],
                      ["temperature", "Temperature"],
                    ].map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                        <Input
                          type="number"
                          step="any"
                          placeholder={label}
                          value={String(specialistInput[key as keyof DifferentialRequest])}
                          onChange={(e) =>
                            setSpecialistInput((prev) => ({
                              ...prev,
                              [key]: Number.parseFloat(e.target.value || "0"),
                            }))
                          }
                          className="h-11"
                        />
                      </div>
                    ))}

                    <div className="md:col-span-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400 pt-2">{getText("PE Specific", "PE විශේෂ", "PE குறிப்பான்கள்")}</div>
                    {[
                      ["sflt1_plgf_ratio", "sFlt-1/PlGF Ratio"],
                      ["serum_creatinine", "Serum Creatinine"],
                      ["platelet_count", "Platelet Count"],
                    ].map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                        <Input
                          type="number"
                          step="any"
                          placeholder={label}
                          value={String(specialistInput[key as keyof DifferentialRequest])}
                          onChange={(e) =>
                            setSpecialistInput((prev) => ({
                              ...prev,
                              [key]: Number.parseFloat(e.target.value || "0"),
                            }))
                          }
                          className="h-11"
                        />
                      </div>
                    ))}

                    <div className="md:col-span-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400 pt-2">{getText("GDM Specific", "GDM විශේෂ", "GDM குறிப்பான்கள்")}</div>
                    {[
                      ["hba1c", "HbA1c"],
                      ["ogtt_1hr", "OGTT 1hr"],
                      ["ogtt_2hr", "OGTT 2hr"],
                      ["pregnancies_count", "No. of Pregnancies"],
                    ].map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                        <Input
                          type="number"
                          step="any"
                          placeholder={label}
                          value={String(specialistInput[key as keyof DifferentialRequest])}
                          onChange={(e) =>
                            setSpecialistInput((prev) => ({
                              ...prev,
                              [key]: Number.parseFloat(e.target.value || "0"),
                            }))
                          }
                          className="h-11"
                        />
                      </div>
                    ))}

                    <div className="md:col-span-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400 pt-2">{getText("Preterm Specific", "ප්‍රීටර්ම් විශේෂ", "முன்கூட்டிய பிரசவ குறிப்பான்கள்")}</div>
                    {[
                      ["cervical_length_mm", "Cervical Length (mm)"],
                      ["mean_pulse_pressure", "Mean Pulse Pressure"],
                    ].map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                        <Input
                          type="number"
                          step="any"
                          placeholder={label}
                          value={String(specialistInput[key as keyof DifferentialRequest])}
                          onChange={(e) =>
                            setSpecialistInput((prev) => ({
                              ...prev,
                              [key]: Number.parseFloat(e.target.value || "0"),
                            }))
                          }
                          className="h-11"
                        />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">fFN Result</p>
                      <select
                        value={specialistInput.ffn_result ? "positive" : "negative"}
                        onChange={(e) =>
                          setSpecialistInput((prev) => ({
                            ...prev,
                            ffn_result: e.target.value === "positive",
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      >
                        <option value="negative">fFN Negative</option>
                        <option value="positive">fFN Positive</option>
                      </select>
                    </div>
                  </div>

                  {differentialError && <p className="text-sm font-bold text-red-500">{differentialError}</p>}

                  <div className="flex justify-end">
                    <Button
                      onClick={handleEvaluateDifferential}
                      disabled={isEvaluatingDifferential}
                      className="bg-bloom-gradient text-white font-black uppercase tracking-widest"
                    >
                      {isEvaluatingDifferential ? "Evaluating..." : "Evaluate Differential"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {differentialResult && (
                <Card className="border-0 glass shadow-xl overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500">
                      <TrendingUp className="w-5 h-5 text-accent" />
                      {getText("Comparison Report", "සංසන්දනාත්මක වාර්තාව", "ஒப்பீட்டு அறிக்கை")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {[
                      { label: "Preeclampsia", result: differentialResult.preeclampsia },
                      { label: "GDM", result: differentialResult.gdm },
                      { label: "Preterm Birth", result: differentialResult.preterm_birth },
                    ].map((item) => (
                      <div key={item.label} className="space-y-2">
                        <div className="flex items-center justify-between text-sm font-bold">
                          <span>{item.label}</span>
                          <span>{(item.result.probability * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.max(0, Math.min(100, item.result.probability * 100))}%` }}
                          />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{item.result.risk_level}</p>
                      </div>
                    ))}

                    <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                        {getText("Primary Risk", "ප්‍රධාන අවදානම", "முக்கிய ஆபத்து")}: {differentialResult.primary_risk.replace("_", " ")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* AI Analysis Tab - Explainable AI */}
            <TabsContent value="analysis" className="space-y-6">
              <Card className="border-0 glass shadow-xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500">
                    <Brain className="w-5 h-5 text-accent" />
                    {getText("Explainable AI - Feature Importance", "විස්තරාත්මක AI - විශේෂාංග වැදගත්කම", "விளக்கக்கூடிய AI - அம்ச முக்கியத்துவம்")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 mb-8 flex items-start gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                      <Info className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">
                        {getText(
                          "This analysis shows which clinical factors contributed most to the AI's risk assessment. Higher bars indicate greater influence on the prediction.",
                          "මෙම විශ්ලේෂණය AI හි අවදානම් තක්සේරුවට වඩාත්ම දායක වූ සායනික සාධක මොනවාද යන්න පෙන්වයි.",
                          "இந்த பகுப்பாய்வு AI இன் ஆபத்து மதிப்பீட்டிற்கு எந்த மருத்துவ காரணிகள் அதிகம் பங்களித்தன என்பதைக் காட்டுகிறது."
                        )}
                      </p>
                      {differentialResult?.explainability_model && (
                        <p className="text-xs font-black text-primary uppercase tracking-widest mt-2">
                          {getText("Model", "ආකෘතිය", "மாதிரி")}: {differentialResult.explainability_model}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="h-80 mb-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={featureImportanceData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity={1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" domain={[0, explainabilityDomainMax]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold", fill: "#94a3b8" }} />
                        <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fontWeight: "bold", fill: "#64748b" }} axisLine={false} tickLine={false} width={140} />
                        <Tooltip
                          cursor={{ fill: "rgba(0,0,0,0.02)" }}
                          formatter={(value: number, _name: string, payload) => {
                            const row = payload?.payload as ExplainabilityFeature | undefined
                            const directionLabel = row?.direction === "increase" ? "Risk Increase" : row?.direction === "decrease" ? "Risk Decrease" : "Neutral"
                            return [`${(value * 100).toFixed(1)}%`, directionLabel]
                          }}
                          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", padding: "12px", fontSize: "12px", fontWeight: "bold" }}
                        />
                        <Bar dataKey="importance" radius={[0, 6, 6, 0]} barSize={24}>
                          {featureImportanceData.map((entry, index) => (
                            <Cell
                              key={`${entry.feature}-${index}`}
                              fill={entry.direction === "increase" ? "#ef4444" : entry.direction === "decrease" ? "#22c55e" : "#64748b"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {!!topClinicalHint && (
                    <div className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 mb-8">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent mb-1">
                        {getText("Clinical Correlation", "සායනික සම්බන්ධතාවය", "மருத்துவ தொடர்பு")}
                      </p>
                      <p className="text-sm font-medium text-slate-700">{topClinicalHint}</p>
                    </div>
                  )}

                  {!differentialResult && (
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                      {getText("Run Differential evaluation to generate patient-specific explainability.", "රෝගියාට විශේෂිත විස්තරාත්මක විශ්ලේෂණය සඳහා Differential පරීක්ෂණය ක්‍රියාත්මක කරන්න.", "நோயாளி சார்ந்த விளக்கத்தைக் காண Differential மதிப்பீட்டை இயக்கவும்.")}
                    </p>
                  )}

                  {/* Feature Details */}
                  <div className="grid grid-cols-2 gap-4">
                    {featureImportanceData.slice(0, 4).map((item) => (
                      <div key={item.feature} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl transition-all hover:bg-white hover:shadow-md">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-1.5 h-10 rounded-full",
                            item.status === "abnormal" && "bg-rose-500",
                            item.status === "elevated" && "bg-primary",
                            item.status === "normal" && "bg-emerald-500",
                            item.status === "risk-factor" && "bg-gold-500"
                          )} />
                          <div>
                            <p className="text-xs font-black text-slate-800 uppercase tracking-wide">{item.feature}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                              {(item.importance * 100).toFixed(1)}% {getText("Impact", "බලපෑම", "தாக்கம்")}
                              {" • "}
                              {item.direction === "increase"
                                ? getText("Risk Increase", "අවදානම වැඩිවීම", "ஆபத்து அதிகரிப்பு")
                                : item.direction === "decrease"
                                  ? getText("Risk Decrease", "අවදානම අඩුවීම", "ஆபத்து குறைவு")
                                  : getText("Neutral", "මධ්‍යස්ථ", "நடுநிலை")}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-2 max-w-xs leading-snug">{item.clinical_hint}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">{item.value}</p>
                          <Badge className={cn(
                            "text-[8px] font-black uppercase tracking-widest mt-1 border-0 h-5",
                            item.status === "abnormal" && "bg-rose-100 text-rose-700",
                            item.status === "elevated" && "bg-primary/10 text-primary",
                            item.status === "normal" && "bg-emerald-100 text-emerald-700",
                            item.status === "risk-factor" && "bg-gold-100 text-gold-700"
                          )}>
                            {item.status === "abnormal" ? getText("Abnormal", "අසාමාන්‍ය", "அசாதாரணமானது") :
                              item.status === "elevated" ? getText("Elevated", "ඉහළ", "உயர்ந்தது") :
                                item.status === "normal" ? getText("Normal", "සාමාන්‍ය", "சாதாரணமானது") :
                                  getText("Risk Factor", "අවදානම් සාධකය", "ஆபத்து காரணி")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI Recommendation Card */}
              <Card className="border-0 glass shadow-xl overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-accent" />
                <CardContent className="p-8">
                  <div className="flex items-start gap-6">
                    <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner">
                      <Zap className="w-7 h-7 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-accent mb-3">
                        {getText("AI Clinical Recommendation", "AI සායනික නිර්දේශය", "AI மருத்துவ பரிந்துரை")}
                      </h3>
                      <p className="text-slate-600 font-medium leading-relaxed mb-6">
                        {getText(
                          aiRecommendationText,
                          aiRecommendationText,
                          aiRecommendationText
                        )}
                      </p>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {getText(`Confidence: ${(differentialConfidence * 100).toFixed(1)}%`, `විශ්වාසය: ${(differentialConfidence * 100).toFixed(1)}%`, `நம்பகத்தன்மை: ${(differentialConfidence * 100).toFixed(1)}%`)}
                          </span>
                        </div>
                        <div className="h-4 w-px bg-slate-200" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {getText("Model: Differential PE/GDM/PTB", "ආදර්ශය: Differential PE/GDM/PTB", "மாதிரி: Differential PE/GDM/PTB")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Biomarkers Tab */}
            <TabsContent value="biomarkers" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <Card className="border-0 glass shadow-xl">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                      <Beaker className="w-5 h-5 text-primary" />
                      {getText("Lab Results", "රසායනාගාර ප්‍රතිඵල", "ஆய்வக முடிவுகள்")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 gap-3">
                      {biomarkerRows.map((lab) => (
                        <div key={lab.name} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl transition-all hover:bg-white hover:shadow-md">
                          <div>
                            <p className="text-xs font-black text-slate-800 uppercase tracking-wide">{lab.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{getText("Ref:", "යොමු:", "குறிப்பு:")} {lab.range}</p>
                            {lab.impact !== null && (
                              <p className="text-[10px] font-bold uppercase tracking-widest mt-1 text-slate-500">
                                {getText("Impact", "බලපෑම", "தாக்கம்")}: {(lab.impact * 100).toFixed(1)}% • {lab.direction === "increase"
                                  ? getText("Risk Increase", "අවදානම වැඩිවීම", "ஆபத்து அதிகரிப்பு")
                                  : lab.direction === "decrease"
                                    ? getText("Risk Decrease", "අවදානම අඩුවීම", "ஆபத்து குறைவு")
                                    : getText("Neutral", "මධ්‍යස්ථ", "நடுநிலை")}
                              </p>
                            )}
                            {lab.clinicalHint && (
                              <p className="text-[11px] text-slate-500 mt-2 max-w-sm leading-snug">{lab.clinicalHint}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              "text-sm font-black",
                              lab.status === "high" && "text-rose-600",
                              lab.status === "low" && "text-primary",
                              lab.status === "normal" && "text-emerald-600"
                            )}>
                              {lab.value}
                            </p>
                            {lab.impact !== null && (
                              <Badge className={cn(
                                "text-[8px] font-black uppercase tracking-widest mt-1 border-0 h-5",
                                lab.direction === "increase" && "bg-rose-100 text-rose-700",
                                lab.direction === "decrease" && "bg-emerald-100 text-emerald-700",
                                lab.direction === "neutral" && "bg-slate-100 text-slate-700"
                              )}>
                                {lab.direction === "increase"
                                  ? getText("Increase", "වැඩි", "அதிகரிப்பு")
                                  : lab.direction === "decrease"
                                    ? getText("Decrease", "අඩු", "குறைவு")
                                    : getText("Neutral", "මධ්‍යස්ථ", "நடுநிலை")}
                              </Badge>
                            )}
                            {lab.status !== "normal" && (
                              <TrendingUp className={cn(
                                "w-3 h-3 inline ml-1",
                                lab.status === "high" && "text-rose-500",
                                lab.status === "low" && "text-primary rotate-180"
                              )} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 glass shadow-xl">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                      <Activity className="w-5 h-5 text-accent" />
                      {getText("Vital Signs Trend", "ජීවිතාධාර ප්‍රවණතාව", "உயிர் அறிகுறிகள் போக்கு")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    {!!featureImportanceData.length && (
                      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {getText("Direction Overlay", "දිශා ආවරණය", "திசை மேற்படலம்")}:
                          <span className="text-rose-600 ml-1">{getText("Red = risk increase", "රතු = අවදානම වැඩි", "சிவப்பு = ஆபத்து அதிகரிப்பு")}</span>
                          <span className="text-emerald-600 ml-3">{getText("Green = risk decrease", "කොළ = අවදානම අඩු", "பச்சை = ஆபத்து குறைவு")}</span>
                        </p>
                      </div>
                    )}
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={[
                            {
                              week: "Stage 1",
                              systolic: activePatient?.vitals.systolic ?? specialistInput.systolic_bp,
                              diastolic: activePatient?.vitals.diastolic ?? specialistInput.diastolic_bp,
                            },
                            {
                              week: "Differential",
                              systolic: specialistInput.systolic_bp,
                              diastolic: specialistInput.diastolic_bp,
                            },
                          ]}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold", fill: "#94a3b8" }} />
                          <YAxis domain={[60, 160]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold", fill: "#94a3b8" }} />
                          <Tooltip
                            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", padding: "12px", fontSize: "12px", fontWeight: "bold" }}
                          />
                          <Legend wrapperStyle={{ fontSize: "10px", fontWeight: "black", textTransform: "uppercase", letterSpacing: "0.1em", paddingTop: "20px" }} />
                          <Line type="monotone" dataKey="systolic" stroke="var(--primary)" strokeWidth={3} dot={{ fill: "var(--primary)", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} name="Systolic" />
                          <Line type="monotone" dataKey="diastolic" stroke="var(--accent)" strokeWidth={3} dot={{ fill: "var(--accent)", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} name="Diastolic" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-6">
              <Card className="border-0 glass shadow-xl">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    <Clock className="w-5 h-5 text-slate-400" />
                    {getText("Patient Timeline", "රෝගී කාලරේඛාව", "நோயாளி காலவரிசை")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-10">
                  <div className="space-y-0">
                    {[
                      ...patientTimeline
                        .slice()
                        .reverse()
                        .flatMap((entry) => {
                          const probabilities = entry.condition_probabilities ?? {}
                          const peRisk = probabilities.preeclampsia as { probability?: number } | undefined
                          const gdmRisk = probabilities.gdm as { probability?: number } | undefined
                          const pretermRisk = probabilities.preterm_birth as { probability?: number } | undefined
                          const modelLabel = entry.model_used || "Differential PE/GDM/PTB"
                          const eventDate = entry.evaluated_at ? new Date(entry.evaluated_at).toLocaleString() : "--"

                          return [
                            {
                              date: eventDate,
                              event: "Preeclampsia Model Run",
                              type: "diagnostic",
                              details: `Model: ${modelLabel} | Risk: ${typeof peRisk?.probability === "number" ? `${(peRisk.probability * 100).toFixed(1)}%` : "N/A"} | Specialist: ${entry.specialist_id || "N/A"}`,
                            },
                            {
                              date: eventDate,
                              event: "GDM Model Run",
                              type: "diagnostic",
                              details: `Model: ${modelLabel} | Risk: ${typeof gdmRisk?.probability === "number" ? `${(gdmRisk.probability * 100).toFixed(1)}%` : "N/A"} | Specialist: ${entry.specialist_id || "N/A"}`,
                            },
                            {
                              date: eventDate,
                              event: "Preterm Birth Model Run",
                              type: "diagnostic",
                              details: `Model: ${modelLabel} | Risk: ${typeof pretermRisk?.probability === "number" ? `${(pretermRisk.probability * 100).toFixed(1)}%` : "N/A"} | Specialist: ${entry.specialist_id || "N/A"}`,
                            },
                          ]
                        }),
                      {
                        date: activePatient?.collectedAt ? new Date(activePatient.collectedAt).toLocaleString() : "--",
                        event: "Escalated to Stage 2",
                        type: "escalation",
                        details: `Risk score: ${(activePatient?.riskScore ?? 0).toFixed(2)}`,
                      },
                      {
                        date: activePatient?.collectedAt ? new Date(activePatient.collectedAt).toLocaleString() : "--",
                        event: "Latest Stage 1 Screening",
                        type: "screening",
                        details: `BP: ${activePatient?.vitals.systolic ?? "--"}/${activePatient?.vitals.diastolic ?? "--"}`,
                      },
                    ].map((item, index, arr) => (
                      <div key={index} className="flex gap-8 group">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-4 h-4 rounded-full border-4 border-white shadow-md z-10 transition-transform group-hover:scale-125",
                            item.type === "escalation" && "bg-primary shadow-primary/30",
                            item.type === "diagnostic" && "bg-rose-500 shadow-rose-500/30",
                            item.type === "screening" && "bg-accent shadow-accent/30",
                            item.type === "routine" && "bg-emerald-500 shadow-emerald/30",
                            item.type === "registration" && "bg-slate-400 shadow-slate/30"
                          )} />
                          {index < arr.length - 1 && <div className="w-1 h-full bg-slate-100 -mt-1 group-hover:bg-slate-200 transition-colors" />}
                        </div>
                        <div className="flex-1 pb-10">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.date}</p>
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none mb-2">{item.event}</p>
                          <p className="text-sm font-medium text-slate-500 bg-slate-50 border border-slate-100 p-3 rounded-xl inline-block mt-2">{item.details}</p>
                        </div>
                      </div>
                    ))}
                    {timelineError && (
                      <p className="text-sm font-bold text-rose-600 mt-2">{timelineError}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prescriptions" className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <Card className="xl:col-span-2 border-0 glass shadow-xl overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                      <Pill className="w-5 h-5 text-primary" />
                      {getText("Add Prescription", "ප්‍රිස්ක්‍රිප්ෂන් එකතු කරන්න", "மருந்துச் சீட்டை சேர்க்கவும்")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {!activePatient?.id ? (
                      <p className="text-sm font-medium text-slate-500">{getText("Select a patient first", "පළමුව රෝගියෙකු තෝරන්න", "முதலில் நோயாளியைத் தேர்ந்தெடுக்கவும்")}</p>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{getText("Medication Name", "ඖෂධ නාමය", "மருந்து பெயர்")}</p>
                          <Input
                            value={prescriptionForm.medication_name}
                            onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, medication_name: e.target.value }))}
                            placeholder={getText("e.g. Labetalol", "උදා: Labetalol", "உதா: Labetalol")}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{getText("Dosage", "මාත්‍රාව", "அளவு")}</p>
                            <Input
                              value={prescriptionForm.dosage}
                              onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, dosage: e.target.value }))}
                              placeholder={getText("e.g. 100 mg", "උදා: 100 mg", "உதா: 100 mg")}
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{getText("Frequency", "වාර ගණන", "அடிக்கடி")}</p>
                            <Input
                              value={prescriptionForm.frequency}
                              onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, frequency: e.target.value }))}
                              placeholder={getText("e.g. Twice daily", "උදා: දිනකට දෙවරක්", "உதா: நாளுக்கு இருமுறை")}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{getText("Route", "ලබාදෙන ආකාරය", "மருந்தளிக்கும் வழி")}</p>
                          <Input
                            value={prescriptionForm.route}
                            onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, route: e.target.value }))}
                            placeholder={getText("e.g. Oral", "උදා: Oral", "உதா: Oral")}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{getText("Start Date", "ආරම්භක දිනය", "தொடக்க தேதி")}</p>
                            <Input
                              type="date"
                              value={prescriptionForm.start_date}
                              onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, start_date: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{getText("End Date", "අවසන් දිනය", "முடிவு தேதி")}</p>
                            <Input
                              type="date"
                              value={prescriptionForm.end_date}
                              onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, end_date: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{getText("Instructions", "උපදෙස්", "வழிமுறைகள்")}</p>
                          <textarea
                            value={prescriptionForm.instructions}
                            onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, instructions: e.target.value }))}
                            rows={4}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary"
                            placeholder={getText("Additional clinical instructions...", "අමතර සායනික උපදෙස්...", "கூடுதல் மருத்துவ வழிமுறைகள்...")}
                          />
                        </div>

                        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                          <input
                            type="checkbox"
                            checked={prescriptionForm.is_active}
                            onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                            className="rounded border-slate-300"
                          />
                          {getText("Active prescription", "ක්‍රියාකාරී ප්‍රිස්ක්‍රිප්ෂන්", "செயலில் உள்ள மருந்துச் சீட்டு")}
                        </label>

                        <Button
                          onClick={handleCreatePrescription}
                          disabled={isSavingPrescription}
                          className="w-full bg-bloom-gradient text-white font-black uppercase tracking-widest"
                        >
                          {isSavingPrescription
                            ? getText("Saving...", "සුරැකෙමින්...", "சேமிக்கப்படுகிறது...")
                            : getText("Issue Prescription", "ප්‍රිස්ක්‍රිප්ෂන් නිකුත් කරන්න", "மருந்துச் சீட்டை வழங்கவும்")}
                        </Button>
                      </>
                    )}

                    {prescriptionActionMessage && (
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{prescriptionActionMessage}</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="xl:col-span-3 border-0 glass shadow-xl overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                      <FileText className="w-5 h-5 text-accent" />
                      {getText("Prescription History", "ප්‍රිස්ක්‍රිප්ෂන් ඉතිහාසය", "மருந்துச் சீட்டு வரலாறு")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {isLoadingPrescriptions ? (
                      <p className="text-sm font-medium text-slate-500">{getText("Loading prescriptions...", "ප්‍රිස්ක්‍රිප්ෂන් පූරණය වෙමින්...", "மருந்துச் சீட்டுகள் ஏற்றப்படுகின்றன...")}</p>
                    ) : prescriptionError ? (
                      <p className="text-sm font-bold text-rose-600">{prescriptionError}</p>
                    ) : prescriptions.length === 0 ? (
                      <p className="text-sm font-medium text-slate-500">{getText("No prescriptions found for this patient", "මෙම රෝගියා සඳහා ප්‍රිස්ක්‍රිප්ෂන් නොමැත", "இந்த நோயாளிக்கு மருந்துச் சீட்டுகள் இல்லை")}</p>
                    ) : (
                      <div className="space-y-3">
                        {prescriptions.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-slate-900 uppercase tracking-wide">{item.medication_name}</p>
                                <p className="text-xs font-medium text-slate-500 mt-1">
                                  {[item.dosage, item.frequency, item.route].filter(Boolean).join(" | ") || "--"}
                                </p>
                              </div>
                              <Badge className={cn(
                                "text-[10px] font-black uppercase tracking-widest border-0 h-6",
                                item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                              )}>
                                {item.is_active
                                  ? getText("Active", "ක්‍රියාකාරී", "செயலில்")
                                  : getText("Inactive", "අක්‍රිය", "செயலற்ற")}
                              </Badge>
                            </div>
                            {item.instructions && (
                              <p className="text-sm text-slate-600 mt-3 leading-relaxed">{item.instructions}</p>
                            )}
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-3">
                              {getText("Period", "කාලය", "காலம்")}: {item.start_date || "--"} {getText("to", "සිට", "முதல்")} {item.end_date || "--"}
                              {" • "}
                              {getText("Issued", "නිකුත් කළේ", "வழங்கிய தேதி")}: {item.created_at ? new Date(item.created_at).toLocaleString() : "--"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-6">
              {/* Appointment Status Filter */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-white/50 rounded-xl px-4 py-2 border border-slate-100">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={appointmentStatusFilter}
                    onChange={(e) => setAppointmentStatusFilter(e.target.value)}
                    className="text-sm font-bold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
                  >
                    <option value="">All Status</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="PENDING">Pending</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
              {appointmentStatusError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {appointmentStatusError}
                </div>
              )}

              {isLoadingDoctorSchedule ? (
                <Card className="border-0 glass shadow-2xl shadow-slate-200/50 rounded-3xl">
                  <CardContent className="p-8 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-sm font-bold text-slate-400">{getText("Loading appointments...", "පත්‍රිකා පූරණය වෙමින්...", "சந்திப்புகள் ஏற்றப்படுகிறது...")}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : doctorAppointments.length === 0 ? (
                <Card className="border-0 glass shadow-2xl shadow-slate-200/50 rounded-3xl">
                  <CardContent className="p-8 text-center">
                    <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-400">{getText("No appointments scheduled", "නිර්ධారණ නොමැත", "எந்த சந்திப்புகளும் திட்டமிடப்படவில்லை")}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {doctorAppointments.map((apt: any) => (
                    <Card key={apt.id} className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden hover:shadow-2xl transition-all rounded-2xl border-l-4" style={{ borderLeftColor: apt.patient_risk_level === 'escalate' ? '#dc2626' : '#16a34a' }}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{apt.patient_name || "Patient"}</h3>
                              {/* Patient Risk Badge */}
                              <Badge className={cn(
                                "text-xs font-black uppercase tracking-wider rounded-lg",
                                apt.patient_risk_level === 'escalate' ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                              )}>
                                {apt.patient_risk_level === 'escalate' ? '🔴 High Risk' : '🟢 Routine'}
                              </Badge>
                              {apt.patient_risk_score && (
                                <span className="text-xs font-bold text-slate-500">
                                  Score: {(apt.patient_risk_score * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-bold mb-3">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                {new Date(apt.appointment_date).toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                {new Date(apt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div>{apt.appointment_type}</div>
                            </div>
                            {apt.notes && <p className="text-xs text-slate-600 mb-3">{apt.notes}</p>}
                          </div>
                          <div className="text-right space-y-3">
                            <div>
                              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Queue #</p>
                              <p className="text-sm font-black text-slate-900">{apt.queue_number || "-"}</p>
                            </div>
                            {/* Status Update Dropdown */}
                            <div>
                              <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 block">Status</label>
                              <select
                                value={apt.status}
                                onChange={(e) => updateAppointmentStatus(apt.id, e.target.value)}
                                className={cn(
                                  "text-xs font-black uppercase tracking-wider rounded-lg px-2 py-1 border-0 cursor-pointer transition-all",
                                  apt.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                                    apt.status === "CONFIRMED" ? "bg-blue-100 text-blue-700" :
                                      apt.status === "SCHEDULED" ? "bg-emerald-100 text-emerald-700" :
                                        apt.status === "COMPLETED" ? "bg-slate-100 text-slate-700" :
                                          "bg-rose-100 text-rose-700"
                                )}
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="CONFIRMED">CONFIRMED</option>
                                <option value="SCHEDULED">SCHEDULED</option>
                                <option value="COMPLETED">COMPLETED</option>
                                <option value="CANCELLED">CANCELLED</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <ProfileSettingsDialog
        open={showProfileSettings}
        onOpenChange={setShowProfileSettings}
        userProfile={userProfile}
        onProfileSaved={(profile) => {
          setUserProfile(profile)
        }}
      />

    </div>
  )
}

