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
  Building2
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
      title: getText("Offline Capable", "ஆஃப்லைன் திறன்", "නොබැඳි හැකියාව"),
      description: getText(
        "Mobile-first design works even in areas with limited connectivity, perfect for rural clinics.",
        "සීමිත සම්බන්ධතාව ඇති ප්‍රදේශවල පවා ක්‍රියා කරන ජංගම-ප්‍රථම නිර�  const conditions = [
    {
      name: getText("Preeclampsia", "ප්‍රෙක්ලැම්ප්සියා", "ப்ரீக்ளாம்ப்சியா"),
      description: getText(
        "High blood pressure disorder affecting pregnancy outcomes",
        "ගර්භණී ප්‍රතිඵල වලට බලපාන අධි රුධිර පීඩන ආබාධය",
        "கர்ப்ப விளைவுகளை பாதிக்கும் உயர் இரத்த அழுத்தக் கோளாறு"
      ),
      color: "bg-red-500",
      icon: Activity
    },
    {
      name: getText("Gestational Diabetes", "ගර්භණී දියවැඩියාව", "கர்ப்பகால நீரிழிவு"),
      description: getText(
        "Diabetes developing during pregnancy requiring monitoring",
        "ගර්භණී සමයේදී වර්ධනය වන නිරීක්ෂණය අවශ්‍ය දියවැඩියාව",
        "கர்ப்ப காலத்தில் கண்காணிப்பு தேவைப்படும் நீரிழிவு"
      ),
      color: "bg-amber-500",
      icon: Droplets
    },
    {
      name: getText("Preterm Birth Risk", "නොමේරූ උපත් අවදානම", "குறைப்பிரசவ ஆபத்து"),
      description: getText(
        "Risk of delivery before 37 weeks of gestation",
        "ගර්භණී සති 37 ට පෙර දරු ප්‍රසූතිය අවදානම",
        "கர்ப்பத்தின் 37 வாரங்களுக்கு முன் பிரசவ ஆபத்து"
      ),
      color: "bg-purple-500",
      icon: Baby
    }
  ]
ப்பீடுகள் எந்த காரணிகள் கணிப்புகளுக்கு பங்களிக்கின்றன என்பதை மருத்துவர்களுக்கு சரியாக காட்டுகின்றன."
      )
    },
    {
      icon: BarChart3,
      title: getText("Real-time Analytics", "තත්කාලීන විශ්ලේෂණ", "நிகழ்நேர பகுப்பாய்வு"),
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
    { value: "3", label: getText("Languages Supported", "සහාය භාෂා", "ஆதரிக்கப்படும் மொழிகள்") }
  ]

  const conditions = [
    {
      name: getText("Preeclampsia", "ප්‍රෙක්ලැම්ප්සියා", "ப்ரீக்ளாம்ப்சியா"),
      description: getText(
        "High blood pressure disorder affecting pregnancy outcomes",
        "ගර්භණී ප්‍රතිඵල වලට බලපාන අධි රුධිර පීඩන ආබාධය",
        "கர்ப்ப விளைவுகளை பாதிக்கும் உயர் இரத்த அழுத்தக் கோளாறு"
      ),
      color: "bg-red-500"
    },
    {
      name: getText("Gestational Diabetes", "ගර්භණී දියවැඩියාව", "கர்ப்பகால நீரிழிவு"),
      description: getText(
        "Diabetes developing during pregnancy requiring monitoring",
        "ගර්භණී සමයේදී වර්ධනය වන නිරීක්ෂණය අවශ්‍ය දියවැඩියාව",
        "கர்ப்ப காலத்தில் கண்காணிப்பு தேவைப்படும் நீரிழிவு"
      ),
      color: "bg-amber-500"
    },
    {
      name: getText("Preterm Birth Risk", "නොමේරූ උපත් අවදානම", "குறைப்பிரசவ ஆபத்து"),
      description: getText(
        "Risk of delivery before 37 weeks of gestation",
        "ගර්භණී සති 37 ට පෙර දරු ප්‍රසූතිය අවදානම",
        "கர்ப்பத்தின் 37 வாரங்களுக்கு முன் பிரசவ ஆபத்து"
      ),
      color: "bg-purple-500"
    }
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">BloomCare</h1>
                <p className="text-[10px] font-medium tracking-widest uppercase text-primary">Hemas Hospitals</p>
              </div>
            </div>

            {/* Nav Links - Hidden on mobile */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-[#0EA5E9] transition-colors">
                {getText("Features", "විශේෂාංග", "அம்சங்கள்")}
              </a>
              <a href="#conditions" className="text-sm font-medium text-slate-600 hover:text-[#0EA5E9] transition-colors">
                {getText("Conditions", "තත්වයන්", "நிலைமைகள்")}
              </a>
              <a href="#contact" className="text-sm font-medium text-slate-600 hover:text-[#0EA5E9] transition-colors">
                {getText("Contact", "සම්බන්ධ වන්න", "தொடர்பு")}
              </a>
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              {/* Language Toggle */}
              <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
                <SelectTrigger className="w-[100px] bg-white/50 backdrop-blur-sm border-slate-200 focus:ring-primary">
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
                className="hidden sm:flex border-primary text-primary hover:bg-primary/5 rounded-full px-6"
                onClick={onNavigateToLogin}
              >
                {getText("Sign In", "පුරනය", "உள்நுழை")}
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 rounded-full px-6"
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
            className="w-full h-full object-cover opacity-20 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
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
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] text-slate-900 text-balance tracking-tight">
                {getText(
                  "Early Detection for Every Mother",
                  "සෑම මවකටම ඉක්මන් හඳුනාගැනීම",
                  "ஒவ்வொரு தாய்க்கும் ஆரம்பகால கண்டறிதல்"
                )}
                <span className="text-primary block mt-2">BloomCare AI.</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl">
                {getText(
                  "Empowering maternal care through AI diagnostics. Detecting Preeclampsia, GDM, and Preterm birth trajectories with clinical precision.",
                  "AI රෝග විනිශ්චය හරහා මාතෘ සත්කාරය බලගැන්වීම. සායනික නිරවද්‍යතාවයෙන් ප්‍රෙක්ලැම්ප්සියා, GDM සහ නොමේරූ උපත් පථයන් හඳුනා ගැනීම.",
                  "AI கண்டறிதல் மூலம் தாய்வழி பராமரிப்பை மேம்படுத்துதல். மருத்துவ துல்லியத்துடன் ப்ரீக்ளாம்ப்சியா, GDM மற்றும் குறைப்பிரசவ பாதைகளைக் கண்டறிதல்."
                )}
              </p>
              <div className="flex flex-col sm:flex-row gap-5">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 text-white px-10 h-14 text-lg rounded-full shadow-xl shadow-primary/20"
                  onClick={onNavigateToLogin}
                >
                  {getText("Start Screening", "පරීක්ෂණය ආරම්භ කරන්න", "திரையிடலைத் தொடங்கு")}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-slate-200 bg-white/50 backdrop-blur-sm text-slate-700 hover:bg-white px-10 h-14 text-lg rounded-full"
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
                <p className="text-4xl md:text-5xl font-bold text-primary mb-2 transition-transform group-hover:scale-110 group-hover:duration-300">{stat.value}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 text-balance">
              {getText("Comprehensive Maternal Care Platform", "විස්තීර්ණ මාතෘ සත්කාර වේදිකාව", "விரிவான தாய்வழி பராமரிப்பு தளம்")}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {getText(
                "BloomCare combines advanced AI technology with clinical expertise to provide the best maternal care.",
                "BloomCare හොඳම මාතෘ සත්කාරය සැපයීම සඳහා උසස් AI තාක්ෂණය සායනික විශේෂඥතාවය සමඟ ඒකාබද්ධ කරයි.",
                "BloomCare சிறந்த தாய்வழி பராமரிப்பை வழங்க மேம்பட்ட AI தொழில்நுட்பத்தை மருத்துவ நிபுணத்துவத்துடன் இணைக்கிறது."
              )}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 bg-white/50 glass hover:bg-white transition-all hover:-translate-y-2 duration-300">
                <CardContent className="p-8">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 shadow-inner">
                    <feature.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Conditions Section */}
      <section id="conditions" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 text-balance">
              {getText("Conditions We Screen For", "අප පරීක්ෂා කරන තත්වයන්", "நாங்கள் திரையிடும் நிலைமைகள்")}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {getText(
                "Our AI system is trained to detect early warning signs for these critical pregnancy conditions.",
                "මෙම තීරණාත්මක ගර්භණී තත්වයන් සඳහා ඉක්මන් අනතුරු ඇඟවීමේ සලකුණු හඳුනා ගැනීමට අපගේ AI පද්ධතිය පුහුණු කර ඇත.",
                "இந்த முக்கியமான கர்ப்ப நிலைமைகளுக்கான ஆரம்ப எச்சரிக்கை அறிகுறிகளைக் கண்டறிய எங்கள் AI அமைப்பு பயிற்சி பெற்றுள்ளது."
              )}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {conditions.map((condition, index) => (
              <Card key={index} className="border-0 shadow-2xl glass overflow-hidden group hover:scale-105 transition-all duration-500">
                <div className={`h-2 ${condition.color} opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                <CardContent className="p-8">
                  <div className={`w-16 h-16 rounded-2xl ${condition.color} bg-opacity-10 flex items-center justify-center mb-6 shadow-sm group-hover:bg-opacity-20 transition-all`}>
                    <condition.icon className={`w-8 h-8 ${condition.color.replace('bg-', 'text-')}`} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">{condition.name}</h3>
                  <p className="text-slate-600 leading-relaxed">{condition.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* User Roles Section */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-slate-100 relative overflow-hidden">
        {/* Decorative Background Image */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 opacity-10 pointer-events-none">
          <img 
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/26cbefce023ef662973277f7865df390-F8fjF9yvryJzMuI1w7Cvb8GRuMnTNa.jpg"
            alt=""
            className="w-full h-full object-cover rounded-full"
          />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 text-balance">
              {getText("Designed for Everyone", "සැමට නිර්මාණය කර ඇත", "அனைவருக்கும் வடிவமைக்கப்பட்டது")}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {getText(
                "Tailored experiences for every stakeholder in the maternal care journey.",
                "මාතෘ සත්කාර ගමනේ සෑම පාර්ශවකරුවෙකු සඳහාම අභිරුචි අත්දැකීම්.",
                "தாய்வழி பராமரிப்பு பயணத்தில் ஒவ்வொரு பங்குதாரருக்கும் வடிவமைக்கப்பட்ட அனுபவங்கள்."
              )}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="border-0 glass hover:bg-white transition-all hover:-translate-y-2 cursor-pointer group shadow-lg" onClick={onNavigateToLogin}>
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary group-hover:duration-300 transition-colors">
                  <Stethoscope className="w-10 h-10 text-primary group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-1">
                  {getText("Frontline Staff", "මුල් පෙළ කාර්ය මණ්ඩලය", "முன்னணி ஊழியர்கள்")}
                </h3>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
                  {getText("Nurses & Health Workers", "හෙදියන් සහ සෞඛ්‍ය කාර්යකරුවන්", "செவிலியர்கள் & சுகாதார பணியாளர்கள்")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 glass hover:bg-white transition-all hover:-translate-y-2 cursor-pointer group shadow-lg" onClick={onNavigateToLogin}>
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-accent group-hover:duration-300 transition-colors">
                  <Users className="w-10 h-10 text-accent group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-1">
                  {getText("Obstetricians", "ප්‍රසව වෛද්‍යවරු", "மகப்பேறு மருத்துவர்கள்")}
                </h3>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
                  {getText("Specialist Doctors", "විශේෂඥ වෛද්‍යවරු", "சிறப்பு மருத்துவர்கள்")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 glass hover:bg-white transition-all hover:-translate-y-2 cursor-pointer group shadow-lg" onClick={onNavigateToLogin}>
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-6 group-hover:bg-slate-900 group-hover:duration-300 transition-colors">
                  <Building2 className="w-10 h-10 text-slate-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-1">
                  {getText("Hospital Admin", "රෝහල් පරිපාලක", "மருத்துவமனை நிர்வாகி")}
                </h3>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
                  {getText("Management & Analytics", "කළමනාකරණය සහ විශ්ලේෂණ", "நிர்வாகம் & பகுப்பாய்வு")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 glass hover:bg-white transition-all hover:-translate-y-2 cursor-pointer group shadow-lg" onClick={onNavigateToLogin}>
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-rose-100 flex items-center justify-center mx-auto mb-6 group-hover:bg-rose-500 group-hover:duration-300 transition-colors">
                  <Baby className="w-10 h-10 text-rose-500 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-1">
                  {getText("Patient Portal", "රෝගී ද්වාරය", "நோயாளி போர்டல்")}
                </h3>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
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
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              {getText("Ready to Revolutionize Maternal Care?", "ආරම්භ කිරීමට සූදානම්ද?", "தொடங்க தயாரா?")}
            </h2>
            <p className="text-xl text-white/90 mb-10 leading-relaxed">
              {getText(
                "Join Hemas Hospitals in deploying the world's first multi-condition AI maternal risk engine. Early detection saves lives.",
                "AI-බලගැන්වූ අවදානම් හඳුනාගැනීම සමඟ මාතෘ සෞඛ්‍ය සේවය විප්ලවීය කිරීමට හේමාස් රෝහල් සමඟ එක්වන්න.",
                "AI-இயக்கப்படும் ஆபத்து கண்டறிதல் மூலம் தாய்வழி சுகாதாரத்தை புரட்சி செய்ய ஹேமாஸ் மருத்துவமனைகளுடன் இணையுங்கள்."
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-5">
              <Button 
                size="lg" 
                className="bg-white text-primary hover:bg-white/90 px-10 h-14 text-lg rounded-full shadow-2xl"
                onClick={onNavigateToLogin}
              >
                {getText("Provider Login", "සෞඛ්‍ය සේවා පිවිසුම", "வழங்குநர் உள்நுழைவு")}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white/40 text-white hover:bg-white/10 px-10 h-14 text-lg rounded-full"
                onClick={onNavigateToLogin}
              >
                {getText("Sign In", "පුරනය", "உள்நுழை")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-white relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute left-0 bottom-0 w-64 h-64 opacity-5 pointer-events-none">
          <img 
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1d925020dd629cfa9dd925818a3735bb-oi8U6x7UcEPNmKqcEV2JjeQ4bUr3Dd.jpg"
            alt=""
            className="w-full h-full object-cover rounded-full"
          />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">
                {getText("Contact Us", "අප අමතන්න", "எங்களை தொடர்பு கொள்ளவும்")}
              </h2>
              <p className="text-slate-600 mb-8">
                {getText(
                  "Have questions about BloomCare? Our team is here to help you get started.",
                  "BloomCare ගැන ප්‍රශ්න තිබේද? ඔබට ආරම්භ කිරීමට උදව් කිරීමට අපගේ කණ්ඩායම මෙහි සිටී.",
                  "BloomCare பற்றி கேள்விகள் உள்ளதா? தொடங்க உங்களுக்கு உதவ எங்கள் குழு இங்கே உள்ளது."
                )}
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{getText("Emergency Hotline", "හදිසි ඇමතුම් අංකය", "அவசர உதவி எண்")}</p>
                    <p className="font-semibold text-slate-900">0117 888 888</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{getText("Email", "ඊමේල්", "மின்னஞ்சல்")}</p>
                    <p className="font-semibold text-slate-900">bloomcare@hemashospitals.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{getText("Address", "ලිපිනය", "முகவரி")}</p>
                    <p className="font-semibold text-slate-900">389, Negombo Road, Wattala</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {getText("Send us a message", "අපට පණිවිඩයක් යවන්න", "எங்களுக்கு செய்தி அனுப்புங்கள்")}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {getText("Your Name", "ඔබේ නම", "உங்கள் பெயர்")}
                  </label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9]"
                    placeholder={getText("Enter your name", "ඔබේ නම ඇතුලත් කරන්න", "உங்கள் பெயரை உள்ளிடவும்")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {getText("Email", "ඊමේල්", "மின்னஞ்சல்")}
                  </label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9]"
                    placeholder={getText("Enter your email", "ඔබේ ඊමේල් ඇතුලත් කරන්න", "உங்கள் மின்னஞ்சலை உள்ளிடவும்")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {getText("Message", "පණිවිඩය", "செய்தி")}
                  </label>
                  <textarea 
                    rows={4}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] resize-none"
                    placeholder={getText("How can we help?", "අපට ඔබට උදව් කළ හැක්කේ කෙසේද?", "நாங்கள் எப்படி உதவ முடியும்?")}
                  />
                </div>
                <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-12 shadow-lg shadow-primary/20">
                  {getText("Send Message", "පණිවිඩය යවන්න", "செய்தி அனுப்பு")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold">BloomCare</h4>
                  <p className="text-[10px] font-medium tracking-widest uppercase text-primary">Hemas Hospitals</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                {getText(
                  "AI-Powered Maternal Risk Intelligence System",
                  "AI-බලගැන්වූ මාතෘ අවදානම් බුද්ධි පද්ධතිය",
                  "AI-இயக்கப்படும் தாய்வழி ஆபத்து நுண்ணறிவு அமைப்பு"
                )}
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">{getText("Quick Links", "ඉක්මන් සබැඳි", "விரைவு இணைப்புகள்")}</h5>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#features" className="hover:text-white transition-colors">{getText("Features", "විශේෂාංග", "அம்சங்கள்")}</a></li>
                <li><a href="#conditions" className="hover:text-white transition-colors">{getText("Conditions", "තත්වයන්", "நிலைமைகள்")}</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">{getText("Contact", "සම්බන්ධ වන්න", "தொடர்பு")}</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">{getText("Legal", "නීතිමය", "சட்டபூர்வ")}</h5>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">{getText("Privacy Policy", "රහස්‍යතා ප්‍රතිපත්තිය", "தனியுரிமைக் கொள்கை")}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{getText("Terms of Service", "සේවා නියම", "சேவை விதிமுறைகள்")}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{getText("Data Protection", "දත්ත ආරක්ෂාව", "தரவு பாதுகாப்பு")}</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">{getText("Accreditations", "පිළිගැනීම්", "அங்கீகாரங்கள்")}</h5>
              <div className="flex gap-2">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-[#0EA5E9]" />
                </div>
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
            <p>© 2026 Hemas Hospitals. {getText("All rights reserved.", "සියලු හිමිකම් ඇවිරිණි.", "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.")}</p>
            <p>{getText("Design and Development by", "නිර්මාණය සහ සංවර්ධනය", "வடிவமைப்பு மற்றும் மேம்பாடு")} <span className="text-[#0EA5E9]">Code Nexus</span></p>
          </div>
        </div>
      </footer>
    </div>
  )
}

