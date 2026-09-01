import { NextRequest, NextResponse } from "next/server"
import { buildReply, SAFE_FALLBACK_EN } from "@/lib/chatbot-local"

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

    return NextResponse.json(replyData)
  } catch (error) {
    console.error("Unexpected chatbot error", error)
    return NextResponse.json(
      {
        reply: SAFE_FALLBACK_EN,
        navigateTo: "none",
        mode: "key-answer",
        language: "en",
      },
      { status: 500 },
    )
  }
}
