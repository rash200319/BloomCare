"use client"

import { getApiBaseCandidates } from "@/lib/api"

import { useEffect, useState } from "react"
import {
  User,
  Globe,
  ChevronDown,
  TrendingUp,
  Users,
  Activity,
  AlertTriangle,
  Building,
  Bell,
  Settings,
  LogOut,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import ProfileSettingsDialog from "./profile-settings-dialog"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"

type Language = "EN" | "SI" | "TA"

interface AdminDashboardProps {
  onLogout: () => void
}

interface DashboardMetrics {
  total_screenings: number
  stage1_screenings_count: number
  stage2_screenings_count: number
  high_risk_count: number
  avg_severity_score: number
  total_patients: number
  active_clinics: number
}

interface ReferralEfficiency {
  stage1_high_risk_total: number
  stage2_referrals_completed: number
  conversion_rate_percent: number
  avg_days_to_referral: number
  pending_referrals: number
}

interface CostImpact {
  high_risk_cases_detected_30d: number
  cost_per_case_saved_lkr: number
  estimated_total_savings_lkr: number
  roi_percent: number
}

interface Stage2DiagnosticRow {
  diagnostic_id: string
  evaluated_at: string | null
  patient_name: string
  patient_national_id: string | null
  specialist_name: string
  stage1_screening_id: string | null
  primary_disease_checked: string | null
  dominant_condition: string | null
  overall_severity_score: number | null
  sflt1_plgf_ratio: number | null
  cervical_length_mm: number | null
  model_used: string | null
}

interface TrendPoint {
  timestamp: string
  case_count: number
  condition: string
  severity_avg: number
}

type StaffRoleOption = "FRONTLINE_STAFF" | "CLINICAL_SPECIALIST"

const languages = [
  { code: "EN", label: "English" },
  { code: "SI", label: "Sinhala" },
  { code: "TA", label: "Tamil" },
]

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("EN")
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null)
  const [referralEfficiency, setReferralEfficiency] = useState<ReferralEfficiency | null>(null)
  const [costImpact, setCostImpact] = useState<CostImpact | null>(null)
  const [caseTrends, setCaseTrends] = useState<TrendPoint[]>([])
  const [stage2Diagnostics, setStage2Diagnostics] = useState<Stage2DiagnosticRow[]>([])
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [staffRole, setStaffRole] = useState<StaffRoleOption>("FRONTLINE_STAFF")
  const [staffName, setStaffName] = useState("")
  const [staffEmail, setStaffEmail] = useState("")
  const [staffPhone, setStaffPhone] = useState("")
  const [staffSpecialization, setStaffSpecialization] = useState("")
  const [staffSubmitting, setStaffSubmitting] = useState(false)
  const [staffMessage, setStaffMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    const profile = localStorage.getItem('bloomcare_user_profile')
    if (profile) {
      setUserProfile(JSON.parse(profile))
    }
  }, [])

  useEffect(() => {
    const accessToken = typeof window !== "undefined" ? window.localStorage.getItem("bloomcare_access_token") : null
    if (!accessToken) {
      return
    }

    const loadAnalytics = async () => {
      try {
        const headers = { Authorization: `Bearer ${accessToken}` }
        const bases = getApiBaseCandidates()

        const fetchJson = async (path: string) => {
          let lastError: unknown = null
          for (const base of bases) {
            try {
              const response = await fetch(`${base}${path}`, { headers })
              if (response.status === 404) {
                continue
              }
              if (!response.ok) {
                throw new Error(`Request failed: ${response.status}`)
              }
              return response.json()
            } catch (error) {
              lastError = error
            }
          }
          throw lastError instanceof Error ? lastError : new Error(`Unable to load ${path}`)
        }

        const [metrics, referral, impact, trends, stage2Rows] = await Promise.all([
          fetchJson("/admin/dashboard-metrics"),
          fetchJson("/admin/referral-efficiency"),
          fetchJson("/admin/cost-impact"),
          fetchJson("/admin/case-trends?days_back=30&group_by=day"),
          fetchJson("/admin/stage2-diagnostics?limit=8"),
        ])

        setDashboardMetrics(metrics)
        setReferralEfficiency(referral)
        setCostImpact(impact)
        setCaseTrends(trends?.trends ?? [])
        setStage2Diagnostics(stage2Rows?.rows ?? [])
      } catch (error) {
        setAnalyticsError(error instanceof Error ? error.message : "Unable to load analytics")
        console.error("Admin analytics load error:", error)
      }
    }

    loadAnalytics()
  }, [])

  const getText = (en: string, si: string, ta: string) => {
    if (selectedLanguage === "SI") return si
    if (selectedLanguage === "TA") return ta
    return en
  }

  const handleCreateStaff = async () => {
    setStaffMessage(null)

    const trimmedName = staffName.trim()
    const trimmedEmail = staffEmail.trim().toLowerCase()
    const trimmedPhone = staffPhone.trim()
    const trimmedSpecialization = staffSpecialization.trim()

    if (!trimmedName || !trimmedEmail) {
      setStaffMessage({ type: "error", text: "Full name and email are required." })
      return
    }

    if (staffRole === "CLINICAL_SPECIALIST" && !trimmedSpecialization) {
      setStaffMessage({ type: "error", text: "Specialization is required for obstetricians." })
      return
    }

    const accessToken = typeof window !== "undefined" ? window.localStorage.getItem("bloomcare_access_token") : null
    if (!accessToken) {
      setStaffMessage({ type: "error", text: "Admin session expired. Please log in again." })
      return
    }

    const bases = getApiBaseCandidates()
    const payload = {
      full_name: trimmedName,
      email: trimmedEmail,
      phone_number: trimmedPhone || null,
      role: staffRole,
      specialization: staffRole === "CLINICAL_SPECIALIST" ? trimmedSpecialization : null,
    }

    try {
      setStaffSubmitting(true)

      let lastError: unknown = null
      let created = false

      for (const base of bases) {
        try {
          const response = await fetch(`${base}/staff-management/create-staff`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(payload),
          })

          if (!response.ok) {
            const errJson = await response.json().catch(() => null)
            throw new Error(errJson?.detail || `Create staff failed (${response.status})`)
          }

          await response.json()
          created = true
          break
        } catch (error) {
          lastError = error
        }
      }

      if (!created) {
        throw lastError instanceof Error ? lastError : new Error("Unable to create staff account.")
      }

      setStaffMessage({
        type: "success",
        text: "Staff account created. Ask the user to complete First-Time Login to set their password.",
      })
      setStaffName("")
      setStaffEmail("")
      setStaffPhone("")
      setStaffSpecialization("")
    } catch (error) {
      setStaffMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to create staff account.",
      })
    } finally {
      setStaffSubmitting(false)
    }
  }

  const trendChartData = caseTrends.length > 0
    ? caseTrends.map((point) => ({
        month: new Date(point.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        screenings: point.case_count,
        escalations: point.severity_avg,
        lowRisk: Math.max(0, point.case_count - Math.round(point.severity_avg)),
      }))
    : []

  const totalScreenings = dashboardMetrics?.total_screenings ?? 0
  const highRiskDetected = dashboardMetrics?.high_risk_count ?? 0
  const costSaved = costImpact?.estimated_total_savings_lkr ?? 0
  const activeClinics = dashboardMetrics?.active_clinics ?? 0

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans selection:bg-primary/20 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/30 to-slate-50/10" />
      </div>

      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 transition-transform hover:scale-105 cursor-pointer group">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 rotate-3 group-hover:rotate-0 transition-transform duration-500">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>

              <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">Bloom<span className="text-primary">Care</span></h1>
              <p className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">
                Analytics Intelligence
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-100 hidden sm:block" />

          <div className="hidden lg:flex items-center gap-6 px-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {getText("BloomCare Administration", "BloomCare පරිපාලනය", "BloomCare நிர்வாகம்")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-3 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition-all shadow-sm group">
            <Bell className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-white shadow-sm" />
          </button>

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

          <div className="h-8 w-px bg-slate-100" />

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 group"
            >
              <div className="hidden sm:text-right sm:block">
                <p className="text-sm font-black text-slate-900 tracking-tight">{userProfile?.full_name || "Loading..."}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administrator</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20 transition-transform group-hover:scale-105">
                <User className="w-5 h-5 text-white" />
              </div>
            </button>
            {showUserMenu && (
              <div className="absolute top-full right-0 mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 min-w-[220px] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="px-5 py-4 border-b border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                  <p className="text-xs font-bold text-slate-900">{userProfile?.full_name || userProfile?.email || "N/A"}</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    setShowProfileSettings(true)
                  }}
                  className="w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  System Settings
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
      <main className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <Card className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden group hover:scale-[1.02] transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="h-1 w-full bg-primary/40" />
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {getText("Total Screenings", "මුළු පරීක්ෂණ", "மொத்த ஸ்கிரீனிங்கள்")}
                </p>
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  <Users className="w-6 h-6 text-primary group-hover:text-white transition-colors" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{totalScreenings.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-4">
                <div className="flex items-center px-1.5 py-0.5 bg-emerald-50 rounded-full border border-emerald-100">
                  <ArrowUpRight className="w-3 h-3 text-emerald-500 mr-1" />
                  <span className="text-[10px] text-emerald-600 font-black">{Math.min(99.9, Math.max(0, referralEfficiency?.conversion_rate_percent ?? 0)).toFixed(1)}%</span>
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{getText("growth", "වර්ධනය", "வளர்ச்சி")}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden group hover:scale-[1.02] transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 delay-75">
            <div className="h-1 w-full bg-accent/40" />
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {getText("High Risk Detected", "ඉහළ අවදානම් හඳුනාගැනීම", "அதிக ஆபத்து கண்டறியப்பட்டது")}
                </p>
                <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
                  <AlertTriangle className="w-5 h-5 text-accent group-hover:text-white transition-colors" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{highRiskDetected.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-4">
                <div className="flex items-center px-1.5 py-0.5 bg-accent/5 rounded-full border border-accent/10">
                  <ArrowDownRight className="w-3 h-3 text-accent mr-1" />
                  <span className="text-[10px] text-accent font-black">{referralEfficiency?.pending_referrals ?? 0} pending</span>
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{getText("optimization", "ප්‍රශස්තකරණය", "மேம்படுத்தல்")}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden group hover:scale-[1.02] transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150">
            <div className="h-1 w-full bg-emerald-500/40" />
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {getText("Cost Savings", "පිරිවැය ඉතිරිය", "செலவு சேமிப்பு")}
                </p>
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <TrendingUp className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">LKR {(costSaved / 1000000).toFixed(1)}M</p>
              <div className="flex items-center gap-2 mt-4">
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-100">{getText("Verified AI ROI", "තහවුරු කරන ලද AI ROI", "சரிபார்க்கப்பட்ட AI ROI")}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden group hover:scale-[1.02] transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 delay-200">
            <div className="h-1 w-full bg-blue-500/40" />
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {getText("Active Clinics", "ක්‍රියාකාරී සායන", "செயலில் உள்ள கிளினிக்குகள்")}
                </p>
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <Building className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{activeClinics}</p>
              <div className="flex items-center gap-2 mt-4">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{getText("BloomCare Network", "BloomCare ජාලය", "BloomCare நெட்வொர்க்")}</span>
              </div>
            </CardContent>
          </Card>
        </div>
        <Tabs defaultValue="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <TabsList className="bg-white/50 backdrop-blur-md border border-slate-100 p-1.5 rounded-2xl shadow-sm inline-flex">
            <TabsTrigger value="overview" className="h-10 px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all">
              <BarChart3 className="w-4 h-4 mr-2" />
              {getText("Overview", "දළ විශ්ලේෂණය", "கண்ணோட்டம்")}
            </TabsTrigger>
            <TabsTrigger value="activity" className="h-10 px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all">
              <Activity className="w-4 h-4 mr-2" />
              {getText("Live Feed", "සජීවී පුවත්", "நிகழ்நேர ஊட்டம்")}
            </TabsTrigger>
            <TabsTrigger value="registration" className="h-10 px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all">
              <Users className="w-4 h-4 mr-2" />
              {getText("Staff Registration", "සේවා ලියාපදිංචිය", "பணியாளர் பதிவு")}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab content */}
          <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50/50 pb-6">
                  <div>
                    <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">
                      {getText("Monthly Screening Trends", "මාසික පරීක්ෂණ ප්‍රවණතා", "மாதாந்திர ஸ்கிரீனிங் போக்குகள்")}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-8">
                  <div className="h-80 w-full font-bold">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendChartData}>
                        <defs>
                          <linearGradient id="colorScreenings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FB7185" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#FB7185" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        />
                        <Area type="monotone" dataKey="screenings" stroke="var(--primary)" strokeWidth={4} fillOpacity={1} fill="url(#colorScreenings)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden">
                <CardHeader className="border-b border-slate-50/50 pb-6">
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    {getText("Referral Snapshot", "යොමු කිරීමේ සාරාංශය", "பரிந்துரை சுருக்கம்")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-8 px-8 space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Conversion</p>
                      <p className="text-3xl font-black text-slate-900">{(referralEfficiency?.conversion_rate_percent ?? 0).toFixed(1)}%</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Pending</p>
                      <p className="text-3xl font-black text-slate-900">{referralEfficiency?.pending_referrals ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Avg. referral delay</p>
                      <p className="text-3xl font-black text-slate-900">{(referralEfficiency?.avg_days_to_referral ?? 0).toFixed(1)}d</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">High-risk cases</p>
                      <p className="text-3xl font-black text-slate-900">{highRiskDetected.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Activity Tab content */}
          <TabsContent value="activity" className="space-y-8 animate-in fade-in duration-500">
            <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50/50 pb-6">
                <div>
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    {getText("Stage 2 Diagnostics", "අදියර 2 රෝග විනිශ්චය", "நிலை 2 நோயறிதல்கள்")}
                  </CardTitle>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {getText("Latest records from stage2_diagnostics", "stage2_diagnostics වෙතින් නවතම වාර්තා", "stage2_diagnostics இலிருந்து சமீபத்திய பதிவுகள்")}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px]">
                    <thead className="bg-slate-50/70">
                      <tr>
                        <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Patient</th>
                        <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Specialist</th>
                        <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Disease</th>
                        <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Condition</th>
                        <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Severity</th>
                        <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">sFlt-1/PlGF</th>
                        <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Cervical Length</th>
                        <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Evaluated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stage2Diagnostics.length === 0 ? (
                        <tr>
                          <td className="p-6 text-sm text-slate-500" colSpan={8}>
                            {getText("No stage 2 diagnostic records found.", "අදියර 2 රෝග විනිශ්චය වාර්තා හමු නොවීය.", "நிலை 2 நோயறிதல் பதிவுகள் இல்லை.")}
                          </td>
                        </tr>
                      ) : (
                        stage2Diagnostics.map((row) => (
                          <tr key={row.diagnostic_id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-5">
                              <div className="space-y-1">
                                <p className="text-sm font-black text-slate-900">{row.patient_name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{row.patient_national_id || "No ID"}</p>
                              </div>
                            </td>
                            <td className="p-5 text-sm font-bold text-slate-700">{row.specialist_name}</td>
                            <td className="p-5 text-sm font-bold text-slate-700 uppercase">{row.primary_disease_checked || "N/A"}</td>
                            <td className="p-5">
                              <Badge className="rounded-lg bg-slate-900 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                                {row.dominant_condition || "Pending"}
                              </Badge>
                            </td>
                            <td className="p-5 text-sm font-black text-slate-900">
                              {row.overall_severity_score != null ? `${(row.overall_severity_score * 100).toFixed(0)}%` : "--"}
                            </td>
                            <td className="p-5 text-sm font-bold text-slate-700">
                              {row.sflt1_plgf_ratio != null ? row.sflt1_plgf_ratio.toFixed(2) : "--"}
                            </td>
                            <td className="p-5 text-sm font-bold text-slate-700">
                              {row.cervical_length_mm != null ? `${row.cervical_length_mm.toFixed(1)} mm` : "--"}
                            </td>
                            <td className="p-5 text-sm font-bold text-slate-700">
                              {row.evaluated_at ? new Date(row.evaluated_at).toLocaleString() : "--"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="registration" className="space-y-8 animate-in fade-in duration-500">
            <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden">
              <CardHeader className="border-b border-slate-50/50 pb-6">
                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">
                  {getText("Register Staff", "සේවා ලියාපදිංචිය", "பணியாளர் பதிவு")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Full Name</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Full name"
                      value={staffName}
                      onChange={(event) => setStaffName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="name@example.com"
                      value={staffEmail}
                      onChange={(event) => setStaffEmail(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Phone (Optional)</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="07XXXXXXXX"
                      value={staffPhone}
                      onChange={(event) => setStaffPhone(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Role</label>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={staffRole}
                      onChange={(event) => setStaffRole(event.target.value as StaffRoleOption)}
                    >
                      <option value="FRONTLINE_STAFF">Frontline Staff</option>
                      <option value="CLINICAL_SPECIALIST">Obstetrician</option>
                    </select>
                  </div>
                  {staffRole === "CLINICAL_SPECIALIST" && (
                    <div className="space-y-2 lg:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Specialization</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Maternal-Fetal Medicine, Obstetrics, etc."
                        value={staffSpecialization}
                        onChange={(event) => setStaffSpecialization(event.target.value)}
                      />
                    </div>
                  )}
                </div>

                {staffMessage && (
                  <div
                    className={cn(
                      "rounded-xl px-4 py-3 text-sm font-semibold",
                      staffMessage.type === "success"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : "bg-rose-50 text-rose-700 border border-rose-100"
                    )}
                  >
                    {staffMessage.text}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleCreateStaff}
                    disabled={staffSubmitting}
                    className="rounded-xl text-[10px] font-black uppercase tracking-widest px-6"
                  >
                    {staffSubmitting ? "Creating..." : "Create Staff Account"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

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
