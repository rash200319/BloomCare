"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, CalendarClock, CheckCircle2, ChevronDown, Clock, History, Loader2, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  BookingOperation,
  decideBookingOperation,
  listBookingOperations,
} from "@/lib/appointment-orchestration"

const FINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED", "FAILED"])

function OperationCard({
  operation,
  actingOn,
  onDecide,
}: {
  operation: BookingOperation
  actingOn: string | null
  onDecide: (operation: BookingOperation, decision: "CONFIRM" | "CANCEL") => void
}) {
  const pending = operation.status === "AWAITING_CONFIRMATION"
  const failed = ["REJECTED", "EXPIRED", "FAILED"].includes(operation.status)
  const deadline = operation.confirmation_deadline
    ? new Date(operation.confirmation_deadline).toLocaleString()
    : "Not available"

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-slate-900">{operation.patient_name || "Patient"}</p>
            <Badge variant={failed ? "destructive" : "secondary"}>{operation.status.replaceAll("_", " ")}</Badge>
            {operation.schedule_version && <Badge variant="outline">Schedule v{operation.schedule_version}</Badge>}
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {operation.appointment_type || "Appointment"} · {operation.appointment_date ? new Date(operation.appointment_date).toLocaleString() : "Date pending"}
          </p>
          {pending && (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" /> Confirmation deadline: {deadline}
            </p>
          )}
          <p className="text-xs text-slate-400">Temporal operation: {operation.operation_id}</p>
          {(operation.error_message || operation.error_code) && (
            <p className="flex items-center gap-2 text-sm font-semibold text-rose-600">
              <XCircle className="h-4 w-4" /> {operation.error_message || operation.error_code}
            </p>
          )}
        </div>
        {pending && !FINAL_STATUSES.has(operation.status) && (
          <div className="flex gap-2">
            <Button
              onClick={() => onDecide(operation, "CONFIRM")}
              disabled={actingOn === operation.operation_id}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {actingOn === operation.operation_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Confirm
            </Button>
            <Button
              variant="destructive"
              onClick={() => onDecide(operation, "CANCEL")}
              disabled={actingOn === operation.operation_id}
            >
              <XCircle className="mr-2 h-4 w-4" /> Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SpecialistBookingRequests() {
  const [operations, setOperations] = useState<BookingOperation[]>([])
  const [loading, setLoading] = useState(true)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    try {
      const items = await listBookingOperations()
      setOperations(items)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load booking requests.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [load])

  // Pending requests are what actually need attention right now, so they get
  // their own always-visible section. Everything already decided piles up
  // forever otherwise, burying new requests in old ones and making the panel
  // look static even while it's updating correctly underneath.
  const pendingOperations = useMemo(
    () => operations
      .filter((item) => item.status === "AWAITING_CONFIRMATION")
      .sort((left, right) => new Date(left.appointment_date || 0).getTime() - new Date(right.appointment_date || 0).getTime()),
    [operations],
  )

  const decidedOperations = useMemo(
    () => operations
      .filter((item) => item.status !== "AWAITING_CONFIRMATION")
      .sort((left, right) => new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime()),
    [operations],
  )

  const decide = async (operation: BookingOperation, decision: "CONFIRM" | "CANCEL") => {
    const reason = decision === "CANCEL"
      ? window.prompt("Reason for cancelling this booking request:")
      : undefined
    if (decision === "CANCEL" && reason === null) return
    if (decision === "CANCEL" && !reason?.trim()) {
      setError("A cancellation reason is required.")
      return
    }
    setActingOn(operation.operation_id)
    setError(null)
    try {
      await decideBookingOperation(operation.operation_id, decision, reason || undefined)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update booking request.")
    } finally {
      setActingOn(null)
    }
  }

  return (
    <Card className="border-0 glass shadow-xl shadow-slate-200/50 rounded-3xl">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-3 text-base font-black text-slate-900">
          <CalendarClock className="h-5 w-5 text-primary" />
          Booking Requests
          <Badge className="ml-auto bg-amber-100 text-amber-700">
            {pendingOperations.length} pending
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading booking requests...
          </div>
        ) : operations.length === 0 ? (
          <p className="py-8 text-center text-sm font-semibold text-slate-500">No Temporal booking requests yet.</p>
        ) : (
          <div className="space-y-6">
            {pendingOperations.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 py-6 text-center text-sm font-semibold text-slate-400">
                Nothing needs your attention right now.
              </p>
            ) : (
              <div className="space-y-4">
                {pendingOperations.map((operation) => (
                  <OperationCard key={operation.operation_id} operation={operation} actingOn={actingOn} onDecide={decide} />
                ))}
              </div>
            )}

            {decidedOperations.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowHistory((prev) => !prev)}
                  className="flex w-full items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  <History className="h-4 w-4" />
                  Recently decided ({decidedOperations.length})
                  <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", showHistory && "rotate-180")} />
                </button>
                {showHistory && (
                  <div className="mt-4 space-y-4">
                    {decidedOperations.map((operation) => (
                      <OperationCard key={operation.operation_id} operation={operation} actingOn={actingOn} onDecide={decide} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
