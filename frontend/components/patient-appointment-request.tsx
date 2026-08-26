"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"

import AppointmentOperationStatus from "@/components/appointment-operation-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiRequest } from "@/lib/api"
import {
  BookingOperation,
  requestAppointment,
} from "@/lib/appointment-orchestration"

interface Specialization {
  specialization: string
}

interface Specialist {
  id: string
  full_name: string
  specialization: string
}

export default function PatientAppointmentRequest() {
  const [specializations, setSpecializations] = useState<Specialization[]>([])
  const [specialists, setSpecialists] = useState<Specialist[]>([])
  const [specialization, setSpecialization] = useState("")
  const [specialistId, setSpecialistId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")
  const [operation, setOperation] = useState<BookingOperation | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void apiRequest("/appointments/specializations", { requireAuth: true })
      .then(async (response) => {
        if (response.ok) setSpecializations((await response.json()) as Specialization[])
      })
      .catch(() => setError("Unable to load appointment specializations."))
  }, [])

  useEffect(() => {
    setSpecialistId("")
    setSpecialists([])
    if (!specialization) return
    void apiRequest(`/appointments/specialists/${encodeURIComponent(specialization)}`, {
      requireAuth: true,
    })
      .then(async (response) => {
        if (response.ok) setSpecialists((await response.json()) as Specialist[])
      })
      .catch(() => setError("Unable to load specialists."))
  }, [specialization])

  const minimumDate = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!specialistId || !date || !time) {
      setError("Select a specialist, date, and time.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const accepted = await requestAppointment({
        specialist_id: specialistId,
        appointment_date: new Date(`${date}T${time}:00`).toISOString(),
        duration_minutes: 30,
        appointment_type: "PRENATAL_CHECKUP",
        notes: notes.trim() || undefined,
        idempotency_key: crypto.randomUUID(),
      })
      setOperation(accepted)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to request appointment.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-[24px] border border-primary/10 bg-primary/5 p-6">
      <h3 className="text-lg font-black text-slate-900">Request an appointment</h3>
      <p className="mt-1 text-sm text-slate-600">
        Your request is processed asynchronously and sent to the selected specialist for confirmation.
      </p>
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submit}>
        <select
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          value={specialization}
          onChange={(event) => setSpecialization(event.target.value)}
          aria-label="Specialization"
        >
          <option value="">Select specialization</option>
          {specializations.map((item) => (
            <option key={item.specialization} value={item.specialization}>{item.specialization}</option>
          ))}
        </select>
        <select
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          value={specialistId}
          onChange={(event) => setSpecialistId(event.target.value)}
          aria-label="Specialist"
          disabled={!specialization}
        >
          <option value="">Select specialist</option>
          {specialists.map((item) => (
            <option key={item.id} value={item.id}>{item.full_name}</option>
          ))}
        </select>
        <Input type="date" min={minimumDate} value={date} onChange={(event) => setDate(event.target.value)} />
        <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        <Input
          className="md:col-span-2"
          placeholder="Optional note"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
        />
        <Button className="md:col-span-2" type="submit" disabled={submitting}>
          {submitting ? "Submitting request..." : "Request appointment"}
        </Button>
      </form>
      {error && <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>}
      {operation && (
        <div className="mt-5">
          <AppointmentOperationStatus initialOperation={operation} onChange={setOperation} />
        </div>
      )}
    </section>
  )
}

