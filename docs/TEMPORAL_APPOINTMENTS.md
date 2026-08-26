# Temporal Appointment Orchestration Plan

## Goal

Extend BloomCare with a small, production-minded appointment service in which an authenticated patient submits a booking request over HTTP and immediately receives a trackable asynchronous operation. A separate Python Temporal worker durably coordinates validation, slot reservation, appointment creation, human confirmation or cancellation, rescheduling, notifications, and reminder timers.

The integration is additive: existing synchronous staff and offline-mobile booking continues to work while patient self-service moves through Temporal.

## Implementation status

Implemented in the first vertical slice:

- [x] Python Temporal worker and task queue
- [x] Transactional booking-operation and workflow outbox records
- [x] Patient self-service `202 Accepted` API with idempotency keys
- [x] Patient/specialist validation and database-backed slot reservation
- [x] Idempotent appointment creation and in-app notification delivery
- [x] Specialist confirmation, cancellation, and completion through Workflow Updates
- [x] Durable confirmation timeout and 24/2-hour reminder timers
- [x] Existing specialist status endpoint bridge for workflow-backed appointments
- [x] Patient request form and operation-status polling
- [x] Atomic rescheduling with schedule-versioned timer recalculation
- [x] Patient cancellation dialog with reason and Temporal status update
- [x] Specialist Booking Requests view with deadlines, decisions, and errors
- [x] Local Temporal Compose stack and separate worker deployment command
- [x] API, persistence, overlap, notification, and time-skipping workflow tests

Planned follow-up work:

- [ ] SMS, email, or push provider activities
- [ ] Mobile/offline booking migration to asynchronous operation IDs
- [ ] Encrypted Temporal payload codec and production observability
- [ ] Production rollout of the PostgreSQL migration and Temporal Cloud/cluster

## Architecture

```text
Patient web portal
      |
      | POST /api/v1/appointment-operations
      v
FastAPI ---- PostgreSQL booking operation + transactional outbox
      |                         |
      | HTTP 202                v
      |                 Temporal outbox relay
      |                         |
      v                         v
Operation status       AppointmentBookingWorkflow
                                |
                                +-- validate patient and specialist
                                +-- reserve doctor slot atomically
                                +-- create appointment idempotently
                                +-- notify patient and specialist
                                +-- wait for confirm/cancel/reschedule
                                +-- run durable reminder timers
                                +-- close on completion/cancellation
```

PostgreSQL remains the source of truth. Temporal owns orchestration state and durable waiting. Workflow payloads contain opaque IDs only; activities load sensitive data from the database.

## API contract

### Create a booking operation

`POST /api/v1/appointment-operations`

The patient ID is derived from the authenticated patient JWT and is never accepted from a patient-controlled request field.

```json
{
  "specialist_id": "specialist-uuid",
  "appointment_date": "2026-10-15T09:30:00Z",
  "duration_minutes": 30,
  "appointment_type": "PRENATAL_CHECKUP",
  "notes": "Optional note",
  "idempotency_key": "client-generated-uuid"
}
```

Returns `202 Accepted`:

```json
{
  "operation_id": "operation-uuid",
  "workflow_id": "appointment-booking-operation-uuid",
  "status": "REQUESTED",
  "appointment_id": null,
  "status_url": "/api/v1/appointment-operations/operation-uuid"
}
```

### Read status

`GET /api/v1/appointment-operations/{operation_id}`

Access is limited to the patient, assigned specialist, creator, or administrator.

### Human decision

`POST /api/v1/appointment-operations/{operation_id}/decision`

```json
{"decision": "CONFIRM", "reason": null}
```

or

```json
{"decision": "CANCEL", "reason": "Doctor unavailable"}
```

### Reschedule

`POST /api/v1/appointment-operations/{operation_id}/reschedule`

The new slot is reserved before the old reservation is released. The appointment schedule version is incremented so old reminder deliveries cannot run.

## Operation state machine

```text
REQUESTED
  -> VALIDATING
  -> RESERVING_SLOT
  -> CREATING_APPOINTMENT
  -> AWAITING_CONFIRMATION
      -> CONFIRMED
          -> REMINDER_SCHEDULED
          -> RESCHEDULED -> REMINDER_SCHEDULED
          -> COMPLETED
          -> CANCELLED
      -> REJECTED
      -> EXPIRED
      -> CANCELLED
  -> FAILED
```

Existing appointment rows retain the simpler `PENDING`, `CONFIRMED`, `COMPLETED`, and `CANCELLED` states.

## Persistence

New tables:

- `appointment_booking_operations`: request, workflow identity, status, result, error, and audit timestamps.
- `appointment_slot_reservations`: specialist time range, reservation status, expiry, operation, and appointment link.
- `workflow_outbox`: transactional workflow-start events and delivery attempts.
- `notification_deliveries`: idempotency record for booking and reminder notification channels.

Appointment additions:

- `booking_operation_id`
- `schedule_version`

Production PostgreSQL must enforce non-overlapping active reservations. SQLite remains a local/demo fallback and cannot provide the same concurrency guarantee.

## Workflow behavior

1. Load the booking operation by ID.
2. Validate active patient, active specialist, role, date, duration, and appointment type.
3. Atomically reserve the requested interval.
4. Create the appointment idempotently and link it to the reservation and operation.
5. Create patient and specialist booking notifications.
6. Wait for an authorized human decision until the configured deadline.
7. On confirmation, schedule durable reminders (default: 24 and 2 hours before the visit).
8. Before every delivery, reload the appointment and validate status and schedule version.
9. On reschedule, reserve the new interval first, update the appointment, release the old interval, increment the version, and recalculate timers.
10. On cancellation, expiry, rejection, or failure, release any active reservation and stop outstanding reminders.

Temporal activities are idempotent and may be retried. Validation errors are non-retryable; transient database and delivery errors use bounded exponential retry policies.

## Repository layout

```text
backend/
  api/v1/appointment_operations.py
  orchestration/appointments/
    contracts.py
    workflow.py
    activities.py
    temporal_client.py
    outbox_relay.py
    worker.py
  models/
    appointment_operation.py
    appointment_slot_reservation.py
    workflow_outbox.py
    notification_delivery.py
  schemas/appointment_operation.py
  services/
    appointment_orchestration_service.py
    slot_reservation_service.py
  tests/orchestration/
frontend/
  lib/appointment-orchestration.ts
  components/appointment-operation-status.tsx
  components/patient-appointment-request.tsx
  components/specialist-booking-requests.tsx
infra/temporal/
  docker-compose.yml
```

## Delivery phases

1. Add SDK, configuration, local Temporal infrastructure, and the separate worker.
2. Add operation, reservation, outbox, delivery persistence, and database constraints.
3. Implement validation, reservation, creation, compensation, and status querying.
4. Add specialist confirm/cancel decisions and confirmation expiry.
5. Add durable reminders and notification deduplication.
6. Add rescheduling and timer versioning.
7. Add outbox reconciliation, metrics, structured logging, and worker health checks.
8. Migrate mobile/offline staff booking after the web workflow is stable.

## Test and acceptance criteria

- An authenticated patient receives `202` and a trackable operation ID.
- A patient cannot book for another patient.
- Duplicate idempotency keys return the same operation.
- Concurrent requests cannot acquire the same specialist interval.
- An assigned specialist can confirm or cancel; unrelated users cannot.
- Cancellation and rescheduling prevent stale reminders.
- Workflow and activity retries never duplicate appointments or notifications.
- Timers survive API and worker restarts.
- Temporal workflow history contains no name, NIC, phone number, medical notes, or diagnosis.
- Backend API, workflow time-skipping, concurrency, authorization, and frontend type checks pass.

## Runtime configuration

```env
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_APPOINTMENT_TASK_QUEUE=bloomcare-appointments
TEMPORAL_TLS_ENABLED=false
APPOINTMENT_CONFIRMATION_TIMEOUT_HOURS=24
APPOINTMENT_REMINDER_HOURS=24,2
APPOINTMENT_RESERVATION_TTL_MINUTES=15
TEMPORAL_MAX_ACTIVITY_ATTEMPTS=5
TEMPORAL_ACTIVITY_TIMEOUT_SECONDS=30
```

The API and worker deploy independently:

```text
web: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
worker: python -m backend.orchestration.appointments.worker
```
