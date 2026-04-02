"use client"

import { FormEvent, useMemo, useState } from "react"
import { Bot, MessageCircle, Send, X } from "lucide-react"

type ChatNavigateTo = "none" | "home" | "login" | "features" | "conditions" | "dashboard"

type UserRole = "frontline" | "doctor" | "admin" | "patient" | null

type AppView = "home" | "login" | "dashboard"

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

export default function SiteChatbot({ currentView, currentRole, onNavigate }: SiteChatbotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi, I am BloomCare Assistant. I can answer questions about the site and guide you to the right page.",
    },
  ])

  const quickPrompts = useMemo(
    () => ["How do I log in?", "Show me features", "What conditions are monitored?", "Take me to dashboard"],
    [],
  )

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
        ? "I could not reach AI right now. Please try again shortly."
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
          text: "Network issue. Please check your connection and try again.",
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
              <div>
                <p className="text-sm font-black text-slate-900">BloomCare Assistant</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Site Help + Navigation</p>
              </div>
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
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-primary/40 hover:text-primary"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about BloomCare..."
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
