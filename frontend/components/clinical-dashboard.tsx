"use client"

import { useState } from "react"
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
  Bell,
  Settings,
  LogOut,
  Info,
  Zap,
  Building2,
  Stethoscope,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
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

// Escalated patients data
const escalatedPatients = [
  {
    id: "P-2024-002",
    name: "Nimalka Fernando",
    age: 28,
    gestationalWeek: 24,
    escalatedFrom: "Wattala Clinic",
    escalatedTime: "Today, 10:30 AM",
    riskScore: 0.78,
    riskLevel: "high",
    primaryRisk: "Preeclampsia",
    status: "pending",
  },
  {
    id: "P-2024-009",
    name: "Malini Samaraweera",
    age: 34,
    gestationalWeek: 28,
    escalatedFrom: "Thalawathugoda Clinic",
    escalatedTime: "Today, 09:15 AM",
    riskScore: 0.65,
    riskLevel: "moderate",
    primaryRisk: "GDM",
    status: "in-review",
  },
  {
    id: "P-2024-010",
    name: "Priyanka Herath",
    age: 31,
    gestationalWeek: 32,
    escalatedFrom: "Wattala Clinic",
    escalatedTime: "Yesterday, 03:45 PM",
    riskScore: 0.82,
    riskLevel: "high",
    primaryRisk: "Preterm Risk",
    status: "reviewed",
  },
  {
    id: "P-2024-011",
    name: "Sachini Perera",
    age: 26,
    gestationalWeek: 20,
    escalatedFrom: "Negombo Clinic",
    escalatedTime: "Yesterday, 11:20 AM",
    riskScore: 0.58,
    riskLevel: "moderate",
    primaryRisk: "Preeclampsia",
    status: "pending",
  },
]

// Feature importance data for Explainable AI
const featureImportanceData = [
  { feature: "sFlt-1/PlGF Ratio", importance: 0.28, value: "38.5", status: "abnormal" },
  { feature: "Systolic BP", importance: 0.22, value: "145 mmHg", status: "elevated" },
  { feature: "Proteinuria", importance: 0.18, value: "+2", status: "abnormal" },
  { feature: "BMI", importance: 0.12, value: "32.4", status: "elevated" },
  { feature: "Gestational Age", importance: 0.10, value: "24 weeks", status: "normal" },
  { feature: "Previous Preeclampsia", importance: 0.06, value: "Yes", status: "risk-factor" },
  { feature: "Family History", importance: 0.04, value: "Mother", status: "risk-factor" },
]

// Risk distribution pie chart data
const riskDistributionData = [
  { name: "Preeclampsia", value: 45, color: "#F472B6" }, // primary
  { name: "GDM", value: 30, color: "#20847F" }, // accent
  { name: "Preterm Risk", value: 25, color: "#EAB308" }, // highlight
]

// Weekly trend data
const weeklyTrendData = [
  { day: "Mon", preeclampsia: 3, gdm: 2, preterm: 1 },
  { day: "Tue", preeclampsia: 4, gdm: 3, preterm: 2 },
  { day: "Wed", preeclampsia: 2, gdm: 4, preterm: 1 },
  { day: "Thu", preeclampsia: 5, gdm: 2, preterm: 3 },
  { day: "Fri", preeclampsia: 3, gdm: 5, preterm: 2 },
  { day: "Sat", preeclampsia: 2, gdm: 1, preterm: 1 },
  { day: "Sun", preeclampsia: 1, gdm: 2, preterm: 0 },
]

const languages = [
  { code: "EN", label: "English" },
  { code: "SI", label: "Sinhala" },
  { code: "TA", label: "Tamil" },
]

export default function ClinicalDashboard({ onLogout }: ClinicalDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("EN")
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(escalatedPatients[0])
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  const getText = (en: string, si: string, ta: string) => {
    if (selectedLanguage === "SI") return si
    if (selectedLanguage === "TA") return ta
    return en
  }

  const filteredPatients = escalatedPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
              <p className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">Hemas Hospitals Intelligence</p>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 mx-2" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            {getText("Clinical Intelligence", "සායනික බුද්ධිය", "மருத்துவ நுண்ணறிவு")}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-slate-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#F97316] rounded-full" />
          </button>

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
                <p className="text-sm font-bold text-slate-900">Dr. Saman Kumara</p>
                <p className="text-[10px] font-bold text-primary uppercase tracking-tighter">{getText("Obstetrician", "ප්‍රසව වෛද්‍ය", "மகப்பேறு மருத்துவர்")}</p>
              </div>
              <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center shadow-md shadow-accent/20 border-2 border-white">
                <User className="w-5 h-5 text-white" />
              </div>
            </button>
            {showUserMenu && (
              <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[200px] py-2">
                <button className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2">
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
        {/* Left Sidebar - Escalated Patients */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-primary" />
              {getText("Escalated Cases", "උත්සන්න අවස්ථා", "அதிகரிக்கப்பட்ட வழக்குகள்")}
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={getText("Search ID or Name...", "රෝගීන් සොයන්න...", "நோயாளிகளைத் தேடுங்கள்...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200 h-11 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="p-3 border-b border-slate-100 flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              {getText("Filter", "පෙරනය", "வடிகட்டி")}
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs">
              <Calendar className="w-3 h-3 mr-1" />
              {getText("Today", "අද", "இன்று")}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {filteredPatients.map((patient) => (
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
                      patient.riskLevel === "high"
                        ? "bg-red-500/10 text-red-500 border-red-500/20"
                        : "bg-accent/10 text-accent border-accent/20"
                    )}
                  >
                    {patient.riskScore.toFixed(2)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider">
                  <span className={cn(
                    "px-2 py-1 rounded-md",
                    patient.primaryRisk === "Preeclampsia" && "bg-primary/10 text-primary",
                    patient.primaryRisk === "GDM" && "bg-accent/10 text-accent",
                    patient.primaryRisk === "Preterm Risk" && "bg-gold-500/10 text-gold-600"
                  )}>
                    {patient.primaryRisk}
                  </span>
                  <span className={cn(
                    "px-2 py-1 rounded-md",
                    patient.status === "pending" && "bg-slate-100 text-slate-600",
                    patient.status === "in-review" && "bg-blue-100 text-blue-700",
                    patient.status === "reviewed" && "bg-emerald-100 text-emerald-700"
                  )}>
                    {patient.status === "pending" ? getText("Pending", "අපේක්ෂිත", "நிலுவையில்") :
                     patient.status === "in-review" ? getText("In Review", "සමාලෝචනයේ", "மதிப்பாய்வில்") :
                     getText("Reviewed", "සමාලෝචිත", "மதிப்பாய்வு செய்யப்பட்டது")}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {patient.escalatedTime}
                </p>
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{getText("Pending Review:", "අපේක්ෂිත සමාලෝචන:", "நிலுவையில் உள்ள மதிப்பாய்வு:")}</span>
              <span className="font-semibold text-[#F97316]">
                {escalatedPatients.filter((p) => p.status === "pending").length}
              </span>
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
              <TabsTrigger value="biomarkers" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg text-xs font-bold uppercase tracking-wider px-6">
                {getText("Biomarkers", "ජෛව සලකුණු", "உயிரியல் குறிப்பான்கள்")}
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg text-xs font-bold uppercase tracking-wider px-6">
                {getText("History", "ඉතිහාසය", "வரலாறு")}
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
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
                          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{selectedPatient.name}</h2>
                          <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 uppercase font-bold text-[10px]">
                            {selectedPatient.id}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-6 mt-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getText("Age", "වයස", "வயது")}</span>
                            <span className="text-sm font-bold text-slate-700">{selectedPatient.age} {getText("years", "අවුරුදු", "வயது")}</span>
                          </div>
                          <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getText("Gestational Week", "ගැබ් සතිය", "கர்ப்ப வாரம்")}</span>
                            <span className="text-sm font-bold text-slate-700">{selectedPatient.gestationalWeek}</span>
                          </div>
                        </div>
                        <p className="text-xs font-medium text-slate-500 mt-4 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-primary" />
                          {getText("Referred from:", "යොමු කළේ:", "பரிந்துரைக்கப்பட்டது:")} <span className="text-slate-700 border-b border-dotted border-slate-300">{selectedPatient.escalatedFrom}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "inline-flex flex-col items-center justify-center w-24 h-24 rounded-2xl shadow-inner",
                        selectedPatient.riskLevel === "high" ? "bg-red-50 border border-red-100" : "bg-accent/5 border border-accent/10"
                      )}>
                        <div className="flex items-center gap-1 mb-1">
                          <AlertTriangle className={cn(
                            "w-4 h-4",
                            selectedPatient.riskLevel === "high" ? "text-red-500" : "text-accent"
                          )} />
                          <span className={cn(
                            "text-2xl font-black",
                            selectedPatient.riskLevel === "high" ? "text-red-500" : "text-accent"
                          )}>
                            {selectedPatient.riskScore.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                          {selectedPatient.riskLevel === "high" 
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
                  selectedPatient.primaryRisk === "Preeclampsia" && "bg-primary/[0.03] ring-1 ring-primary/20"
                )}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{getText("Preeclampsia", "ප්‍රී-එක්ලැම්ප්සියාව", "ப்ரீக்ளாம்ப்சியா")}</span>
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Heart className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-900">72%</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">{getText("Probability", "සම්භාවිතාව", "நிகழ்தகவு")}</p>
                  </CardContent>
                </Card>

                <Card className={cn(
                  "border-0 glass shadow-lg transition-all hover:-translate-y-1",
                  selectedPatient.primaryRisk === "GDM" && "bg-accent/[0.03] ring-1 ring-accent/20"
                )}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{getText("GDM", "ගැබ් දියවැඩියාව", "கர்ப்பகால நீரிழிவு")}</span>
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-accent" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-900">28%</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">{getText("Probability", "සම්භාවිතාව", "நிகழ்தகவு")}</p>
                  </CardContent>
                </Card>

                <Card className={cn(
                  "border-0 glass shadow-lg transition-all hover:-translate-y-1 rounded-2xl",
                  selectedPatient.primaryRisk === "Preterm Risk" && "bg-highlight/[0.03] ring-1 ring-highlight/20"
                )}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">{getText("Preterm Risk", "කලින් දරු ප්‍රසූතිය", "முன்கூட்டிய பிரசவம்")}</span>
                      <div className="w-8 h-8 rounded-lg bg-highlight/10 flex items-center justify-center">
                        <Baby className="w-4 h-4 text-highlight" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-900">15%</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">{getText("Probability", "සම්භාවිතාව", "நிகழ்தகவு")}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                <Button className="bg-bloom-gradient hover:opacity-90 text-white flex-1 h-14 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] border-0 font-black text-xs uppercase tracking-widest">
                  <FileText className="w-4 h-4 mr-2" />
                  {getText("Generate Report", "වාර්තාව ජනනය කරන්න", "அறிக்கையை உருவாக்கு")}
                </Button>
                <Button className="bg-accent hover:bg-accent/90 text-white flex-1 h-14 rounded-2xl shadow-lg shadow-accent/20 transition-all hover:scale-[1.02] font-black text-xs uppercase tracking-widest">
                  <Activity className="w-4 h-4 mr-2" />
                  {getText("Order Lab Tests", "රසායනාගාර පරීක්ෂණ ඇණවුම් කරන්න", "ஆய்வக சோதனைகளை ஆர்டர் செய்யவும்")}
                </Button>
                <Button variant="outline" className="flex-1 h-14 rounded-2xl border-slate-200 hover:bg-slate-50 font-black text-xs uppercase tracking-widest">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {getText("Mark as Reviewed", "සමාලෝචිත ලෙස සලකුණු කරන්න", "மதிப்பாய்வு செய்யப்பட்டதாக குறிக்கவும்")}
                </Button>
              </div>
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
                        <XAxis type="number" domain={[0, 0.3]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold", fill: "#94a3b8" }} />
                        <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fontWeight: "bold", fill: "#64748b" }} axisLine={false} tickLine={false} width={140} />
                        <Tooltip
                          cursor={{ fill: "rgba(0,0,0,0.02)" }}
                          formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Importance"]}
                          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", padding: "12px", fontSize: "12px", fontWeight: "bold" }}
                        />
                        <Bar dataKey="importance" fill="url(#barGradient)" radius={[0, 6, 6, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

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
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{(item.importance * 100).toFixed(1)}% {getText("Impact", "බලපෑම", "தாக்கம்")}</p>
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
                          "Based on the elevated sFlt-1/PlGF ratio and systolic blood pressure, this patient shows early markers consistent with developing preeclampsia. Recommend close monitoring with weekly BP checks and repeat biomarker testing in 7 days. Consider low-dose aspirin prophylaxis if not already initiated.",
                          "ඉහළ sFlt-1/PlGF අනුපාතය සහ සිස්ටොලික් රුධිර පීඩනය මත පදනම්ව, මෙම රෝගියා ප්‍රී-එක්ලැම්ප්සියාව වර්ධනය වීමත් සමඟ සමපාත වන මුල් සලකුණු පෙන්වයි.",
                          "உயர்ந்த sFlt-1/PlGF விகிதம் மற்றும் சிஸ்டாலிக் இரத்த அழுத்தத்தின் அடிப்படையில், இந்த நோயாளி ப்ரீக்ளாம்ப்சியா வளர்ச்சியுடன் ஒத்துப்போகும் ஆரம்ப அறிகுறிகளைக் காட்டுகிறார்."
                        )}
                      </p>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {getText("Confidence: 87%", "විශ්වාසය: 87%", "நம்பகத்தன்மை: 87%")}
                          </span>
                        </div>
                        <div className="h-4 w-px bg-slate-200" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {getText("Model: Stage 2 Random Forest v2.1", "ආදර්ශය: අදියර 2 Random Forest v2.1", "மாதிரி: நிலை 2 Random Forest v2.1")}
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
                      {[
                        { name: "sFlt-1/PlGF Ratio", value: "38.5", range: "<38", status: "high" },
                        { name: "Proteinuria", value: "+2", range: "Negative", status: "high" },
                        { name: "Serum Creatinine", value: "0.9 mg/dL", range: "0.6-1.2", status: "normal" },
                        { name: "Uric Acid", value: "6.8 mg/dL", range: "2.5-5.6", status: "high" },
                        { name: "Platelet Count", value: "145,000/μL", range: "150,000-400,000", status: "low" },
                        { name: "Hemoglobin", value: "11.2 g/dL", range: "11.0-14.0", status: "normal" },
                      ].map((lab) => (
                        <div key={lab.name} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl transition-all hover:bg-white hover:shadow-md">
                          <div>
                            <p className="text-xs font-black text-slate-800 uppercase tracking-wide">{lab.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{getText("Ref:", "යොමු:", "குறிப்பு:")} {lab.range}</p>
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
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={[
                            { week: "W20", systolic: 118, diastolic: 76 },
                            { week: "W21", systolic: 122, diastolic: 78 },
                            { week: "W22", systolic: 128, diastolic: 82 },
                            { week: "W23", systolic: 135, diastolic: 85 },
                            { week: "W24", systolic: 145, diastolic: 92 },
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
                      { date: "March 27, 2026", event: "Escalated to Stage 2", type: "escalation", details: "Risk score exceeded threshold (0.78)" },
                      { date: "March 27, 2026", event: "Stage 1 Screening at Wattala Clinic", type: "screening", details: "BP: 145/92, BMI: 32.4" },
                      { date: "March 20, 2026", event: "Routine Checkup", type: "routine", details: "All vitals within normal range" },
                      { date: "March 13, 2026", event: "Initial Registration", type: "registration", details: "First prenatal visit at 20 weeks" },
                    ].map((item, index) => (
                      <div key={index} className="flex gap-8 group">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-4 h-4 rounded-full border-4 border-white shadow-md z-10 transition-transform group-hover:scale-125",
                            item.type === "escalation" && "bg-primary shadow-primary/30",
                            item.type === "screening" && "bg-accent shadow-accent/30",
                            item.type === "routine" && "bg-emerald-500 shadow-emerald/30",
                            item.type === "registration" && "bg-slate-400 shadow-slate/30"
                          )} />
                          {index < 3 && <div className="w-1 h-full bg-slate-100 -mt-1 group-hover:bg-slate-200 transition-colors" />}
                        </div>
                        <div className="flex-1 pb-10">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.date}</p>
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none mb-2">{item.event}</p>
                          <p className="text-sm font-medium text-slate-500 bg-slate-50 border border-slate-100 p-3 rounded-xl inline-block mt-2">{item.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
