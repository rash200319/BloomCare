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
  patient_id?: string
  specialist_id: string
  patient_name?: string | null
  specialist_name?: string | null
  appointment_id?: string | null
  appointment_date?: string
  duration_minutes?: number
  appointment_type?: string
  schedule_version?: number
  confirmation_deadline?: string | null
  decision_reason?: string | null
  reschedule_reason?: string | null
  status: BookingOperationStatus
  status_url?: string
  error_code?: string | null
  error_message?: string | null
  orchestration_notice?: string | null
  updated_at?: string
}

export interface BookingCommandResponse {
  operation_id: string
  status: BookingOperationStatus
  message: string
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

export async function listBookingOperations(status?: BookingOperationStatus): Promise<BookingOperation[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return parseResponse<BookingOperation[]>(
    await apiRequest(`/appointment-operations${query}`, { requireAuth: true }),
  )
}

export async function decideBookingOperation(
  operationId: string,
  decision: "CONFIRM" | "CANCEL" | "COMPLETE",
  reason?: string,
): Promise<BookingCommandResponse> {
  return parseResponse<BookingCommandResponse>(
    await apiRequest(`/appointment-operations/${encodeURIComponent(operationId)}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, reason: reason?.trim() || null }),
      requireAuth: true,
    }),
  )
}

export async function rescheduleBookingOperation(
  operationId: string,
  appointmentDate: string,
  durationMinutes?: number,
  reason?: string,
): Promise<BookingCommandResponse> {
  return parseResponse<BookingCommandResponse>(
    await apiRequest(`/appointment-operations/${encodeURIComponent(operationId)}/reschedule`, {
      method: "POST",
      body: JSON.stringify({
        appointment_date: appointmentDate,
        duration_minutes: durationMinutes,
        reason: reason?.trim() || null,
      }),
      requireAuth: true,
    }),
  )
}

export const isFinalBookingStatus = (status: BookingOperationStatus): boolean =>
  ["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED", "FAILED"].includes(status)
