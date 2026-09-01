import { NextResponse } from "next/server"
import Groq from "groq-sdk"

type ExplainLanguage = "en" | "si" | "ta"
type FactorScore = { key: string; score: number }

const FEATURE_LABELS: Record<string, string> = {
  bmi: "BMI",
  systolic_bp: "systolic blood pressure",
  diastolic_bp: "diastolic blood pressure",
  blood_sugar: "blood sugar",
  hemoglobin: "hemoglobin",
  heart_rate: "heart rate",
  temperature: "body temperature",
  edge_risk_score: "overall risk score",
  probability_score: "overall screening probability",
  trigger_count: "number of risk triggers",
  sflt1_plgf_ratio: "sFlt-1/PlGF ratio",
  plgf_absolute: "PlGF level",
  papp_a: "PAPP-A level",
  cervical_length_mm: "cervical length",
}

function normalizeLanguage(input: unknown): ExplainLanguage {
  if (typeof input !== "string") return "en"
  if (input === "si" || input === "ta" || input === "en") return input
  return "en"
}

function isValidShapPayload(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === "object") return true
  return false
}

function fallbackMessage(language: ExplainLanguage): string {
  if (language === "si") {
    return "ඔබගේ දත්ත පිළිබඳ සරල පැහැදිලි කිරීම දැන් ලබාදීමට නොහැකි විය. කරුණාකර වෛද්‍යවරයා සමඟ පරීක්ෂා කරන්න."
  }
  if (language === "ta") {
    return "உங்கள் தரவுக்கான எளிய விளக்கத்தை இப்போது உருவாக்க முடியவில்லை. தயவுசெய்து உங்கள் மருத்துவருடன் உறுதிப்படுத்தவும்."
  }
  return "I could not generate a simple explanation right now. Please confirm details with your doctor."
}

function toFriendlyLabel(rawKey: string): string {
  const normalized = rawKey.trim().toLowerCase()
  if (FEATURE_LABELS[normalized]) return FEATURE_LABELS[normalized]
  return rawKey
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
}

function extractTopFactors(shapJson: unknown): FactorScore[] {
  if (!shapJson || typeof shapJson !== "object") return []

  const obj = shapJson as Record<string, unknown>
  const factors: FactorScore[] = []

  if (Array.isArray(obj.features)) {
    for (const item of obj.features) {
      if (!item || typeof item !== "object") continue
      const row = item as Record<string, unknown>
      const key = typeof row.feature === "string" ? row.feature : ""
      const importance = typeof row.importance === "number" ? Math.abs(row.importance) : null
      const contribution = typeof row.contribution === "number" ? Math.abs(row.contribution) : null
      const score = importance ?? contribution
      if (key && score !== null && Number.isFinite(score)) {
        factors.push({ key, score })
      }
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key === "features") continue
    if (typeof value === "number" && Number.isFinite(value)) {
      factors.push({ key, score: Math.abs(value) })
    }
  }

  const deduped = new Map<string, number>()
  for (const item of factors) {
    const existing = deduped.get(item.key)
    if (existing === undefined || item.score > existing) {
      deduped.set(item.key, item.score)
    }
  }

  return [...deduped.entries()]
    .map(([key, score]) => ({ key, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
}

function buildLocalExplanation(shapJson: unknown, conditionName: string, language: ExplainLanguage): string {
  const top = extractTopFactors(shapJson)

  if (top.length === 0) {
    if (language === "si") {
      return "පscreening දත්ත අද නොමැත. ඔබගේ සෞඛ්‍ය ස්ථිතිය පිළිබඳ වෛද්‍යවරයා සමඟ සමාලෝචනය කරන්න."
    }
    if (language === "ta") {
      return "சமீபத்திய screening தரவு குறிப்பிடப்படவில்லை. உங்கள் சுகாதாரம் பற்றி மருத்துவருடன் ஆலோசனை செய்யவும்."
    }
    return "No screening data available at this time. Please discuss your health with your doctor."
  }

  const factorA = toFriendlyLabel(top[0].key)
  const factorB = top[1] ? toFriendlyLabel(top[1].key) : null

  if (language === "si") {
    return factorB
      ? `ඔබගේ වෛද්‍යවරයා ${conditionName} සම්බන්ධ නවතම පරීක්ෂණය සටහන් කර ඇත. ප්‍රධාන සාධක දෙක ලෙස ${factorA} සහ ${factorB} දක්නට ලැබේ. මෙය මාර්ගෝපදේශයක් පමණක් වනдықтан, වෛද්‍යවරයා සමඟ තහවුරු කරන්න.`
      : `ඔබගේ වෛද්‍යවරයා ${conditionName} සම්බන්ධ නවතම පරීක්ෂණය සටහන් කර ඇත. ප්‍රධාන සාධකයක් ලෙස ${factorA} දක්නට ලැබේ. වැඩිදුර තහවුරු කිරීම සඳහා වෛද්‍යවරයා සමඟ සමාලෝචනය කරන්න.`
  }

  if (language === "ta") {
    return factorB
      ? `உங்கள் மருத்துவர் ${conditionName} தொடர்பான சமீபத்திய பரிசோதனையை பதிவு செய்துள்ளார். முக்கிய இரண்டு காரணிகள் ${factorA} மற்றும் ${factorB} ஆக காணப்படுகின்றன. இது வழிகாட்டும் தகவல் மட்டுமே, தயவுசெய்து மருத்துவருடன் உறுதிப்படுத்தவும்.`
      : `உங்கள் மருத்துவர் ${conditionName} தொடர்பான சமீபத்திய பரிசோதனையை பதிவு செய்துள்ளார். முக்கிய காரணியாக ${factorA} காணப்படுகிறது. முழு விளக்கத்திற்கு மருத்துவருடன் உறுதிப்படுத்தவும்.`
  }

  return factorB
    ? `Your doctor has noted updates related to ${conditionName}. The two strongest factors in your latest screening are ${factorA} and ${factorB}. This is guidance only, so please confirm details with your doctor.`
    : `Your doctor has noted updates related to ${conditionName}. One key factor in your latest screening is ${factorA}. Please confirm details with your doctor.`
}

function getGroqClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  return new Groq({ apiKey })
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || ""
    if (!authHeader.toLowerCase().startsWith("bearer ") || authHeader.trim().length < 16) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
      (process.env.NEXT_PUBLIC_BACKEND_URL
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/+$/, "")}/api/v1`
        : null)

    if (apiBase) {
      const verify = await fetch(`${apiBase}/auth/profile`, {
        method: "GET",
        headers: { Authorization: authHeader },
        cache: "no-store",
      })
      if (!verify.ok) {
        return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 })
      }
    }

    const body = (await request.json()) as {
      shapJson?: unknown
      language?: string
      conditionName?: string
    }

    const language = normalizeLanguage(body.language)
    const conditionName = typeof body.conditionName === "string" && body.conditionName.trim().length > 0
      ? body.conditionName.trim()
      : "Maternal risk"

    if (!isValidShapPayload(body.shapJson)) {
      return NextResponse.json({ error: "Invalid or missing shapJson payload" }, { status: 400 })
    }

    const groq = getGroqClient()
    if (!groq) {
      return NextResponse.json({
        explanation: buildLocalExplanation(body.shapJson, conditionName, language),
        mode: "local-explain",
      }, { status: 200 })
    }

    const systemPrompt = `
You are the BloomCare Medical Assistant.
Your job is to read SHAP feature-importance JSON and explain it to a pregnant mother in simple, comforting language.

RULES:
1) Do not provide a diagnosis. Use phrasing like: "Your doctor has noted..."
2) Explain the top 2 likely risk factors from the JSON in plain language.
3) Keep the response under 3 sentences.
4) Requested reply language: ${language}. You must reply in this language.
5) Use supportive tone and avoid fear-inducing wording.
`

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Condition: ${conditionName}. Here is the AI medical JSON data: ${JSON.stringify(body.shapJson)}`,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 220,
    })

    const text = completion.choices[0]?.message?.content?.trim()
    return NextResponse.json({
      explanation: text || buildLocalExplanation(body.shapJson, conditionName, language),
      mode: text ? "groq" : "local-explain",
    })
  } catch (error) {
    console.error("AI Explanation Error:", error)
    return NextResponse.json({ error: "Failed to generate AI explanation" }, { status: 500 })
  }
}
