"use client"

import SiteChatbot from "./site-chatbot"

/**
 * Global chatbot host mounted from the root layout so the assistant
 * appears on every screen (home, login, and all role dashboards).
 */
export default function GlobalChatbot() {
  return <SiteChatbot />
}
