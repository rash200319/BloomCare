"use client"

import { useState } from "react"
import {
  User,
  Globe,
  ChevronDown,
  Baby,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building,
  Calendar,
  Download,
  Filter,
  Bell,
  Settings,
  LogOut,
  BarChart3,
  PieChart as PieChartIcon,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  AreaChart,
  Area,
} from "recharts"

type Language = "EN" | "SI" | "TA"

interface AdminDashboardProps {
  onLogout: () => void
}

// Monthly screening data
const monthlyScreeningData = [
  { month: "Jan", screenings: 1245, escalations: 187, lowRisk: 1058 },
  { month: "Feb", screenings: 1380, escalations: 207, lowRisk: 1173 },
  { month: "Mar", screenings: 1520, escalations: 228, lowRisk: 1292 },
  { month: "Apr", screenings: 1650, escalations: 264, lowRisk: 1386 },
  { month: "May", screenings: 1890, escalations: 302, lowRisk: 1588 },
  { month: "Jun", screenings: 2100, escalations: 336, lowRisk: 1764 },
]

// Clinic performance data
const clinicPerformanceData = [
  { clinic: "Wattala", screenings: 856, escalations: 128, efficiency: 94 },
  { clinic: "Thalawathugoda", screenings: 642, escalations: 96, efficiency: 91 },
  { clinic: "Negombo", screenings: 534, escalations: 80, efficiency: 89 },
  { clinic: "Colombo Central", screenings: 428, screenings2: 428, escalations: 64, efficiency: 96 },
  { clinic: "Kandy", screenings: 312, escalations: 47, efficiency: 87 },
]

// Risk distribution data
const riskDistributionData = [
  { name: "Low Risk", value: 68, color: "#22C55E" }, // Keep green for low risk as it's standard
  { name: "Moderate Risk", value: 18, color: "#EAB308" }, // highlight (Gold)
  { name: "High Risk", value: 14, color: "#EF4444" }, // Red
]

// Condition breakdown data
const conditionBreakdownData = [
  { name: "Preeclampsia", value: 45, color: "#F472B6" }, // primary
  { name: "GDM", value: 32, color: "#20847F" }, // accent
  { name: "Preterm Risk", value: 23, color: "#EAB308" }, // highlight
]

// Weekly trend data
const weeklyTrendData = [
  { week: "W1", screenings: 485, costSaved: 1940000 },
  { week: "W2", screenings: 520, costSaved: 2080000 },
  { week: "W3", screenings: 495, costSaved: 1980000 },
  { week: "W4", screenings: 600, costSaved: 2400000 },
]

// Recent activity data
const recentActivity = [
  { id: 1, type: "escalation", patient: "Nimalka Fernando", clinic: "Wattala", time: "10 min ago", risk: "Preeclampsia" },
  { id: 2, type: "screening", patient: "Malini Samaraweera", clinic: "Thalawathugoda", time: "25 min ago", risk: null },
  { id: 3, type: "resolved", patient: "Priyanka Herath", clinic: "Wattala", time: "1 hour ago", risk: "GDM" },
  { id: 4, type: "escalation", patient: "Sachini Perera", clinic: "Negombo", time: "2 hours ago", risk: "Preterm" },
  { id: 5, type: "screening", patient: "Kumari Jayawardena", clinic: "Colombo Central", time: "3 hours ago", risk: null },
]

const languages = [
  { code: "EN", label: "English" },
  { code: "SI", label: "Sinhala" },
  { code: "TA", label: "Tamil" },
]

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("EN")
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [dateRange, setDateRange] = useState("this-month")
  const [isExporting, setIsExporting] = useState(false)

  const getText = (en: string, si: string, ta: string) => {
    if (selectedLanguage === "SI") return si
    if (selectedLanguage === "TA") return ta
    return en
  }

  const handleExportPDF = async () => {
    try {
      setIsExporting(true)
      const response = await fetch("http://localhost:8000/export/monthly-screening-trends")
      
      if (!response.ok) {
        throw new Error("Failed to export PDF")
      }
      
      // Get the PDF blob
      const blob = await response.blob()
      
      // Create a download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "BloomCare_Monthly_Screening_Report.pdf"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      console.log("PDF exported successfully")
    } catch (error) {
      console.error("Error exporting PDF:", error)
      alert("Failed to export PDF. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans selection:bg-primary/20 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <img 
          src="/images/mother-baby-shadow.png" 
          alt="" 
          className="w-full h-full object-cover opacity-[0.03] scale-110"
        />
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
              {getText("Hemas Administration", "හේමාස් පරිපාලනය", "ஹேமாஸ் நிர்வாகம்")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Date Range Selector */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px] bg-white border-slate-200 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm">
              <Calendar className="w-4 h-4 mr-2 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
              <SelectItem value="today" className="text-[10px] font-black uppercase tracking-widest">{getText("Today", "අද", "இன்று")}</SelectItem>
              <SelectItem value="this-week" className="text-[10px] font-black uppercase tracking-widest">{getText("This Week", "මෙම සතිය", "இந்த வாரம்")}</SelectItem>
              <SelectItem value="this-month" className="text-[10px] font-black uppercase tracking-widest">{getText("This Month", "මෙම මාසය", "இந்த மாதம்")}</SelectItem>
              <SelectItem value="this-quarter" className="text-[10px] font-black uppercase tracking-widest">{getText("This Quarter", "මෙම කාර්තුව", "இந்த காலாண்டு")}</SelectItem>
            </SelectContent>
          </Select>

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
                <p className="text-sm font-black text-slate-900 tracking-tight">Admin Perera</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">District Manager</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20 transition-transform group-hover:scale-105">
                <User className="w-5 h-5 text-white" />
              </div>
            </button>
            {showUserMenu && (
              <div className="absolute top-full right-0 mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 min-w-[220px] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="px-5 py-4 border-b border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                  <p className="text-xs font-bold text-slate-900">perera.admin@hemas.lk</p>
                </div>
                <button className="w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 flex items-center gap-3">
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
              <p className="text-3xl font-black text-slate-900 tracking-tight">2,847</p>
              <div className="flex items-center gap-2 mt-4">
                <div className="flex items-center px-1.5 py-0.5 bg-emerald-50 rounded-full border border-emerald-100">
                  <ArrowUpRight className="w-3 h-3 text-emerald-500 mr-1" />
                  <span className="text-[10px] text-emerald-600 font-black">12.5%</span>
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
              <p className="text-3xl font-black text-slate-900 tracking-tight">398</p>
              <div className="flex items-center gap-2 mt-4">
                <div className="flex items-center px-1.5 py-0.5 bg-accent/5 rounded-full border border-accent/10">
                  <ArrowDownRight className="w-3 h-3 text-accent mr-1" />
                  <span className="text-[10px] text-accent font-black">8.3%</span>
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
              <p className="text-3xl font-black text-slate-900 tracking-tight">LKR 8.4M</p>
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
              <p className="text-3xl font-black text-slate-900 tracking-tight">12</p>
              <div className="flex items-center gap-2 mt-4">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{getText("Hemas Network", "හේමාස් ජාලය", "ஹேமாஸ் நெட்வொர்க்")}</span>
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
            <TabsTrigger value="clinics" className="h-10 px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all">
              <Building className="w-4 h-4 mr-2" />
              {getText("Network", "ජාලය", "நெறிமுறை")}
            </TabsTrigger>
            <TabsTrigger value="risks" className="h-10 px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all">
              <PieChartIcon className="w-4 h-4 mr-2" />
              {getText("Risks", "අවදානම්", "ஆபத்து")}
            </TabsTrigger>
            <TabsTrigger value="activity" className="h-10 px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all">
              <Activity className="w-4 h-4 mr-2" />
              {getText("Live Feed", "සජීවී පුවත්", "நிகழ்நேர ஊட்டம்")}
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
                  <Button 
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    variant="outline" 
                    className="rounded-xl border-slate-200 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {isExporting ? getText("Exporting...", "අපනයනය කරමින්...", "ஏற்றுமதி செய்கிறது...") : getText("Export", "අපනයනය", "ஏற்றுமதி")}
                  </Button>
                </CardHeader>
                <CardContent className="pt-8">
                  <div className="h-80 w-full font-bold">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyScreeningData}>
                        <defs>
                          <linearGradient id="colorScreenings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FB7185" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#FB7185" stopOpacity={0}/>
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
                    {getText("Risk Distribution", "අවදානම් බෙදීම", "ஆபத்து விநியோகம்")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-8 px-8 flex flex-col items-center">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={riskDistributionData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {riskDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 mt-6 w-full">
                    {riskDistributionData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest group">
                        <span className="flex items-center gap-2 text-slate-500 group-hover:text-slate-900 transition-colors">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </span>
                        <span className="text-slate-900">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Network Tab content */}
          <TabsContent value="clinics" className="space-y-8 animate-in fade-in duration-500">
            <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="text-left p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                          {getText("Medical Center", "වෛද්‍ය මධ්‍යස්ථානය", "மருத்துவ மையம்")}
                        </th>
                        <th className="text-left p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                          {getText("Volume", "ප්‍රමාණය", "தொகுதி")}
                        </th>
                        <th className="text-left p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                          {getText("Efficiency", "කාර්යක්ෂමතාව", "திறன்")}
                        </th>
                        <th className="text-left p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                          {getText("Status", "තත්ත්වය", "நிலை")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {clinicPerformanceData.map((clinic) => (
                        <tr key={clinic.clinic} className="hover:bg-slate-50/30 transition-colors group">
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-primary" />
                              </div>
                              <span className="text-xs font-black text-slate-900">{clinic.clinic}</span>
                            </div>
                          </td>
                          <td className="p-6 text-xs font-bold text-slate-600">{clinic.screenings.toLocaleString()}</td>
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <div className="w-32 h-2 bg-slate-100/50 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
                                  style={{ width: `${clinic.efficiency}%` }} 
                                />
                              </div>
                              <span className="text-[10px] font-black text-slate-900">{clinic.efficiency}%</span>
                            </div>
                          </td>
                          <td className="p-6">
                            <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[9px] font-black uppercase tracking-widest">
                              Operational
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risks Tab content */}
          <TabsContent value="risks" className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {conditionBreakdownData.map((condition) => (
                <Card key={condition.name} className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden group hover:scale-[1.02] transition-all duration-300">
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">
                        {condition.name}
                      </p>
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-12" 
                        style={{ backgroundColor: `${condition.color}15` }}
                      >
                        <Activity className="w-5 h-5" style={{ color: condition.color }} />
                      </div>
                    </div>
                    <div className="flex items-end justify-between mb-4">
                      <p className="text-3xl font-black text-slate-900 tracking-tight">{condition.value}%</p>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Concentration</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div 
                        className="h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${condition.value}%`, backgroundColor: condition.color }} 
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden">
               <CardHeader className="border-b border-slate-50/50 pb-6">
                 <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    {getText("Weekly Condition Forecast", "සතිපතා තත්ත්ව පුරෝකථනය", "வாராந்திர நிலை முன்னறிவிப்பு")}
                 </CardTitle>
               </CardHeader>
               <CardContent className="pt-8">
                  <div className="h-64 w-full font-bold">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weeklyTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="screenings" stroke="#0EA5E9" strokeWidth={3} dot={{ r: 4, fill: '#0EA5E9', strokeWidth: 2, stroke: '#fff' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
               </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab content */}
          <TabsContent value="activity" className="space-y-8 animate-in fade-in duration-500">
            <Card className="border-0 glass shadow-2xl shadow-slate-200/50 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50/50 pb-6">
                <div>
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    {getText("Live Diagnostic Stream", "සජීවී රෝග විනිශ්චය ප්‍රවාහය", "நேரடி கண்டறியும் ஸ்ட்ரீம்")}
                  </CardTitle>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time AI Processing Log</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Live System Status</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="p-8 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50/30 transition-colors group">
                      <div className="flex items-center gap-6 mb-4 md:mb-0">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110",
                          activity.type === "escalation" ? "bg-rose-50 text-rose-500 shadow-rose-200/50" : 
                          activity.type === "screening" ? "bg-teal-50 text-teal-500 shadow-teal-200/50" : 
                          "bg-emerald-50 text-emerald-500 shadow-emerald-200/50"
                        )}>
                          {activity.type === "escalation" ? <AlertTriangle className="w-7 h-7" /> : 
                           activity.type === "screening" ? <Activity className="w-7 h-7" /> : <CheckCircle className="w-7 h-7" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <p className="text-sm font-black text-slate-900 tracking-tight">{activity.patient}</p>
                            <Badge variant="outline" className="rounded-lg border-slate-200 bg-white/50 text-[8px] font-black uppercase tracking-widest py-0.5 px-2">
                              {activity.clinic}
                            </Badge>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {activity.time} • {getText("Stage 1 Analysis", "අදියර 1 විශ්ලේෂණය", "நிலை 1 பகுப்பாய்வு")}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 flex-wrap">
                        {activity.risk && (
                          <div className="px-4 py-2 bg-slate-900 rounded-xl text-white">
                             <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Condition Detected</p>
                             <p className="text-[10px] font-black uppercase tracking-widest">{activity.risk}</p>
                          </div>
                        )}
                        <div className={cn(
                          "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all group-hover:shadow-xl",
                          activity.type === "escalation" ? "bg-red-500 text-white shadow-red-200/50" : 
                          activity.type === "screening" ? "bg-teal-500 text-white shadow-teal-200/50" : 
                          "bg-emerald-500 text-white shadow-emerald-200/50"
                        )}>
                          {activity.type === "escalation" ? getText("High Priority Escalation", "ඉහළ ප්‍රමුඛතා උත්සන්න කිරීම", "அதி முக்கியத்துவம்") : 
                           activity.type === "screening" ? getText("Routine Screening", "සාමාන්‍ය පරීක්ෂණ", "வழக்கமான ஸ்கிரீனிங்") : 
                           getText("Care Protocol Resolved", "සත්කාර ප්‍රොටෝකෝලය විසඳා ඇත", "தீர்வு கண்டறியப்பட்டது")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-center">
                  <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">
                    {getText("Load More Activity", "තවත් ක්‍රියාකාරකම් පෙන්වන්න", "மேலும் செயல்பாடு")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
