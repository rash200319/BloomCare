"use client"

import { useState } from "react"
import { 
  Heart, 
  Globe, 
  Shield, 
  Activity, 
  Brain, 
  Users, 
  Clock, 
  CheckCircle,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Stethoscope,
  Baby,
  BarChart3,
  Smartphone,
  Languages,
  Building2,
  Droplets
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"

type Language = "EN" | "SI" | "TA"

interface HomePageProps {
  onNavigateToLogin: () => void
}

export default function HomePage({ onNavigateToLogin }: HomePageProps) {
  const [language, setLanguage] = useState<Language>("EN")

  const getText = (en: string, si: string, ta: string) => {
    if (language === "SI") return si
    if (language === "TA") return ta
    return en
  }

  const features = [
    {
      icon: Brain,
      title: getText("AI-Powered Detection", "AI-බලගැන්වූ හඳුනාගැනීම", "AI-இயக்கப்படும் கண்டறிதல்"),
      description: getText(
        "Advanced machine learning algorithms analyze patient data to predict pregnancy complications with high accuracy.",
        "උසස් යන්ත්‍ර ඉගෙනුම් ඇල්ගොරිතම ගර්භණී සංකූලතා ඉහළ නිරවද්‍යතාවයකින් අනාවැකි කීමට රෝගී දත්ත විශ්ලේෂණය කරයි.",
        "மேம்பட்ட இயந்திர கற்றல் வழிமுறைகள் கர்ப்ப சிக்கல்களை அதிக துல்லியத்துடன் கணிக்க நோயாளி தரவை பகுப்பாய்வு செய்கின்றன."
      )
    },
    {
      icon: Clock,
      title: getText("Early Risk Detection", "ඉක්මන් අවදානම් හඳුනාගැනීම", "ஆரம்ப ஆபத்து கண்டறிதல்"),
      description: getText(
        "Identify potential risks for Preeclampsia, Gestational Diabetes, and Preterm Birth weeks before traditional methods.",
        "සම්ප්‍රදායික ක්‍රම වලට සති ගණනකට පෙර ප්‍රෙක්ලැම්ප්සියා, ගර්භණී දියවැඩියාව සහ නොමේරූ උපත සඳහා විභව අවදානම් හඳුනා ගන්න.",
        "பாரம்பரிய முறைகளுக்கு வாரங்களுக்கு முன்பே ப்ரீக்ளாம்ப்சியா, கர்ப்பகால நீரிழிவு மற்றும் குறைப்பிரசவத்திற்கான சாத்தியமான ஆபத்துகளை அடையாளம் காணுங்கள்."
      )
    },
    {
      icon: Languages,
      title: getText("Trilingual Support", "ත්‍රිභාෂා සහාය", "முக்மொழி ஆதரவு"),
      description: getText(
        "Full support for English, Sinhala, and Tamil ensures accessibility for all patients and healthcare workers.",
        "ඉංග්‍රීසි, සිංහල සහ දෙමළ සඳහා සම්පූර්ණ සහාය සියලුම රෝගීන් සහ සෞඛ්‍ය සේවකයින් සඳහා ප්‍රවේශ්‍යතාව සහතික කරයි.",
        "ஆங்கிலம், சிங்களம் மற்றும் தமிழுக்கான முழு ஆதரவு அனைத்து நோயாளிகளுக்கும் சுகாதார பணியாளர்களுக்கும் அணுகலை உறுதி செய்கிறது."
      )
    },
    {
      icon: Smartphone,
      title: getText("Offline Capable", "නොබැඳි හැකියාව", "ஆஃப்லைன் திறன்"),
      description: getText(
        "Mobile-first design works even in areas with limited connectivity, perfect for rural clinics.",
        "සීමිත සම්බන්ධතාව ඇති ප්‍රදේශවල පවා ක්‍රියා කරන ජංගම-ප්‍රථම නිර්මාණය ග්‍රාමීය සායන සඳහා පරිපූර්ණයි.",
        "வரையறுக்கப்பட்ட இணைப்பு உள்ள பகுதிகளில் கூட செயல்படும் மொபைல்-முதல் வடிவமைப்பு கிராமப்புற கிளினிக்குகளுக்கு சரியானது."
      )
    },
    {
      icon: Shield,
      title: getText("Explainable AI", "පැහැදිලි කළ හැකි AI", "விளக்கக்கூடிய AI"),
      description: getText(
        "Transparent risk assessments show clinicians exactly which factors contribute to predictions.",
        "විනිවිද පෙනෙන අවදානම් තක්සේරු වෛද්‍යවරුන්ට අනාවැකි සඳහා දායක වන සාධක හරියටම පෙන්වයි.",
        "வெளிப்படையான ஆபத்து மதிப்பீடுகள் எந்த காரணிகள் கணிப்புகளுக்கு பங்களிக்கின்றன என்பதை மருத்துவர்களுக்கு சரியாக காட்டுகின்றன."
      )
    },
    {
      icon: BarChart3,
      title: getText("Real-time Analytics", "තත්කාලීන විශ්ලේෂණ", "நிகழ்நேර பகுப்பாய்வு"),
      description: getText(
        "Hospital administrators get comprehensive dashboards for monitoring outcomes across all clinics.",
        "රෝහල් පරිපාලකයින්ට සියලුම සායන හරහා ප්‍රතිඵල නිරීක්ෂණය සඳහා විස්තීර්ණ උපකරණ පුවරු ලැබේ.",
        "மருத்துவமனை நிர்வாகிகள் அனைத்து கிளினிக்குகளிலும் விளைவுகளை கண்காணிக்க விரிவான டாஷ்போர்டுகளைப் பெறுகிறார்கள்."
      )
    }
  ]

  const stats = [
    { value: "95%", label: getText("Detection Accuracy", "හඳුනාගැනීමේ නිරවද්‍යතාව", "கண்டறிதல் துல்லியம்") },
    { value: "4-6", label: getText("Weeks Earlier Detection", "සති ඉක්මන් හඳුනාගැනීම", "வாரங்கள் முன்னதாக கண்டறிதல்") },
    { value: "24/7", label: getText("System Availability", "පද්ධති ලබාගත හැකි බව", "கணினி கிடைக்கும் தன்மை") },
    { value: "3", label: getText("Languages Supported", "සහාය භාෂා", "ஆදரிக்கப்படும் மொழிகள்") }
  ]

  const conditions = [
    {
      name: getText("Preeclampsia", "ප්‍රෙක්ලැම්ප්සියා", "ப்ரீக்ளாம்ப்சியா"),
      description: getText(
        "Preeclampsia is a serious high-blood pressure condition that can occur mid-pregnancy. It requires proactive monitoring of blood pressure and protein levels to ensure maternal and fetal safety.",
        "ප්‍රෙක්ලැම්ප්සියා යනු ගර්භණී සමයේදී ඇතිවිය හැකි බරපතල අධි රුධිර පීඩන තත්ත්වයකි. මවගේ සහ දරුවාගේ ආරක්ෂාව සහතික කිරීම සඳහා රුධිර පීඩනය සහ ප්‍රෝටීන් මට්ටම ක්‍රියාකාරීව අධීක්ෂණය කිරීම අවශ්‍ය වේ.",
        "ப்ரீக்ளாம்ப்சியா என்பது கர்ப்ப காலத்தில் ஏற்படும் ஒரு தீவிர உயர் இரத்த அழுத்த நிலை. தாய் மற்றும் கருவின் பாதுகாப்பை உறுதி செய்ய இரத்த அழுத்தம் மற்றும் புரத அளவை முன்கூட்டியே கண்காணிப்பு அவசியம்."
      ),
      color: "bg-rose-500",
      icon: Activity,
      image: "/images/preeclampsia.png"
    },
    {
      name: getText("Gestational Diabetes", "ගර්භණී දියවැඩියාව", "கர்ப்பகால நீரிழிவு"),
      description: getText(
        "Gestational Diabetes develops when blood sugar levels rise during pregnancy. Early screening and nutritional management significantly reduce risks for both mother and baby.",
        "ගර්භණී සමයේදී රුධිරයේ සීනි මට්ටම ඉහළ යාම රෝගීන්ට බලපායි. මුල් අවධියේදී පිරික්සීම සහ පෝෂණ කළමනාකරණය මවට සහ දරුවාට ඇති අවදානම සැලකිය යුතු ලෙස අඩු කරයි.",
        "கர்ப்ப காலத்தில் இரத்தத்தில் சர்க்கரை அளவு அதிகரிக்கும் போது கர்ப்பகால நீரிழிவு உருவாகிறது. ஆரம்பகால திரையிடல் மற்றும் ஊட்டச்சத்து மேலாண்மை தாய் மற்றும் குழந்தை இருவருக்குமான அபாயங்களை கணிசமாகக் குறைக்கிறது."
      ),
      color: "bg-amber-500",
      icon: Droplets,
      image: "/images/diabetes.png"
    },
    {
      name: getText("Preterm Birth Risk", "නොමේරූ උපත් අවදානම", "குறைப்பிரசவ ஆபத்து"),
      description: getText(
        "Preterm birth occurs when a baby is born before 37 weeks. Our AI identifies silent risk trajectories early, allowing for medical interventions that protect baby's lung and vital organ development.",
        "දරුවෙකු සති 37 ට පෙර උපත ලැබීම නොමේරූ උපතයි. අපගේ AI පද්ධතිය කලින් අවදානම් හඳුනා ගනී, එමඟින් දරුවාගේ වැදගත් අවයව වර්ධනය ආරක්ෂා කිරීමට වෛද්‍ය මැදිහත්වීම් වලට ඉඩ සලසයි.",
        "37 வாரங்களுக்கு முன்பே குழந்தை பிறப்பது குறைப்பிரசவம் ஆகும். எமது AI முன்கூட்டியே அபாயங்களைக் கண்டறிந்து, குழந்தையின் நுரையீரல் மற்றும் முக்கிய உறுப்பு வளர்ச்சியைக் காக்க மருத்துவ தலையீடுகளை அனுமதிக்கிறது."
      ),
      color: "bg-teal-500",
      icon: Baby,
      image: "/images/preterm.png"
    }
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col relative">
      {/* Page-wide Background Treatment */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <img 
          src="/images/shadow-pregnancy.png" 
          alt="" 
          className="absolute -right-20 top-40 w-[600px] h-[900px] object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#F8FAFC]/95 via-[#F8FAFC]/80 to-transparent" />
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-bloom-gradient flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">BloomCare</h1>
                <p className="text-[10px] font-medium tracking-widest uppercase text-primary">Hemas Hospitals</p>
              </div>
            </div>

            {/* Nav Links - Hidden on mobile */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors">
                {getText("Features", "විශේෂාංග", "அம்சங்கள்")}
              </a>
              <a href="#conditions" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors">
                {getText("Conditions", "තත්වයන්", "நிலைமைகள்")}
              </a>
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              {/* Language Toggle */}
              <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
                <SelectTrigger className="w-[110px] bg-white/50 backdrop-blur-sm border-slate-200 focus:ring-primary h-9">
                  <Globe className="w-4 h-4 mr-2 text-primary" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EN">English</SelectItem>
                  <SelectItem value="SI">සිංහල</SelectItem>
                  <SelectItem value="TA">தமிழ்</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                className="hidden sm:flex border-primary text-primary hover:bg-primary/5 rounded-full px-6 h-9"
                onClick={onNavigateToLogin}
              >
                {getText("Sign In", "පුරනය", "உள்நுழை")}
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 rounded-full px-6 h-9"
                onClick={onNavigateToLogin}
              >
                {getText("Get Started", "ආරම්භ කරන්න", "தொடங்கு")}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white">
        {/* Background Image Container */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/shadow-pregnancy.png" 
            alt="" 
            className="w-full h-full object-cover opacity-80 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/40 to-transparent" />
        </div>

        {/* Animated Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] animate-pulse" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-white/80 glass rounded-full px-5 py-2 mb-2 animate-float">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold tracking-wide uppercase text-slate-700">
                  {getText("Trusted by Hemas Hospitals", "හේමාස් රෝහල් විශ්වාස කරයි", "ஹேமாஸ் மருத்துவமனைகளால் நம்பப்படுகிறது")}
                </span>
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.1] text-slate-900 text-balance tracking-tight">
                {getText(
                  "Early Detection for Every Mother",
                  "සෑම මවකටම ඉක්මන් හඳුනාගැනීම",
                  "ஒவ்வொரு தாய்க்கும் ஆரம்பகால கண்டறிதல்"
                )}
                <span className="text-primary block mt-2">BloomCare AI.</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl font-medium">
                {getText(
                  "Empowering maternal care through AI diagnostics. Detecting Preeclampsia, GDM, and Preterm birth trajectories with clinical precision.",
                  "AI රෝග විනිශ්චය හරහා මාතෘ සත්කාරය බලගැන්වීම. සායනික නිරවද්‍යතාවයෙන් ප්‍රෙක්ලැම්ප්සියා, GDM සහ නොමේරූ උපත් පථයන් හඳුනා ගැනීම.",
                  "AI கண்டறிதல் மூலம் தாய்வழி பராமரிப்பை மேம்படுத்துதல். மருத்துவ துல்லியத்துடன் ப்ரீக்ளாம்ப்சியா, GDM மற்றும் குறைப்பிரசவ பாதைகளைக் கண்டறிதல்."
                )}
              </p>
              <div className="flex flex-col sm:flex-row gap-5">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 text-white px-10 h-16 text-lg rounded-full shadow-xl shadow-primary/20 font-bold"
                  onClick={onNavigateToLogin}
                >
                  {getText("Start Screening", "පරීක්ෂණය ආරම්භ කරන්න", "திரையிடலைத் தொடங்கு")}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-slate-200 bg-white/50 backdrop-blur-sm text-slate-700 hover:bg-white px-10 h-16 text-lg rounded-full font-bold"
                  onClick={onNavigateToLogin}
                >
                  {getText("Provider Login", "සෞඛ්‍ය සේවා පිවිසුම", "வழங்குநர் உள்நுழைவு")}
                </Button>
              </div>
            </div>

            <div className="relative flex justify-center">
              {/* Decorative Rings */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border-2 border-primary/5 rounded-full animate-spin-slow" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] border border-accent/10 rounded-full animate-reverse-spin-slow" />
              
              <div className="relative z-10">
                {/* Main Hero Circle */}
                <div className="w-80 h-80 md:w-96 md:h-96 rounded-full overflow-hidden border-8 border-white shadow-[0_32px_64px_-16px_rgba(244,63,94,0.2)] animate-float">
                  <img 
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ef05a8b7f0422206eb30a4a02582f39c-N2pTa6XJ1ut6MDawWGk2hfWhSzZ1Qh.jpg"
                    alt="Maternal Care"
                    className="w-full h-full object-cover scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent" />
                </div>
                
                {/* Floating Micro-Cards */}
                <div className="absolute -top-4 -right-8 glass p-4 rounded-2xl animate-float delay-150 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Precision</p>
                      <p className="text-sm font-bold text-slate-800">98% Recall</p>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-12 -left-12 glass p-4 rounded-2xl animate-float delay-300 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Heart className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Health</p>
                      <p className="text-sm font-bold text-slate-800">Proactive Care</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white py-16 border-y border-slate-100 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <p className="text-4xl md:text-5xl font-black text-primary mb-2 transition-transform group-hover:scale-110 group-hover:duration-300">{stat.value}</p>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white/60 backdrop-blur-md relative z-10 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-950 mb-6 text-balance uppercase tracking-tighter drop-shadow-sm">
              {getText("Comprehensive Maternal Care Platform", "විස්තීර්ණ මාතෘ සත්කාර වේදිකාව", "விரிவான தாய்வழி பராமரிப்பு தளம்")}
            </h2>
            <p className="text-xl text-slate-700 max-w-2xl mx-auto font-black leading-relaxed">
              {getText(
                "BloomCare combines advanced AI technology with clinical expertise to provide the best maternal care.",
                "BloomCare හොඳම මාතෘ සත්කාරය සැපයීම සඳහා උසස් AI තාක්ෂණය සායනික විශේෂඥතාවය සමඟ ඒකාබද්ධ කරයි.",
                "BloomCare சிறந்த தாய்வழி பராமரிப்பை வழங்க மேம்பட்ட AI தொழில்நுட்பத்தை மருத்துவ நிபுணத்துவத்துடன் இணைக்கிறது."
              )}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 bg-white/50 glass hover:bg-white transition-all hover:-translate-y-2 duration-300 shadow-xl shadow-slate-200/50">
                <CardContent className="p-8">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 shadow-inner">
                    <feature.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-600 font-medium text-sm leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Conditions Section */}
      <section id="conditions" className="py-24 bg-white/70 backdrop-blur-md relative z-10 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-950 mb-6 text-balance uppercase tracking-tighter drop-shadow-sm">
              {getText("Conditions We Screen For", "අප පරීක්ෂා කරන තත්වයන්", "நாங்கள் திரையிடும் நிலைமைகள்")}
            </h2>
            <p className="text-xl text-slate-700 max-w-2xl mx-auto font-black leading-relaxed">
              {getText(
                "Our AI system is trained to detect early warning signs for these critical pregnancy conditions.",
                "මෙම තීරණාත්මක ගර්භණී තත්වයන් සඳහා ඉක්මන් අනතුරු ඇඟවීමේ සලකුණු හඳුනා ගැනීමට අපගේ AI පද්ධතිය පුහුණු කර ඇත.",
                "இந்த முக்கியமான கர்ப்ப நிலைமைகளுக்கான ஆரம்ப எச்சரிக்கை அறிகுறிகளைக் கண்டறிய எங்கள் AI அமைப்பு பயிற்சி பெற்றுள்ளது."
              )}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {conditions.map((condition, index) => (
              <Card key={index} className="border-0 shadow-2xl shadow-slate-200/60 glass overflow-hidden group hover:scale-[1.03] transition-all duration-500 rounded-[32px]">
                <div className="h-48 overflow-hidden relative">
                  <img 
                    src={condition.image} 
                    alt={condition.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent`} />
                  <div className={`absolute bottom-4 left-6 flex items-center gap-3`}>
                    <div className={`w-10 h-10 rounded-xl ${condition.color} flex items-center justify-center shadow-lg text-white`}>
                      <condition.icon className="w-6 h-6" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-8">
                  <h3 className="text-2xl font-black text-slate-950 mb-4">{condition.name}</h3>
                  <p className="text-slate-600 font-bold leading-relaxed text-sm">{condition.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* User Roles Section */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-slate-100 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 text-balance uppercase tracking-tight">
              {getText("Designed for Everyone", "සැමට නිර්මාණය කර ඇත", "அனைவருக்கும் வடிவமைக்கப்பட்டது")}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto font-medium">
              {getText(
                "Tailored experiences for every stakeholder in the maternal care journey.",
                "මාතෘ සත්කාර ගමනේ සෑම පාර්ශවකරුවෙකු සඳහාම අභිරුචි අත්දැකීම්.",
                "தாய்வழி பராமரிப்பு பயணத்தில் ஒவ்வொரு பங்குதாரருக்கும் வடிவமைக்கப்பட்ட அனுபவங்கள்."
              )}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="border-0 glass hover:bg-white transition-all hover:-translate-y-2 cursor-pointer group shadow-xl shadow-slate-200/50" onClick={onNavigateToLogin}>
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary group-hover:duration-300 transition-colors">
                  <Stethoscope className="w-10 h-10 text-primary group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-black text-lg text-slate-900 mb-1">
                  {getText("Frontline Staff", "මුල් පෙළ කාර්ය මණ්ඩලය", "முன்னணி ஊழியர்கள்")}
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  {getText("Nurses & Health Workers", "හෙදියන් සහ සෞඛ්‍ය කාර්යකරුවන්", "செவிலியர்கள் & சுகாதார பணியாளர்கள்")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 glass hover:bg-white transition-all hover:-translate-y-2 cursor-pointer group shadow-xl shadow-slate-200/50" onClick={onNavigateToLogin}>
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-accent group-hover:duration-300 transition-colors">
                  <Users className="w-10 h-10 text-accent group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-black text-lg text-slate-900 mb-1">
                  {getText("Obstetricians", "ප්‍රසව වෛද්‍යවරු", "மகப்பேறு மருத்துவர்கள்")}
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  {getText("Specialist Doctors", "විශේෂඥ වෛද්‍යවරු", "சிறப்பு மருத்துவர்கள்")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 glass hover:bg-white transition-all hover:-translate-y-2 cursor-pointer group shadow-xl shadow-slate-200/50" onClick={onNavigateToLogin}>
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-6 group-hover:bg-slate-900 group-hover:duration-300 transition-colors">
                  <Building2 className="w-10 h-10 text-slate-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-black text-lg text-slate-900 mb-1">
                  {getText("Hospital Admin", "රෝහල් පරිපාලක", "மருத்துவமனை நிர்வாகி")}
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  {getText("Management & Analytics", "කළමනාකරණය සහ විශ්ලේෂණ", "நிர்வாகம் & பகுப்பாய்வு")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 glass hover:bg-white transition-all hover:-translate-y-2 cursor-pointer group shadow-xl shadow-slate-200/50" onClick={onNavigateToLogin}>
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-rose-100 flex items-center justify-center mx-auto mb-6 group-hover:bg-rose-500 group-hover:duration-300 transition-colors">
                  <Baby className="w-10 h-10 text-rose-500 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-black text-lg text-slate-900 mb-1">
                  {getText("Patient Portal", "රෝගී ද්වාරය", "நோயாளி போர்டல்")}
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  {getText("Expectant Mothers", "ගර්භනී මව්වරුන්", "எதிர்பார்க்கும் தாய்மார்கள்")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="/images/mother-baby-painting.png"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-transparent" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-2xl text-white">
            <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight uppercase tracking-tight">
              {getText("Ready to Revolutionize Maternal Care?", "ආරම්භ කිරීමට සූදානම්ද?", "தொடங்க தயாரா?")}
            </h2>
            <p className="text-xl text-white/90 mb-10 leading-relaxed font-bold">
              {getText(
                "Join Hemas Hospitals in deploying the world's first multi-condition AI maternal risk engine. Early detection saves lives.",
                "AI-බලගැන්වූ අවදානම් හඳුනාගැනීම සමඟ මාතෘ සෞඛ්‍ය සේවය විප්ලවීය කිරීමට හේමාස් රෝහල් සමඟ එක්වන්න.",
                "AI-இயக்கப்படும் ஆபத்து கண்டறிதல் மூலம் தாய்வழி சுகாதாரத்தை புரட்சி செய்ய ஹேமாஸ் மருத்துவமனைகளுடன் இணையுங்கள்."
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-5">
              <Button 
                size="lg" 
                className="bg-white text-primary hover:bg-white/90 px-10 h-16 text-lg rounded-full shadow-2xl font-black uppercase tracking-widest"
                onClick={onNavigateToLogin}
              >
                {getText("Provider Login", "සෞඛ්‍ය සේවා පිවිසුම", "வழங்குநர் உள்நுழைவு")}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="bg-white/10 backdrop-blur-md border-white/60 text-white hover:bg-white/20 px-10 h-16 text-lg rounded-full font-black uppercase tracking-widest"
                onClick={onNavigateToLogin}
              >
                {getText("Sign In", "පුරනය", "உள்නුழை")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <footer className="bg-slate-900 text-white py-20 relative overflow-hidden">
        {/* Background Branding */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-bloom-gradient flex items-center justify-center shadow-xl shadow-primary/30">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h4 className="text-3xl font-black tracking-tighter">BloomCare</h4>
                  <p className="text-[10px] font-black tracking-[0.3em] uppercase text-primary">Hemas Hospitals</p>
                </div>
              </div>
              <p className="text-lg text-slate-400 max-w-md font-medium leading-relaxed">
                {getText(
                  "Integrating explainable AI into clinical workflows to protect every mother and child.",
                  "සෑම මවක් සහ දරුවෙකුම ආරක්ෂා කිරීම සඳහා සායනික කාර්ය ප්‍රවාහයන්ට පැහැදිලි කළ හැකි AI ඒකාබද්ධ කිරීම.",
                  "ஒவ்வொரு தாயையும் குழந்தையையும் பாதுகாக்க மருத்துவ பணிப்பாய்வுகளில் விளக்கக்கூடிய AI ஐ ஒருங்கிணைத்தல்."
                )}
              </p>
            </div>
            
            <div>
              <h5 className="font-black uppercase tracking-widest text-slate-200 mb-6 text-sm">{getText("Quick Links", "ඉක්මන් සබැඳි", "விரைவு இணைப்புகள்")}</h5>
              <ul className="space-y-4 text-slate-400 font-bold">
                <li><a href="#features" className="hover:text-primary transition-colors">{getText("Features", "විශේෂාංග", "අம்சங்கள்")}</a></li>
                <li><a href="#conditions" className="hover:text-primary transition-colors">{getText("Conditions", "තත්වයන්", "நிலைமைகள்")}</a></li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-black uppercase tracking-widest text-slate-200 mb-6 text-sm">{getText("Contact", "සම්බන්ධ වන්න", "தொடர்பු")}</h5>
              <div className="space-y-4 text-slate-400 font-bold">
                <p className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-primary" />
                  bloom@hemas.lk
                </p>
                <p className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-primary" />
                  Wattala, Sri Lanka
                </p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-slate-800 pt-12 flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <p>© 2026 Hemas Hospitals. {getText("All rights reserved AI Safety First.", "සියලු හිමිකම් ඇවිරිණි.", "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.")}</p>
            <div className="flex items-center gap-6">
              <span className="text-slate-700">Powered by</span>
              <span className="text-slate-300">Code Nexus</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
