import { apiRequest } from "@/lib/api"

export type BookingOperationStatus =
  | "REQUESTED"
  | "VALIDATING"
  | "RESERVING_SLOT"
  | "CREATING_APPOINTMENT"
  | "AWAITING_CONFIRMATION"
  | "CONFIRMED"
  | "REMINDER_SCHEDULED"
  | "RESCHEDULED"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED"
  | "EXPIRED"
  | "FAILED"

export interface BookingOperation {
  operation_id: string
  workflow_id: string
  specialist_id: string
  appointment_id?: string | null
  appointment_date?: string
  duration_minutes?: number
  appointment_type?: string
  status: BookingOperationStatus
  status_url?: string
  error_code?: string | null
  error_message?: string | null
}

export interface BookingRequest {
  specialist_id: string
  appointment_date: string
  duration_minutes: number
  appointment_type: string
  notes?: string
  idempotency_key: string
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.detail || `Request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

export async function requestAppointment(payload: BookingRequest): Promise<BookingOperation> {
  return parseResponse<BookingOperation>(
    await apiRequest("/appointment-operations", {
      method: "POST",
      body: JSON.stringify(payload),
      requireAuth: true,
    }),
  )
}

export async function getBookingOperation(operationId: string): Promise<BookingOperation> {
  return parseResponse<BookingOperation>(
    await apiRequest(`/appointment-operations/${encodeURIComponent(operationId)}`, {
      requireAuth: true,
    }),
  )
}

export const isFinalBookingStatus = (status: BookingOperationStatus): boolean =>
  ["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED", "FAILED"].includes(status)

