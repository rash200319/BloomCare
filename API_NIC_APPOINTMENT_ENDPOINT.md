# BloomCare Appointment API - NIC-Based Creation

## Endpoint: Create Appointment by Patient NIC

### Route
```
POST /api/v1/appointments/by-nic
```

### Description
Creates a new appointment using human-readable identifiers (patient NIC and specialist name) instead of UUIDs. This endpoint is designed for frontline staff and automated systems to create appointments without needing to look up internal IDs.

### Request Body
```json
{
  "patient_nic": "200052000660",
  "patient_full_name": "m2",
  "specialist_name": "doc1",
  "appointment_date": "2026-05-03T10:30:00",
  "appointment_type": "PRENATAL_CHECKUP",
  "notes": "Patient reports ongoing symptoms",
  "duration_minutes": 30
}
```

### Request Fields

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `patient_nic` | string | ✓ | Patient's National ID | `"200052000660"` |
| `patient_full_name` | string | ✓ | Patient's full name (verified against NIC) | `"m2"` |
| `specialist_name` | string | ✓ | Specialist's full name (DOCTOR or CLINICAL_SPECIALIST) | `"doc1"` |
| `appointment_date` | datetime | ✓ | Appointment date/time (ISO 8601, must be future) | `"2026-05-03T10:30:00"` |
| `appointment_type` | string | ✗ | Type of appointment (default: PRENATAL_CHECKUP) | `"PRENATAL_CHECKUP"` |
| `notes` | string | ✗ | Additional notes (optional) | `"Patient reports ongoing symptoms"` |
| `duration_minutes` | integer | ✗ | Duration in minutes (default: 30) | `30` |

### Valid Appointment Types
- `PRENATAL_CHECKUP`
- `ULTRASOUND_SCAN`
- `ROUTINE_FOLLOW_UP`
- `LAB_TEST`
- `RISK_ASSESSMENT`
- `ADMISSION_CHECKUP`
- `FIRST_LOGIN_SETUP`

### Success Response (201 Created)
```json
{
  "id": "9942ef34-b985-43db-aeb1-8dfc87adec70",
  "patient_id": "784b66a2-fc35-48f9-801c-bf263374e9eb",
  "patient_name": "m2",
  "specialist_id": "f3510115-17c3-4e77-946b-8c0070611a9a",
  "specialist_name": "doc1",
  "created_by_id": null,
  "created_by_role": "SYSTEM",
  "appointment_type": "PRENATAL_CHECKUP",
  "appointment_date": "2026-05-03T10:30:00",
  "duration_minutes": 30,
  "queue_number": 1,
  "status": "PENDING",
  "notes": "Patient reports ongoing symptoms",
  "created_at": "2026-04-03T05:29:23.722615",
  "updated_at": "2026-04-03T05:29:23.722615"
}
```

### Error Responses

#### 404 - Patient Not Found
```json
{
  "detail": "Patient with NIC '200052000660' not found"
}
```

#### 400 - Patient Name Mismatch
```json
{
  "detail": "Patient name mismatch. Expected 'm2', got 'Wrong Name'"
}
```

#### 404 - Specialist Not Found
```json
{
  "detail": "Specialist 'Dr. NonExistent' not found"
}
```

#### 400 - Invalid Appointment Date
```json
{
  "detail": "Appointment date must be in the future"
}
```

#### 409 - Time Slot Conflict
```json
{
  "detail": "This time slot is already booked for the specialist"
}
```

### Features
- ✓ **Patient NIC Lookup**: Automatically resolves patient_id from national_id
- ✓ **Name Verification**: Confirms patient full name matches before creating appointment
- ✓ **Specialist Resolution**: Finds specialist by full name (case-insensitive)
- ✓ **Auto Queue Assignment**: Assigns queue number for the day
- ✓ **Double-Booking Prevention**: Checks for scheduling conflicts
- ✓ **Future Date Validation**: Ensures appointment is not in the past
- ✓ **System-Created Tracking**: Appointments marked as created_by_role='SYSTEM'
- ✓ **SQLite Compatible**: Works with SQLite (fallback) and PostgreSQL

### Implementation Notes
- Method: `AppointmentService.create_appointment_by_nic()`
- Located in: `backend/services/appointment_service.py`
- Endpoint handler: `backend/api/v1/appointments.py::create_appointment_by_nic()`
- Database compatibility: SQLite ✓ | PostgreSQL ✓
- Status: **Production Ready**

### Testing
Test the endpoint with curl:
```bash
curl -X POST "http://localhost:8005/api/v1/appointments/by-nic" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_nic": "200052000660",
    "patient_full_name": "m2",
    "specialist_name": "doc1",
    "appointment_date": "2026-05-03T10:30:00",
    "appointment_type": "PRENATAL_CHECKUP",
    "notes": "Test appointment",
    "duration_minutes": 30
  }'
```

### Related Endpoints
- `GET /api/v1/appointments/` - List appointments
- `GET /api/v1/appointments/{appointment_id}` - Get appointment details
- `PATCH /api/v1/appointments/{appointment_id}` - Update appointment
- `GET /api/v1/appointments/availability/{specialist_name}` - Get specialist availability
- `POST /api/v1/appointments/` - Create appointment (existing, requires auth)
