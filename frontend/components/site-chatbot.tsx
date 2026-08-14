"use client"

import { FormEvent, useMemo, useState } from "react"

type ChatNavigateTo = "none" | "home" | "login" | "features" | "conditions" | "dashboard"
type UserRole = "frontline" | "doctor" | "admin" | "patient" | null
type AppView = "home" | "login" | "dashboard"
type ChatLanguage = "en" | "si" | "ta"

interface SiteChatbotProps {
  currentView?: AppView
  currentRole?: UserRole
  onNavigate?: (target: Exclude<ChatNavigateTo, "none">) => void
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
}

const LANGUAGE_LABELS: Record<ChatLanguage, string> = {
  en: "English",
  si: "සිංහල",
  ta: "தமிழ்",
}

const QUICK_PROMPTS_BY_LANGUAGE: Record<ChatLanguage, string[]> = {
  en: [
    "How do I log in?",
    "Show me features",
    "What conditions are monitored?",
    "Take me to dashboard",
    "What's here?",
    "Tell me about BloomCare",
  ],
  si: [
    "ලොගින් කොහොමද?",
    "විශේෂාංග පෙන්වා දෙන්න",
    "කුමන තත්ත්ව නිරීක්ෂණ කරනවා?",
    "Dashboard එකට ගෙන යන්න",
    "මෙතැනින් කුමක්ද?",
    "BloomCare ගැන කියන්න",
  ],
  ta: [
    "உள்நுழைவு எப்படி?",
    "அம்சங்களைக் காட்டு",
    "எந்த நிலைகள் கண்காணிக்கப்படுகின்றன?",
    "டாஷ்போர்டுக்கு என்னை அழைத்துச் செல்",
    "இங்கே என்ன உள்ளது?",
    "BloomCare பற்றி சொல்",
  ],
}

const WELCOME_MESSAGES: Record<ChatLanguage, string> = {
  en: "Hi, I am BloomCare Assistant. I can answer questions about the site and guide you to the right page.",
  si: "ආයුබෝවන්, මම BloomCare Assistant ය. මට ඔබට පිටුව ගැන ප්‍රශ්න විතරක දිය හැකි අතර ඔබව නිවැරදි පිටුවට ගයිතු දිය හැකිය.",
  ta: "வணக்கம், நான் BloomCare Assistant. நான் உங்களுக்கு தளம் பற்றிய கேள்விகளுக்கு பதிலளித்து புறங்குறை பக்கத்திற்கு வழிகாட்ட முடியும்.",
}

function dispatchNavigate(target: Exclude<ChatNavigateTo, "none">) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("bloomcare-navigate", { detail: target }))
}

function ChatIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12a8.5 8.5 0 0 1-8.5 8.5H7l-4 3V12A8.5 8.5 0 1 1 21 12Z"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="12" r="1.2" fill="#ffffff" />
      <circle cx="12.5" cy="12" r="1.2" fill="#ffffff" />
      <circle cx="16" cy="12" r="1.2" fill="#ffffff" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function BotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="8" width="14" height="10" rx="3" stroke="#ffffff" strokeWidth="2" />
      <path d="M12 4v4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="3.5" r="1.5" fill="#ffffff" />
      <circle cx="9.5" cy="13" r="1.2" fill="#ffffff" />
      <circle cx="14.5" cy="13" r="1.2" fill="#ffffff" />
    </svg>
  )
}

export default function SiteChatbot({
  currentView = "home",
  currentRole = null,
  onNavigate,
}: SiteChatbotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [chatLanguage, setChatLanguage] = useState<ChatLanguage>("en")
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", text: WELCOME_MESSAGES.en },
  ])

  const quickPrompts = useMemo(() => QUICK_PROMPTS_BY_LANGUAGE[chatLanguage], [chatLanguage])

  const handleLanguageChange = (lang: ChatLanguage) => {
    setChatLanguage(lang)
    setShowLanguageMenu(false)
    setMessages([{ id: "welcome", role: "assistant", text: WELCOME_MESSAGES[lang] }])
  }

  const navigate = (target: Exclude<ChatNavigateTo, "none">) => {
    if (onNavigate) {
      onNavigate(target)
      return
    }
    dispatchNavigate(target)
  }

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isSending) return

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: trimmed }])
    setInput("")
    setIsSending(true)

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, currentView, currentRole }),
      })

      const payload = (await response.json()) as {
        reply?: string
        navigateTo?: ChatNavigateTo
        error?: string
      }

      const assistantText = payload.error
        ? chatLanguage === "si"
          ? "මෙම අවස්ථාවේ AI එක සිතින්න. කරුණාකර පසුව උත්සාහ කරන්න."
          : chatLanguage === "ta"
            ? "இப்பொழுது AI-க்கு எட்ட முடியவில்லை. பிறகு மீண்டும் முயற்சி செய்யவும்."
            : "I could not reach AI right now. Please try again shortly."
        : payload.reply || "I can help you navigate BloomCare."

      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: assistantText }])

      if (payload.navigateTo && payload.navigateTo !== "none") {
        navigate(payload.navigateTo)
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text:
            chatLanguage === "si"
              ? "ජාල ගැටලුවක්. ඔබගේ සංගතිය පරීක්ෂා කරන්න සහ නැවත උත්සාහ කරන්න."
              : chatLanguage === "ta"
                ? "பிணைய சிக்கல். உங்கள் இணைப்பை சரிபார்த்து மீண்டும் முயற்சி செய்யவும்."
                : "Network issue. Please check your connection and try again.",
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await sendMessage(input)
  }

  // Render directly in the layout tree (no portal / no mount gate) so the FAB
  // cannot disappear due to hydration timing, missing Tailwind utilities, or icon CSS.
  return (
    <div
      id="bloomcare-chatbot-root"
      data-bloomcare-chatbot="true"
      style={{
        position: "fixed",
        right: 20,
        bottom: 24,
        zIndex: 2147483646,
        pointerEvents: "none",
      }}
    >
      {isOpen && (
        <div
          data-bloomcare-chatbot-panel="true"
          style={{
            position: "absolute",
            right: 0,
            bottom: 72,
            width: 360,
            maxWidth: "calc(100vw - 2rem)",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            boxShadow: "0 25px 50px rgba(15, 23, 42, 0.25)",
            overflow: "hidden",
            pointerEvents: "auto",
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #f1f5f9",
              padding: "12px 16px",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  height: 32,
                  width: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  backgroundColor: "#F43F5E",
                }}
              >
                <BotIcon />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                  BloomCare Assistant
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Site Help + Navigation
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setShowLanguageMenu((prev) => !prev)}
                  style={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    padding: "4px 8px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#475569",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                  aria-label="Change language"
                >
                  {chatLanguage.toUpperCase()}
                </button>
                {showLanguageMenu && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      marginTop: 4,
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      boxShadow: "0 10px 25px rgba(15, 23, 42, 0.15)",
                      overflow: "hidden",
                      zIndex: 2,
                    }}
                  >
                    {(["en", "si", "ta"] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => handleLanguageChange(lang)}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "8px 12px",
                          textAlign: "left",
                          fontSize: 12,
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                          background: chatLanguage === lang ? "#F43F5E" : "#fff",
                          color: chatLanguage === lang ? "#fff" : "#475569",
                        }}
                      >
                        {LANGUAGE_LABELS[lang]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  borderRadius: 6,
                  padding: 4,
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                }}
                aria-label="Close chatbot"
              >
                ×
              </button>
            </div>
          </div>

          <div style={{ height: 320, overflowY: "auto", padding: "12px 16px" }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  maxWidth: "90%",
                  borderRadius: 16,
                  padding: "8px 12px",
                  marginBottom: 12,
                  marginLeft: message.role === "user" ? "auto" : 0,
                  fontSize: 14,
                  lineHeight: 1.5,
                  background: message.role === "assistant" ? "#f1f5f9" : "#F43F5E",
                  color: message.role === "assistant" ? "#1e293b" : "#fff",
                }}
              >
                {message.text}
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid #f1f5f9", padding: "8px 16px 12px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  style={{
                    borderRadius: 999,
                    border: "1px solid #e2e8f0",
                    padding: "4px 10px",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#475569",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  chatLanguage === "si"
                    ? "BloomCare ගැන අසන්න..."
                    : chatLanguage === "ta"
                      ? "BloomCare பற்றி கேளுங்கள்..."
                      : "Ask about BloomCare..."
                }
                style={{
                  height: 40,
                  flex: 1,
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "0 12px",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={isSending}
                style={{
                  height: 40,
                  width: 40,
                  borderRadius: 12,
                  border: "none",
                  background: "#F43F5E",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: isSending ? "not-allowed" : "pointer",
                  opacity: isSending ? 0.6 : 1,
                }}
                aria-label="Send message"
              >
                →
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        data-bloomcare-chatbot-fab="true"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          pointerEvents: "auto",
          display: "flex",
          height: 64,
          width: 64,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "9999px",
          border: "4px solid #ffffff",
          backgroundColor: "#F43F5E",
          color: "#ffffff",
          boxShadow: "0 14px 32px rgba(244, 63, 94, 0.5)",
          cursor: "pointer",
        }}
        aria-label={isOpen ? "Close chatbot" : "Open chatbot"}
        title="BloomCare Assistant"
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>
    </div>
  )
}
