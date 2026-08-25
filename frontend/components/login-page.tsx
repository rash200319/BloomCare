"use client"

import { useState } from "react"
import {
  Heart,
  User,
  Lock,
  Globe,
  Stethoscope,
  UserCircle,
  Shield,
  Baby,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Phone,
  ArrowRight,
  BarChart3
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { apiRequest, DEMO_CREDENTIALS, DEMO_LOGIN_ENABLED, type DemoLoginRole } from "@/lib/api"

type UserRole = "frontline" | "doctor" | "admin" | "patient"
type Language = "EN" | "SI" | "TA"

interface LoginPageProps {
  onLogin: (role: UserRole) => void
  onBack?: () => void
}

const roleOptions = [
  {
    id: "doctor" as UserRole,
    title: "Obstetrician",
    titleSi: "ප්‍රසව වෛද්‍ය",
    titleTa: "மகப்பேறு மருத்துவர்",
    description: "Clinical Risk Management",
    descriptionSi: "සායනික අවදානම් කළමනාකරණය",
    descriptionTa: "மருத்துவ அபாய மேலாண்மை",
    icon: UserCircle,
    color: "bg-accent"
  },
  {
    id: "frontline" as UserRole,
    title: "Frontline Staff",
    titleSi: "මුල් පෙළ කාර්ය මණ්ඩලය",
    titleTa: "முன்னணி ஊழியர்கள்",
    description: "Nurses & Community Workers",
    descriptionSi: "හෙදියන් සහ ප්‍රජා කාර්යකරුවන්",
    descriptionTa: "செவிலியர்கள் & சமூக ஊழியர்கள්",
    icon: Stethoscope,
    color: "bg-primary"
  },
  {
    id: "patient" as UserRole,
    title: "Patient Portal",
    titleSi: "රෝගී ද්වාරය",
    titleTa: "நோயாளி போர்டல்",
    description: "Expectant Mothers",
    descriptionSi: "ගර්භනී මව්වරුන්",
    descriptionTa: "தாய்மார்கள්",
    icon: Baby,
    color: "bg-amber-500"
  },
  {
    id: "admin" as UserRole,
    title: "Hospital Admin",
    titleSi: "රෝහල් පරිපාලක",
    titleTa: "நிர்வாகி",
    description: "Analytics & Oversight",
    descriptionSi: "විශ්ලේෂණ සහ අධීක්ෂණය",
    descriptionTa: "பகுப்பாய்வு மற்றும் மேற்பார்வை",
    icon: BarChart3,
    color: "bg-slate-700"
  }
]

export default function LoginPage({ onLogin, onBack }: LoginPageProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [language, setLanguage] = useState<Language>("EN")
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [temporaryPassword, setTemporaryPassword] = useState("")
  const [isFirstLoginMode, setIsFirstLoginMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const fromApiRole = (role: string): UserRole => {
    const upper = String(role || "").toUpperCase()
    if (upper === "FRONTLINE_STAFF") return "frontline"
    if (upper === "DOCTOR" || upper === "CLINICAL_SPECIALIST" || upper === "OBSERTITIAN") return "doctor"
    if (upper === "ADMIN") return "admin"
    if (upper === "PATIENT") return "patient"
    throw new Error(`Unknown account role: ${role || "(missing)"}`)
  }

  const getText = (en: string, si: string, ta: string) => {
    if (language === "SI") return si
    if (language === "TA") return ta
    return en
  }

  const isPatientRole = selectedRole === "patient"
  const demoForRole =
    DEMO_LOGIN_ENABLED &&
    selectedRole &&
    selectedRole !== "admin" &&
    selectedRole in DEMO_CREDENTIALS
      ? DEMO_CREDENTIALS[selectedRole as DemoLoginRole]
      : null

  const getIdentifierLabel = () => {
    if (isPatientRole) {
      return getText("National ID", "ජාතික හැඳුනුම්පත් අංකය", "தேசிய அடையாள எண்")
    }
    return getText("Email", "ඊමේල්", "மின்னஞ்சல்")
  }

  const getIdentifierPlaceholder = () => {
    if (!demoForRole) return ""
    return demoForRole.identifier
  }

  const fillDemoCredentials = () => {
    if (!demoForRole) return
    setIdentifier(demoForRole.identifier)
    setPassword(demoForRole.password)
    setErrorMessage("")
  }

  const getIdentifierPayload = () => {
    if (isPatientRole) {
      return { national_id: identifier }
    }
    return { email: identifier }
  }

  const parseApiError = async (response: Response, fallback: string) => {
    const err = await response.json().catch(() => ({}))
    const detail = (err as { detail?: unknown })?.detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          typeof item === "string"
            ? item
            : item && typeof item === "object" && "msg" in item
              ? String((item as { msg: unknown }).msg)
              : JSON.stringify(item),
        )
        .join("; ")
    }
    return fallback
  }

  const handleLogin = async () => {
    if (!selectedRole || !identifier || !password) {
      setErrorMessage(getText("Please fill all required fields.", "අවශ්‍ය සියලු ක්ෂේත්‍ර පුරවන්න.", "அனைத்து தேவையான புலங்களையும் நிரப்பவும்."))
      return
    }

    if (isFirstLoginMode && (!temporaryPassword || !confirmPassword)) {
      setErrorMessage(getText(
        "Enter temporary password, new password, and confirmation.",
        "තාවකාලික මුරපදය, නව මුරපදය සහ තහවුරු කිරීම ඇතුළත් කරන්න.",
        "தற்காலிக கடவுச்சொல், புதிய கடவுச்சொல் மற்றும் உறுதிப்படுத்தலை உள்ளிடவும்."
      ))
      return
    }

    if (isFirstLoginMode && password !== confirmPassword) {
      setErrorMessage(getText("Passwords do not match.", "මුරපද ගැළපෙන්නේ නැත.", "கடவுச்சொற்கள் பொருந்தவில்லை."))
      return
    }

    setErrorMessage("")
    setIsLoading(true)

    try {
      if (isFirstLoginMode) {
        const setupEndpoint = isPatientRole ? "/auth/first-login/patient" : "/auth/first-login/staff"
        const setupResponse = await apiRequest(setupEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...getIdentifierPayload(),
            temporary_password: temporaryPassword,
            password,
            confirm_password: confirmPassword,
          }),
        })

        if (!setupResponse.ok) {
          const detail = await parseApiError(setupResponse, "Password setup failed")
          if (detail.toLowerCase().includes("password already set")) {
            setIsFirstLoginMode(false)
            setConfirmPassword("")
            setErrorMessage(getText(
              "Password already set. Please sign in.",
              "මුරපදය දැනටමත් සකසා ඇත. කරුණාකර පුරනය වන්න.",
              "கடவுச்சொல் ஏற்கனவே அமைக்கப்பட்டுள்ளது. தயவுசெய்து உள்நுழையவும்."
            ))
            return
          }
          throw new Error(detail)
        }

        setIsFirstLoginMode(false)
        setConfirmPassword("")
        setErrorMessage(getText(
          "Password set successfully. Please sign in.",
          "මුරපදය සාර්ථකව සකසා ඇත. දැන් පුරනය වන්න.",
          "கடவுச்சொல் வெற்றிகரமாக அமைக்கப்பட்டது. தயவுசெய்து உள்நுழையவும்."
        ))
        return
      }

      const loginEndpoint = isPatientRole ? "/auth/login/patient" : "/auth/login/staff"
      const loginResponse = await apiRequest(loginEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...getIdentifierPayload(),
          password,
        }),
      })

      if (!loginResponse.ok) {
        throw new Error(await parseApiError(loginResponse, "Sign in failed"))
      }

      const tokenData = await loginResponse.json()

      // ✅ Extract actual role from backend response
      const actualBackendRole = fromApiRole(tokenData.role)

      // ✅ VALIDATION: Verify backend role matches user's form selection
      if (actualBackendRole !== selectedRole) {
        throw new Error(
          getText(
            `Access Denied: You are registered as ${tokenData.role}, but tried to access as ${selectedRole}. Your account can only access the ${actualBackendRole} role.`,
            `ප්‍රවේශ අවලංගු: ඔබ ${tokenData.role} ලෙස ලියාපදිංචි වී ඉන්නෙමු, නමුත් ${selectedRole} ලෙස ප්‍රවේශ හැකි විය නොහැක. ඔබගේ ගිණුම හැකිවෙයි ඇත්තේ ${actualBackendRole} භූමිකාවට පමණි.`,
            `அணுக வேண்டிய நിবంధனைகள் மீறப்பட்டுள்ளது: நீங்கள் ${tokenData.role} ஆகப் பதிவு செய்யப்பட்டுள்ளீர்கள், ஆனால் ${selectedRole} ஆக அணுக முயற்சி செய்தீர்கள். உங்கள் கணக்கு அணுக முடிய வேண்டும் ${actualBackendRole} பாத்திரத்திற்கு மட்டுமே.`
          )
        )
      }

      // ✅ AUTHORIZATION: Call backend dashboard endpoint to verify access rights
      const dashboardEndpointMap: Record<UserRole, string> = {
        'frontline': '/dashboard/frontline/dashboard',
        'doctor': '/dashboard/doctor/dashboard',
        'admin': '/dashboard/admin/dashboard',
        'patient': '/dashboard/patient/dashboard'
      }

      const accessToken = tokenData.access_token
      const dashboardEndpoint = dashboardEndpointMap[actualBackendRole]

      const dashboardResponse = await apiRequest(dashboardEndpoint, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      })

      if (dashboardResponse.status === 403) {
        throw new Error(
          getText(
            "You do not have permission to access this dashboard.",
            "ඔබට මෙම ඩ්‍යාෂ්බෝර්ඩ ප්‍රවේශ කිරීමට අනුමතి නොමැත.",
            "இந்த டாஷ்போர்டை அணுக உங்களுக்கு அনுமதி இல்லை."
          )
        )
      }

      if (!dashboardResponse.ok) {
        throw new Error(await parseApiError(dashboardResponse, "Failed to verify dashboard access"))
      }

      // ✅ Store both token and full profile data
      if (typeof window !== "undefined") {
        window.localStorage.setItem("bloomcare_access_token", tokenData.access_token)
        window.localStorage.setItem("bloomcare_user_profile", JSON.stringify(tokenData))
      }

      // ✅ Trigger login with actual backend role (not selected role)
      onLogin(actualBackendRole)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed"
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col relative font-sans overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src="/images/mother-baby-shadow.png"
          alt=""
          className="w-full h-full object-cover opacity-10 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-white via-white/40 to-white/90" />
      </div>

      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/5 rounded-full blur-[120px]" />

      {/* Header */}
      <header className="w-full bg-white/50 backdrop-blur-md border-b border-slate-100 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-400 hover:text-primary transition-all group"
              >
                <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                <span className="text-xs font-bold uppercase tracking-widest">{getText("Back", "ආපසු", "பின்செல்")}</span>
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">BloomCare</h1>
                <p className="text-[10px] font-bold text-primary tracking-widest uppercase -mt-1">
                  {getText("Maternal Risk Intelligence", "මාතෘ අවදානම් බුද්ධිය", "தாய்வழி ஆபத்து நுண்ணறிவு")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-rose-50 rounded-full border border-rose-100">
              <Phone className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">0117 888 888</span>
            </div>

            <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
              <SelectTrigger className="w-[110px] bg-white rounded-xl border-slate-200 text-xs font-bold shadow-sm">
                <Globe className="w-4 h-4 mr-2 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                <SelectItem value="EN" className="text-xs font-bold uppercase tracking-widest">English</SelectItem>
                <SelectItem value="SI" className="text-xs font-bold uppercase tracking-widest">සිංහල</SelectItem>
                <SelectItem value="TA" className="text-xs font-bold uppercase tracking-widest">தமிழ்</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
              {getText("Welcome Back", "නැවත සාදරයෙන් පිළිගනිමු", "வரவேற்கிறோம்")}
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto font-medium leading-relaxed">
              {getText("Excellence in maternal care powered by advanced predictive AI.", "උසස් AI මගින් බලගැන්වූ විශිෂ්ට මාතෘ රැකවරණය.", "மேம்பட்ட AI மூலம் தாய்வழி பராமரிப்பு.")}
            </p>
          </div>

          {!selectedRole ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {roleOptions.map((role) => (
                <Card
                  key={role.id}
                  className="group cursor-pointer border-0 glass shadow-2xl shadow-slate-200/50 transition-all duration-500 hover:shadow-primary/20 hover:-translate-y-3 overflow-hidden"
                  onClick={() => setSelectedRole(role.id)}
                >
                  <div className={cn("h-1.5 w-full", role.color)} />
                  <CardContent className="p-8 text-center relative">
                    <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl transition-transform group-hover:scale-110 group-hover:rotate-3", role.color)}>
                      <role.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-3 group-hover:text-primary transition-colors">
                      {language === "EN" ? role.title : language === "SI" ? role.titleSi : role.titleTa}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 leading-relaxed px-4 opacity-70">
                      {language === "EN" ? role.description : language === "SI" ? role.descriptionSi : language === "TA" ? role.descriptionTa : ""}
                    </p>
                    <div className="mt-10 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0">
                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Select</span>
                      <ArrowRight className="w-3 h-3 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <Card className="border-0 glass shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
                <div className={cn("h-2 w-full", roleOptions.find(r => r.id === selectedRole)?.color)} />
                <CardHeader className="text-center pb-8 pt-10">
                  <div className={cn("w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl", roleOptions.find(r => r.id === selectedRole)?.color)}>
                    {(() => {
                      const Icon = roleOptions.find(r => r.id === selectedRole)?.icon || User
                      return <Icon className="w-10 h-10 text-white" />
                    })()}
                  </div>
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                    {getText("Sign In", "පුරනය වන්න", "உள்நுழை")}
                  </CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">
                    {language === "EN" ? roleOptions.find(r => r.id === selectedRole)?.title : language === "SI" ? roleOptions.find(r => r.id === selectedRole)?.titleSi : roleOptions.find(r => r.id === selectedRole)?.titleTa}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 px-12 pb-12">
                  {errorMessage && (
                    <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 mb-2">
                      <p className="text-[11px] font-bold text-rose-700">{errorMessage}</p>
                    </div>
                  )}
                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                      {getIdentifierLabel()}
                    </Label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                      <Input
                        id="email"
                        type={isPatientRole ? "text" : "email"}
                        placeholder={getIdentifierPlaceholder()}
                        className="h-12 pl-12 bg-white/50 border-slate-100 focus:border-primary/30 focus:ring-primary/10 rounded-xl transition-all font-bold text-slate-800"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                      {getText("Password", "මුරපදය", "கடவுச்சொல்")}
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="h-12 pl-12 pr-12 bg-white/50 border-slate-100 focus:border-primary/30 focus:ring-primary/10 rounded-xl transition-all font-bold text-slate-800"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {isFirstLoginMode && (
                    <div className="space-y-3">
                      <Label htmlFor="temporary-password" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                        {getText("Temporary Password", "තාවකාලික මුරපදය", "தற்காலிக கடவுச்சொல்")}
                      </Label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                        <Input
                          id="temporary-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="h-12 pl-12 bg-white/50 border-slate-100 focus:border-primary/30 focus:ring-primary/10 rounded-xl transition-all font-bold text-slate-800"
                          value={temporaryPassword}
                          onChange={(e) => setTemporaryPassword(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {isFirstLoginMode && (
                    <div className="space-y-3">
                      <Label htmlFor="confirm-password" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                        {getText("Confirm Password", "මුරපදය තහවුරු කරන්න", "கடவுச்சொல்லை உறுதிப்படுத்தவும்")}
                      </Label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                        <Input
                          id="confirm-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="h-12 pl-12 bg-white/50 border-slate-100 focus:border-primary/30 focus:ring-primary/10 rounded-xl transition-all font-bold text-slate-800"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="w-4 h-4 rounded border-slate-200 text-primary focus:ring-primary/20" />
                      <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-700 uppercase tracking-wider">{getText("Remember", "මතක", "நினைவில்")}</span>
                    </label>
                  </div>

                  <div className="pt-2">
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-white h-14 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] font-black uppercase tracking-[0.2em] text-xs"
                      onClick={handleLogin}
                      disabled={!identifier || !password || (isFirstLoginMode && (!temporaryPassword || !confirmPassword)) || isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-3">
                          <span className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                          {getText("Wait...", "මඳක් ඉන්න...", "காத்திருக்க...")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          {isFirstLoginMode
                            ? getText("Set Password", "මුරපදය සකසන්න", "கடவுச்சொல்லை அமைக்க")
                            : getText("Sign In", "පුරනය වන්න", "உள்நுழை")}
                          <ChevronRight className="w-5 h-5" />
                        </span>
                      )}
                    </Button>
                  </div>

                  {selectedRole !== "admin" && (
                    <Button
                      variant="ghost"
                      className="w-full text-[10px] font-black text-primary hover:text-primary uppercase tracking-[0.2em] h-10"
                      onClick={() => {
                        setIsFirstLoginMode(!isFirstLoginMode)
                        setPassword("")
                        setConfirmPassword("")
                        setTemporaryPassword("")
                        setErrorMessage("")
                      }}
                    >
                      {isFirstLoginMode
                        ? getText("Back to Sign In", "පුරනයට ආපසු", "உள்நுழைவுக்கு திரும்பு")
                        : getText("First Time Access? Set Password", "පළමු ප්‍රවේශයද? මුරපදය සකසන්න", "முதல் அணுகலா? கடவுச்சொல் அமைக்க")}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    className="w-full text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-[0.2em] h-10"
                    onClick={() => {
                      setSelectedRole(null)
                      setIdentifier("")
                      setPassword("")
                      setConfirmPassword("")
                      setIsFirstLoginMode(false)
                      setErrorMessage("")
                    }}
                  >
                    {getText("Change Role", "කාර්යභාරය වෙනස් කරන්න", "பங்கை மாற்றவும்")}
                  </Button>
                </CardContent>
              </Card>

              {/* Demo Credentials — gated; admin intentionally omitted */}
              {DEMO_LOGIN_ENABLED && demoForRole && (
              <div className="mt-8 p-8 bg-slate-50/50 border border-slate-100 rounded-3xl backdrop-blur-sm shadow-inner">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Demo Credentials</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-200"
                    onClick={fillDemoCredentials}
                  >
                    Autofill
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-5 py-3 bg-white/50 rounded-xl border border-white gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">
                      {demoForRole?.label || "ID"}
                    </span>
                    <span className="text-xs font-black text-slate-800 text-right break-all">
                      {demoForRole?.identifier || "—"}
                    </span>
                  </div>
                  {selectedRole === "patient" && (
                    <div className="flex items-center justify-between px-5 py-3 bg-white/50 rounded-xl border border-white gap-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Alt NIC</span>
                      <span className="text-xs font-black text-slate-800 text-right break-all">
                        {DEMO_CREDENTIALS.patient.altIdentifier}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-5 py-3 bg-white/50 rounded-xl border border-white">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Password</span>
                    <span className="text-xs font-black text-slate-800">{demoForRole?.password || "rash2003"}</span>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white/50 backdrop-blur-md border-t border-slate-100 px-6 py-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-4">
            <Heart className="w-5 h-5 text-primary opacity-30" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              © 2026 BloomCare. {getText("All rights reserved.", "සියලු හිමිකම් ඇවිරිණි.", "அனைத்து உரிமைகளும்.")}
            </p>
          </div>
          <div className="flex items-center gap-10">
            {["Privacy", "Terms", "Support"].map((link) => (
              <a key={link} href="#" className="text-[10px] font-black text-slate-300 hover:text-primary transition-colors uppercase tracking-[0.2em]">{link}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
