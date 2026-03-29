"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Search,
  Plus,
  User as UserIcon,
  Globe,
  ChevronDown,
  Heart,
  Thermometer,
  Activity,
  Scale,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Phone,
  Baby,
  Settings,
  LogOut,
  ChevronLeft,
  Calendar,
  Clock,
  LayoutDashboard,
  ClipboardList,
  History,
  ShieldCheck,
  Stethoscope,
  Loader2,
  Microscope,
  Droplets,
  Dna,
  Users,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Eye,
  ChevronRight,
  MoreVertical,
  MapPin,
  Printer,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// Dummy patient data
const patients = [
  { id: "P-1024", name: "Anula Wijesinghe", age: 28, status: "stable", risk: "Low", time: "10 min ago", bloodGroup: "O+", phone: "0771234567", location: "Wattala" },
  { id: "P-1025", name: "Dilrukshi Perera", age: 31, status: "critical", risk: "High", time: "25 min ago", bloodGroup: "A-", phone: "0719876543", location: "Negombo" },
  { id: "P-1026", name: "Lakmini Silva", age: 24, status: "warning", risk: "Moderate", time: "1 hour ago", bloodGroup: "B+", phone: "0754433221", location: "Colombo 07" },
  { id: "P-1027", name: "Samanthi Gunawardena", age: 33, status: "stable", risk: "Low", time: "2 hours ago", bloodGroup: "AB+", phone: "0708877665", location: "Kandy" },
  { id: "P-1028", name: "Priyanka Herath", age: 29, status: "stable", risk: "Low", time: "3 hours ago", bloodGroup: "O-", phone: "0721112223", location: "Galle" },
  { id: "P-1029", name: "Nimali Rathnayake", age: 35, status: "critical", risk: "High", time: "5 hours ago", bloodGroup: "A+", phone: "0779998887", location: "Jaffna" },
]

const recentHistory = [
  { id: "H-501", patient: "Anula Wijesinghe", date: "2024-03-27", time: "09:15 AM", risk: "Low", vitals: { bp: "110/70", hr: 72, temp: 36.6, sugar: 95 } },
  { id: "H-502", patient: "Dilrukshi Perera", date: "2024-03-27", time: "10:30 AM", risk: "High", vitals: { bp: "155/95", hr: 88, temp: 37.2, sugar: 145 } },
  { id: "H-503", patient: "Lakmini Silva", date: "2024-03-27", time: "11:45 AM", risk: "Moderate", vitals: { bp: "135/85", hr: 80, temp: 36.8, sugar: 110 } },
  { id: "H-504", patient: "Kushani Soyza", date: "2024-03-26", time: "02:20 PM", risk: "Low", vitals: { bp: "115/75", hr: 74, temp: 36.5, sugar: 92 } },
  { id: "H-505", patient: "Pavithra Gamage", date: "2024-03-26", time: "04:10 PM", risk: "High", vitals: { bp: "160/100", hr: 92, temp: 37.5, sugar: 160 } },
]

const languages: { code: "EN" | "SI" | "TA"; label: string }[] = [
  { code: "EN", label: "English" },
  { code: "SI", label: "Sinhala" },
  { code: "TA", label: "Tamil" },
]

interface FrontlineTriageDashboardProps {
  onLogout: () => void
}

// Types for API responses
interface VitalsInput {
  patient_name: string
  age: number
  systolic: number
  diastolic: number
  bmi: number
  heart_rate: number
  bs: number
  temperature: number
  hemoglobin: number
  pcos: number
  previous_complications: number
  preexisting_diabetes: number
  mental_health: number
  sleep_pattern: number
  exercise: number
  education: number
  map: number
}

interface RiskResponse {
  risk_level: string
  risk_score: number
  recommendations: string[]
  bp_status: string
  observation: string
}

interface PendingScreening {
  id: string
  createdAt: string
  vitals: VitalsInput
}

declare global {
  interface Window {
    score?: (input: number[]) => number[]
  }
}

const API_URL = process.env.NEXT_PUBLIC_STAGE1_API_URL ?? "http://127.0.0.1:8000/predict-risk"
const PENDING_QUEUE_KEY = "bloomcare_stage1_pending_queue"
const DEFAULT_IMPUTE = {
  age: 28,
  bmi: 24,
  systolic: 120,
  diastolic: 80,
  heart_rate: 78,
  bs: 95,
  temperature: 36.8,
  hemoglobin: 12,
  pcos: 0,
  previous_complications: 0,
  preexisting_diabetes: 0,
  mental_health: 3,
  sleep_pattern: 7,
  exercise: 3,
  education: 4,
}

export default function FrontlineTriageDashboard({ onLogout }: FrontlineTriageDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState(patients[1])
  const [selectedLanguage, setSelectedLanguage] = useState<"EN" | "SI" | "TA">("EN")
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [riskData, setRiskData] = useState<RiskResponse | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"triage" | "registry" | "history">("triage")
  const [historyFilter, setHistoryFilter] = useState("all")
  const [selectedReport, setSelectedReport] = useState<any>(null)

  const getText = (en: string, si: string, ta: string) => {
    if (selectedLanguage === "SI") return si
    if (selectedLanguage === "TA") return ta
    return en
  }
  // Form state
  const [formData, setFormData] = useState({
    patientName: "Nimalka Fernando",
    age: "28",
    systolic: "120",
    diastolic: "80",
    bmi: "24.5",
    heartRate: "78",
    bs: "95",
    temperature: "36.8",
    hemoglobin: "12",
    pcos: "0",
    previousComplications: "0",
    preexistingDiabetes: "0",
    mentalHealth: "3",
    sleepPattern: "7",
    exercise: "3",
    education: "4",
    // Stage 2 Fields (Conditional)
    sfltRatio: "",
    serumCreatinine: "",
    plateletCount: "",
    serumTriglycerides: "",
    tsh: "",
    pcv: "",
    seng: "",
    cystatinC: "",
    pp13: "",
    doppler: "",
    gestationalAge: "",
    famHtn: "",
    htn: "",
    occupation: "",
    diet: "",
  })
  const [showStage2Form, setShowStage2Form] = useState(false)

  const computedMap = useMemo(() => {
    const systolic = Number.parseFloat(formData.systolic)
    const diastolic = Number.parseFloat(formData.diastolic)
    if (Number.isNaN(systolic) || Number.isNaN(diastolic)) {
      return null
    }
    return (systolic + 2 * diastolic) / 3
  }, [formData.systolic, formData.diastolic])

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const readPendingQueue = (): PendingScreening[] => {
    if (typeof window === "undefined") {
      return []
    }
    const raw = window.localStorage.getItem(PENDING_QUEUE_KEY)
    if (!raw) {
      return []
    }
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const writePendingQueue = (queue: PendingScreening[]) => {
    if (typeof window === "undefined") {
      return
    }
    window.localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue))
    setPendingCount(queue.length)
  }

  const queueForSync = (vitals: VitalsInput) => {
    const queue = readPendingQueue()
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      vitals,
    })
    writePendingQueue(queue)
  }

  const getOfflineRisk = (vitals: VitalsInput): RiskResponse => {
    const map = vitals.map
    const features = [
      vitals.age,
      vitals.bmi,
      vitals.systolic,
      vitals.diastolic,
      vitals.heart_rate,
      vitals.bs,
      vitals.temperature,
      vitals.hemoglobin,
      vitals.pcos,
      vitals.previous_complications,
      vitals.preexisting_diabetes,
      vitals.mental_health,
      vitals.education,
      map,
    ]

    const modelOutput = typeof window !== "undefined" && typeof window.score === "function"
      ? window.score(features)
      : [0.45, 0.55]

    const rawRisk = modelOutput[1] ?? 0.5
    const lifestyleAdjustment =
      (vitals.sleep_pattern < 5 ? 0.04 : vitals.sleep_pattern >= 7 ? -0.02 : 0) +
      (vitals.exercise <= 1 ? 0.03 : vitals.exercise >= 4 ? -0.01 : 0) +
      (vitals.mental_health >= 7 ? 0.05 : vitals.mental_health <= 3 ? -0.01 : 0)
    const riskScore = Math.min(1, Math.max(0, rawRisk + lifestyleAdjustment))
    
    // Multi-tier Risk Logic
    let risk_level: "low" | "moderate" | "high" = "low"
    if (riskScore >= 0.7 || vitals.systolic >= 140 || vitals.diastolic >= 90) {
      risk_level = "high"
    } else if (riskScore >= 0.4 || vitals.systolic >= 130 || vitals.diastolic >= 85) {
      risk_level = "moderate"
    }

    const bpStatus =
      vitals.systolic >= 140 || vitals.diastolic >= 90
        ? "Elevated"
        : vitals.systolic >= 130 || vitals.diastolic >= 85
          ? "Watch"
          : "Normal"

    const mapAlert = map >= 95 ? "MAP high" : map >= 70 ? "MAP normal" : "MAP low"

    const recommendations = risk_level === "high" 
      ? [
          "Urgent: Repeat BP within 15 minutes",
          "Immediate escalation for Stage 2 Specialist review",
          "Capture advanced biomarkers for differential diagnosis",
        ]
      : risk_level === "moderate"
      ? [
          "Monitor BP every 4 hours",
          "Prepare for Stage 2 Diagnostic entry",
          "Schedule specialist consult within 48 hours",
        ]
      : [
          "Continue routine maternal monitoring",
          "Schedule next screening in 1-2 weeks",
          "Maintain healthy lifestyle as per guideline",
        ]

    return {
      risk_level,
      risk_score: Number(riskScore.toFixed(2)),
      recommendations,
      bp_status: bpStatus,
      observation: `Offline model estimate (${mapAlert}: ${map.toFixed(1)} mmHg)`,
    }
  }

  const buildVitalsInput = (): VitalsInput => {
    const parseOrDefault = (raw: string, fallback: number) => {
      const value = Number.parseFloat(raw)
      return Number.isNaN(value) ? fallback : value
    }

    const systolic = parseOrDefault(formData.systolic, DEFAULT_IMPUTE.systolic)
    const diastolic = parseOrDefault(formData.diastolic, DEFAULT_IMPUTE.diastolic)
    const map = (systolic + 2 * diastolic) / 3

    return {
      patient_name: formData.patientName.trim() || "Unknown Patient",
      age: parseOrDefault(formData.age, DEFAULT_IMPUTE.age),
      systolic,
      diastolic,
      bmi: parseOrDefault(formData.bmi, DEFAULT_IMPUTE.bmi),
      heart_rate: parseOrDefault(formData.heartRate, DEFAULT_IMPUTE.heart_rate),
      bs: parseOrDefault(formData.bs, DEFAULT_IMPUTE.bs),
      temperature: parseOrDefault(formData.temperature, DEFAULT_IMPUTE.temperature),
      hemoglobin: parseOrDefault(formData.hemoglobin, DEFAULT_IMPUTE.hemoglobin),
      pcos: parseOrDefault(formData.pcos, DEFAULT_IMPUTE.pcos),
      previous_complications: parseOrDefault(formData.previousComplications, DEFAULT_IMPUTE.previous_complications),
      preexisting_diabetes: parseOrDefault(formData.preexistingDiabetes, DEFAULT_IMPUTE.preexisting_diabetes),
      mental_health: parseOrDefault(formData.mentalHealth, DEFAULT_IMPUTE.mental_health),
      sleep_pattern: parseOrDefault(formData.sleepPattern, DEFAULT_IMPUTE.sleep_pattern),
      exercise: parseOrDefault(formData.exercise, DEFAULT_IMPUTE.exercise),
      education: parseOrDefault(formData.education, DEFAULT_IMPUTE.education),
      map,
    }
  }

  const syncPendingRecords = async () => {
    if (typeof window === "undefined" || !navigator.onLine) {
      return
    }

    const queue = readPendingQueue()
    if (queue.length === 0) {
      return
    }

    setIsSyncing(true)
    try {
      const unsynced: PendingScreening[] = []

      for (const item of queue) {
        try {
          const response = await fetch(API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Offline-Sync": "true",
            },
            body: JSON.stringify(item.vitals),
          })

          if (!response.ok) {
            unsynced.push(item)
          }
        } catch {
          unsynced.push(item)
        }
      }

      writePendingQueue(unsynced)
      if (unsynced.length === 0) {
        setStatusMessage("All offline Stage 1 records synced successfully.")
      } else {
        setStatusMessage(`${unsynced.length} record(s) are still pending sync.`)
      }
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    setPendingCount(readPendingQueue().length)
    setIsOffline(!navigator.onLine)

    const scriptId = "stage1-offline-model"
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script")
      script.id = scriptId
      script.src = "/scripts/stage1_offline_ai.js"
      script.async = true
      document.body.appendChild(script)
    }

    const handleOnline = () => {
      setIsOffline(false)
      syncPendingRecords().catch(() => {
        setStatusMessage("Back online, but some records are still waiting to sync.")
      })
    }

    const handleOffline = () => {
      setIsOffline(true)
      setStatusMessage("Offline mode active. New screenings will be saved locally.")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const handleCalculateRisk = async () => {
    setIsLoading(true)
    setApiError(null)
    setStatusMessage(null)
    setShowStage2Form(false) // Reset Stage 2 form on new analysis
    
    try {
      const vitalsData = buildVitalsInput()

      if (!navigator.onLine) {
        const offlineResult = getOfflineRisk(vitalsData)
        setRiskData(offlineResult)
        setShowResult(true)
        queueForSync(vitalsData)
        setStatusMessage("No internet connection. Stage 1 was scored locally and queued for sync.")
        return
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vitalsData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: RiskResponse = await response.json()
      setRiskData(result)
      setShowResult(true)
      syncPendingRecords().catch(() => {
        setStatusMessage("Current result saved. Some older offline records are still pending sync.")
      })
    } catch {
      const vitalsData = buildVitalsInput()

      try {
        const offlineResult = getOfflineRisk(vitalsData)
        setRiskData(offlineResult)
        setShowResult(true)
        queueForSync(vitalsData)
        setStatusMessage("Backend unavailable. Used offline Stage 1 model and queued record for sync.")
      } catch {
        setApiError('Failed to connect to the AI service and offline fallback was not available.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans selection:bg-primary/20 relative overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <img 
          src="/images/mother-baby-shadow.png" 
          alt="" 
          className="w-full h-full object-cover opacity-5 scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/20 via-slate-50/40 to-slate-50/10" />
      </div>
      
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-100 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-50 gap-3">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 rotate-3 hover:rotate-0 transition-transform duration-500">
              <Stethoscope className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">Bloom<span className="text-primary">Care</span></h1>
              <p className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">
                {getText("Hemas Hospitals Intelligence", "හේමාස් රෝහල් බුද්ධිය", "ஹேமாஸ் மருத்துவமனை நுண்ணறிவு")}
              </p>
            </div>
          </div>
          
          <div className="h-8 w-px bg-slate-100 hidden sm:block" />
          
          <div className="hidden lg:flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-100">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "h-8 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all",
                activeTab === "triage" ? "bg-white shadow-sm text-primary" : "text-slate-400 hover:text-slate-600"
              )}
              onClick={() => setActiveTab("triage")}
            >
              <LayoutDashboard className="w-3.5 h-3.5 mr-2" />
              {getText("Triage", "පෙරීම", "ட்ரைஜ்")}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "h-8 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all",
                activeTab === "registry" ? "bg-white shadow-sm text-primary" : "text-slate-400 hover:text-slate-600"
              )}
              onClick={() => setActiveTab("registry")}
            >
              <ClipboardList className="w-3.5 h-3.5 mr-2" />
              {getText("Registry", "ලියාපදිංචිය", "பதிவுப்புத்தகம்")}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "h-8 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all",
                activeTab === "history" ? "bg-white shadow-sm text-primary" : "text-slate-400 hover:text-slate-600"
              )}
              onClick={() => setActiveTab("history")}
            >
              <History className="w-3.5 h-3.5 mr-2" />
              {getText("History", "ඉතිහාසය", "வரலாறு")}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Offline Badge */}
          {isOffline && (
            <Badge variant="outline" className="hidden md:flex h-9 rounded-xl bg-orange-50 border-orange-100 text-orange-600 text-[9px] font-black uppercase tracking-widest px-4 items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              {getText("Offline", "නොබැඳි", "ஆஃப்லைன்")}
            </Badge>
          )}

          {/* Emergency Badge */}
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-rose-50 rounded-full border border-rose-100 mr-2">
            <Phone className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">0117 888 888</span>
          </div>

          {/* Language Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-slate-200 hover:border-primary/30 transition-all shadow-sm"
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
                      setSelectedLanguage(lang.code)
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

          <div className="h-8 w-px bg-slate-100" />

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 group"
            >
              <div className="hidden sm:text-right sm:block">
                <p className="text-sm font-black text-slate-900 tracking-tight">Nurse Kamala</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getText("Wattala Clinic", "වත්තල සායනය", "வத்தளை கிளினிக்")}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20 transition-transform group-hover:scale-105">
                <UserIcon className="w-5 h-5 text-white" />
              </div>
            </button>
            {showUserMenu && (
              <div className="absolute top-full right-0 mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 min-w-[220px] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="px-5 py-4 border-b border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                  <p className="text-xs font-bold text-slate-900">kamala.n@hemas.lk</p>
                </div>
                <button className="w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 flex items-center gap-3">
                  <Settings className="w-4 h-4 text-slate-400" />
                  Profile Settings
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
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left Column - Patient Queue (1/3 width) */}
        <aside className="w-full lg:w-1/4 bg-white/40 backdrop-blur-md border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col min-w-0 lg:min-w-[320px]">
          <div className="p-4 sm:p-6">
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-white font-black h-16 rounded-2xl shadow-xl shadow-primary/30 text-xs uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] border-0"
              onClick={() => {
                setFormData({
                  patientName: "",
                  age: "",
                  systolic: "",
                  diastolic: "",
                  bmi: "",
                  heartRate: "",
                  bs: "",
                  temperature: "",
                  hemoglobin: "",
                  pcos: "",
                  previousComplications: "",
                  preexistingDiabetes: "",
                  mentalHealth: "",
                  sleepPattern: "",
                  exercise: "",
                  education: "",
                  sfltRatio: "",
                  serumCreatinine: "",
                  plateletCount: "",
                  serumTriglycerides: "",
                  tsh: "",
                  pcv: "",
                  seng: "",
                  cystatinC: "",
                  pp13: "",
                  doppler: "",
                  gestationalAge: "",
                  famHtn: "",
                  htn: "",
                  occupation: "",
                  diet: "",
                })
                setShowResult(false)
              }}
            >
              <Plus className="w-5 h-5 mr-3" />
              {getText("New Screening", "නව පරීක්ෂාව", "புதிய பரிசோதனை")}
            </Button>
          </div>

          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder={getText("Search name or ID...", "නම හෝ හැඳුනුම්පත සොයන්න...", "பெயர் அல்லது ஐடியைத் தேடுங்கள்...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-12 bg-white/50 border-slate-100 focus:border-primary/30 focus:ring-primary/10 rounded-xl transition-all font-bold text-xs"
              />
            </div>
          </div>

          <div className="px-4 sm:px-8 pb-4 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {getText("Today's Queue", "අද පෝලිම", "இன்றைய வரிசை")}
            </h3>
            <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full">
              {filteredPatients.length}
            </span>
          </div>

          <div className="max-h-72 lg:max-h-none flex-1 overflow-y-auto px-3 sm:px-4 custom-scrollbar">
            {filteredPatients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => {
                  setSelectedPatient(patient)
                  setFormData({
                    ...formData,
                    patientName: patient.name,
                  })
                  setShowResult(false)
                }}
                className={cn(
                  "w-full p-4 rounded-2xl mb-3 text-left transition-all relative overflow-hidden group border",
                  selectedPatient?.id === patient.id
                    ? "bg-white border-primary/20 shadow-xl shadow-primary/5 translate-x-1"
                    : "bg-transparent border-transparent hover:bg-white/50 hover:border-slate-100 hover:translate-x-1"
                )}
              >
                {selectedPatient?.id === patient.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                )}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        patient.status === "assessed" 
                          ? "bg-emerald-50 text-emerald-500" 
                          : "bg-slate-50 text-slate-400"
                      )}
                    >
                      {patient.status === "assessed" ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className={cn(
                        "text-sm font-black transition-colors",
                        selectedPatient?.id === patient.id ? "text-slate-900" : "text-slate-600 group-hover:text-slate-900"
                      )}>{patient.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{patient.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-300 group-hover:text-slate-400 uppercase tracking-widest">{patient.time}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-8 border-t border-slate-100 bg-white/50 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{getText("Assessed Today", "අද ඇගයූ", "இன்று மதிப்பிடப்பட்டது")}</p>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-1000" 
                      style={{ width: `${(patients.filter(p => p.status === "assessed").length / patients.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-emerald-600">
                    {patients.filter((p) => p.status === "assessed").length}/{patients.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column - Triage Workspace (2/3 width) */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
            {activeTab === "triage" && (
              <>
                <Card className="border border-slate-200 bg-white/80 shadow-sm rounded-2xl">
                  <CardContent className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full",
                        isOffline ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      )}>
                        {isOffline ? getText("Offline Mode", "නොබැඳි මාදිලිය", "ஆஃப்லைன் பயன்முறை") : getText("Online", "සබැඳි", "ஆன்லைனில்")}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {getText("Pending Sync", "සමමුහුර්ත කිරීමට ඇති", "ஒத்திசைවු நிலුவையில் உள்ளது")}: {pendingCount}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => syncPendingRecords()}
                      disabled={isSyncing || pendingCount === 0 || isOffline}
                      className="h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"
                    >
                      {isSyncing ? getText("Syncing...", "සමමුහුර්ත වෙමින්...", "ஒத்திசைக்கப்படுகிறது...") : getText("Sync Now", "දැන් සමමුහුර්ත කරන්න", "இப்போது ஒத்திசைக்கவும்")}
                    </Button>
                  </CardContent>
                </Card>

                {statusMessage && (
                  <Card className="border border-blue-100 bg-blue-50/60 shadow-sm rounded-2xl">
                    <CardContent className="px-4 sm:px-6 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">{statusMessage}</p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {activeTab === "registry" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden rounded-[32px]">
                  <div className="h-2 w-full bg-bloom-gradient opacity-80" />
                  <CardHeader className="pb-6 pt-8 px-5 sm:px-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                          <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">
                            {getText("Patient Registry", "රෝගී ලේඛනය", "நோயாளி பதிவு")}
                          </CardTitle>
                          <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {getText("Centralized Clinical Database", "මධ්‍යගත සායනික දත්ත සමුදාය", "மத்திய மருத்துவ தரவுத்தளம்")}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="relative group min-w-0 md:min-w-[300px] flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                          <Input 
                            placeholder={getText("Search patients...", "රෝගීන් සොයන්න...", "நோயாளிகளைத் தேடுங்கள்...")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-50 border-slate-100 rounded-xl pl-10 h-11 text-xs font-bold w-full"
                          />
                        </div>
                        <Button variant="outline" className="rounded-xl border-slate-100 h-11 px-4">
                          <Filter className="w-4 h-4 mr-2 text-slate-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:inline">Filter</span>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 sm:px-10 pb-10">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[800px]">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{getText("ID", "අංකය", "ஐடி")}</th>
                            <th className="text-left py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{getText("Full Name", "සම්පූර්ණ නම", "முழுப் பெயர்")}</th>
                            <th className="text-left py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{getText("Details", "විස්තර", "விவரங்கள்")}</th>
                            <th className="text-left py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{getText("Location", "ස්ථානය", "இடம்")}</th>
                            <th className="text-left py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{getText("Risk Status", "අවදානම් තත්ත්වය", "ஆபத்து நிலை")}</th>
                            <th className="text-right py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{getText("Action", "ක්‍රියාව", "செயல்")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {patients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase())).map((p) => (
                            <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                              <td className="py-6">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 rounded-lg px-2 py-1">{p.id}</span>
                              </td>
                              <td className="py-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs">
                                    {p.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-slate-900 tracking-tight">{p.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.phone}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-6">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{p.age} {getText("Years", "වසර", "ஆண்டுகள்")}</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded w-fit">{p.bloodGroup}</span>
                                </div>
                              </td>
                              <td className="py-6">
                                <div className="flex items-center gap-2 text-slate-600">
                                  <MapPin className="w-3.5 h-3.5 text-slate-300" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">{p.location}</span>
                                </div>
                              </td>
                              <td className="py-6">
                                <div className={cn(
                                  "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest w-fit border",
                                  p.risk === "Low" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                  p.risk === "Moderate" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                  "bg-rose-50 text-rose-600 border-rose-100"
                                )}>
                                  {getText(p.risk, p.risk === "Low" ? "අඩු" : p.risk === "Moderate" ? "මධ්‍යම" : "ඉහළ", p.risk === "Low" ? "குறைந்த" : p.risk === "Moderate" ? "மிதமானது" : "அதிக")}
                                </div>
                              </td>
                              <td className="py-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl hover:bg-white hover:shadow-md transition-all group">
                                    <Eye className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl hover:bg-white hover:shadow-md transition-all group text-primary">
                                    <ChevronRight className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{getText("Screening History", "පරීක්ෂණ ඉතිහාසය", "பரிசோதனை வரலாறு")}</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{getText("Past Diagnostic Records", "පෙර රෝග විනිශ්චය වාර්තා", "கடந்த கண்டறியும் பதிவுகள்")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={historyFilter} onValueChange={setHistoryFilter}>
                      <SelectTrigger className="w-[180px] bg-white border-slate-100 rounded-xl h-11 text-[10px] font-black uppercase tracking-widest shadow-sm">
                        <Calendar className="w-4 h-4 mr-2 text-primary" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
                        <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest">{getText("All History", "සියලුම ඉතිහාසය", "அனைத்து வரலாறு")}</SelectItem>
                        <SelectItem value="today" className="text-[10px] font-black uppercase tracking-widest">{getText("Today", "අද", "இன்று")}</SelectItem>
                        <SelectItem value="this-week" className="text-[10px] font-black uppercase tracking-widest">{getText("This Week", "මෙම සතිය", "இந்த வாரம்")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {recentHistory.map((entry) => (
                    <Card key={entry.id} className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden rounded-[24px] group hover:scale-[1.01] transition-all">
                      <CardContent className="p-0">
                        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
                          <div className={cn(
                            "md:w-3 px-1",
                            entry.risk === "Low" ? "bg-emerald-500" :
                            entry.risk === "Moderate" ? "bg-amber-500" : "bg-rose-500"
                          )} />
                          <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-5">
                              <div className={cn(
                                "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-6",
                                entry.risk === "Low" ? "bg-emerald-50 text-emerald-500 shadow-emerald-200/50" :
                                entry.risk === "Moderate" ? "bg-amber-50 text-amber-500 shadow-amber-200/50" : "bg-rose-50 text-rose-500 shadow-rose-200/50"
                              )}>
                                {entry.risk === "High" ? <AlertTriangle className="w-7 h-7" /> : <Activity className="w-7 h-7" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-3 mb-1">
                                  <p className="text-base font-black text-slate-900 tracking-tight">{entry.patient}</p>
                                  <Badge variant="outline" className="rounded-lg border-slate-200 bg-white/50 text-[8px] font-black uppercase tracking-widest py-0.5 px-2">
                                    {entry.id}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {entry.date}</span>
                                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {entry.time}</span>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:px-10">
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{getText("BP", "රුධිර පීඩනය", "இரத்த அழுத்தம்")}</p>
                                <p className="text-xs font-black text-slate-700">{entry.vitals.bp}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{getText("HR", "හෘද වේගය", "இதயத் துடிப்பு")}</p>
                                <p className="text-xs font-black text-slate-700">{entry.vitals.hr} bpm</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{getText("Temp", "උෂ්ණත්වය", "வெப்பநிலை")}</p>
                                <p className="text-xs font-black text-slate-700">{entry.vitals.temp}°C</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{getText("Sugar", "සීනි", "சர்க்கரை")}</p>
                                <p className="text-xs font-black text-slate-700">{entry.vitals.sugar} mg/dL</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md",
                                entry.risk === "Low" ? "bg-emerald-500 text-white shadow-emerald-200/50" :
                                entry.risk === "Moderate" ? "bg-amber-500 text-white shadow-amber-200/50" : "bg-rose-500 text-white shadow-rose-200/50"
                              )}>
                                {getText(entry.risk + " Risk", entry.risk === "Low" ? "අඩු අවදානම" : entry.risk === "Moderate" ? "මධ්‍යම අවදානම" : "ඉහළ අවදානම", entry.risk === "Low" ? "குறைந்த ஆபத்து" : entry.risk === "Moderate" ? "மிதமான ஆபத்து" : "அதிக ஆபத்து")}
                              </div>
                              <Button 
                                onClick={() => setSelectedReport(entry)}
                                variant="ghost" 
                                className="h-8 pr-1 text-[9px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary/5 rounded-lg group/btn"
                              >
                                {getText("View Full Report", "සම්පූර්ණ වාර්තාව බලන්න", "முழு அறிக்கையைப் பார்க்கவும்")}
                                <ChevronRight className="w-3 h-3 ml-2 transition-transform group-hover/btn:translate-x-1" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "triage" && (
              <>
                {/* Top Half - Vitals Form */}
                <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-[32px]">
                  <div className="h-2 w-full bg-bloom-gradient opacity-80" />
                  <CardHeader className="pb-6 sm:pb-8 pt-6 sm:pt-8 px-5 sm:px-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">
                          {getText("Vitals Entry", "ජීව දත්ත ඇතුළත් කිරීම", "உயிர்நிலை தரவு உள்ளீடு")}
                        </CardTitle>
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {getText("Standardized Screening Protocol", "සම්මත පරීක්ෂණ ප්‍රොටෝකෝලය", "தரப்படுத்தப்பட்ட திரையிடல் நெறிமுறை")}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 sm:px-10 pb-6 sm:pb-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {/* Patient Name */}
                      <div className="md:col-span-2 space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                          {getText("Patient Full Name", "රෝගියාගේ සම්පූර්ණ නම", "நோயாளியின் முழுப் பெயர்")}
                        </Label>
                        <div className="relative group">
                          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                          <Input
                            value={formData.patientName}
                            onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                            className="h-12 pl-12 bg-slate-50 border-slate-100 focus:bg-white focus:border-primary/30 focus:ring-primary/10 rounded-xl transition-all font-bold text-slate-700"
                          />
                        </div>
                      </div>

                      {/* Age */}
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                          {getText("Age (Years)", "වයස (අවුරුදු)", "வயது (ஆண்டுகள்)")}
                        </Label>
                        <Input
                          type="number"
                          value={formData.age}
                          onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                          className="h-12 bg-slate-50 border-slate-100 focus:bg-white focus:border-primary/30 focus:ring-primary/10 rounded-xl transition-all font-bold text-slate-700"
                        />
                      </div>

                      {/* Blood Pressure */}
                      <div className="md:col-span-2 space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                          {getText("Blood Pressure (mmHg)", "රුධිර පීඩනය (mmHg)", "இரத்த அழுத்தம் (mmHg)")}
                        </Label>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 relative group">
                        <Heart className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-300 group-focus-within:text-primary transition-colors" />
                        <Input
                          type="number"
                          placeholder="Sys"
                          value={formData.systolic}
                          onChange={(e) => setFormData({ ...formData, systolic: e.target.value })}
                          className="h-12 pl-12 bg-slate-50 border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700"
                        />
                      </div>
                      <span className="text-slate-200 font-black">/</span>
                      <div className="flex-1 relative group">
                        <Heart className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-200 group-focus-within:text-primary transition-colors" />
                        <Input
                          type="number"
                          placeholder="Dia"
                          value={formData.diastolic}
                          onChange={(e) => setFormData({ ...formData, diastolic: e.target.value })}
                          className="h-12 pl-12 bg-slate-50 border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* BMI */}
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                      {getText("BMI Index", "BMI දර්ශකය", "பிஎம்ஐ குறியீடு")}
                    </Label>
                    <div className="relative group">
                      <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-300 group-focus-within:text-primary transition-colors" />
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.bmi}
                        onChange={(e) => setFormData({ ...formData, bmi: e.target.value })}
                        className="h-12 pl-12 bg-slate-50 border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700"
                      />
                    </div>
                  </div>

                  {/* Heart Rate */}
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                      {getText("Heart Rate (bpm)", "හෘද ස්පන්දන වේගය (bpm)", "இதயத் துடிப்பு (bpm)")}
                    </Label>
                    <div className="relative group">
                      <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-300 group-focus-within:text-primary transition-colors" />
                      <Input
                        type="number"
                        value={formData.heartRate}
                        onChange={(e) => setFormData({ ...formData, heartRate: e.target.value })}
                        className="h-12 pl-12 bg-slate-50 border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700"
                      />
                    </div>
                  </div>

                  {/* Temperature */}
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                      {getText("Temperature (°C)", "උෂ්ණත්වය (°C)", "வெப்பநிலை (°C)")}
                    </Label>
                    <div className="relative group">
                      <Thermometer className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-300 group-focus-within:text-primary transition-colors" />
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                        className="h-12 pl-12 bg-slate-50 border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700"
                      />
                    </div>
                  </div>

                  {/* Blood Sugar */}
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                      {getText("Blood Sugar (mg/dL)", "රුධිර සීනි (mg/dL)", "இரத்த சர்க்கரை (mg/dL)")}
                    </Label>
                    <Input
                      type="number"
                      value={formData.bs}
                      onChange={(e) => setFormData({ ...formData, bs: e.target.value })}
                      className="h-12 bg-slate-50 border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700"
                    />
                  </div>

                  {/* Hemoglobin */}
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                      {getText("Hemoglobin (g/dL)", "හිමොග්ලොබින් (g/dL)", "ஹீமோகுளோபின் (g/dL)")}
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.hemoglobin}
                      onChange={(e) => setFormData({ ...formData, hemoglobin: e.target.value })}
                      className="h-12 bg-slate-50 border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700"
                    />
                  </div>

                  {/* Mental Health */}
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                      {getText("Mental Health (1-10)", "මානසික සෞඛ්‍යය (1-10)", "மன ஆரோக்கியம் (1-10)")}
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      max="10"
                      value={formData.mentalHealth}
                      onChange={(e) => setFormData({ ...formData, mentalHealth: e.target.value })}
                      className="h-12 bg-slate-50 border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700"
                    />
                  </div>

                  {/* Sleep Pattern */}
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                      {getText("Sleep Pattern (hours)", "නින්දේ රටාව (පැය)", "தூக்க முறை (நேரம்)")}
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.sleepPattern}
                      onChange={(e) => setFormData({ ...formData, sleepPattern: e.target.value })}
                      className="h-12 bg-slate-50 border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700"
                    />
                  </div>

                  {/* Exercise */}
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                      {getText("Exercise Frequency (0-7)", "ව්‍යායාම සංඛ්‍යාතය (0-7)", "உடற்பயிற்சி அதிர்வெண் (0-7)")}
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="7"
                      value={formData.exercise}
                      onChange={(e) => setFormData({ ...formData, exercise: e.target.value })}
                      className="h-12 bg-slate-50 border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700"
                    />
                  </div>

                  {/* Education */}
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                      {getText("Education Level (1-5)", "අධ්‍යාපන මට්ටම (1-5)", "கல்வி நிலை (1-5)")}
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      max="5"
                      value={formData.education}
                      onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                      className="h-12 bg-slate-50 border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700"
                    />
                  </div>

                  {/* Binary Clinical History */}
                  <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{getText("PCOS (Yes/No)", "PCOS (ඔව්/නැත)", "பிசிஓஎஸ் (ஆம்/இல்லை)")}</Label>
                      <select
                        value={formData.pcos}
                        onChange={(e) => setFormData({ ...formData, pcos: e.target.value })}
                        className="h-12 w-full bg-slate-50 border border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700 px-4"
                      >
                        <option value="">{getText("Unknown", "නොදනී", "தெரியாது")}</option>
                        <option value="0">{getText("No", "නැත", "இல்லை")}</option>
                        <option value="1">{getText("Yes", "ඔව්", "ஆம்")}</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{getText("Previous Complications", "පෙර සංකූලතා", "முந்தைய சிக்கல்கள்")}</Label>
                      <select
                        value={formData.previousComplications}
                        onChange={(e) => setFormData({ ...formData, previousComplications: e.target.value })}
                        className="h-12 w-full bg-slate-50 border border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700 px-4"
                      >
                        <option value="">{getText("Unknown", "නොදනී", "தெரியாது")}</option>
                        <option value="0">{getText("No", "නැත", "இல்லை")}</option>
                        <option value="1">{getText("Yes", "ඔව්", "ஆம்")}</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{getText("Preexisting Diabetes", "පවතින දියවැඩියාව", "ஏற்கனவே இருக்கும் நீரிழிவு")}</Label>
                      <select
                        value={formData.preexistingDiabetes}
                        onChange={(e) => setFormData({ ...formData, preexistingDiabetes: e.target.value })}
                        className="h-12 w-full bg-slate-50 border border-slate-100 focus:bg-white rounded-xl font-bold text-slate-700 px-4"
                      >
                        <option value="">{getText("Unknown", "නොදනී", "தெரியாது")}</option>
                        <option value="0">{getText("No", "නැත", "இல்லை")}</option>
                        <option value="1">{getText("Yes", "ඔව්", "ஆம்")}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{getText("Mean Arterial Pressure (MAP)", "මධ්‍යම ධමනි පීඩනය (MAP)", "சராசரி தமனி அழுத்தம் (MAP)")}</p>
                  <p className="text-sm font-black text-slate-800">
                    {computedMap !== null ? `${computedMap.toFixed(1)} mmHg` : getText("Waiting for blood pressure values", "රුධිර පීඩන අගයන් සඳහා රැඳී සිටිනවා", "இரத்த அழுத்த மதிப்புகளுக்காக காத்திருக்கிறது")}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-2">
                    MAP = (Systolic_BP + (2 x Diastolic)) / 3
                  </p>
                </div>

                <div className="mt-8 sm:mt-10 flex justify-end">
                  <Button
                    onClick={handleCalculateRisk}
                    disabled={isLoading || !formData.patientName}
                    className="bg-bloom-gradient hover:opacity-90 text-white font-black px-10 h-16 rounded-2xl shadow-xl shadow-primary/30 text-xs uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                        {getText("Analyzing...", "විශ්ලේෂණය වෙමින්...", "பகுப்பாய்வு செய்கிறது...")}
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5 mr-3" />
                        {getText("Analyze Risk Level", "අවදානම් මට්ටම විශ්ලේෂණය කරන්න", "ஆபத்து அளவை பகுப்பாய்வு செய்யவும்")}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bottom Half - Result Area */}
            <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 rounded-[32px]">
              <div className="h-2 w-full bg-slate-100" />
              <CardHeader className="pb-6 pt-6 sm:pt-8 px-5 sm:px-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                      <Stethoscope className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">
                        {getText("Risk Assessment Summary", "අවදානම් තක්සේරු සාරාංශය", "ஆபத்து மதிப்பீட்டு சுருக்கம்")}
                      </CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {getText("AI-Based Predictive Analysis", "AI මත පදනම් වූ අනාවැකි විශ්ලේෂණය", "AI-அடிப்படையிலான முன்கணிப்பு பகுப்பாய்வு")}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 sm:px-10 pb-6 sm:pb-10">
                {apiError ? (
                  <div className="py-20 text-center bg-red-50/50 rounded-3xl border border-red-200">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                      <AlertTriangle className="w-10 h-10 text-red-400" />
                    </div>
                    <p className="text-sm font-bold text-red-600 mb-2">{getText("Connection Error", "සම්බන්ධතා දෝෂයකි", "இணைப்பு பிழை")}</p>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] max-w-xs mx-auto">
                      {apiError}
                    </p>
                  </div>
                ) : !showResult ? (
                  <div className="py-20 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                      <Activity className="w-10 h-10 text-slate-200 animate-pulse" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] max-w-xs mx-auto">
                      {getText("Complete patient vitals and click Analyze", "රෝගී දත්ත සම්පූර්ණ කර අවදානම විශ්ලේෂණය කරන්න", "நோயாளியின் முக்கியத் தரவை முடித்து, பகுப்பாய்வு செய்யவும்")}
                    </p>
                  </div>
                ) : riskData?.risk_level === "low" ? (
                  /* State 1: Low Risk */
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-8 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
                    <div className="flex items-start gap-8 relative z-10">
                      <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl shadow-emerald-200">
                        <CheckCircle className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">
                          {getText("Routine Care Recommended", "සාමාන්‍ය සත්කාර නිර්දේශිතයි", "வழக்கமான பராமரிப்பு பரிந்துரைக்கப்படுகிறது")}
                        </h3>
                        <p className="text-sm font-bold text-slate-500 leading-relaxed mb-8 max-w-2xl">
                          {getText(
                            "No significant risk factors identified. BloomCare AI confirms patient stability. Maintain standard maternal care protocols and monitor in next routine checkup.",
                            "සැලකිය යුතු අවදානම් සාධක හඳුනාගෙන නොමැත. බ්ලූම්කෙයාර් AI රෝගියාගේ ස්ථාවරත්වය තහවුරු කරයි. සම්මත මාතෘ සත්කාර ප්‍රොටෝකෝල පවත්වා ගෙන යන්න.",
                            "குறிப்பிடத்தக்க ஆபத்து காரணிகள் எதுவும் அடையாளம் காணப்படவில்லை. ப்ளூம்கேர் AI நோயாளியின் நிலைத்தன்மையை உறுதிப்படுத்துகிறது. நிலையான தாய்வழி பராமரிப்பு நெறிமுறைகளைப் பராமரிக்கவும்."
                          )}
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                          <div className="bg-white/60 p-5 rounded-2xl border border-white">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">{getText("Risk Score", "අවදානම් ලකුණු", "ஆபத்து மதிப்பெண்")}</p>
                            <p className="text-2xl font-black text-slate-900">{riskData?.risk_score.toFixed(2)}</p>
                          </div>
                          <div className="bg-white/60 p-5 rounded-2xl border border-white">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">{getText("BP Status", "රුධිර පීඩන තත්ත්වය", "இரத்த அழுத்த நிலை")}</p>
                            <p className="text-2xl font-black text-slate-900">{riskData?.bp_status}</p>
                          </div>
                          <div className="bg-white/60 p-5 rounded-2xl border border-white">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">{getText("Observation", "නිරීක්ෂණය", "பரிசோதனை")}</p>
                            <p className="text-2xl font-black text-slate-900">{riskData?.observation}</p>
                          </div>
                        </div>

                        {riskData?.recommendations && riskData.recommendations.length > 0 && (
                          <div className="mt-6">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">{getText("Recommendations", "නිර්දේශ", "பரிந்துரைகள்")}</p>
                            <div className="space-y-2">
                              {riskData.recommendations.map((rec, index) => (
                                <div key={index} className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                                  <p className="text-sm font-bold text-slate-600">{rec}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* State 2: High or Moderate Risk */
                  <div className={cn(
                    "border-2 rounded-3xl p-8 relative overflow-hidden group transition-all duration-500",
                    riskData?.risk_level === "high" 
                      ? "bg-red-50/50 border-red-500/20" 
                      : "bg-amber-50/50 border-amber-500/20"
                  )}>
                    <div className={cn(
                      "absolute right-[-20px] top-[-20px] w-40 h-40 rounded-full blur-3xl",
                      riskData?.risk_level === "high" ? "bg-red-500/10" : "bg-amber-500/10"
                    )} />
                    <div className="flex items-start gap-8 relative z-10">
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl transition-all",
                        riskData?.risk_level === "high" 
                          ? "bg-red-500 shadow-red-200 animate-pulse" 
                          : "bg-amber-500 shadow-amber-200"
                      )}>
                        {riskData?.risk_level === "high" 
                          ? <AlertTriangle className="w-8 h-8 text-white" />
                          : <Activity className="w-8 h-8 text-white" />
                        }
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">
                          {riskData?.risk_level === "high" 
                            ? getText("Critical Anomaly Detected", "විවේචනාත්මක අසාමාන්‍යතාවයක් හඳුනාගෙන ඇත", "சிக்கலான ஒழுங்கின்மை கண்டறியப்பட்டது")
                            : getText("Moderate Risk Identified", "මධ්‍යම අවදානමක් හඳුනාගෙන ඇත", "மிதமான ஆபத்து அடையாளம் காணப்பட்டது")
                          }
                        </h3>
                        <p className="text-sm font-bold text-slate-500 leading-relaxed mb-6 max-w-2xl">
                          {riskData?.risk_level === "high"
                            ? getText(
                                "Indicators exceed safety thresholds. High risk of gestational complications. Immediate clinical intervention and specialist review are required.",
                                "දර්ශක ආරක්ෂිත සීමාවන් ඉක්මවා යයි. ගර්භණී සංකූලතා ඇතිවීමේ වැඩි අවදානමක් ඇත. ක්ෂණික සායනික මැදිහත්වීමක් සහ විශේෂඥ සමාලෝචනයක් අවශ්‍ය වේ.",
                                "குறியீடுகள் பாதுகாப்பு வரம்புகளை மீறுகின்றன. கர்ப்பகால சிக்கல்களின் அதிக ஆபத்து உள்ளது. உடனடி மருத்துவ தலையீடு மற்றும் நிபுணர் மதிப்பாய்வு தேவை."
                              )
                            : getText(
                                "Moderate risk markers identified. Patient requires close monitoring and Stage 2 biomarker screening to prevent escalation.",
                                "මධ්‍යම මට්ටමේ අවදානම් සලකුණු හඳුනාගෙන ඇත. තත්ත්වය නරක අතට හැරීම වැළැක්වීම සඳහා රෝගියා සමීපව නිරීක්ෂණය කිරීම සහ අදියර 2 ජෛව සලකුණු පරීක්ෂාව අවශ්‍ය වේ.",
                                "மிதமான ஆபத்து குறிகாட்டிகள் அடையாளம் காணப்பட்டுள்ளன. நிலைமை மோசமடைவதைத் தடுக்க நோயாளிக்கு நெருக்கமான கண்காணிப்பு மற்றும் நிலை 2 உயிரியல் குறிப்பு திரையிடல் தேவை."
                              )
                          }
                        </p>
                        
                        <div className="flex flex-wrap gap-2 mb-8">
                          {riskData?.recommendations?.slice(0, 3).map((rec, index) => (
                            <span key={index} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-highlight text-white rounded-full">
                              {rec.length > 20 ? rec.substring(0, 20) + '...' : rec}
                            </span>
                          ))}
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
                          <div className="bg-white/80 p-5 rounded-2xl border border-red-500/10 shadow-sm">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">{getText("Risk Score", "අවදානම් ලකුණු", "ஆபத்து மதிப்பெண்")}</p>
                            <p className="text-2xl font-black text-slate-900">{riskData?.risk_score.toFixed(2)}</p>
                          </div>
                          <div className={cn(
                            "bg-white/80 p-5 rounded-2xl border shadow-sm",
                            riskData?.risk_level === "high" ? "border-red-500/10" : "border-amber-500/10"
                          )}>
                            <p className={cn(
                              "text-[10px] font-black uppercase tracking-widest mb-1",
                              riskData?.risk_level === "high" ? "text-red-500" : "text-amber-500"
                            )}>{getText("Priority", "ප්‍රමුඛතාවය", "முன்னுரிமை")}</p>
                            <p className={cn(
                              "text-2xl font-black capitalize",
                              riskData?.risk_level === "high" ? "text-red-500" : "text-amber-500"
                            )}>
                              {riskData?.risk_level === "high" 
                                ? getText("URGENT", "හදිසි", "அவசரம்") 
                                : getText("CAUTION", "අවවාදයයි", "எச்சரிக்கை")}
                            </p>
                          </div>
                          <div className={cn(
                            "bg-white/80 p-5 rounded-2xl border shadow-sm",
                            riskData?.risk_level === "high" ? "border-red-500/10" : "border-amber-500/10"
                          )}>
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">{getText("Referral", "යොමු කිරීම", "பரிந்துரை")}</p>
                            <p className="text-2xl font-black text-slate-900">{getText("Stage 2", "අදියර 2", "நிலை 2")}</p>
                          </div>
                        </div>

                        {riskData?.recommendations && riskData.recommendations.length > 0 && (
                          <div className="mb-8">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3">{getText("Clinical Recommendations", "සායනික නිර්දේශ", "மருத்துவ பரிந்துரைகள்")}</p>
                            <div className="space-y-2">
                              {riskData.recommendations.map((rec, index) => (
                                <div key={index} className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-red-400 rounded-full" />
                                  <p className="text-sm font-bold text-slate-600">{rec}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4 mb-10">
                          <Button 
                            onClick={() => setShowStage2Form(true)}
                            className="bg-slate-900 border-0 text-white flex-1 h-14 rounded-2xl shadow-xl shadow-slate-900/20 font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all"
                          >
                            <Microscope className="w-4 h-4 mr-2" />
                            {getText("Capture Stage 2 Data", "අදියර 2 දත්ත ලබාගන්න", "நிலை 2 தரவை சேகரிக்கவும்")}
                          </Button>
                          <Button variant="outline" className="flex-1 border-primary/20 font-black h-14 rounded-2xl text-primary text-xs uppercase tracking-widest hover:bg-primary/5">
                            <Phone className="w-4 h-4 mr-2" />
                            {getText("Refer Emergency", "හදිසි යොමු කිරීම", "அவசர பரிந்துரை")}
                          </Button>
                        </div>

                        {showStage2Form && (
                          <div className="bg-white rounded-[28px] p-6 sm:p-8 border border-red-100 shadow-inner animate-in slide-in-from-top-4 duration-500">
                             <div className="flex items-center gap-4 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                   <Dna className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                   <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{getText("Advanced Diagnostics (Stage 2)", "උසස් රෝග විනිශ්චය (අදියර 2)", "மேம்பட்ட நோயறிதல் (நிலை 2)")}</h4>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{getText("Laboratory Biomarkers & Clinical Imaging", "රසායනාගාර ජෛව සලකුණු සහ සායනික නිරූපණය", "ஆய்வக உயிரியல் குறிப்பான்கள் மற்றும் மருத்துவ இமேஜிங்")}</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                                {/* Critical Biomarkers */}
                                <div className="space-y-6">
                                   <p className="text-[10px] font-black text-primary uppercase tracking-widest border-l-2 border-primary pl-3">{getText("Critical Biomarkers", "තීරණාත්මක ජෛව සලකුණු", "முக்கிய உயிரியல் குறிப்பான்கள்")}</p>
                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                         <Label className="text-[9px] font-black uppercase text-slate-500">{getText("sFlt-1/PlGF Ratio", "sFlt-1/PlGF අනුපාතය", "sFlt-1/PlGF விகிதம்")}</Label>
                                         <Input value={formData.sfltRatio} onChange={(e) => setFormData({...formData, sfltRatio: e.target.value})} className="h-11 bg-slate-50 rounded-xl" placeholder="e.g. 38.5" />
                                      </div>
                                      <div className="space-y-2">
                                         <Label className="text-[9px] font-black uppercase text-slate-500">{getText("Serum Creatinine", "සීරම් ක්‍රියැටිනින්", "சீரம் கிரியேட்டினின்")}</Label>
                                         <Input value={formData.serumCreatinine} onChange={(e) => setFormData({...formData, serumCreatinine: e.target.value})} className="h-11 bg-slate-50 rounded-xl" placeholder="mg/dL" />
                                      </div>
                                      <div className="space-y-2">
                                         <Label className="text-[9px] font-black uppercase text-slate-500">{getText("Platelet Count", "ප්ලේට්ලට් ගණන", "இரத்த தட்டுக்களின் எண்ணிக்கை")}</Label>
                                         <Input value={formData.plateletCount} onChange={(e) => setFormData({...formData, plateletCount: e.target.value})} className="h-11 bg-slate-50 rounded-xl" placeholder="x10³/µL" />
                                      </div>
                                      <div className="space-y-2">
                                         <Label className="text-[9px] font-black uppercase text-slate-500">{getText("Triglycerides", "ට්‍රයිග්ලිසරයිඩ්", "ட்ரைகிளிசரைடுகள்")}</Label>
                                         <Input value={formData.serumTriglycerides} onChange={(e) => setFormData({...formData, serumTriglycerides: e.target.value})} className="h-11 bg-slate-50 rounded-xl" placeholder="mg/dL" />
                                      </div>
                                   </div>
                                </div>

                                {/* Endocrine & Blood */}
                                <div className="space-y-6">
                                   <p className="text-[10px] font-black text-accent uppercase tracking-widest border-l-2 border-accent pl-3">{getText("Endocrine & Blood", "අන්තරාසර්ග සහ රුධිරය", "நாளமில்லா மற்றும் இரத்தம்")}</p>
                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                         <Label className="text-[9px] font-black uppercase text-slate-500">{getText("TSH Level", "TSH මට්ටම", "TSH அளவு")}</Label>
                                         <Input value={formData.tsh} onChange={(e) => setFormData({...formData, tsh: e.target.value})} className="h-11 bg-slate-50 rounded-xl" placeholder="µIU/mL" />
                                      </div>
                                      <div className="space-y-2">
                                         <Label className="text-[9px] font-black uppercase text-slate-500">{getText("PCV (%)", "PCV (%)", "PCV (%)")}</Label>
                                         <Input value={formData.pcv} onChange={(e) => setFormData({...formData, pcv: e.target.value})} className="h-11 bg-slate-50 rounded-xl" placeholder="Percentage" />
                                      </div>
                                      <div className="space-y-2">
                                         <Label className="text-[9px] font-black uppercase text-slate-500">{getText("Soluble Endoglin", "ද්‍රාව්‍ය එන්ඩොග්ලින්", "கரையக்கூடிய எண்டோக்ளின்")}</Label>
                                         <Input value={formData.seng} onChange={(e) => setFormData({...formData, seng: e.target.value})} className="h-11 bg-slate-50 rounded-xl" placeholder="ng/mL" />
                                      </div>
                                      <div className="space-y-2">
                                         <Label className="text-[9px] font-black uppercase text-slate-500">{getText("Cystatin C", "සිස්ටැටින් සී", "சிஸ்டாடின் சி")}</Label>
                                         <Input value={formData.cystatinC} onChange={(e) => setFormData({...formData, cystatinC: e.target.value})} className="h-11 bg-slate-50 rounded-xl" placeholder="mg/L" />
                                      </div>
                                   </div>
                                </div>

                                {/* Clinical Imaging */}
                                <div className="space-y-6">
                                   <p className="text-[10px] font-black text-[#F97316] uppercase tracking-widest border-l-2 border-[#F97316] pl-3">{getText("Clinical Imaging", "සායනික නිරූපණය", "மருத்துவ இமேஜிங்")}</p>
                                   <div className="space-y-2">
                                      <Label className="text-[9px] font-black uppercase text-slate-500">{getText("Uterine Artery Doppler (sp_art)", "ගර්භාෂ ධමනි ඩොප්ලර්", "கருப்பை தமனி டாப்ளர்")}</Label>
                                      <Input value={formData.doppler} onChange={(e) => setFormData({...formData, doppler: e.target.value})} className="h-11 bg-slate-50 rounded-xl" placeholder="Resistance Index / Waveform Details" />
                                   </div>
                                </div>

                                {/* Expanded History */}
                                <div className="space-y-6">
                                   <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-l-2 border-slate-900 pl-3">{getText("Expanded History", "පුළුල් කරන ලද ඉතිහාසය", "விரிவாக்கப்பட்ட வரலாறு")}</p>
                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                         <Label className="text-[9px] font-black uppercase text-slate-500">{getText("Gestational Age", "ගැබ් කාලය", "கர்ப்ப காலம்")}</Label>
                                         <Input value={formData.gestationalAge} onChange={(e) => setFormData({...formData, gestationalAge: e.target.value})} className="h-11 bg-slate-50 rounded-xl" placeholder="Weeks" />
                                      </div>
                                      <div className="space-y-2">
                                         <Label className="text-[9px] font-black uppercase text-slate-500">{getText("Family HTN", "පවුලේ අධික රුධිර පීඩනය", "குடும்ப உயர் இரத்த அழுத்தம்")}</Label>
                                         <select value={formData.famHtn} onChange={(e) => setFormData({...formData, famHtn: e.target.value})} className="h-11 w-full bg-slate-50 rounded-xl px-3 text-xs font-bold text-slate-700">
                                            <option value="">{getText("Select", "තෝරන්න", "தேர்ந்தெடு")}</option>
                                            <option value="0">{getText("No", "නැත", "இல்லை")}</option>
                                            <option value="1">{getText("Yes", "ඔව්", "ஆம்")}</option>
                                         </select>
                                      </div>
                                   </div>
                                </div>
                             </div>

                             <Button className="w-full bg-bloom-gradient h-14 rounded-2xl shadow-xl shadow-primary/20 text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all border-0">
                                <ShieldCheck className="w-5 h-5 mr-3" />
                                {getText("Complete Stage 2 Escalation", "අදියර 2 යොමු කිරීම පූර්ණ කරන්න", "நிலை 2 பரிந்துரையை பூர்த்தி செய்க")}
                             </Button>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4">
                          <Button className="flex-1 bg-bloom-gradient hover:opacity-90 text-white font-black h-16 rounded-2xl shadow-xl shadow-primary/30 text-xs uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] border-0">
                            <Phone className="w-4 h-4 mr-3" />
                            {getText("Escalate to Specialist", "විශේෂඥ වෛද්‍යවරයකු වෙත යොමු කරන්න", "நிபுணரிடம் பரிந்துரைக்கவும்")}
                          </Button>
                          <Button variant="outline" className="flex-1 border-primary/20 font-black h-16 rounded-2xl text-primary text-xs uppercase tracking-[0.2em] hover:bg-primary/5">
                            {getText("Print Referral Card", "යොමු කිරීමේ කාඩ්පත මුද්‍රණය කරන්න", "பரிந்துரை அட்டையை அச்சிடுக")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
    
      {/* Full Report Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-2xl bg-white rounded-[32px] border-0 shadow-2xl p-0 overflow-hidden">
          <div className="h-2 w-full bg-bloom-gradient" />
          <div className="p-8 sm:p-10">
            <DialogHeader className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    selectedReport?.risk === "Low" ? "bg-emerald-50 text-emerald-500" :
                    selectedReport?.risk === "Moderate" ? "bg-amber-50 text-amber-500" : "bg-rose-50 text-rose-500"
                  )}>
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      {getText("Clinical Screening Report", "සායනික පරීක්ෂණ වාර්තාව", "மருத்துவ பரிசோதனை அறிக்கை")}
                    </DialogTitle>
                    <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {getText("Patient Reference ID", "රෝගී යොමු අංකය", "நோயாளி குறிப்பு ஐடி")}: {selectedReport?.id}
                    </DialogDescription>
                  </div>
                </div>
                <div className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                  selectedReport?.risk === "Low" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                  selectedReport?.risk === "Moderate" ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-rose-50 text-rose-600 border-rose-100"
                )}>
                  {selectedReport?.risk && getText(selectedReport.risk + " Risk", selectedReport.risk === "Low" ? "අඩු අවදානම" : selectedReport.risk === "Moderate" ? "මධ්‍යම අවදානම" : "ඉහළ අවදානම", selectedReport.risk === "Low" ? "குறைந்த ஆபத்து" : selectedReport.risk === "Moderate" ? "மிதமான ஆபத்து" : "அதிக ஆபத்து")}
                </div>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{getText("Patient Details", "රෝගියාගේ විස්තර", "நோயாளி விவரங்கள்")}</p>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-base font-black text-slate-900 mb-1">{selectedReport?.patient}</p>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {selectedReport?.date}</span>
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {selectedReport?.time}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{getText("Clinical Summary", "සායනික සාරාංශය", "மருத்துவ சுருக்கம்")}</p>
                  <p className="text-xs font-bold text-slate-600 leading-relaxed">
                    {getText(
                      "This automated report displays vitals captured during the triage screening session. All values reflect the patient state as recorded on " + selectedReport?.date + ".",
                      "මෙම ස්වයංක්‍රීය වාර්තාව පරීක්ෂණ සැසිය තුළ ලබාගත් රෝගී දත්ත ප්‍රදර්ශනය කරයි. " + selectedReport?.date + " දින වාර්තා වූ රෝගියාගේ තත්ත්වය සියලු අගයන්ගෙන් පිළිඹිබු වේ.",
                      "இந்த தானியங்கி அறிக்கை திரையிடலின் போது எடுக்கப்பட்ட முக்கிய தரவுகளைக் காட்டுகிறது. அனைத்து மதிப்புகளும் " + selectedReport?.date + " அன்று பதிவுசெய்யப்பட்ட நோயாளியின் நிலையை பிரதிபலிக்கின்றன."
                    )}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-[28px] p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-6 relative z-10">{getText("Vitals Dashboard", "ජීව දත්ත උපකරණ පුවරුව", "முக்கியத் தரவு டாஷ்போர்டு")}</p>
                <div className="grid grid-cols-2 gap-y-6 relative z-10">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{getText("BP", "රුධිර පීඩනය", "இரத்த அழுத்தம்")}</p>
                    <p className="text-base font-black">{selectedReport?.vitals.bp} <span className="text-[10px] text-slate-500">mmHg</span></p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{getText("Pulse", "නාඩි", "நாடித்துடிப்பு")}</p>
                    <p className="text-base font-black">{selectedReport?.vitals.hr} <span className="text-[10px] text-slate-500">bpm</span></p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{getText("Temp", "උෂ්ණත්වය", "வெப்பநிலை")}</p>
                    <p className="text-base font-black">{selectedReport?.vitals.temp} <span className="text-[10px] text-slate-500">°C</span></p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{getText("Sugar", "සීනි", "சர்க்கரை")}</p>
                    <p className="text-base font-black">{selectedReport?.vitals.sugar} <span className="text-[10px] text-slate-500">mg/dL</span></p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-4">
              <Button 
                variant="outline" 
                className="flex-1 border-slate-200 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4 mr-3" />
                {getText("Print Report", "වාර්තාව මුද්‍රණය කරන්න", "அறிக்கையை அச்சிடுக")}
              </Button>
              <Button 
                className="flex-1 bg-bloom-gradient h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white border-0 shadow-lg shadow-primary/25"
                onClick={() => setSelectedReport(null)}
              >
                {getText("Close", "වසා දමන්න", "மூடு")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      </div>
      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] bg-white/80 backdrop-blur-2xl border border-slate-100 p-2 rounded-[24px] shadow-2xl z-[60] flex items-center justify-around translate-y-0 animate-in slide-in-from-bottom-8 duration-700">
        <button 
          onClick={() => setActiveTab("triage")}
          className={cn(
            "flex flex-col items-center gap-1.5 px-6 py-3 rounded-2xl transition-all",
            activeTab === "triage" ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-widest">{getText("Triage", "පෙරීම", "ட்ரைஜ்")}</span>
        </button>
        <button 
          onClick={() => setActiveTab("registry")}
          className={cn(
            "flex flex-col items-center gap-1.5 px-6 py-3 rounded-2xl transition-all",
            activeTab === "registry" ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <ClipboardList className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-widest">{getText("Registry", "ලියාපදිංචිය", "பதிவு")}</span>
        </button>
        <button 
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex flex-col items-center gap-1.5 px-6 py-3 rounded-2xl transition-all",
            activeTab === "history" ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <History className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-widest">{getText("History", "ඉතිහාසය", "வரலாறு")}</span>
        </button>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  )
}
