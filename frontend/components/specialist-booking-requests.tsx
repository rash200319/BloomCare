"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, CalendarClock, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BookingOperation,
  decideBookingOperation,
  listBookingOperations,
} from "@/lib/appointment-orchestration"

const FINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED", "FAILED"])

export default function SpecialistBookingRequests() {
  const [operations, setOperations] = useState<BookingOperation[]>([])
  const [loading, setLoading] = useState(true)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const ordered = useMemo(
    () => [...operations].sort((left, right) => {
      const leftPending = left.status === "AWAITING_CONFIRMATION" ? 0 : 1
      const rightPending = right.status === "AWAITING_CONFIRMATION" ? 0 : 1
      return leftPending - rightPending || new Date(left.appointment_date || 0).getTime() - new Date(right.appointment_date || 0).getTime()
    }),
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
            {operations.filter((item) => item.status === "AWAITING_CONFIRMATION").length} pending
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
        ) : ordered.length === 0 ? (
          <p className="py-8 text-center text-sm font-semibold text-slate-500">No Temporal booking requests yet.</p>
        ) : (
          <div className="space-y-4">
            {ordered.map((operation) => {
              const pending = operation.status === "AWAITING_CONFIRMATION"
              const failed = ["REJECTED", "EXPIRED", "FAILED"].includes(operation.status)
              const deadline = operation.confirmation_deadline
                ? new Date(operation.confirmation_deadline).toLocaleString()
                : "Not available"
              return (
                <div key={operation.operation_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                      <p className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" /> Confirmation deadline: {deadline}
                      </p>
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
                          onClick={() => void decide(operation, "CONFIRM")}
                          disabled={actingOn === operation.operation_id}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {actingOn === operation.operation_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          Confirm
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => void decide(operation, "CANCEL")}
                          disabled={actingOn === operation.operation_id}
                        >
                          <XCircle className="mr-2 h-4 w-4" /> Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
