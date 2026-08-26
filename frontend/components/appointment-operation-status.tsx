"use client"

import { useEffect, useState } from "react"
import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  BookingOperation,
  getBookingOperation,
  isFinalBookingStatus,
} from "@/lib/appointment-orchestration"

interface Props {
  initialOperation: BookingOperation
  onChange?: (operation: BookingOperation) => void
}

export default function AppointmentOperationStatus({ initialOperation, onChange }: Props) {
  const [operation, setOperation] = useState(initialOperation)

  useEffect(() => {
    if (isFinalBookingStatus(operation.status) || operation.status === "REMINDER_SCHEDULED") return
    const timer = window.setInterval(async () => {
      try {
        const latest = await getBookingOperation(operation.operation_id)
        setOperation(latest)
        onChange?.(latest)
      } catch {
        // A temporary polling failure must not discard the accepted operation.
      }
    }, 2500)
    return () => window.clearInterval(timer)
  }, [operation.operation_id, operation.status, onChange])

  const failed = ["CANCELLED", "REJECTED", "EXPIRED", "FAILED"].includes(operation.status)
  const ready = ["CONFIRMED", "REMINDER_SCHEDULED", "COMPLETED"].includes(operation.status)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {failed ? (
            <XCircle className="h-5 w-5 text-rose-500" />
          ) : ready ? (
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          ) : operation.status === "AWAITING_CONFIRMATION" ? (
            <Clock className="h-5 w-5 text-amber-500" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          )}
          <div>
            <p className="text-sm font-bold text-slate-900">Booking operation</p>
            <p className="text-xs text-slate-500">Reference: {operation.operation_id.slice(0, 8)}</p>
          </div>
        </div>
        <Badge variant={failed ? "destructive" : "secondary"}>{operation.status.replaceAll("_", " ")}</Badge>
      </div>
      {operation.error_message && <p className="mt-3 text-sm text-rose-600">{operation.error_message}</p>}
    </div>
  )
}

