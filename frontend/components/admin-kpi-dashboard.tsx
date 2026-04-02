"use client"

import { useEffect, useState, useMemo } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  Users,
  AlertTriangle,
  BarChart3,
  Activity,
  DollarSign,
  RefreshCw,
  LogOut,
  Globe,
  ChevronDown,
} from "lucide-react"

type Language = "EN" | "SI" | "TA"

interface AdminKPIDashboardProps {
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

interface RiskDriver {
  feature: string
  frequency: number
  percentage: number
  avg_importance: number
}

interface SpecialistWorkload {
  specialist_id: string
  specialist_name: string
  case_count: number
  primary_conditions: Record<string, number>
  avg_severity: number
}

interface CostImpact {
  high_risk_cases_detected_30d: number
  cost_per_case_saved_lkr: number
  estimated_total_savings_lkr: number
  roi_percent: number
}

interface TrendPoint {
  timestamp: string
  case_count: number
  condition: string
  severity_avg: number
}

const getApiBaseCandidates = (): string[] => {
  const candidates: (string | undefined)[] = [
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, ""),
    "http://localhost:8005/api/v1",
    "http://127.0.0.1:8005/api/v1",
  ]

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:"
    const host = window.location.hostname || "localhost"
    candidates.push(`${protocol}//${host}:8005/api/v1`)
  }

  return candidates
    .filter((c): c is string => Boolean(c))
    .reduce((acc: string[], c: string) => (acc.includes(c) ? acc : [...acc, c]), [])
}

export default function AdminKPIDashboard({ onLogout }: AdminKPIDashboardProps) {
  const [language, setLanguage] = useState<Language>("EN")
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [referralData, setReferralData] = useState<ReferralEfficiency | null>(null)
  const [riskDrivers, setRiskDrivers] = useState<RiskDriver[]>([])
  const [specialists, setSpecialists] = useState<SpecialistWorkload[]>([])
  const [costImpact, setCostImpact] = useState<CostImpact | null>(null)
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)

  const getText = (en: string, si: string, ta: string) => {
    if (language === "SI") return si
    if (language === "TA") return ta
    return en
  }

  const getAccessToken = (): string | null => {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem("bloomcare_access_token")
  }

  const apiRequest = async (path: string, init?: RequestInit): Promise<Response> => {
    const token = getAccessToken()
    if (!token) {
      throw new Error("No active session found")
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
      } catch (e) {
        lastError = e
      }
    }

    if (lastError instanceof Error) {
      throw new Error(`Unable to reach API: ${lastError.message}`)
    }
    throw new Error("Unable to reach API")
  }

  const loadAllMetrics = async () => {
    setLoading(true)
    setError(null)
    try {
      const [metricsRes, refRes, drivRes, specRes, costRes, trendRes] = await Promise.all([
        apiRequest("/admin/dashboard-metrics"),
        apiRequest("/admin/referral-efficiency"),
        apiRequest("/admin/top-risk-drivers?limit=5"),
        apiRequest("/admin/specialist-workload"),
        apiRequest("/admin/cost-impact"),
        apiRequest("/admin/case-trends?days_back=30&group_by=day"),
      ])

      if (!metricsRes.ok) throw new Error("Failed to load dashboard metrics")
      if (!refRes.ok) throw new Error("Failed to load referral efficiency data")
      if (!drivRes.ok) throw new Error("Failed to load risk drivers")
      if (!specRes.ok) throw new Error("Failed to load specialist workload")
      if (!costRes.ok) throw new Error("Failed to load cost impact data")
      if (!trendRes.ok) throw new Error("Failed to load case trends")

      const m = (await metricsRes.json()) as DashboardMetrics
      const r = (await refRes.json()) as ReferralEfficiency
      const d = (await drivRes.json()) as { drivers: RiskDriver[] }
      const s = (await specRes.json()) as { specialists: SpecialistWorkload[] }
      const c = (await costRes.json()) as CostImpact
      const t = (await trendRes.json()) as { trends: TrendPoint[] }

      setMetrics(m)
      setReferralData(r)
      setRiskDrivers(d.drivers || [])
      setSpecialists(s.specialists || [])
      setCostImpact(c)
      setTrends(t.trends || [])
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error loading dashboard"
      setError(errorMessage)
      console.error("Dashboard load error:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllMetrics()
  }, [])

  const riskDriverChartData = useMemo(() => {
    return riskDrivers.slice(0, 5).map((d) => ({
      name: d.feature.slice(0, 15),
      percentage: d.percentage,
    }))
  }, [riskDrivers])

  const specialistChartData = useMemo(() => {
    return specialists.map((s) => ({
      name: s.specialist_name.split(" ")[0].slice(0, 8),
      cases: s.case_count,
    }))
  }, [specialists])

  if (loading && !metrics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 animate-bounce text-primary mx-auto mb-4" />
          <p className="text-slate-400">{getText("Loading dashboard...", "ඩැෂ්බෝර්ඩ් පූරණය වෙමින්...", "டாஷ்போர்ட் லோடிங்...")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Bloom<span className="text-primary">Care</span> Analytics
            </h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">
              {getText("Hospital Intelligence Platform", "රෝහල බුද්ධිමත්ගත වේදිකා", "மருத்துவமனை அறிவாளி மঞ்சம்")}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAllMetrics}
              className="text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-medium hover:border-slate-600 flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                {language}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showLanguageMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                  {["EN", "SI", "TA"].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setLanguage(lang as Language)
                        setShowLanguageMenu(false)
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg text-sm font-medium"
                    >
                      {lang === "EN" ? "English" : lang === "SI" ? "සිංහල" : "தமிழ்"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="text-slate-300 hover:text-red-400 hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <Card className="border-red-500/50 bg-red-950/30">
            <CardContent className="p-4 text-red-200 text-sm">{error}</CardContent>
          </Card>
        )}

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    {getText("Total Screenings", "සම්පූර්ණ පරීක්ෂණ", "மொத்த ஸ்கிரீனிங்கள்")}
                  </p>
                  <p className="text-4xl font-black mt-2">{metrics?.total_screenings ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {getText("Stage 1", "අදියර 1", "நிலை 1")}: {metrics?.stage1_screenings_count ?? 0} | {" "}
                    {getText("Stage 2", "අදියර 2", "நிலை 2")}: {metrics?.stage2_screenings_count ?? 0}
                  </p>
                </div>
                <Users className="w-10 h-10 text-primary/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    {getText("High Risk Cases", "ඉහළ අවදානම් අවස්ථා", "அதிக ஆபத்து வழக்குகள்")}
                  </p>
                  <p className="text-4xl font-black mt-2 text-red-400">{metrics?.high_risk_count ?? 0}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-red-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    {getText("Avg Severity", "සාමාන්ය බරවත්කම", "சராசரி கடுமை")}
                  </p>
                  <p className="text-4xl font-black mt-2 text-orange-400">
                    {((metrics?.avg_severity_score ?? 0) * 100).toFixed(0)}%
                  </p>
                </div>
                <Activity className="w-10 h-10 text-orange-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    {getText("Total Patients", "සම්පූර්ණ රෝගීන්", "மொத்த நோயாளிகள்")}
                  </p>
                  <p className="text-4xl font-black mt-2 text-blue-400">{metrics?.total_patients ?? 0}</p>
                </div>
                <Users className="w-10 h-10 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    {getText("Active Clinics", "සක්‍රිය සායනා", "சக்திவாய்ந்த மருத்துவசாலைகள்")}
                  </p>
                  <p className="text-4xl font-black mt-2 text-emerald-400">{metrics?.active_clinics ?? 0}</p>
                </div>
                <BarChart3 className="w-10 h-10 text-emerald-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Referral Efficiency */}
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                {getText("Referral Efficiency", "යුළු කිරීමේ කාර්යක්ෂමතාව", "குறிப்பு திறன்")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">{getText("Conversion Rate", "පරිවර්තන අනුපාතය", "மாற்று விகிதம்")}</p>
                <p className="text-3xl font-black text-cyan-400">
                  {(referralData?.conversion_rate_percent ?? 0).toFixed(1)}%
                </p>
              </div>
              <div className="pt-3 border-t border-slate-700 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">{getText("Stage 1 High Risk", "අදියර 1 ඉහළ අවදානම", "நிலை 1 அதிக ஝ுஂகி")}:</span>
                  <span className="font-bold">{referralData?.stage1_high_risk_total ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{getText("Stage 2 Completed", "අදියර 2 සම්පූර්ණ", "நிலை 2 சம்பூர்ணமாக")}:</span>
                  <span className="font-bold text-emerald-400">{referralData?.stage2_referrals_completed ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{getText("Pending", "බලා සිටින", "நிலுவையில் உள்ள")}:</span>
                  <span className="font-bold text-orange-400">{referralData?.pending_referrals ?? 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Impact */}
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="w-5 h-5 text-green-400" />
                {getText("Cost Savings", "වියදම් සාムර්ථ්ය", "செலவு சேமிப்பு")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">{getText("Estimated Savings (30d)", "ඇස්තමේන්තුගත ඉතිරි (30 දින)", "மதிப்பிடப்பட்ட சேமிப்பு (30 நாட்கள்)")} </p>
                <p className="text-3xl font-black text-green-400">
                  LKR {((costImpact?.estimated_total_savings_lkr ?? 0) / 1000000).toFixed(1)}M
                </p>
              </div>
              <div className="pt-3 border-t border-slate-700 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">{getText("High-Risk Cases", "ඉහළ-අවදානම් අවස්ථා", "அதிக ஆபத்து வழக்குகள்")}:</span>
                  <span className="font-bold">{costImpact?.high_risk_cases_detected_30d ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{getText("Cost per Case", "අවස්ථාවක් සඳහා වියදම", "வழக்கு ஒன்றுக்கான செலவு")}:</span>
                  <span className="font-bold">LKR {((costImpact?.cost_per_case_saved_lkr ?? 0) / 1000).toFixed(0)}K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{getText("Program ROI", "වැඩසටහන් ROI", "நிரல் ROI")}:</span>
                  <span className="font-bold text-green-400">{(costImpact?.roi_percent ?? 0).toFixed(0)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Specialist Utilization */}
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-purple-400" />
                {getText("Specialist Workload", "විශේෂඥ පටිපාටිය", "நிபுணர் பணிச்சுமை")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">{getText("Active Specialists", "සක්‍රිය විශේෂඥ", "செயலில் உள்ள நிபுணர்")}</p>
                <p className="text-3xl font-black text-purple-400">{specialists.length}</p>
              </div>
              <div className="pt-3 border-t border-slate-700 space-y-2 max-h-40 overflow-y-auto">
                {specialists.map((s) => (
                  <div key={s.specialist_id} className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 truncate">{s.specialist_name}</span>
                    <Badge variant="outline" className="border-purple-500/50 text-purple-300 text-xs">
                      {s.case_count} cases
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Risk Drivers Bar Chart */}
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardHeader>
              <CardTitle>{getText("Top Risk Drivers", "ඉහළ අවදානම් සාරිලි", "முக்கிய ஝ுஂகி ஓட்டுநர்")}</CardTitle>
              <CardDescription className="text-slate-400">
                {getText("Features contributing to high-risk classification", "ඉහළ අවදානම සඳහා දායක වන විශේෂ", "உச්చ ஝ுஂகி வகைப்பாட்டிற்கு பங்களிக்கும் அம்சங்கள்")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {riskDriverChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={riskDriverChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #475569",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="percentage" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-400 py-8">{getText("No data available", "තොරතුරු නැත", "தரவு கிடைக்கவில்லை")}</p>
              )}
            </CardContent>
          </Card>

          {/* Specialist Workload Chart */}
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardHeader>
              <CardTitle>{getText("Specialist Caseload", "විශේෂඥ අවස්ථා විතර", "நிபுணர் கேस பணி")}</CardTitle>
              <CardDescription className="text-slate-400">
                {getText("Cases per specialist", "එක් විශේෂඥ එක", "நிபுணர் ஒன்றுக்கான வழக்குகள்")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {specialistChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={specialistChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #475569",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="cases" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-400 py-8">{getText("No data available", "තොරතුරු නැත", "தரவு கிடைக்கவில்லை")}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Case Trends Chart */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle>{getText("Case Trends Over Time", "කාලය අනුව අවස්ථා ඉතිහාසය", "கால சுழற்சிகளில் வழக்கு போக்குகள்")}</CardTitle>
            <CardDescription className="text-slate-400">
              {getText("Daily case volume and severity trends", "දෛනික අවස්ථා පරිමාණය සහ බරවත්කම ඉතිහාසය", "தினசரி வழக்கு நிலைய மற்றும் கடுமை போக்குகள்")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trends.map((t) => ({ ...t, date: new Date(t.timestamp).toLocaleDateString() }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                  />
                  <Area type="monotone" dataKey="case_count" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-slate-400 py-8">{getText("No data available", "තොරතුරු නැත", "தரவு கிடைக்கவில்லை")}</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
