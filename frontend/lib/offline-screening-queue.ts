/**
 * Local queue for Stage 1 screenings submitted while offline.
 *
 * The risk score itself is already computed entirely on-device (see
 * getOfflineRisk in frontline-triage-dashboard.tsx, backed by the compiled
 * stage1_offline_ai.js model). This module covers the other half: the
 * POST /submit-screening call that persists that result to the backend.
 * Without this queue, a network failure at submit time silently discarded
 * the screening — mirrors the pattern already used on mobile
 * (mobile/src/services/offlineQueue.ts), just backed by localStorage instead
 * of AsyncStorage since there's no encryption-at-rest story on web either way.
 */
import { apiRequest } from "./api"

const QUEUE_KEY = "bloomcare_pending_stage1_screenings"

export interface Stage1ScreeningPayload {
  patient_unique_id: string | null
  phone: string | null
  name: string
  age: number
  contact: string | null
  gestational_age_weeks: number
  general_risk_flag: "High" | "Low"
  probability_score: number
  triggers: string[]
  screened_at: string
  systolic: number
  diastolic: number
  bmi: number
  heart_rate: number
  blood_sugar: number
  temperature: number
  hemoglobin: number
  pcos: number
  previous_complications: number
  preexisting_diabetes: number
  mental_health: number
  sleep_pattern: number
  exercise: number
  education: number
  map: number
  bp_status: string
  observation: string
}

export interface PendingScreening {
  id: string
  createdAt: string
  payload: Stage1ScreeningPayload
}

export interface FlushResult {
  succeeded: number
  /** Rejected by the server (e.g. validation) -- retrying won't help, so these are dropped from the queue, not kept. */
  failed: Array<{ item: PendingScreening; message: string }>
  /** Still queued because the attempt failed at the network level. */
  remaining: number
}

function readQueue(): PendingScreening[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(items: PendingScreening[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
}

export function enqueueScreening(payload: Stage1ScreeningPayload): PendingScreening {
  const item: PendingScreening = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(),
    payload,
  }
  writeQueue([...readQueue(), item])
  return item
}

export function getPendingScreenings(): PendingScreening[] {
  return readQueue()
}

export function getPendingCount(): number {
  return readQueue().length
}

function formatDetail(detail: unknown): string {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (item && typeof item === "object" && "msg" in item ? String((item as { msg: unknown }).msg) : String(item)))
      .join("; ")
  }
  return "Server rejected this screening"
}

/**
 * Attempts to sync every queued screening. Network failures leave an item
 * queued for the next attempt; a real server rejection (validation, etc.)
 * removes it from the queue instead of retrying it forever with the same
 * doomed payload, and is reported back via `failed` so the caller can
 * surface it rather than lose it silently.
 */
export async function flushPendingScreenings(): Promise<FlushResult> {
  const queue = readQueue()
  if (queue.length === 0) {
    return { succeeded: 0, failed: [], remaining: 0 }
  }

  const stillPending: PendingScreening[] = []
  const failed: FlushResult["failed"] = []
  let succeeded = 0

  for (const item of queue) {
    try {
      const response = await apiRequest("/submit-screening", {
        method: "POST",
        body: JSON.stringify(item.payload),
      })
      if (response.ok) {
        succeeded += 1
        continue
      }
      const body = await response.json().catch(() => ({} as { detail?: unknown }))
      failed.push({ item, message: formatDetail((body as { detail?: unknown })?.detail) })
    } catch {
      // apiRequest only throws for network-level failures -- keep it queued.
      stillPending.push(item)
    }
  }

  writeQueue(stillPending)
  return { succeeded, failed, remaining: stillPending.length }
}
