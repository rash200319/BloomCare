"use client"

import { useState } from "react"
import {
  User,
  Globe,
  ChevronDown,
  Baby,
  Heart,
  Activity,
  Calendar,
  Clock,
  Bell,
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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
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

interface PatientPortalProps {
  onLogout: () => void
}

const PatientPortal = ({ onLogout }: PatientPortalProps) => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("EN")
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const getText = (en: string, si: string, ta: string) => {
    if (selectedLanguage === "SI") return si
    if (selectedLanguage === "TA") return ta
    return en
  }

  const patientData = {
    name: "Nimalka Fernando",
    email: "nimalka.f@outlook.com",
    gestationalWeek: 24,
    bloodGroup: "O+",
    dueDate: "July 15, 2026",
    pregnancyStatus: "Healthy / Optimal"
  }

  const vitalsHistory = [
    { week: "W16", systolic: 112, diastolic: 72, weight: 58 },
    { week: "W18", systolic: 115, diastolic: 74, weight: 59.5 },
    { week: "W20", systolic: 118, diastolic: 76, weight: 61 },
    { week: "W22", systolic: 120, diastolic: 78, weight: 62.5 },
    { week: "W24", systolic: 118, diastolic: 76, weight: 64 },
  ]

  const upcomingAppointments = [
    {
      id: 1,
      type: "Prenatal Checkup",
      typeSi: "ප්‍රසව පූර්ව පරීක්ෂාව",
      typeTa: "மகப்பேறுக்கு முற்பட்ட பரிசோதனை",
      date: "April 3, 2026",
      time: "10:30 AM",
      doctor: "Dr. Saman Kumara",
      location: "Hemas Hospital Wattala",
      status: "confirmed",
    },
    {
      id: 2,
      type: "Glucose Screening",
      typeSi: "ග්ලූකෝස් පිරික්සීම",
      typeTa: "குளுக்கோஸ் ஸ்கிரீனிங்",
      date: "April 10, 2026",
      time: "08:00 AM",
      doctor: "Lab Services",
      location: "Hemas Hospital Wattala",
      status: "pending",
    },
    {
      id: 3,
      type: "Ultrasound Scan",
      typeSi: "අල්ට්‍රා සවුන්ඩ් ස්කෑන්",
      typeTa: "அல்ட்ராசவுண்ட் ஸ்கேன்",
      date: "April 17, 2026",
      time: "02:00 PM",
      doctor: "Dr. Priya Fernando",
      location: "Hemas Hospital Wattala",
      status: "confirmed",
    },
  ]

  const healthTips = [
    {
      id: 1,
      title: "Stay Hydrated",
      titleSi: "ජලය හොඳින් පානය කරන්න",
      titleTa: "நீரேற்றமாக இருங்கள்",
      description: "Drink at least 8-10 glasses of water daily to support your baby.",
      descriptionSi: "ඔබේ දරුවාගේ වර්ධනයට දිනකට වතුර වීදුරු 8-10 ක් පානය කරන්න.",
      descriptionTa: "உங்கள் குழந்தையின் வளர்ச்சிக்கு தினமும் 8-10 கிளாஸ் தண்ணீர் குடிக்கவும்.",
      icon: Droplets,
    },
    {
      id: 2,
      title: "Monitor Blood Pressure",
      titleSi: "රුධිර පීඩනය පරීක්ෂා කරන්න",
      titleTa: "இரத்த அழுத்தத்தைக் கண்காணிக்கவும்",
      description: "Regular BP checks help detect early signs of preeclampsia.",
      descriptionSi: "නිතිපතා රුධිර පීඩනය පරීක්ෂා කිරීමෙන් සංකූලතා කලින් හඳුනාගත හැක.",
      descriptionTa: "இரத்த அழுத்தத்தை சீராக பரிசோதிப்பது சிக்கல்களை முன்கூட்டியே கண்டறிய உதவும்.",
      icon: Heart,
    },
    {
      id: 3,
      title: "Prenatal Vitamins",
      titleSi: "ප්‍රසව විටමින් ගන්න",
      titleTa: "மகப்பேறு வைட்டமின்கள்",
      description: "Folic acid and iron are essential for your baby's development.",
      descriptionSi: "ෆෝලික් අම්ලය සහ යකඩ ඔබේ දරුවාගේ වර්ධනයට අත්‍යවශ්‍ය වේ.",
      descriptionTa: "ஃபோலிக் அமிலம் மற்றும் இரும்புச்சத்து உங்கள் குழந்தையின் வளர்ச்சிக்கு அவசியம்.",
      icon: Pill,
    },
  ]

  const medications = [
    { name: "Folic Acid", dosage: "5mg", frequency: "Once daily", time: "Morning" },
    { name: "Iron Supplement", dosage: "200mg", frequency: "Once daily", time: "Evening" },
    { name: "Calcium Carbonate", dosage: "500mg", frequency: "Twice daily", time: "Morning/Night" },
  ]

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
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 transition-transform hover:scale-105 cursor-pointer group">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 rotate-3 group-hover:rotate-0 transition-transform duration-500">
              <Baby className="w-7 h-7 text-white filter drop-shadow-sm" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">Bloom<span className="text-primary">Care</span></h1>
              <p className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">
                {getText("Patient Portal", "රෝගී ද්වාරය", "நோயாளி போர்டல்")}
              </p>
            </div>
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

          <div className="h-8 w-px bg-slate-100 mx-2" />

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 group"
            >
              <div className="hidden sm:text-right sm:block">
                <p className="text-sm font-black text-slate-900 tracking-tight">{patientData.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Week {patientData.gestationalWeek} • {patientData.bloodGroup}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20 transition-transform group-hover:scale-105">
                <User className="w-5 h-5 text-white" />
              </div>
            </button>
            {showUserMenu && (
              <div className="absolute top-full right-0 mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 min-w-[220px] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="px-5 py-4 border-b border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                  <p className="text-xs font-bold text-slate-900">{patientData.email}</p>
                </div>
                <button className="w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 flex items-center gap-3">
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
      <main className="flex-1 p-8 overflow-y-auto">
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
                       {getText("Week", "සතිය", "வாரம்")} {patientData.gestationalWeek}
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
          <TabsList className="bg-white/50 backdrop-blur-md border border-slate-100 p-1.5 rounded-2xl shadow-sm inline-flex">
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
                     <p className="text-3xl font-black text-slate-900 tracking-tight">{patientData.gestationalWeek} <span className="text-sm text-slate-400">weeks</span></p>
                   </div>
                   <div className="w-full h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(patientData.gestationalWeek / 40) * 100}%` }} />
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
                   <p className="text-[10px] font-bold text-accent uppercase tracking-widest mt-4">110 Days to welcome</p>
                 </CardContent>
              </Card>

              <Card className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden group rounded-[24px]">
                 <div className="h-1 w-full bg-emerald-500" />
                 <CardContent className="p-8">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{getText("Next Analytics Sync", "මීළඟ පරීක්ෂාව", "அடுத்த ஸ்கிரீனிங்")}</p>
                   <div className="flex items-end justify-between">
                     <p className="text-2xl font-black text-slate-900 tracking-tight">Fri, April 3</p>
                   </div>
                   <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-4">10:30 AM • Hemas Wattala</p>
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
                  </div>
               </CardContent>
            </Card>
          </TabsContent>

          {/* Health/Care Plan Tab */}
          <TabsContent value="health" className="space-y-8 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="border-0 glass shadow-xl shadow-slate-200/50 overflow-hidden rounded-[24px]">
                   <CardHeader className="border-b border-slate-50/50 pb-6 px-8">
                      <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                         <Pill className="w-5 h-5 text-emerald-500" />
                         Active Prescriptions
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-0">
                      <div className="divide-y divide-slate-50">
                        {medications.map((med) => (
                           <div key={med.name} className="p-8 hover:bg-slate-50/50 transition-colors">
                              <div className="flex items-center justify-between mb-2">
                                 <h4 className="text-sm font-black text-slate-900">{med.name}</h4>
                                 <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[8px] font-black uppercase">{med.dosage}</Badge>
                              </div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{med.frequency} • {med.time}</p>
                           </div>
                        ))}
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
                            <p className="text-sm font-black text-slate-900">Hemas Hospital Wattala</p>
                            <p className="text-xs text-slate-500">Negombo Rd, Wattala</p>
                         </div>
                      </div>
                      <div className="p-6 bg-rose-50/50 rounded-2xl border border-rose-100 flex items-start gap-4">
                         <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-primary" />
                         </div>
                         <div>
                            <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1">Consultant</p>
                            <p className="text-sm font-black text-slate-900">Dr. Saman Kumara</p>
                            <p className="text-xs text-slate-500">Obstetrician & Gynecologist</p>
                         </div>
                      </div>
                   </CardContent>
                </Card>
             </div>
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
                       <Button size="icon" className="w-12 h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors">
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
                      <h3 className="text-3xl font-black relative z-10 tracking-tight">Week {patientData.gestationalWeek}</h3>
                      <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] relative z-10 mt-2">Corn Ear Size</p>
                   </div>
                   <div className="flex-1 p-12 bg-white/40">
                      <h3 className="text-2xl font-black text-slate-900 mb-6 tracking-tight">Development This Week</h3>
                      <p className="text-slate-500 leading-relaxed mb-8 font-bold">
                         {getText(
                           "Your baby's face is fully formed with eyebrows and eyelashes. Their brain is developing rapidly, starting a regular waking and sleeping cycle. Movement levels may increase significantly.",
                           "ඔබේ දරුවාගේ මුහුණ දැන් සම්පූර්ණයෙන්ම සෑදී ඇති අතර මොළයේ වර්ධනය වේගවත් වේ. දරුවා අවදි වන සහ නිදාගන්නා නිතිපතා චක්‍රයක් ආරම්භ වේ.",
                           "உங்கள் குழந்தையின் முகம் இப்போது முழுமையாக உருவாகியுள்ளது. மூளை வேகமாக வளர்ந்து வருகிறது, ஒரு வழக்கமான தூக்க சுழற்சி தொடங்குகிறது."
                         )}
                      </p>
                      <div className="grid grid-cols-3 gap-6">
                         {[
                           { val: "30cm", label: "Length" },
                           { val: "600g", label: "Weight" },
                           { val: "77%", label: "Development" },
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
           <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center animate-pulse shadow-xl shadow-rose-500/20">
                 <Phone className="w-7 h-7 text-white" />
              </div>
              <div>
                 <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-1">{getText("24/7 Medical Support", "හදිසි වෛද්‍ය සහාය", "அவசர உதவி")}</p>
                 <p className="text-2xl font-black text-slate-900 tracking-tight">0117 888 888</p>
              </div>
           </div>
           <div className="flex items-center gap-10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <a href="#" className="hover:text-primary transition-colors">Digital Records</a>
              <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-primary transition-colors">Support Center</a>
           </div>
        </div>
      </footer>
    </div>
  )
}

export default PatientPortal
