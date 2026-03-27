"use client"

import { useState } from "react"
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
  Stethoscope
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Dummy patient data
const patients = [
  { id: "P-2024-001", name: "Kumari Perera", status: "assessed", time: "09:15 AM" },
  { id: "P-2024-002", name: "Nimalka Fernando", status: "waiting", time: "09:30 AM" },
  { id: "P-2024-003", name: "Sanduni Silva", status: "waiting", time: "09:45 AM" },
  { id: "P-2024-004", name: "Dilhani Jayawardena", status: "assessed", time: "10:00 AM" },
  { id: "P-2024-005", name: "Chamari Wickramasinghe", status: "waiting", time: "10:15 AM" },
  { id: "P-2024-006", name: "Rashmi Bandara", status: "waiting", time: "10:30 AM" },
  { id: "P-2024-007", name: "Thilini Rajapaksa", status: "assessed", time: "10:45 AM" },
  { id: "P-2024-008", name: "Anusha Gunawardena", status: "waiting", time: "11:00 AM" },
]

const languages = [
  { code: "EN", label: "English" },
  { code: "SI", label: "Sinhala" },
  { code: "TA", label: "Tamil" },
]

interface FrontlineTriageDashboardProps {
  onLogout: () => void
}

export default function FrontlineTriageDashboard({ onLogout }: FrontlineTriageDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState(patients[1])
  const [selectedLanguage, setSelectedLanguage] = useState("EN")
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [resultView, setResultView] = useState<"low" | "high">("low")
  const [showResult, setShowResult] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    patientName: "Nimalka Fernando",
    age: "28",
    systolic: "120",
    diastolic: "80",
    bmi: "24.5",
    heartRate: "78",
    temperature: "36.8",
  })

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCalculateRisk = () => {
    setShowResult(true)
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans selection:bg-primary/20 relative overflow-hidden">
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
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 rotate-3 hover:rotate-0 transition-transform duration-500">
              <Stethoscope className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">Bloom<span className="text-primary">Care</span></h1>
              <p className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">
                Hemas Hospitals Intelligence
              </p>
            </div>
          </div>
          
          <div className="h-8 w-px bg-slate-100 hidden sm:block" />
          
          <div className="hidden lg:flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-100">
            <Button variant="ghost" size="sm" className="h-8 rounded-lg bg-white shadow-sm font-black text-[10px] uppercase tracking-widest text-primary">
              <LayoutDashboard className="w-3.5 h-3.5 mr-2" />
              Triage
            </Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <ClipboardList className="w-3.5 h-3.5 mr-2" />
              Registry
            </Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <History className="w-3.5 h-3.5 mr-2" />
              History
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wattala Clinic</p>
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
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Patient Queue (1/3 width) */}
        <aside className="w-1/4 bg-white/40 backdrop-blur-md border-r border-slate-100 flex flex-col min-w-[320px]">
          <div className="p-6">
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
                  temperature: "",
                })
                setShowResult(false)
              }}
            >
              <Plus className="w-5 h-5 mr-3" />
              New Screening
            </Button>
          </div>

          <div className="px-6 pb-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-12 bg-white/50 border-slate-100 focus:border-primary/30 focus:ring-primary/10 rounded-xl transition-all font-bold text-xs"
              />
            </div>
          </div>

          <div className="px-8 pb-4 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Today&apos;s Queue
            </h3>
            <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full">
              {filteredPatients.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
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

          <div className="p-8 border-t border-slate-100 bg-white/50 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assessed Today</p>
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
        <main className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Top Half - Vitals Form */}
            <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-[32px]">
              <div className="h-2 w-full bg-bloom-gradient opacity-80" />
              <CardHeader className="pb-8 pt-8 px-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      Vitals Entry
                    </CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Standardized Screening Protocol
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-10 pb-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Patient Name */}
                  <div className="md:col-span-2 space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                      Patient Full Name
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
                      Age (Years)
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
                      Blood Pressure (mmHg)
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
                      BMI Index
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
                      Heart Rate (bpm)
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
                      Temperature (°C)
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
                </div>

                <div className="mt-10 flex justify-end">
                  <Button
                    onClick={handleCalculateRisk}
                    className="bg-bloom-gradient hover:opacity-90 text-white font-black px-10 h-16 rounded-2xl shadow-xl shadow-primary/30 text-xs uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] border-0"
                  >
                    <ShieldCheck className="w-5 h-5 mr-3" />
                    Analyze Risk Level
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bottom Half - Result Area */}
            <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 rounded-[32px]">
              <div className="h-2 w-full bg-slate-100" />
              <CardHeader className="pb-6 pt-8 px-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                      <Stethoscope className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">
                        Risk Assessment Summary
                      </CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        AI-Based Predictive Analysis
                      </CardDescription>
                    </div>
                  </div>
                  
                  {/* Toggle for demo purposes */}
                  <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-100 self-center">
                    <button
                      onClick={() => setResultView("low")}
                      className={cn(
                        "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        resultView === "low"
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                          : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      Low Risk
                    </button>
                    <button
                      onClick={() => setResultView("high")}
                      className={cn(
                        "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        resultView === "high"
                          ? "bg-red-500 text-white shadow-lg shadow-red-200"
                          : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      High Risk
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-10 pb-10">
                {!showResult ? (
                  <div className="py-20 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                      <Activity className="w-10 h-10 text-slate-200 animate-pulse" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] max-w-xs mx-auto">
                      Complete patient vitals and trigger analysis &quot;Analyze Risk Level&quot;
                    </p>
                  </div>
                ) : resultView === "low" ? (
                  /* State 1: Low Risk */
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-8 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
                    <div className="flex items-start gap-8 relative z-10">
                      <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl shadow-emerald-200">
                        <CheckCircle className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">
                          Routine Care Recommended
                        </h3>
                        <p className="text-sm font-bold text-slate-500 leading-relaxed mb-8 max-w-2xl">
                          No significant risk factors identified. BloomCare AI confirms patient stability. Maintain standard maternal care protocols and monitor in next routine checkup.
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                          <div className="bg-white/60 p-5 rounded-2xl border border-white">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Risk Score</p>
                            <p className="text-2xl font-black text-slate-900">0.12</p>
                          </div>
                          <div className="bg-white/60 p-5 rounded-2xl border border-white">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">BP Status</p>
                            <p className="text-2xl font-black text-slate-900">Normal</p>
                          </div>
                          <div className="bg-white/60 p-5 rounded-2xl border border-white">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Observation</p>
                            <p className="text-2xl font-black text-slate-900">Stable</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* State 2: High Risk */
                  <div className="bg-red-50/50 border-2 border-red-500/20 rounded-3xl p-8 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-red-500/10 rounded-full blur-3xl" />
                    <div className="flex items-start gap-8 relative z-10">
                      <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl shadow-red-200 animate-pulse">
                        <AlertTriangle className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">
                          Critical Anomaly Detected
                        </h3>
                        <p className="text-sm font-bold text-slate-500 leading-relaxed mb-6 max-w-2xl">
                          Indicators exceed safety thresholds. High risk of gestational complications. Immediate clinical intervention and specialist review are required.
                        </p>
                        
                        <div className="flex flex-wrap gap-2 mb-8">
                          {["Systolic BP Flag", "BMI Threshold Exceeded", "GDM Alert"].map(tag => (
                            <span key={tag} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-highlight text-white rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
                          <div className="bg-white/80 p-5 rounded-2xl border border-red-500/10 shadow-sm">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Risk Score</p>
                            <p className="text-2xl font-black text-slate-900">0.84</p>
                          </div>
                          <div className="bg-white/80 p-5 rounded-2xl border border-red-500/10 shadow-sm">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Priority</p>
                            <p className="text-2xl font-black text-red-500 font-black">URGENT</p>
                          </div>
                          <div className="bg-white/80 p-5 rounded-2xl border border-red-500/10 shadow-sm">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Referral</p>
                            <p className="text-2xl font-black text-slate-900">Stage 2</p>
                          </div>
                        </div>


                        <div className="flex flex-col sm:flex-row gap-4">
                          <Button className="flex-1 bg-bloom-gradient hover:opacity-90 text-white font-black h-16 rounded-2xl shadow-xl shadow-primary/30 text-xs uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] border-0">
                            <Phone className="w-4 h-4 mr-3" />
                            Escalate to Specialist
                          </Button>
                          <Button variant="outline" className="flex-1 border-primary/20 font-black h-16 rounded-2xl text-primary text-xs uppercase tracking-[0.2em] hover:bg-primary/5">
                            Print Referral Card
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
