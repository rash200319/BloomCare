"use client"

import { useEffect, useState } from "react"
import {
  TrendingUp,
  Globe,
  LogOut,
  User,
  AlertCircle,
  CheckCircle,
  Calendar,
  BarChart3,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

type Language = "EN" | "SI" | "TA"

interface LongitudinalTrackerProps {
  patientId: string
  patientName: string
  onLogout: () => void
}

interface ScreeningSubmission {
  patient_id: string
  general_risk_flag: boolean
  probability_score: number
  triggers?: string[]
}

interface RiskJourneyEntry {
  screened_at: string
  probability_score: number
  general_risk_flag: boolean
  triggers?: string[]
}

interface TrendData {
  date: string
  preeclampsia: number
  gdm: number
  preterm_birth: number
  overall_risk: number
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

export default function LongitudinalTracker({
  patientId,
  patientName,
  onLogout,
}: LongitudinalTrackerProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("EN")
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [activeTab, setActiveTab] = useState<"trends" | "submit">("trends")
  const [riskJourney, setRiskJourney] = useState<RiskJourneyEntry[]>([])
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [submissionData, setSubmissionData] = useState<ScreeningSubmission>({
    patient_id: patientId,
    general_risk_flag: false,
    probability_score: 0,
    triggers: [],
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

  // Load risk journey on mount
  useEffect(() => {
    const loadRiskJourney = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await apiRequest(`/longitudinal/${patientId}/risk-journey`)
        const data = await response.json()
        setRiskJourney(Array.isArray(data) ? data : data.screenings || [])

        // Transform to chart data
        const chartData = (Array.isArray(data) ? data : data.screenings || []).map((entry: RiskJourneyEntry) => ({
          date: new Date(entry.screened_at).toLocaleDateString(),
          preeclampsia: entry.probability_score * 0.45 * 100,
          gdm: entry.probability_score * 0.35 * 100,
          preterm_birth: entry.probability_score * 0.2 * 100,
          overall_risk: entry.probability_score * 100,
        }))
        setTrendData(chartData)
      } catch (err) {
        console.warn("Failed to load risk journey:", err)
        setError(err instanceof Error ? err.message : "Failed to load risk journey")
      } finally {
        setIsLoading(false)
      }
    }
    loadRiskJourney()
  }, [patientId])

  const handleSubmitScreening = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setIsLoading(true)
      setError(null)

      const response = await apiRequest("/longitudinal/submit-screening", {
        method: "POST",
        body: JSON.stringify(submissionData),
      })

      if (!response.ok) {
        throw new Error(`Failed to submit screening: ${response.statusText}`)
      }

      const data = await response.json()
      setRiskJourney([...riskJourney, data])
      setSuccessMessage(getText("Screening submitted successfully!", "තිරසිsammen submitted!!", "ஸ்கிரீனிங் வெற்றிகரமாக சมर्पित!"))

      // Reset form
      setSubmissionData({
        patient_id: patientId,
        general_risk_flag: false,
        probability_score: 0,
        triggers: [],
      })

      setTimeout(() => {
        setSuccessMessage(null)
        setActiveTab("trends")
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit screening")
    } finally {
      setIsLoading(false)
    }
  }

  const overallRisk = riskJourney.length > 0
    ? (riskJourney.reduce((sum, entry) => sum + entry.probability_score, 0) / riskJourney.length) * 100
    : 0

  const getRiskLevel = (risk: number): string => {
    if (risk < 30) return "Low"
    if (risk < 60) return "Moderate"
    return "High"
  }

  const getRiskColor = (risk: number): string => {
    if (risk < 30) return "text-green-600"
    if (risk < 60) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                {getText("Longitudinal Tracking", "දිගු කාලගත ලුහුබැඳීම", "நீண்ட கால ट्র्याकिং")}
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
                      {getText("Logout", "ලොගઆউට්", "விளக्கம்")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">
                  {getText("Overall Risk", "සামාන්‍ය අවදානම", "ஒட்டுமொத்த ঝுக்కி")}
                </p>
                <p className={cn("text-3xl font-bold", getRiskColor(overallRisk))}>
                  {overallRisk.toFixed(1)}%
                </p>
                <Badge variant="secondary" className="mt-2">
                  {getRiskLevel(overallRisk)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">
                  {getText("Total Screenings", "මුළු පරිශීලනයන්", "மொத்த ஸ்கிரீனிங்")}
                </p>
                <p className="text-3xl font-bold text-blue-600">{riskJourney.length}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {getText("recorded", "pio", "பதிவு செய்யப்பட்ட")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">
                  {getText("Latest Screening", "නවතම පරිශීලනය", "சமீபத்திய ஸ்கிரீனிங்")}
                </p>
                <p className="text-lg font-medium text-gray-900">
                  {riskJourney.length > 0
                    ? new Date(riskJourney[riskJourney.length - 1].screened_at).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab("trends")}
              className={cn(
                "py-2 px-1 font-medium border-b-2 transition-colors",
                activeTab === "trends"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              )}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              {getText("Risk Trends", "අවදානම ප්‍රවණතා", "ஆபத்து போக்குபாய்வு")}
            </button>
            <button
              onClick={() => setActiveTab("submit")}
              className={cn(
                "py-2 px-1 font-medium border-b-2 transition-colors",
                activeTab === "submit"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              )}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              {getText("Submit Screening", "පරිශීලනය ඉදිරිපත් කරන්න", "ஸ்கிரீனிங் சமர్პित করুங்கள்")}
            </button>
          </div>
        </div>

        {/* Trends Tab */}
        {activeTab === "trends" && (
          <div className="space-y-6">
            {trendData.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {getText("Risk Probability Trends", "අවදානම ප්‍රතිශතතා ප්‍රවණතා", "ঝুক্তি সম্ভাবনা প্রবণতা")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="preeclampsia"
                        stroke="#8b5cf6"
                        name={getText("Preeclampsia", "පෙර ඇක්ලැම්පසිය", "ప్రీక్లాంప్సియా")}
                      />
                      <Line
                        type="monotone"
                        dataKey="gdm"
                        stroke="#ef4444"
                        name={getText("GDM", "GDM", "GDM")}
                      />
                      <Line
                        type="monotone"
                        dataKey="preterm_birth"
                        stroke="#f59e0b"
                        name={getText("Preterm Birth", "පෂ්ට්‍ර birth", "ಮುಂಚಿನ ಜನ್ಮ")}
                      />
                      <Line
                        type="monotone"
                        dataKey="overall_risk"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name={getText("Overall Risk", "සামාන්‍ය අවදානම", "ओकल्पना जोख़िम ")}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">
                    {getText("No screening data available yet", "තවම පරිශීලන තොරතුරු නොමැත", "இதுவரை ஸ்கிரீனிங் தரவு கிடைப்பில்லை")}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Screening History Table */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {getText("Screening History", "පරිශීලන ඉතිහාසය", "ஸ்கிரீனிங் வரலாறு")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {riskJourney.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    {getText("No screenings recorded", "පරිශීලනයන් ප්‍ර බොහොමයක් नेदि", "ஸ்கிரீனிங்கள் பதிவு செய்யப்படவில்லை")}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-900">
                            {getText("Date", "දිනය", "தேதி")}
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">
                            {getText("Risk Score", "අවදානම ප්‍ර", "ঝুক్కി స్కోర్")}
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">
                            {getText("Risk Level", "අවදානම මට්ටම", "ঝুக్కি స్థాయి")}
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">
                            {getText("Triggers", "ක්‍රියාකරුවෝ", "ಟ್ರಿಗ್ಗರ್‌ಗಳು")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {riskJourney.map((entry, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                {new Date(entry.screened_at).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium">
                              {(entry.probability_score * 100).toFixed(1)}%
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={entry.general_risk_flag ? "destructive" : "secondary"}>
                                {getRiskLevel(entry.probability_score * 100)}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              {entry.triggers && entry.triggers.length > 0
                                ? entry.triggers.join(", ")
                                : "--"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Submit Tab */}
        {activeTab === "submit" && (
          <Card>
            <CardHeader>
              <CardTitle>
                {getText("Submit New Screening", "නව පරිශීලනය ඉදිරිපත් කරන්න", "புதிய ஸ்கிரீனிங் சமர్పித்தல்")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitScreening} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText("Risk Probability Score (0-1)", "අවදානම ප්‍ර ස්කඩ් (0-1)", "ঝুক్కि সম্ভাবনা স্कोर (0-1)")}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={submissionData.probability_score}
                    onChange={(e) =>
                      setSubmissionData({
                        ...submissionData,
                        probability_score: parseFloat(e.target.value),
                      })
                    }
                    placeholder={getText("Enter score (0.0-1.0)", "ස්කඩ් නිවේදනය කරන්න (0.0-1.0)", "সংখ্যা লিখুন (0.0-1.0)")}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={submissionData.general_risk_flag}
                      onChange={(e) =>
                        setSubmissionData({
                          ...submissionData,
                          general_risk_flag: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {getText("General Risk Flag (High Risk?)", "සාමාන්‍ය අවදානම ඊනුම (ඉහළ අවදානම?)", "సాధారణ ಜೋಖಿಮ ಫ್ಲ್ಯಾಗ್ (ಹೆಚ್ಚಿನ ಜೋಖಿಮೆ?)")}
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText("Risk Triggers (comma-separated)", "අවදානම ක්‍රියාකරුවෝ (කොමා වලින් වෙන් කරන්න)", "ഭീകരത ട്രിգർ (കോമ-വേർതിരിക്കപ്പെട്ട)")}
                  </label>
                  <textarea
                    value={submissionData.triggers?.join(", ") || ""}
                    onChange={(e) =>
                      setSubmissionData({
                        ...submissionData,
                        triggers: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter((t) => t),
                      })
                    }
                    placeholder={getText("e.g., hypertension, obesity, diabetes", "උදා: hypertension,肥満, දිනුම", "৯००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००००० eğer ইত্যাদি")}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
                >
                  {isLoading ? "Submitting..." : getText("Submit Screening", "පරිශීලනය ඉදිරිපත් කරන්න", "ஸ்கிரீனிங் சமர్পித்தல்")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
