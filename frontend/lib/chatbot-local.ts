/**
 * Local multilingual FAQ + navigation assistant (keyword intents; no LLM).
 *
 * Manual smoke prompts:
 * - "hi" / "ආයුබෝවන්" / "வணக்கம்"
 * - "how do I log in" → login navigate
 * - "what is preeclampsia" / "gdm"
 * - "how does offline work"
 * - "what do frontline staff do"
 * - "asdfqwerty" → rich fallback (not empty)
 */

export type ChatNavigateTo =
  | "none"
  | "home"
  | "login"
  | "features"
  | "conditions"
  | "dashboard"
  | "appointments"

export type SupportedLanguage = "en" | "si" | "ta"

export interface ChatbotResponse {
  reply: string
  navigateTo: ChatNavigateTo
  language: SupportedLanguage
  mode: "key-answer"
}

const ALLOWED_NAVIGATIONS: ChatNavigateTo[] = [
  "none",
  "home",
  "login",
  "features",
  "conditions",
  "dashboard",
  "appointments",
]

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
  | "roles"
  | "offline"
  | "stage1_stage2"
  | "explainability"
  | "demo_login"
  | "security"
  | "contact"
  | "language_help"
  | "logout"
  | "prescriptions"
  | "reports"
  | "triage"

interface KnowledgeEntry {
  intent: IntentKey
  navigateTo: ChatNavigateTo
  keywords: Record<SupportedLanguage, string[]>
  replies: Record<SupportedLanguage, string>
  /** Extra weight when currentRole matches */
  roleBoost?: Partial<Record<string, number>>
  /** Extra weight when currentView matches */
  viewBoost?: Partial<Record<string, number>>
}

const MIN_SCORE = 3

/** Normalize aliases before matching (misspellings / short forms). */
const ALIAS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bpre[\s-]?eclampsia\b/gi, "preeclampsia"],
  [/\bgdm\b/gi, "gestational diabetes"],
  [/\bsign[\s-]?in\b/gi, "sign in"],
  [/\blog[\s-]?in\b/gi, "login"],
  [/\bstage\s*1\b/gi, "stage 1"],
  [/\bstage\s*2\b/gi, "stage 2"],
  [/\bai explain(ation|ability)?\b/gi, "explainability"],
  [/\bshap\b/gi, "explainability"],
]

function normalize(text: string): string {
  let out = text.toLowerCase().replace(/\s+/g, " ").trim()
  for (const [pattern, replacement] of ALIAS_REPLACEMENTS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function keywordScore(text: string, keyword: string, languagePriority: boolean): number {
  const key = normalize(keyword)
  if (!key) return 0

  const isEnglishAlpha = /^[a-z0-9 ]+$/.test(key)
  let matched = false
  if (isEnglishAlpha) {
    const regex = new RegExp(`\\b${escapeRegex(key)}\\b`, "i")
    matched = regex.test(text)
  } else {
    matched = text.includes(key)
  }
  if (!matched) return 0

  // Longer phrases beat short tokens; language-priority keywords get a bump.
  const lengthBonus = Math.min(key.split(" ").length, 4)
  const base = isEnglishAlpha ? 2 + lengthBonus : 1 + lengthBonus
  return languagePriority ? base + 1 : base
}

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    intent: "greeting",
    navigateTo: "none",
    keywords: {
      en: ["hi", "hello", "hey", "good morning", "good evening", "good afternoon"],
      si: ["හලෝ", "ආයුබෝවන්", "කොහොමද", "hello", "halo"],
      ta: ["வணக்கம்", "ஹலோ", "எப்படி இருக்கீங்க", "vanakkam"],
    },
    replies: {
      en: "Hello! Welcome to BloomCare. I can help with navigation, roles, offline Stage 1, screening stages, and demo login tips. What would you like to know?",
      si: "ආයුබෝවන්! BloomCare වෙත සාදරයෙන් පිළිගනිමු. මම navigation, කාර්යභාර, offline Stage 1, screening සහ demo login ගැන උදව් කරමි. ඔබට අවශ්‍ය කුමක්ද?",
      ta: "வணக்கம்! BloomCare-க்கு வரவேற்கிறோம். வழிசெலுத்தல், பாத்திரங்கள், offline Stage 1, screening மற்றும் demo login குறித்து உதவ முடியும். என்ன தெரிந்துகொள்ள விரும்புகிறீர்கள்?",
    },
  },
  {
    intent: "login",
    navigateTo: "login",
    keywords: {
      en: ["login", "log in", "sign in", "how do i log in", "access account"],
      si: ["ලොගින්", "ගිණුම", "ඇතුල් වෙන්න", "signin", "ලොගින් කොහොමද"],
      ta: ["உள்நுழை", "லாகின்", "கணக்கு", "சைன் இன்", "உள்நுழைவு எப்படி"],
    },
    viewBoost: { login: 2 },
    replies: {
      en: "I'll take you to the Login page. Patients use National ID; staff and clinicians use email. After first login you set your own password with the temporary password issued at registration.",
      si: "මම ඔබව Login පිටුවට ගෙන යන්නම්. රෝගීන් National ID භාවිතා කරයි; කාර්ය මණ්ඩලය email භාවිතා කරයි. පළමු ලොගින් වලදී ලබා දුන් temporary password එකෙන් නව මුරපදයක් සකසන්න.",
      ta: "உங்களை Login பக்கத்திற்கு அழைத்துச் செல்கிறேன். நோயாளிகள் National ID; பணியாளர்கள் email பயன்படுத்துகிறார்கள். முதல் உள்நுழைவில் வழங்கப்பட்ட temporary password மூலம் புதிய கடவுச்சொல் அமைக்கவும்.",
    },
  },
  {
    intent: "demo_login",
    navigateTo: "login",
    keywords: {
      en: ["demo login", "demo account", "demo password", "try demo", "sample login", "test account", "autofill"],
      si: ["demo login", "උදාහරණ ගිණුම", "demo password", "සාම්පල්", "autofill"],
      ta: ["demo login", "டெமோ கணக்கு", "demo password", "மாதிரி உள்நுழைவு", "autofill"],
    },
    viewBoost: { login: 3 },
    replies: {
      en: "Demo password for sample accounts is rash2003. On the Login page, Autofill can fill frontline, clinician, or patient demos (admin is not shown in Autofill). Portfolio demos only — never use real patient data.",
      si: "Demo ගිණුම් සඳහා මුරපදය rash2003 වේ. Login පිටුවේ Autofill මගින් frontline, clinician හෝ patient demo පුරවයි (admin Autofill නැත). Portfolio demo පමණි — සැබෑ රෝගී දත්ත භාවිතා නොකරන්න.",
      ta: "டெமோ கணக்குகளுக்கான கடவுச்சொல் rash2003. Login பக்கத்தில் Autofill frontline, clinician அல்லது patient டெமோவை நிரப்பும் (admin Autofill இல்லை). Portfolio டெமோ மட்டும் — உண்மையான நோயாளி தரவைப் பயன்படுத்த வேண்டாம்.",
    },
  },
  {
    intent: "appointments",
    navigateTo: "appointments",
    keywords: {
      en: ["appointment", "appointments", "booking", "schedule visit", "book a doctor", "channel"],
      si: ["හමුවීම", "වෛද්‍ය හමුවීම", "චැනල්", "channel", "appointment", "කාලසටහන"],
      ta: ["சந்திப்பு", "அப்பாயின்ட்மென்ட்", "நேர ஒதுக்கீடு", "சந்திப்பு முன்பதிவு"],
    },
    roleBoost: { patient: 2, frontline: 2, doctor: 1 },
    replies: {
      en: "Appointments live in your role dashboard after login. Frontline staff book visits; clinicians confirm or complete them; patients can review upcoming appointments in the patient portal.",
      si: "ලොගින් වූ පසු ඔබගේ dashboard එකේ Appointments තිබේ. Frontline කාර්ය මණ්ඩලය හමුවීම් වෙන් කරයි; වෛද්‍යවරු තහවුරු/සම්පූර්ණ කරයි; රෝගීන් patient portal එකේ ඉදිරි හමුවීම් බලයි.",
      ta: "உள்நுழைந்த பிறகு உங்கள் டாஷ்போர்டில் Appointments உள்ளன. Frontline பணியாளர்கள் சந்திப்பு முன்பதிவு செய்கிறார்கள்; மருத்துவர்கள் உறுதி/முடிக்கிறார்கள்; நோயாளிகள் patient portal-ல் வரவிருக்கும் சந்திப்புகளைப் பார்க்கலாம்.",
    },
  },
  {
    intent: "features",
    navigateTo: "features",
    keywords: {
      en: ["feature", "features", "capability", "what can you do", "what does bloomcare do", "functions", "tell me about bloomcare"],
      si: ["විශේෂාංග", "හැකියාව", "මොනවද තියෙන්නෙ", "features", "bloomcare ගැන"],
      ta: ["அம்சங்கள்", "திறன்கள்", "என்ன செய்யும்", "பயன்பாடுகள்", "bloomcare பற்றி"],
    },
    replies: {
      en: "BloomCare offers AI-assisted maternal risk screening (Stage 1 + Stage 2), role-based portals, appointments, prescriptions, longitudinal tracking, and multilingual UI (English, Sinhala, Tamil).",
      si: "BloomCare මගින් AI මාතෘ අවදානම් පරීක්ෂණ (Stage 1 + Stage 2), කාර්යභාර dashboards, හමුවීම්, ඖෂධ, දිගුකාලීන ලුහුඬුවීම සහ බහු භාෂා UI (English / Sinhala / Tamil) සපයයි.",
      ta: "BloomCare AI தாய்மை ஆபத்து பரிசோதனை (Stage 1 + Stage 2), பாத்திர டாஷ்போர்டுகள், சந்திப்புகள், மருந்துகள், நீண்டகால கண்காணிப்பு மற்றும் பல்மொழி UI (ஆங்கிலம் / சிங்களம் / தமிழ்) வழங்குகிறது.",
    },
  },
  {
    intent: "conditions",
    navigateTo: "conditions",
    keywords: {
      en: [
        "condition",
        "conditions",
        "gestational diabetes",
        "preeclampsia",
        "preterm",
        "preterm birth",
        "maternal risk",
        "monitored conditions",
      ],
      si: ["තත්ත්ව", "අවදානම්", "දියවැඩියාව", "gestational diabetes", "preeclampsia", "preterm", "නොමේරූ"],
      ta: ["நிலை", "ஆபத்து", "நீரிழிவு", "gestational diabetes", "preeclampsia", "preterm", "முன்கூட்டிய பிறப்பு"],
    },
    replies: {
      en: "BloomCare focuses on gestational diabetes (GDM), preeclampsia, and preterm birth risk. Screening supports clinical decisions — it does not replace a doctor's judgment.",
      si: "BloomCare අවධානය යොමු කරන්නේ ගර්භණී දියවැඩියාව (GDM), preeclampsia සහ නොමේරූ දරු උපත් අවදානම් වෙතයි. මෙය සායනික තීරණවලට සහාය වේ — වෛද්‍ය උපදෙස් වෙනුවට නොවේ.",
      ta: "BloomCare கர்ப்பகால நீரிழிவு (GDM), ப்ரீக்ளாம்ப்சியா மற்றும் முன்கூட்டிய பிறப்பு ஆபத்தை கண்காணிக்கிறது. இது மருத்துவ முடிவுகளுக்கு உதவும் — மருத்துவர் ஆலோசனைக்கு மாற்றாகாது.",
    },
  },
  {
    intent: "dashboard",
    navigateTo: "dashboard",
    keywords: {
      en: ["dashboard", "my dashboard", "portal", "my workspace", "open dashboard"],
      si: ["dashboard", "පැනලය", "portal", "මගේ පිටුව", "මගේ dashboard"],
      ta: ["டாஷ்போர்டு", "போர்ட்டல்", "என் பக்கம்", "என் டாஷ்போர்டு"],
    },
    replies: {
      en: "Taking you to your dashboard. Content depends on your role: frontline triage, clinical review, patient portal, or admin analytics.",
      si: "ඔබව dashboard එකට ගෙන යමි. අන්තර්ගතය ඔබගේ කාර්යභාරය අනුව වෙනස් වේ: frontline triage, clinical review, patient portal හෝ admin analytics.",
      ta: "உங்களை டாஷ்போர்டுக்கு அழைத்துச் செல்கிறேன். உள்ளடக்கம் உங்கள் பாத்திரத்தைப் பொறுத்தது: frontline triage, clinical review, patient portal அல்லது admin analytics.",
    },
  },
  {
    intent: "home",
    navigateTo: "home",
    keywords: {
      en: ["home", "home page", "start page", "landing page", "go back home"],
      si: ["home", "මුල් පිටුව", "landing", "mul pituwa"],
      ta: ["முகப்பு", "home", "முகப்பு பக்கம்", "main page"],
    },
    replies: {
      en: "Returning you to the BloomCare home page.",
      si: "ඔබව BloomCare මුල් පිටුවට නැවත ගෙන යමින් පවතී.",
      ta: "உங்களை BloomCare முகப்புப் பக்கத்திற்குத் திருப்புகிறேன்.",
    },
  },
  {
    intent: "where_am_i",
    navigateTo: "none",
    keywords: {
      en: ["where am i", "current page", "what page is this", "my location"],
      si: ["මම කොහෙද ඉන්නෙ", "මේ මොන පිටුවද", "current page", "koheda inne"],
      ta: ["நான் எங்கே இருக்கிறேன்", "இது எந்த பக்கம்", "current page"],
    },
    replies: {
      en: "Let me check where you are right now.",
      si: "ඔබ දැනට සිටින ස්ථානය මම පරීක්ෂා කර බලන්නම්.",
      ta: "நீங்கள் தற்போது எங்கே இருக்கிறீர்கள் என்பதை நான் சரிபார்க்கிறேன்.",
    },
  },
  {
    intent: "current_page_info",
    navigateTo: "none",
    keywords: {
      en: [
        "what's here",
        "what is this page",
        "what can i do here",
        "whats on this page",
        "explain this page",
        "tell me about this page",
      ],
      si: ["මෙතැනින් කුමක්ද", "මෙය කුමන පිටුවද", "මට කෙසේ කළ හැකිද", "පිටුව ගැන"],
      ta: ["இங்கே என்ன உள்ளது", "இது எந்த பக்கம்", "நான் இங்கே என்ன செய்யலாம்", "பக்கத்தை விளக்கு"],
    },
    replies: {
      en: "I'll explain what's available on this page.",
      si: "මෙම පිටුව ගැන සවිස්තරයෙන් කියන්නම්.",
      ta: "இந்த பக்கத்தில் உள்ளவை விளக்குகிறேன்.",
    },
  },
  {
    intent: "roles",
    navigateTo: "none",
    keywords: {
      en: [
        "roles",
        "user roles",
        "frontline staff",
        "clinical specialist",
        "obstetrician",
        "patient portal",
        "admin portal",
        "who can use",
        "what do frontline",
        "what does the doctor",
      ],
      si: ["කාර්යභාර", "frontline", "වෛද්‍ය", "රෝගී portal", "admin", "කවුද භාවිතා"],
      ta: ["பாத்திரங்கள்", "frontline", "மருத்துவர்", "நோயாளி portal", "admin", "யார் பயன்படுத்த"],
    },
    replies: {
      en: "BloomCare has four portals: Frontline (community screening & booking), Clinical specialist (Stage 2 review & prescriptions), Patient (results & appointments), and Admin (staff & analytics).",
      si: "BloomCare හි portals හතරකි: Frontline (ප්‍රජා පරීක්ෂණ සහ booking), Clinical specialist (Stage 2 සමාලෝචනය සහ ඖෂධ), Patient (ප්‍රතිඵල සහ හමුවීම්), සහ Admin (කාර්ය මණ්ඩලය සහ analytics).",
      ta: "BloomCare-ல் நான்கு portal உள்ளன: Frontline (சமூக பரிசோதனை & முன்பதிவு), Clinical specialist (Stage 2 மதிப்பாய்வு & மருந்து), Patient (முடிவுகள் & சந்திப்புகள்), மற்றும் Admin (பணியாளர் & analytics).",
    },
  },
  {
    intent: "offline",
    navigateTo: "none",
    keywords: {
      en: [
        "offline",
        "no internet",
        "disconnected",
        "sync",
        "reconnect",
        "pin unlock",
        "offline pin",
        "how does offline work",
        "morning sync",
      ],
      si: ["offline", "අන්තර්ජාලය නැත", "sync", "PIN", "reconnect", "offline වැඩ"],
      ta: ["offline", "இணையம் இல்லை", "sync", "PIN", "reconnect", "offline எப்படி"],
    },
    roleBoost: { frontline: 2 },
    replies: {
      en: "Mobile Stage 1 can work offline after an online login and optional PIN setup. Staff morning-sync assigned patients, screen offline, then flush the queue when connectivity returns. SQLite caches are for demos — not encrypted like production PHI stores.",
      si: "Online ලොගින් සහ අවශ්‍ය නම් PIN සැකසුමෙන් පසු mobile Stage 1 offline වැඩ කළ හැක. කාර්ය මණ්ඩලය උදෑසන sync කර, offline පරීක්ෂණ කර, සම්බන්ධතාව ආපසු ආ විට queue යවයි. Demo සඳහා පමණි.",
      ta: "Online உள்நுழைவு மற்றும் விருப்ப PIN அமைப்புக்குப் பிறகு mobile Stage 1 offline வேலை செய்யலாம். பணியாளர்கள் காலை sync செய்து, offline பரிசோதனை செய்து, இணைப்பு திரும்பும்போது queue அனுப்புகிறார்கள். டெமோவுக்கு மட்டும்.",
    },
  },
  {
    intent: "stage1_stage2",
    navigateTo: "features",
    keywords: {
      en: [
        "stage 1",
        "stage 2",
        "screening 1",
        "screening 2",
        "triage screening",
        "specialist diagnostics",
        "difference between stage",
        "what is stage 1",
        "what is stage 2",
      ],
      si: ["stage 1", "stage 2", "screening", "triage", "විශේෂඥ", "පරීක්ෂණ අදියර"],
      ta: ["stage 1", "stage 2", "screening", "triage", "நிபுணர் பரிசோதனை"],
    },
    replies: {
      en: "Stage 1 is frontline / on-device triage from vitals and history. Stage 2 is specialist-side diagnostics with biomarkers and explainability. Escalate high-risk Stage 1 cases for Stage 2 review.",
      si: "Stage 1 යනු vitals සහ ඉතිහාසයෙන් frontline / on-device triage වේ. Stage 2 යනු biomarkers සහ explainability සහිත විශේෂඥ diagnostics වේ. ඉහළ අවදානම් Stage 1 අවස්ථා Stage 2 සඳහා escalate කරන්න.",
      ta: "Stage 1 என்பது vitals மற்றும் வரலாற்றில் இருந்து frontline / on-device triage. Stage 2 என்பது biomarkers மற்றும் explainability உடன் நிபுணர் diagnostics. உயர் ஆபத்து Stage 1 வழக்குகளை Stage 2 க்கு escalate செய்யவும்.",
    },
  },
  {
    intent: "explainability",
    navigateTo: "none",
    keywords: {
      en: [
        "explainability",
        "ai explanation",
        "why this risk",
        "shap",
        "what does the ai mean",
        "feature importance",
        "simple explanation",
      ],
      si: ["explainability", "AI පැහැදිලි කිරීම", "අවදානම් ඇයි", "shap", "සරල පැහැදිලි"],
      ta: ["explainability", "AI விளக்கம்", "ஏன் ஆபத்து", "shap", "எளிய விளக்கம்"],
    },
    roleBoost: { patient: 2, doctor: 1 },
    replies: {
      en: "Explainability summaries highlight which screening factors most influenced a risk view, in plain language. They support conversations with your clinician and are not a diagnosis.",
      si: "Explainability සාරාංශ අවදානම් දසුනට බලපෑ ප්‍රධාන සාධක සරල භාෂාවෙන් පෙන්වයි. ඒවා වෛද්‍ය සාකච්ඡාවට සහාය වේ — රෝග විනිශ්චයක් නොවේ.",
      ta: "Explainability சுருக்கங்கள் எந்த காரணிகள் ஆபத்து பார்வையை பாதித்தன என்பதை எளிய மொழியில் காட்டுகின்றன. இவை மருத்துவர் உரையாடலுக்கு உதவும் — நோயறிதல் அல்ல.",
    },
  },
  {
    intent: "security",
    navigateTo: "none",
    keywords: {
      en: [
        "security",
        "privacy",
        "hipaa",
        "is this secure",
        "phi",
        "patient data safe",
        "production ready",
      ],
      si: ["ආරක්ෂාව", "privacy", "hipaa", "දත්ත ආරක්ෂිතද", "security"],
      ta: ["பாதுகாப்பு", "privacy", "hipaa", "தரவு பாதுகாப்பா", "security"],
    },
    replies: {
      en: "BloomCare is a portfolio / interview demo with staged security hardening. It is not HIPAA certified and must not hold real patient data. See SECURITY.md and the control mapping docs in the repo.",
      si: "BloomCare යනු staged security hardening සහිත portfolio / interview demo එකකි. HIPAA certified නොවේ සහ සැබෑ රෝගී දත්ත තබා නොගත යුතුය. Repo තුළ SECURITY.md බලන්න.",
      ta: "BloomCare staged security hardening கொண்ட portfolio / interview டெமோ. HIPAA சான்றளிக்கப்பட்டதல்ல; உண்மையான நோயாளி தரவை வைக்கக் கூடாது. Repo-ல் SECURITY.md பார்க்கவும்.",
    },
  },
  {
    intent: "contact",
    navigateTo: "none",
    keywords: {
      en: [
        "contact",
        "email",
        "university",
        "moratuwa",
        "who built",
        "support email",
        "about the team",
      ],
      si: ["සම්බන්ධ", "email", "මොරටුව", "university", "කවුද හැදුවේ"],
      ta: ["தொடர்பு", "email", "மொரட்டுவ", "university", "யார் உருவாக்கினார்கள்"],
    },
    replies: {
      en: "BloomCare is associated with the University of Moratuwa. For project contact use pabodarashmi668@gmail.com (see the site contact section).",
      si: "BloomCare මොරටුව විශ්වවිද්‍යාලය සමඟ සම්බන්ධ වේ. සම්බන්ධතාව සඳහා pabodarashmi668@gmail.com භාවිතා කරන්න.",
      ta: "BloomCare மொரட்டுவ பல்கலைக்கழகத்துடன் தொடர்புடையது. தொடர்புக்கு pabodarashmi668@gmail.com பயன்படுத்தவும்.",
    },
  },
  {
    intent: "language_help",
    navigateTo: "none",
    keywords: {
      en: [
        "language",
        "sinhala",
        "tamil",
        "change language",
        "switch language",
        "multilingual",
        "translate",
      ],
      si: ["භාෂාව", "සිංහල", "දෙමළ", "භාෂාව වෙනස්", "language"],
      ta: ["மொழி", "சிங்களம்", "தமிழ்", "மொழி மாற்று", "language"],
    },
    replies: {
      en: "Use the language control in the chatbot header (English / Sinhala / Tamil). Many portals also have their own UI language switch after login.",
      si: "Chatbot ශීර්ෂයේ භාෂා පාලනය භාවිතා කරන්න (English / Sinhala / Tamil). ලොගින් වූ පසු බොහෝ portals වලද UI භාෂා මාරුවක් තිබේ.",
      ta: "Chatbot தலைப்பில் மொழி கட்டுப்பாட்டைப் பயன்படுத்தவும் (ஆங்கிலம் / சிங்களம் / தமிழ்). உள்நுழைந்த பிறகு பல portal-களிலும் UI மொழி மாற்றம் உள்ளது.",
    },
  },
  {
    intent: "logout",
    navigateTo: "none",
    keywords: {
      en: ["logout", "log out", "sign out", "end session", "how to logout"],
      si: ["logout", "ලොග් අවුට්", "sign out", "සැසිය අවසන්"],
      ta: ["logout", "வெளியேறு", "sign out", "அமர்வை முடி"],
    },
    replies: {
      en: "Use the Logout control on your dashboard header. That clears the local session; server-side logout-all also revokes outstanding tokens when connected.",
      si: "ඔබගේ dashboard ශීර්ෂයේ Logout භාවිතා කරන්න. එයින් local session ඉවත් වේ; සම්බන්ධ වී සිටින විට server logout-all මගින් tokens අවලංගු කළ හැක.",
      ta: "உங்கள் டாஷ்போர்டு தலைப்பில் Logout பயன்படுத்தவும். இது local session-ஐ அழிக்கும்; இணைக்கப்பட்டிருக்கும்போது server logout-all tokens-ஐ ரத்து செய்யலாம்.",
    },
  },
  {
    intent: "prescriptions",
    navigateTo: "dashboard",
    keywords: {
      en: ["prescription", "prescriptions", "medication", "medicine", "rx", "drug list"],
      si: ["ඖෂධ", "prescription", "බෙහෙත්", "medication"],
      ta: ["மருந்து", "prescription", "மருந்துப்பட்டி", "medication"],
    },
    roleBoost: { patient: 3, doctor: 2 },
    replies: {
      en: "Clinicians create prescriptions from the clinical dashboard. Patients review active prescriptions in the patient portal after login.",
      si: "වෛද්‍යවරු clinical dashboard එකෙන් prescriptions සාදයි. රෝගීන් ලොගින් වූ පසු patient portal එකේ ක්‍රියාකාරී ඖෂධ බලයි.",
      ta: "மருத்துவர்கள் clinical dashboard-ல் prescriptions உருவாக்குகிறார்கள். நோயாளிகள் உள்நுழைந்த பிறகு patient portal-ல் செயலில் உள்ள மருந்துகளைப் பார்க்கலாம்.",
    },
  },
  {
    intent: "reports",
    navigateTo: "dashboard",
    keywords: {
      en: ["report", "reports", "screening report", "download report", "medical report"],
      si: ["වාර්තාව", "report", "පරීක්ෂණ වාර්තා", "download report"],
      ta: ["அறிக்கை", "report", "பரிசோதனை அறிக்கை", "download report"],
    },
    roleBoost: { patient: 2, doctor: 2, frontline: 1 },
    replies: {
      en: "Screening reports and histories appear in role dashboards after login. Patients see their own reports in the patient portal; clinicians review reports for assigned or escalated cases.",
      si: "ලොගින් වූ පසු screening reports dashboards වල පෙනේ. රෝගීන්ට තමන්ගේ වාර්තා patient portal එකේ දිස්වේ; වෛද්‍යවරු assigned/escalated අවස්ථා සමාලෝචනය කරයි.",
      ta: "உள்நுழைந்த பிறகு screening reports டாஷ்போர்டுகளில் தோன்றும். நோயாளிகள் தங்கள் அறிக்கைகளை patient portal-ல் காணலாம்; மருத்துவர்கள் ஒதுக்கப்பட்ட/escalated வழக்குகளை மதிப்பாய்வு செய்கிறார்கள்.",
    },
  },
  {
    intent: "triage",
    navigateTo: "dashboard",
    keywords: {
      en: ["triage", "stage 1 screening", "vitals entry", "risk score", "escalate", "frontline screening"],
      si: ["triage", "vitals", "අවදානම් ලකුණු", "escalate", "frontline පරීක්ෂණ"],
      ta: ["triage", "vitals", "ஆபத்து மதிப்பெண்", "escalate", "frontline பரிசோதனை"],
    },
    roleBoost: { frontline: 3, doctor: 1 },
    replies: {
      en: "Frontline staff capture Stage 1 vitals and history, get a risk score, and can escalate high-risk patients. Open the frontline dashboard after login to start a screening.",
      si: "Frontline කාර්ය මණ්ඩලය Stage 1 vitals සහ ඉතිහාසය ගෙන risk score ලබා, ඉහළ අවදානම් රෝගීන් escalate කරයි. ලොගින් වී frontline dashboard එකෙන් පරීක්ෂණය ආරම්භ කරන්න.",
      ta: "Frontline பணியாளர்கள் Stage 1 vitals மற்றும் வரலாற்றைப் பதிவு செய்து risk score பெற்று உயர் ஆபத்து நோயாளிகளை escalate செய்கிறார்கள். உள்நுழைந்து frontline dashboard-ல் பரிசோதனையைத் தொடங்கவும்.",
    },
  },
  {
    intent: "help",
    navigateTo: "none",
    keywords: {
      en: ["help", "help me", "what can i ask", "commands", "menu"],
      si: ["උදව්", "help", "මට කුමක් අහන්න පුළුවන්", "මෙනුව"],
      ta: ["உதவி", "help", "நான் என்ன கேட்கலாம்", "மெனு"],
    },
    replies: {
      en: "Ask me about login, demo accounts, roles, Stage 1 vs Stage 2, offline sync, appointments, prescriptions, reports, security, or say “what's here?” for this page.",
      si: "Login, demo ගිණුම්, කාර්යභාර, Stage 1 vs Stage 2, offline sync, හමුවීම්, ඖෂධ, වාර්තා, ආරක්ෂාව ගැන අසන්න — හෝ “මෙතැනින් කුමක්ද?” කියන්න.",
      ta: "Login, டெமோ கணக்குகள், பாத்திரங்கள், Stage 1 vs Stage 2, offline sync, சந்திப்புகள், மருந்துகள், அறிக்கைகள், பாதுகாப்பு பற்றி கேளுங்கள் — அல்லது “இங்கே என்ன உள்ளது?” எனச் சொல்லுங்கள்.",
    },
  },
]

const PAGE_DESCRIPTIONS: Record<string, Record<SupportedLanguage, string>> = {
  home: {
    en: "You are on the BloomCare Home page. Here you can learn about the product, open Login, and explore features and monitored conditions.",
    si: "ඔබ BloomCare මුල් පිටුවේ සිටින්නේය. මෙතැනින් නිෂ්පාදනය ගැන දැනගෙන Login වී features සහ conditions බලාගත හැක.",
    ta: "நீங்கள் BloomCare முகப்புப் பக்கத்தில் இருக்கிறீர்கள். இங்கே தயாரிப்பைப் பற்றி அறிந்து Login சென்று features மற்றும் conditions-ஐ ஆராயலாம்.",
  },
  login: {
    en: "You are on the Login page. Patients use National ID; staff use email. Demo Autofill is available when enabled. First login needs the temporary password from registration.",
    si: "ඔබ Login පිටුවේ සිටින්නේය. රෝගීන් National ID; කාර්ය මණ්ඩලය email. Demo Autofill තිබේ නම් භාවිතා කළ හැක. පළමු ලොගින් සඳහා temporary password අවශ්‍යයි.",
    ta: "நீங்கள் Login பக்கத்தில் இருக்கிறீர்கள். நோயாளிகள் National ID; பணியாளர்கள் email. Demo Autofill இயக்கப்பட்டிருந்தால் பயன்படுத்தலாம். முதல் உள்நுழைவுக்கு temporary password தேவை.",
  },
  features: {
    en: "You are viewing Features: Stage 1 & 2 screening, appointments, role dashboards, multilingual UI, and longitudinal tracking.",
    si: "ඔබ Features බලනවා: Stage 1 & 2 screening, හමුවීම්, role dashboards, බහු භාෂා UI සහ දිගුකාලීන ලුහුඬුවීම.",
    ta: "நீங்கள் Features-ஐப் பார்க்கிறீர்கள்: Stage 1 & 2 screening, சந்திப்புகள், role dashboards, பல்மொழி UI மற்றும் நீண்டகால கண்காணிப்பு.",
  },
  conditions: {
    en: "You are viewing Conditions: GDM, preeclampsia, and preterm birth risk education for the demo.",
    si: "ඔබ Conditions බලනවා: GDM, preeclampsia සහ නොමේරූ දරු උපත් අවදානම් පිළිබඳ තොරතුරු.",
    ta: "நீங்கள் Conditions-ஐப் பார்க்கிறீர்கள்: GDM, ப்ரீக்ளாம்ப்சியா மற்றும் முன்கூட்டிய பிறப்பு ஆபத்து பற்றிய தகவல்.",
  },
  dashboard: {
    en: "You are on a role dashboard. Use the menus for triage, clinical review, patient insights, appointments, or admin analytics depending on your login.",
    si: "ඔබ role dashboard එකක සිටින්නේය. ඔබගේ ලොගින් අනුව triage, clinical review, patient insights, හමුවීම් හෝ admin analytics භාවිතා කරන්න.",
    ta: "நீங்கள் ஒரு role dashboard-ல் இருக்கிறீர்கள். உங்கள் உள்நுழைவைப் பொறுத்து triage, clinical review, patient insights, சந்திப்புகள் அல்லது admin analytics பயன்படுத்தவும்.",
  },
  appointments: {
    en: "Appointments are managed from your dashboard after login — booking for frontline, status updates for clinicians, and viewing for patients.",
    si: "හමුවීම් ලොගින් වූ පසු dashboard එකෙන් කළමනාකරණය වේ — frontline booking, clinician status, patient බැලීම.",
    ta: "சந்திப்புகள் உள்நுழைந்த பிறகு dashboard-ல் நிர்வகிக்கப்படும் — frontline முன்பதிவு, clinician நிலை, patient பார்வை.",
  },
}

function richFallback(language: SupportedLanguage, currentRole?: string | null): string {
  const role = (currentRole || "").toLowerCase()
  if (language === "si") {
    if (role === "patient") {
      return "මට එය පැහැදිලි නැත. ඔබට අහන්න පුළුවන්: හමුවීම්, ඖෂධ, වාර්තා, AI පැහැදිලි කිරීම, හෝ “මෙතැනින් කුමක්ද?”."
    }
    if (role === "frontline") {
      return "මට එය පැහැදිලි නැත. උත්සාහ කරන්න: Stage 1 triage, offline sync, හමුවීම් booking, කාර්යභාර, හෝ demo login."
    }
    if (role === "doctor") {
      return "මට එය පැහැදිලි නැත. උත්සාහ කරන්න: Stage 2, prescriptions, reports, explainability, හෝ appointments."
    }
    return "මට එය පැහැදිලි නැත. උත්සාහ කරන්න: login, demo accounts, roles, Stage 1 vs Stage 2, offline, features, හෝ “මෙතැනින් කුමක්ද?”."
  }
  if (language === "ta") {
    if (role === "patient") {
      return "எனக்கு அது புரியவில்லை. சந்திப்புகள், மருந்துகள், அறிக்கைகள், AI விளக்கம் அல்லது “இங்கே என்ன உள்ளது?” எனக் கேளுங்கள்."
    }
    if (role === "frontline") {
      return "எனக்கு அது புரியவில்லை. Stage 1 triage, offline sync, சந்திப்பு முன்பதிவு, பாத்திரங்கள் அல்லது demo login முயற்சிக்கவும்."
    }
    if (role === "doctor") {
      return "எனக்கு அது புரியவில்லை. Stage 2, prescriptions, reports, explainability அல்லது appointments முயற்சிக்கவும்."
    }
    return "எனக்கு அது புரியவில்லை. login, demo accounts, roles, Stage 1 vs Stage 2, offline, features அல்லது “இங்கே என்ன உள்ளது?” முயற்சிக்கவும்."
  }
  if (role === "patient") {
    return "I didn't catch that. Try asking about appointments, prescriptions, reports, AI explanations, or say “what's here?”."
  }
  if (role === "frontline") {
    return "I didn't catch that. Try Stage 1 triage, offline sync, booking appointments, roles, or demo login."
  }
  if (role === "doctor") {
    return "I didn't catch that. Try Stage 2, prescriptions, reports, explainability, or appointments."
  }
  if (role === "admin") {
    return "I didn't catch that. Try roles, security, demo login, features, or dashboard analytics."
  }
  return "I didn't catch that. Try: login, demo accounts, roles, Stage 1 vs Stage 2, offline sync, features, conditions, or “what's here?”."
}

export function detectLanguage(text: string): SupportedLanguage {
  const normalizedText = normalize(text)
  const scores = { en: 0, si: 0, ta: 0 }

  for (const entry of KNOWLEDGE_BASE) {
    for (const lang of ["en", "si", "ta"] as SupportedLanguage[]) {
      for (const keyword of entry.keywords[lang]) {
        if (keywordScore(normalizedText, keyword, true) > 0) {
          scores[lang] += 1
        }
      }
    }
  }

  if (scores.si > scores.en && scores.si >= scores.ta) return "si"
  if (scores.ta > scores.en && scores.ta >= scores.si) return "ta"
  return "en"
}

function findBestEntry(
  message: string,
  language: SupportedLanguage,
  currentView?: string,
  currentRole?: string | null,
): KnowledgeEntry | null {
  const text = normalize(message)
  let best: KnowledgeEntry | null = null
  let bestScore = 0
  const roleKey = (currentRole || "").toLowerCase()
  const viewKey = (currentView || "").toLowerCase()

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0
    const seen = new Set<string>()

    const consider = (keyword: string, priority: boolean) => {
      const key = normalize(keyword)
      if (!key || seen.has(key)) return
      seen.add(key)
      score += keywordScore(text, key, priority)
    }

    for (const keyword of entry.keywords[language]) consider(keyword, true)
    for (const lang of ["en", "si", "ta"] as SupportedLanguage[]) {
      if (lang === language) continue
      for (const keyword of entry.keywords[lang]) consider(keyword, false)
    }

    if (roleKey && entry.roleBoost?.[roleKey]) {
      score += entry.roleBoost[roleKey]!
    }
    if (viewKey && entry.viewBoost?.[viewKey]) {
      score += entry.viewBoost[viewKey]!
    }

    // Soft penalties for weak nav collisions on login view
    if (viewKey === "login" && entry.intent === "dashboard") {
      score -= 1
    }

    if (score > bestScore) {
      best = entry
      bestScore = score
    }
  }

  return bestScore >= MIN_SCORE ? best : null
}

function roleTip(
  intent: IntentKey,
  language: SupportedLanguage,
  currentRole?: string | null,
): string {
  const role = (currentRole || "").toLowerCase()
  if (!role || role === "null") return ""

  if (intent === "appointments") {
    if (language === "si") {
      if (role === "patient") return " ඔබ patient portal එකේ ඉදිරි හමුවීම් බලාගත හැක."
      if (role === "frontline") return " Frontline dashboard එකෙන් නව හමුවීම් book කරන්න."
      if (role === "doctor") return " Clinical dashboard එකෙන් හමුවීම් තත්ත්වය යාවත්කාලීන කරන්න."
    } else if (language === "ta") {
      if (role === "patient") return " Patient portal-ல் வரவிருக்கும் சந்திப்புகளைப் பார்க்கலாம்."
      if (role === "frontline") return " Frontline dashboard-ல் புதிய சந்திப்புகளை முன்பதிவு செய்யுங்கள்."
      if (role === "doctor") return " Clinical dashboard-ல் சந்திப்பு நிலையை புதுப்பிக்கவும்."
    } else {
      if (role === "patient") return " Tip: open your patient portal to see upcoming visits."
      if (role === "frontline") return " Tip: book new visits from the frontline dashboard."
      if (role === "doctor") return " Tip: update appointment status from the clinical dashboard."
    }
  }

  if (intent === "prescriptions" && role === "patient") {
    if (language === "si") return " Patient portal එකේ Prescriptions කොටස බලන්න."
    if (language === "ta") return " Patient portal-ல் Prescriptions பகுதியைப் பாருங்கள்."
    return " Tip: check the Prescriptions section in your patient portal."
  }

  return ""
}

export function buildReply(
  message: string,
  currentView?: string,
  currentRole?: string | null,
): ChatbotResponse {
  const language = detectLanguage(message)
  const entry = findBestEntry(message, language, currentView, currentRole)

  if (!entry) {
    return {
      reply: richFallback(language, currentRole),
      navigateTo: "none",
      language,
      mode: "key-answer",
    }
  }

  if (entry.intent === "where_am_i") {
    const viewLabel = currentView || "an unknown page"
    const baseText = entry.replies[language]
    let roleText = ""
    if (currentRole && currentRole !== "null") {
      const cleanRole = currentRole.replace(/_/g, " ").toLowerCase()
      if (language === "si") roleText = ` ඔබ පද්ධතියට ලොග් වී ඇත්තේ '${cleanRole}' ලෙසයි.`
      else if (language === "ta") roleText = ` உங்கள் கணக்கு '${cleanRole}' ஆக பதிவு செய்யப்பட்டுள்ளது.`
      else roleText = ` You are currently logged in as a ${cleanRole}.`
    }

    let dynamicReply = `${baseText} You are currently viewing the ${viewLabel} page.${roleText}`
    if (language === "si") dynamicReply = `${baseText} ඔබ දැනට සිටින්නේ ${viewLabel} පිටුවේය.${roleText}`
    if (language === "ta") dynamicReply = `${baseText} நீங்கள் தற்போது ${viewLabel} பக்கத்தில் உள்ளீர்கள்.${roleText}`

    return { reply: dynamicReply, navigateTo: "none", language, mode: "key-answer" }
  }

  if (entry.intent === "current_page_info") {
    const viewKey = currentView || "home"
    const pageDesc =
      PAGE_DESCRIPTIONS[viewKey]?.[language] || PAGE_DESCRIPTIONS.home[language]
    return { reply: pageDesc, navigateTo: "none", language, mode: "key-answer" }
  }

  const tip = roleTip(entry.intent, language, currentRole)
  return {
    reply: `${entry.replies[language]}${tip}`,
    navigateTo: ALLOWED_NAVIGATIONS.includes(entry.navigateTo) ? entry.navigateTo : "none",
    language,
    mode: "key-answer",
  }
}

export const SAFE_FALLBACK_EN =
  "Something went wrong on my side. Try asking about login, features, or roles."
