import { NextRequest, NextResponse } from "next/server"

type ChatNavigateTo = "none" | "home" | "login" | "features" | "conditions" | "dashboard" | "appointments"

interface ChatbotResponse {
  reply: string
  navigateTo: ChatNavigateTo
}

const ALLOWED_NAVIGATIONS: ChatNavigateTo[] = [
  "none",
  "home",
  "login",
  "features",
  "conditions",
  "dashboard",
  "appointments"
]

type SupportedLanguage = "en" | "si" | "ta"

type IntentKey =
  | "greeting"
  | "login"
  | "features"
  | "conditions"
  | "dashboard"
  | "home"
  | "appointments"
  | "where_am_i"
  | "current_page_info"
  | "help"

interface KnowledgeEntry {
  intent: IntentKey
  navigateTo: ChatNavigateTo
  keywords: Record<SupportedLanguage, string[]>
  replies: Record<SupportedLanguage, string>
}

// 1. EXPANDED KNOWLEDGE BASE WITH NATURAL TRANSLATIONS
const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    intent: "greeting",
    navigateTo: "none",
    keywords: {
      en: ["hi", "hello", "hey", "good morning", "good evening", "start"],
      si: ["හලෝ", "ආයුබෝවන්", "කොහොමද", "hello", "halo"],
      ta: ["வணக்கம்", "ஹலோ", "எப்படி இருக்கீங்க", "vanakkam"],
    },
    replies: {
      en: "Hello! Welcome to BloomCare. I can help you navigate the system or answer basic questions. How can I assist you today?",
      si: "ආයුබෝවන්! BloomCare වෙත සාදරයෙන් පිළිගනිමු. පද්ධතිය භාවිතා කරන ආකාරය ගැන මට ඔබට උදව් කළ හැක. මම කෙසේද උදව් කළ යුත්තේ?",
      ta: "வணக்கம்! BloomCare-க்கு உங்களை வரவேற்கிறோம். அமைப்பை எவ்வாறு பயன்படுத்துவது என்பதற்கு நான் உதவ முடியும். நான் உங்களுக்கு எப்படி உதவ முடியும்?",
    },
  },
  {
    intent: "login",
    navigateTo: "login",
    keywords: {
      en: ["login", "log in", "sign in", "account", "register", "access"],
      si: ["ලොගින්", "ගිණුම", "ඇතුල් වෙන්න", "signin", "log wenda"],
      ta: ["உள்நுழை", "லாகின்", "கணக்கு", "சைன் இன்", "ulnulai"],
    },
    replies: {
      en: "I can take you to the Login page. Once you enter your credentials, you'll be redirected to your specific dashboard.",
      si: "ඔබගේ ගිණුමට ඇතුල් වීමට මම ඔබව Login පිටුවට ගෙන යන්නම්. ඔබගේ තොරතුරු ඇතුළත් කළ පසු ඔබගේ dashboard එකට පිවිසිය හැක.",
      ta: "உங்கள் கணக்கில் நுழைய உங்களை Login பக்கத்திற்கு அழைத்துச் செல்கிறேன். உங்கள் விவரங்களை உள்ளிட்ட பின் உங்கள் டாஷ்போர்டுக்கு செல்லலாம்.",
    },
  },
  {
    intent: "appointments",
    navigateTo: "appointments",
    keywords: {
      en: ["appointment", "booking", "schedule", "doctor", "meet"],
      si: ["හමුවීම", "වෛද්‍ය", "චැනල්", "channel", "appointment"],
      ta: ["சந்திப்பு", "மருத்துவர்", "அப்பாயின்ட்மென்ட்", "நேர ஒதுக்கீடு"],
    },
    replies: {
      en: "I'll navigate you to the appointments section where you can manage doctor schedules and patient visits.",
      si: "වෛද්‍ය හමුවීම් සහ කාලසටහන් කළමනාකරණය කිරීම සඳහා මම ඔබව Appointments පිටුවට ගෙන යන්නම්.",
      ta: "மருத்துவர் சந்திப்புகள் மற்றும் அட்டவணைகளை நிர்வகிக்க உங்களை Appointments பக்கத்திற்கு அழைத்துச் செல்கிறேன்.",
    },
  },
  {
    intent: "features",
    navigateTo: "features",
    keywords: {
      en: ["feature", "capability", "what can you do", "functions", "about"],
      si: ["විශේෂාංග", "හැකියාව", "මොනවද තියෙන්නෙ", "features", "wada"],
      ta: ["அம்சங்கள்", "திறன்கள்", "என்ன செய்யும்", "பயன்பாடுகள்"],
    },
    replies: {
      en: "BloomCare provides AI-powered maternal risk screening, appointment management, and role-specific clinical dashboards.",
      si: "BloomCare මගින් කෘතිම බුද්ධිය (AI) හරහා මාතෘ අවදානම් හඳුනාගැනීම, වෛද්‍ය හමුවීම් කළමනාකරණය සහ සායනික වාර්තා සපයනු ලබයි.",
      ta: "BloomCare செயற்கை நுண்ணறிவு (AI) மூலம் தாய்மை ஆபத்து கண்டறிதல், சந்திப்பு மேலாண்மை மற்றும் மருத்துவ அறிக்கைகளை வழங்குகிறது.",
    },
  },
  {
    intent: "conditions",
    navigateTo: "conditions",
    keywords: {
      en: ["condition", "diabetes", "preeclampsia", "preterm", "risk", "disease"],
      si: ["තත්ත්ව", "අවදානම්", "දියවැඩියාව", "diabetes", "preeclampsia", "preterm", "leada"],
      ta: ["நிலை", "ஆபத்து", "நீரிழிவு", "diabetes", "preeclampsia", "preterm", "நோய்"],
    },
    replies: {
      en: "Our predictive models specifically monitor for maternal risks like Gestational Diabetes, Preeclampsia, and Preterm birth.",
      si: "අපගේ පද්ධතිය ප්‍රධාන වශයෙන් ගර්භණී දියවැඩියාව, පූර්ව-එක්ලැම්ප්සියාව (Preeclampsia) සහ නොමේරූ දරු උපත් වැනි අවදානම් නිරීක්ෂණය කරයි.",
      ta: "எங்கள் அமைப்பு முக்கியமாக கர்ப்பகால நீரிழிவு, ப்ரீக்ளாம்ப்சியா மற்றும் முன்கூட்டிய பிறப்பு போன்ற தாய்மை ஆபத்துகளை கண்காணிக்கிறது.",
    },
  },
  {
    intent: "dashboard",
    navigateTo: "dashboard",
    keywords: {
      en: ["dashboard", "portal", "panel", "my workspace"],
      si: ["dashboard", "පැනලය", "portal", "මගේ පිටුව"],
      ta: ["டாஷ்போர்டு", "போர்ட்டல்", "panel", "என் பக்கம்"],
    },
    replies: {
      en: "Taking you to your dashboard now. Here you can view your specific tasks and patient records.",
      si: "ඔබව dashboard එක වෙත ගෙන යමින් පවතී. මෙතැනින් ඔබට අදාළ කාර්යයන් සහ රෝගී වාර්තා බලාගත හැක.",
      ta: "உங்களை டாஷ்போர்டுக்கு அழைத்துச் செல்கிறேன். இங்கே உங்கள் குறிப்பிட்ட பணிகள் மற்றும் நோயாளி பதிவுகளைப் பார்க்கலாம்.",
    },
  },
  {
    intent: "home",
    navigateTo: "home",
    keywords: {
      en: ["home", "start page", "landing", "go back"],
      si: ["home", "මුල් පිටුව", "ආපසු", "mul pituwa"],
      ta: ["முகப்பு", "home", "திரும்பிச் செல்", "main page"],
    },
    replies: {
      en: "Returning you to the BloomCare home page.",
      si: "ඔබව BloomCare හි මුල් පිටුවට නැවත ගෙන යමින් පවතී.",
      ta: "உங்களை BloomCare முகப்புப் பக்கத்திற்குத் திருப்புகிறேன்.",
    },
  },
  {
    intent: "where_am_i",
    navigateTo: "none",
    keywords: {
      en: ["where am i", "current page", "what page is this", "location"],
      si: ["මම කොහෙද ඉන්නෙ", "මේ මොන පිටුවද", "current page", "koheda inne"],
      ta: ["நான் எங்கே இருக்கிறேன்", "இது எந்த பக்கம்", "current page"],
    },
    replies: {
      en: "Let me check where you are right now.",
      si: "ඔබ දැනට සිටින ස්ථානය මම පරීක්ෂා කර බලන්නම්.",
      ta: "நீங்கள் தற்போது எங்கே இருக்கிறீர்கள் என்பதை நான் சரிபார்க்கிறேன්.",
    },
  },
  {
    intent: "current_page_info",
    navigateTo: "none",
    keywords: {
      en: ["what's here", "what is this page", "what can i do here", "whats on this page", "explain this page", "tell me about this page", "show me"],
      si: ["මෙතැනින් කුමක්ද", "මෙය කුමන පිටුවද", "මට කෙසේ කළ හැකිද", "පිටුව ගැන සඳහන් කරන්න", "දැනුම දෙන්න", "පෙන්වා දෙන්න"],
      ta: ["இங்கே என்ன உள்ளது", "இது எந்த பக්கம்", "நான் இங்கே என்ன செய்யலாம்", "பக்கத்தை விளக்கு", "சொல்லு", "காட்டு"],
    },
    replies: {
      en: "I'll explain what's available on this page.",
      si: "මෙම පිටුවෙ ගැන සවිස්තරයෙන් කියන්නම්.",
      ta: "இந்த பக்கத்தில் உள்ளவை விளக்குகிறேன்.",
    },
  },
]

// PAGE-SPECIFIC DESCRIPTIONS IN ALL LANGUAGES
const PAGE_DESCRIPTIONS: Record<
  string,
  Record<SupportedLanguage, string>
> = {
  home: {
    en: "You are on the BloomCare Home page. Here you can:\n• Learn about BloomCare's mission and features\n• Navigate to Login or register as a new user\n• Explore information about maternal health monitoring\n• Access the appointment booking system\n• View featured resources and patient testimonials",
    si: "ඔබ BloomCare මුල් පිටුවේ සිටින්නේය. මෙතැනින්:\n• BloomCare පිළිබඳව දැනගත හැක\n• ලොගින් හෝ නව පිරිශ්‍ර ලෙස ඉregistar වත හැක\n• සෞඛ්‍ය දැනුම ලබාගත හැක\n• වෛද්‍ය හමුවීම් වෙන්කර ගත හැක\n• සම්පත් සහ රෝගී අත්දැකීම් බලාගත හැක",
    ta: "நீங்கள் BloomCare முகப்புப் பக்கத்தில் இருக்கிறீர்கள். இங்கே நீங்கள்:\n• BloomCare பற்றி அறிய முடியும்\n• உள்நுழைக அல்லது புதிய பயனாக பதிவு செய்யலாம்\n• மாதத் திறன் சுகாதாரத் தகவல் கற்கலாம்\n• மருத்துவ சந்திப்பை பதிவு செய்ய முடியும்\n• வளங்களை மற்றும் நோயாளி கட்டுரைகளைப் பார்க்கலாம்",
  },
  login: {
    en: "You are on the Login page. Here you can:\n• Access your account with your credentials\n• Patient login using National ID\n• Staff/Doctor login using email\n• Set password on first login\n• Recover your account if needed",
    si: "ඔබ ලොගින් පිටුවේ සිටින්නේය. මෙතැනින්:\n• ඔබගේ ගිණුමට ප්‍රවේශ වත හැක\n• ජාතික හැඳුනුම්පත යොදා අ\n• ඊ-තැපැල් ගිණුම් දිනපතා ලොගින් වත හැක\n• පළමු ලොගින්වල රහස්‍යය සකස් කරන්න\n• ගිණුම ප්‍රතිසංස්කරණය කරන්න",
    ta: "நீங்கள் உள்நுழைப் பக்கத்தில் இருக்கிறீர்கள். இங்கே நீங்கள்:\n• உங்கள் கணக்கில் அணுக முடியும்\n• தேசிய அடையாள லेखையைப் பயன்படுத்தி உள்நுழைக\n• மின்னஞ்eal்ல் கணக்குகளை உபயோகிக்க\n• முதல் உள்நுழைவில் கடவுச்சொல் அமைக்க\n• கணக்கை மீட்க",
  },
  features: {
    en: "You are on the Features page. Here you can learn about:\n• AI-Powered Risk Screening (Stage 1 & 2)\n• Appointment Management System\n• Role-Based Clinical Dashboards\n• Patient Longitudinal Tracking\n• Multilingual Support (English, Sinhala, Tamil)\n• Real-time Risk Assessment and Alerts",
    si: "ඔබ Features පිටුවේ සිටින්නේය. මෙතැනින් ඔබට පිළිබඳව දැනගත හැක:\n• කෘතිම බුද්ධිය ලබන ඉතිරි පිරික්සුම (Stage 1 & 2)\n• වෛද්‍ය හමුවීම් කළමනාකරණ පද්ධතිය\n• කාර්යභාර-පදනම් සායනික dashboards\n• රෝගී ඉතිහාස පුරුදු\n• බහුවිධ භාෂා සහාය (English, Sinhala, Tamil)\n• සැබෑ වේලා අවදානම් ඇගයීම",
    ta: "நீங்கள் Features பக்கத்தில் இருக்கிறீர்கள். இங்கே நீங்கள் பற்றி அறிய முடியும்:\n• AI-இயக்கிய ஆபத்து பரிசோதனை (Stage 1 & 2)\n• மருத்துவ சந்திப்பு நிர்வாஹக அமைப்பு\n• பாத்திரம்-அடிப்படையிலான மருத்துவ டாஷ்போர்டுகள்\n• நோயாளி நீண்டகால கண்ணோட்டம்\n• பல்மொழி ஆதரவு (ஆங்கிலம், சிங்களம், தமிழ்)\n• நிஜ-நேர ஆபத்து மதிப்பீட்டு",
  },
  conditions: {
    en: "You are on the Conditions page. Here you can learn about monitored conditions:\n• Gestational Diabetes Mellitus (GDM)\n• Preeclampsia (Early & Late Onset)\n• Preterm Birth Risk Factors\n• Risk Assessment Criteria\n• Warning Signs & Symptoms\n• When to Escalate to Specialist Care",
    si: "ඔබ Conditions පිටුවේ සිටින්නේය. මෙතැනින් ඔබට නිරීක්ෂණ කරන තත්ත්ව ගැන දැනගත හැක:\n• Gestational Diabetes Mellitus (GDM)\n• Preeclampsia\n• නොමේරූ දරු උපත \n• අවදානම් තක්සේරු නිර්ණයන්\n• අනතුරු සංඥා සහ ලක්ෂණ\n• විශේෂඥ පරිපතනයට පිවිසෙන්නේ කවදාද",
    ta: "நீங்கள் Conditions பக்கத்தில் இருக்கிறீர்கள். இங்கே நீங்கள் நிரீக்ஷணம் செய்யப்படும் நிலைகளைப் பற்றி அறிய முடியும்:\n• கர்ப்பகால நீரிழிவு நோய் (GDM)\n• ப்ரீக்ளாம்ப்சியா\n• முன்கூட்டிய பிறப்பு ஆபத்து\n• ஆபத்து மதிப்பீட்டு அளவுகோல்\n• எச்சரிக்கை அறிகுறி மற்றும் அறிகுறி\n• விशिषज्ञ பரிபதனத்திற்கு வரும் போது",
  },
  dashboard: {
    en: "You are on the Dashboard page. Here you can:\n• View your role-specific summary (Admin/Doctor/Frontline/Patient)\n• Access your patient queue or assigned cases\n• Monitor key health metrics and risk scores\n• Schedule and manage appointments\n• View recent alerts and escalations\n• Access reports and medical history",
    si: "ඔබ Dashboard පිටුවේ සිටින්නේය. මෙතැනින් ඔබට පිළිබඳව කිරීම හැක:\n• ඔබගේ කාර්යභාර-එකිණ්ඩිත සාරාංශය බලාගැනීම\n• ඔබගේ රෝගී කිරුණු හෝ බරපතල ඉතිරි ප්‍රවේශ\n• ප්‍රධාන සෞඛ්‍ය මිතර එබং අවදානම් ස්කොර නිරීක්ෂණ\n• වෛද්‍ය හමුවීම් කාල සටහන් කිරීම සහ කළමනාකරණ\n• මෑත අනතුරු සහ escalations බැලීම\n• වාර්තා සහ වෛද්‍ය ඉතිහාස ප්‍රවේශ",
    ta: "நீங்கள் Dashboard பக்கத்தில் இருக்கிறீர்கள். இங்கே நீங்கள்:\n• உங்கள் பாத்திரம்-கட்டுப்பட்ட சுருக்கம் பார்க்க முடியும்\n• உங்கள் நோயாளி வரிசை அல்லது ஒதுக்கக்கப்பட்ட நிகழ்வுகளை அணுக\n• முக்கிய சுகாதாரம் மெட્રિक्स மற்றும் ஆபத்து மதிப்பீடுகளை மருந்து\n• மருத்துவ சந்திப்பு நேரக்கூட்டம் மற்றும் நிர்வாஹம்\n• சமீபத்திய எச்சரிக்கை மற்றும் போதையை பார்க்க\n• அறிக்கைகளை மற்றும் மருத்துவ வரலாற்றை அணுக",
  },
  appointments: {
    en: "You are on the Appointments page. Here you can:\n• View all upcoming appointments\n• Schedule new appointments with available specialists\n• Reschedule existing appointments\n• Cancel appointments if needed\n• Check specialist availability\n• View appointment details and notes",
    si: "ඔබ Appointments පිටුවේ සිටින්නේය. මෙතැනින් ඔබට කිරීම හැක:\n• සියලුම යාමින් ඉන්න වෛද්‍ය හමුවීම් බලාගැනීම\n• පවතින විශේෂඥ සමඟ නව හමුවීම් කාල සටහන් කිරීම\n• දැනට ඉන්න හමුවීම් කාල පරිවර්තනය\n• අවශ්‍ය නම් හමුවීම් 취소\n• විශේෂඥ පැවැත්ම පරීක්ෂා කිරීම\n• හමුවීම විස්තර සහ සටහන බලාගැනීම",
    ta: "நீங்கள் Appointments பக்கத்தில் இருக்கிறீர்கள். இங்கே நீங்கள்:\n• அனைத்து வரக்குக மருத்துவ சந்திப்புகளைப் பார்க்க\n• வணிக மாற்றத் தியாக் உட்தொழிலாளர் நிபுணர்களுடன் புதிய சந்திப்பை расписание\n• தற்போதுள்ள சந்திப்புகளை மாற்றி வரிசை\n• প्रয়োजনीय சந்திப்புகளை রत্४\n• নিபুણ कर८ दया६नी पbar०नি९\n• सन्দap्पு विसतर सह सटहन बलागतहनिम",
  },
}

const HELP_REPLY: Record<SupportedLanguage, string> = {
  en: "I didn't quite catch that. I can help you navigate to your Dashboard, login page, or explain BloomCare's features and monitored conditions.",
  si: "මට එය පැහැදිලි මදි. ඔබට Dashboard එකට යාමට, Login වීමට, හෝ BloomCare විශේෂාංග ගැන දැනගැනීමට මට උදව් කළ හැක.",
  ta: "எனக்கு அது சரியாகப் புரியவில்லை. டாஷ்போர்டுக்குச் செல்ல, உள்நுழைய அல்லது BloomCare அம்சங்களைப் பற்றி அறிய நான் உங்களுக்கு உதவ முடியும்.",
}

// Helper: Normalize text for matching
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim()
}

// 2. SMARTER LANGUAGE DETECTION
// Scans the entire knowledge base to see which language has the most keyword matches
function detectLanguage(text: string): SupportedLanguage {
  const normalizedText = normalize(text)
  let scores = { en: 0, si: 0, ta: 0 }

  for (const entry of KNOWLEDGE_BASE) {
    for (const lang of ["en", "si", "ta"] as SupportedLanguage[]) {
      for (const keyword of entry.keywords[lang]) {
        if (normalizedText.includes(normalize(keyword))) {
          scores[lang] += 1
        }
      }
    }
  }

  // Default to English if no clear match, otherwise return the highest scoring language
  if (scores.si > scores.en && scores.si >= scores.ta) return "si"
  if (scores.ta > scores.en && scores.ta >= scores.si) return "ta"
  return "en"
}

// 3. IMPROVED INTENT MATCHING
function findBestEntry(message: string, language: SupportedLanguage): KnowledgeEntry | null {
  const text = normalize(message)
  let best: KnowledgeEntry | null = null
  let bestScore = 0

  for (const entry of KNOWLEDGE_BASE) {
    // Prioritize keywords in the detected language, but fall back to checking all
    const langKeywords = entry.keywords[language]
    const genericKeywords = [
      ...entry.keywords.en,
      ...entry.keywords.si,
      ...entry.keywords.ta,
    ]

    let score = 0
    for (const keyword of [...langKeywords, ...genericKeywords]) {
      const key = normalize(keyword)
      // Added word boundary logic for English to prevent partial matches (e.g. "port" matching "portal")
      if (key.length > 0) {
          const isEnglishAlpha = /^[a-z0-9 ]+$/.test(key);
          if (isEnglishAlpha) {
              const regex = new RegExp(`\\b${key}\\b`, 'i');
              if (regex.test(text)) score += 2; // Higher weight for exact word match
          } else {
              if (text.includes(key)) score += 1;
          }
      }
    }

    if (score > bestScore) {
      best = entry
      bestScore = score
    }
  }

  return bestScore > 0 ? best : null
}

function buildReply(
  message: string,
  currentView?: string,
  currentRole?: string | null,
): ChatbotResponse {
  const language = detectLanguage(message)
  const entry = findBestEntry(message, language)

  if (!entry) {
    return {
      reply: HELP_REPLY[language],
      navigateTo: "none",
    }
  }

  // 4. CONTEXT-AWARE RESPONSE LOGIC
  if (entry.intent === "where_am_i") {
    const viewLabel = currentView || "an unknown page"
    const baseText = entry.replies[language]
    
    let roleText = "";
    if (currentRole && currentRole !== "null") {
        const cleanRole = currentRole.replace('_', ' ').toLowerCase();
        if (language === "si") roleText = ` ඔබ පද්ධතියට ලොග් වී ඇත්තේ '${cleanRole}' ලෙසයි.`;
        else if (language === "ta") roleText = ` உங்கள் கணக்கு '${cleanRole}' ஆக பதிவு செய்யப்பட்டுள்ளது.`;
        else roleText = ` You are currently logged in as a ${cleanRole}.`;
    }

    let dynamicReply = `${baseText} You are currently viewing the ${viewLabel} page.${roleText}`;
    if (language === "si") dynamicReply = `${baseText} ඔබ දැනට සිටින්නේ ${viewLabel} පිටුවේය.${roleText}`;
    if (language === "ta") dynamicReply = `${baseText} நீங்கள் தற்போது ${viewLabel} பக்கத்தில் உள்ளீர்கள்.${roleText}`;

    return {
      reply: dynamicReply,
      navigateTo: "none",
    }
  }

  // NEW: Current page information
  if (entry.intent === "current_page_info") {
    const viewKey = currentView || "home"
    const pageDesc = PAGE_DESCRIPTIONS[viewKey]?.[language] || PAGE_DESCRIPTIONS["home"][language]

    return {
      reply: pageDesc,
      navigateTo: "none",
    }
  }

  return {
    reply: entry.replies[language],
    navigateTo: ALLOWED_NAVIGATIONS.includes(entry.navigateTo) ? entry.navigateTo : "none",
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      message?: string
      currentView?: string
      currentRole?: string | null
    }

    const message = body?.message?.trim()
    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 })
    }

    const replyData = buildReply(message, body.currentView, body.currentRole)

    return NextResponse.json({
      ...replyData,
      mode: "key-answer",
      language: detectLanguage(message),
    })
  } catch (error) {
    console.error("Unexpected chatbot error", error)
    return NextResponse.json({
      reply: HELP_REPLY["en"], // Safe fallback
      navigateTo: "none",
      mode: "key-answer",
      language: "en",
    }, { status: 500 }) // Added proper 500 status code for errors
  }
}