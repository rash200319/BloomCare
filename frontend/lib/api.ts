/**
 * Single API client for BloomCare frontend.
 * Default backend: http://127.0.0.1:8001 (API at /api/v1).
 * Set NEXT_PUBLIC_API_BASE_URL or NEXT_PUBLIC_BACKEND_URL in .env.local / Vercel.
 */

const TOKEN_KEY = "bloomcare_access_token"
const DEFAULT_ORIGIN = "http://127.0.0.1:8001"

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, "")
}

function preferHttpsForRemote(url: string): string {
  const normalized = normalizeBase(url)
  try {
    const parsed = new URL(normalized)
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
    if (!isLocal && parsed.protocol === "http:") {
      parsed.protocol = "https:"
      return normalizeBase(parsed.toString())
    }
  } catch {
    return normalized
  }
  return normalized
}

/** Backend origin without /api/v1 (e.g. http://127.0.0.1:8001). */
export function getBackendOrigin(): string {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL
  if (backend && backend.trim()) {
    return preferHttpsForRemote(backend)
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL
  if (apiBase && apiBase.trim()) {
    return preferHttpsForRemote(apiBase.replace(/\/api\/v1\/?$/i, ""))
  }

  return DEFAULT_ORIGIN
}

/** Full API v1 base (e.g. http://127.0.0.1:8001/api/v1). */
export function getApiBase(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL
  if (apiBase && apiBase.trim()) {
    return preferHttpsForRemote(apiBase)
  }

  const legacy = process.env.NEXT_PUBLIC_API_BASE
  if (legacy && legacy.trim()) {
    return preferHttpsForRemote(legacy)
  }

  return `${getBackendOrigin()}/api/v1`
}

/** @deprecated Use getApiBase() — kept so older call sites compile during migration. */
export function getApiBaseCandidates(): string[] {
  return [getApiBase()]
}

export const BACKEND_URL = getBackendOrigin()
export const API_V1_BASE = getApiBase()

/** Join a client path onto the API base. Collection paths get a trailing slash
 *  so FastAPI does not 307 to http:// behind Railway (mixed content). */
export function toApiUrl(path: string, base: string = getApiBase()): string {
  if (path.startsWith("http")) {
    return preferHttpsForRemote(path)
  }

  const [rawPath, query] = path.split("?")
  let pathname = rawPath.startsWith("/") ? rawPath : `/${rawPath}`
  if (/^\/[A-Za-z0-9_-]+$/.test(pathname)) {
    pathname = `${pathname}/`
  }
  return `${normalizeBase(base)}${pathname}${query ? `?${query}` : ""}`
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(TOKEN_KEY)
}

function formatErrorDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg)
        }
        return JSON.stringify(item)
      })
      .join("; ")
  }
  if (detail && typeof detail === "object") {
    return JSON.stringify(detail)
  }
  return fallback
}

/**
 * Fetch against the configured API base only (no localhost / multi-port fallbacks).
 * Does not treat 404 as "wrong host".
 */
export async function apiRequest(
  path: string,
  init?: RequestInit & { requireAuth?: boolean },
): Promise<Response> {
  const { requireAuth = false, ...fetchInit } = init || {}
  const token = getAccessToken()

  if (requireAuth && !token) {
    throw new Error("No active session found. Please login again.")
  }

  const url = path.startsWith("http")
    ? preferHttpsForRemote(path)
    : toApiUrl(path)

  const headers = new Headers(fetchInit.headers)
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  if (fetchInit.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  try {
    return await fetch(url, {
      ...fetchInit,
      headers,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Unable to reach backend API at ${getApiBase()}. ${message}. ` +
        `Start uvicorn on port 8001 or set NEXT_PUBLIC_API_BASE_URL.`,
    )
  }
}

/** Unauthenticated or authenticated JSON helper. */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { requireAuth?: boolean } = {},
): Promise<T> {
  const res = await apiRequest(path, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = formatErrorDetail(
      (body as { detail?: unknown })?.detail,
      `HTTP ${res.status}`,
    )
    throw new Error(detail)
  }
  const contentType = res.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>
  }
  return (await res.text()) as T
}

export async function loginPatient(national_id: string, password: string) {
  return apiFetch("/auth/login/patient", {
    method: "POST",
    body: JSON.stringify({ national_id, password }),
  })
}

export async function loginStaff(email: string, password: string) {
  return apiFetch("/auth/login/staff", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
}

/** Demo accounts — shown only when NEXT_PUBLIC_ENABLE_DEMO_LOGIN is not "false".
 *  Hospital admin credentials are intentionally omitted from the client.
 */
export const DEMO_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN !== "false"

export const DEMO_CREDENTIALS = {
  frontline: {
    label: "Email",
    identifier: "frontline.staff@bloomcare.health",
    password: "rash2003",
  },
  doctor: {
    label: "Email",
    identifier: "obstetrician@bloomcare.health",
    password: "rash2003",
  },
  patient: {
    label: "National ID",
    identifier: "NIC-900000001V",
    password: "rash2003",
    altIdentifier: "199912345678",
  },
} as const

export type DemoLoginRole = keyof typeof DEMO_CREDENTIALS
