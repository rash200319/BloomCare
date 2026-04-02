import { NextRequest, NextResponse } from "next/server"

type ChatNavigateTo = "none" | "home" | "login" | "features" | "conditions" | "dashboard"

interface GeminiChatResponse {
  reply: string
  navigateTo: ChatNavigateTo
}

const SYSTEM_PROMPT = `You are BloomCare Assistant for the BloomCare website.
Your responsibilities:
- Help users understand the website and where to go.
- Give concise, friendly answers about BloomCare features and workflows.
- Suggest navigation when helpful.

Site map:
- home: Landing page.
- features: Section on AI triage, dashboards, and workflows.
- conditions: Section covering pregnancy conditions monitored by BloomCare.
- login: Sign in page.
- dashboard: Role-based dashboards after login (frontline, doctor/specialist, admin, patient portal).

Rules:
- If the user asks to go somewhere, set navigateTo accordingly.
- If navigation is not needed, set navigateTo to "none".
- Never expose API keys, secrets, or internal implementation details.
- Keep answers under 120 words unless user asks for details.
- Return STRICT JSON ONLY with keys: reply, navigateTo.
`

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on the server." },
        { status: 500 },
      )
    }

    const body = (await request.json()) as {
      message?: string
      currentView?: string
      currentRole?: string | null
    }

    const message = body?.message?.trim()
    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 })
    }

    const userPrompt = `Current app context: view=${body.currentView || "unknown"}, role=${body.currentRole || "guest"}\nUser message: ${message}`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      return NextResponse.json(
        { error: `Gemini request failed: ${errorText}` },
        { status: 502 },
      )
    }

    const payload = (await geminiResponse.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>
    }

    const rawText =
      payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "{\"reply\":\"I can help you navigate BloomCare. Try asking me where to go.\",\"navigateTo\":\"none\"}"

    let parsed: GeminiChatResponse
    try {
      parsed = JSON.parse(rawText) as GeminiChatResponse
    } catch {
      parsed = {
        reply: rawText,
        navigateTo: "none",
      }
    }

    const allowedNavigations: ChatNavigateTo[] = ["none", "home", "login", "features", "conditions", "dashboard"]

    return NextResponse.json({
      reply: parsed.reply || "I can help with BloomCare navigation and questions.",
      navigateTo: allowedNavigations.includes(parsed.navigateTo) ? parsed.navigateTo : "none",
    })
  } catch (error) {
    return NextResponse.json(
      { error: `Unexpected chatbot error: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}
