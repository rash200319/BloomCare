"use client"

import { FormEvent, useMemo, useState } from "react"
import { Bot, MessageCircle, Send, X, Globe } from "lucide-react"

type ChatNavigateTo = "none" | "home" | "login" | "features" | "conditions" | "dashboard"

type UserRole = "frontline" | "doctor" | "admin" | "patient" | null

type AppView = "home" | "login" | "dashboard"

type ChatLanguage = "en" | "si" | "ta"

interface SiteChatbotProps {
  currentView: AppView
  currentRole: UserRole
  onNavigate: (target: Exclude<ChatNavigateTo, "none">) => void
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

export default function SiteChatbot({ currentView, currentRole, onNavigate }: SiteChatbotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [chatLanguage, setChatLanguage] = useState<ChatLanguage>("en")
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: WELCOME_MESSAGES["en"],
    },
  ])

  const quickPrompts = useMemo(() => QUICK_PROMPTS_BY_LANGUAGE[chatLanguage], [chatLanguage])

  const handleLanguageChange = (lang: ChatLanguage) => {
    setChatLanguage(lang)
    setShowLanguageMenu(false)
    // Update welcome message when language changes
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: WELCOME_MESSAGES[lang],
      },
    ])
  }

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isSending) return

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsSending(true)

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          currentView,
          currentRole,
        }),
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

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: assistantText,
        },
      ])

      if (payload.navigateTo && payload.navigateTo !== "none") {
        onNavigate(payload.navigateTo)
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text:
            chatLanguage === "si"
              ? "ජාල ගැටලුවක්. ඔබගේ සংගතිය පරීක්ෂා කරන්න සහ නැවත උත්සාහ කරන්න."
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

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-4 z-[100] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-slate-900">BloomCare Assistant</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Site Help + Navigation</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-primary/40 hover:text-primary"
                  aria-label="Change language"
                >
                  <Globe className="h-3 w-3" />
                  <span>{chatLanguage.toUpperCase()}</span>
                </button>
                {showLanguageMenu && (
                  <div className="absolute right-0 top-full mt-1 rounded-lg border border-slate-200 bg-white shadow-lg">
                    {(["en", "si", "ta"] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => handleLanguageChange(lang)}
                        className={`block w-full px-3 py-2 text-left text-xs font-semibold transition-colors ${
                          chatLanguage === lang
                            ? "bg-primary text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
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
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close chatbot"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="h-80 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === "assistant"
                    ? "bg-slate-100 text-slate-800"
                    : "ml-auto bg-primary text-white"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 px-4 pb-3 pt-2">
            <div className="mb-2 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:border-primary/40 hover:bg-slate-50 hover:text-primary"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="flex items-center gap-2">
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
                className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={isSending}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-5 right-5 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/30 transition-transform hover:scale-105"
        aria-label="Open chatbot"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </>
  )
}
