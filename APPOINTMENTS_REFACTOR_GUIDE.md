# BloomCare Appointments Table Refactoring Guide

## Overview
This document outlines the comprehensive refactoring of the `appointments` table to support a simplified booking workflow with predefined available time slots, automatic status management, and strict data integrity constraints.

## Key Changes Summary

### 1. **Default Status Changed to SCHEDULED**
- **Before**: Appointments created with `status = 'PENDING'`
- **After**: Appointments created with `status = 'SCHEDULED'`
- **Reason**: Simplified workflow where patients directly book available time slots; no manual confirmation needed

### 2. **Status Workflow Simplified**
```
┌──────────────┐
│  SCHEDULED   │ ← New appointments start here
└──────┬───────┘
       │
       ├─────→ COMPLETED (doctor marks after consultation)
       │
       └─────→ CANCELLED (patient or staff can cancel)

PENDING & CONFIRMED: Retained for future extensibility only
```

### 3. **New Audit Trail Columns**
| Column | Type | Purpose |
|--------|------|---------|
| `completed_by_id` | UUID | ID of doctor who completed the appointment |
| `completed_at` | TIMESTAMPTZ | Timestamp when marked as completed |
| `cancelled_by_id` | UUID | ID of user who cancelled the appointment |
| `cancelled_at` | TIMESTAMPTZ | Timestamp when cancellation occurred |
| `reason_for_cancellation` | VARCHAR(255) | Cancellation reason for accountability |

### 4. **Time Slot Management**

#### Unique Constraint: Prevent Double-Booking
```sql
UNIQUE(specialist_id, appointment_date)
```
- Each specialist can have **only one appointment per timestamp**
- Treats `appointment_date` as atomic slot identifier
- Prevents accidental overbooking

**Example**:
```
Dr. Smith (specialist_id = uuid1)
  ├─ 2024-04-10 09:00:00 ✓ (Patient A) - SCHEDULED
  └─ 2024-04-10 09:00:00 ✗ (Patient B) - REJECTED (violates unique constraint)
  
Dr. Smith can have different times:
  ├─ 2024-04-10 09:00:00 (Patient A)
  └─ 2024-04-10 10:00:00 (Patient B)
```

### 5. **Daily Queue System**

#### Queue Number Tracking Per Doctor Per Day
```sql
CONSTRAINT chk_queue_per_specialist_per_day UNIQUE (
    specialist_id, 
    DATE(appointment_date), 
    queue_number
)
```

**Purpose**: Maintain sequential order for patient consultations

**Usage**:
```
Dr. Smith on 2024-04-10:
  Queue Position 1: Patient A @09:00 (queue_number = 1)
  Queue Position 2: Patient B @09:30 (queue_number = 2)
  Queue Position 3: Patient C @10:00 (queue_number = 3)

Dr. Smith on 2024-04-11:
  Queue Position 1: Patient D @09:00 (queue_number = 1) ← Resets daily
```

#### Backend Responsibility: Generate Queue Numbers
The FastAPI backend must:
1. **Query existing queue numbers** for the specialist on that day:
   ```python
   existing_queues = db.query(Appointment).filter(
       Appointment.specialist_id == specialist_id,
       DATE(Appointment.appointment_date) == appointment_date.date(),
       Appointment.status == 'SCHEDULED'  # Only count active appointments
   ).all()
   next_queue = max([apt.queue_number for apt in existing_queues] or [0]) + 1
   ```

2. **Assign queue number** when creating/updating appointment
3. **Recalculate queue numbers** if an appointment is cancelled (optional, depends on policy)

### 6. **Status Transition Validation**

#### Database-Level Validation (Triggers)
```sql
trigger: validate_appointment_status_transition()
```

**Valid Transitions**:
```
SCHEDULED → COMPLETED (required: completed_by_id, completed_at)
SCHEDULED → CANCELLED (required: cancelled_by_id, cancelled_at)

COMPLETED ✗ Cannot transition from terminal state
CANCELLED ✗ Cannot transition from terminal state
```

**Auto-Populated Fields**:
- `completed_at` → Set to `CURRENT_TIMESTAMP` when status = 'COMPLETED'
- `cancelled_at` → Set to `CURRENT_TIMESTAMP` when status = 'CANCELLED'

#### Backend-Level Validation (FastAPI)
Should check:
1. **Status transition is valid**
   ```yaml
   FROM: SCHEDULED
   TO: COMPLETED or CANCELLED
   ```

2. **User has authorization**
   ```yaml
   COMPLETED:
     - Only DOCTOR or CLINICAL_SPECIALIST who is assigned (specialist_id matches)
     - Or ADMIN users
   
   CANCELLED:
     - Patient who created the appointment (created_by_id == current_user.id)
     - Or DOCTOR/CLINICAL_SPECIALIST assigned to appointment
     - Or ADMIN users
   ```

3. **Required fields are provided**
   ```yaml
   COMPLETED requires:
     - completed_by_id (doctor's ID)
     - (completed_at auto-set by trigger)
   
   CANCELLED requires:
     - cancelled_by_id (user cancelling)
     - (cancelled_at auto-set by trigger)
     - reason_for_cancellation (recommended)
   ```

### 7. **Automatic Timestamp Updates**

#### Trigger: `touch_updated_at()`
Executes `BEFORE UPDATE` on appointments table:
```sql
NEW.updated_at = CURRENT_TIMESTAMP;
```

- Every modification updates `updated_at` automatically
- No manual timestamp management needed
- Useful for tracking when status changed, notes modified, etc.

### 8. **Auto-Escalation Integration**

#### Trigger: `trigger_auto_escalate()`
When a high-risk screening is created:
```python
edge_risk_classification == 'escalate'
→ Creates SCHEDULED appointment automatically
```

**Auto-Created Appointment Details**:
- `status = 'SCHEDULED'` (ready for doctor assignment)
- `specialist_id = NULL` (doctor selects from dashboard)
- `queue_number = 0` (backend will generate on assignment)
- `appointment_type = 'HIGH_RISK_FOLLOW_UP'`
- `notes = 'AUTO-ESCALATED: Patient marked as high-risk (escalate classification) - requires urgent review'`

### 9. **Performance Optimization**

#### New Indexes Added
| Index | Purpose |
|-------|---------|
| `idx_appointments_specialist` | Fast lookup by doctor |
| `idx_appointments_status` | Filter by status (SCHEDULED, COMPLETED, CANCELLED) |
| `idx_appointments_specialist_date` | Prevent double-booking queries |
| `idx_appointments_specialist_day_queue` | Daily queue lookup for queue number generation |
| `idx_appointments_completed` | Reporting: completed appointments |
| `idx_appointments_cancelled` | Reporting: cancelled appointments |

### 10. **Schema Changes Required in Backend Models**

#### Model: `Appointment`
Add four new columns:
```python
completed_by_id: Optional[str] = None
completed_at: Optional[datetime] = None
cancelled_by_id: Optional[str] = None
cancelled_at: Optional[datetime] = None
reason_for_cancellation: Optional[str] = None
```

#### Schema: `AppointmentResponse`
```python
class AppointmentResponse(BaseModel):
    # ... existing fields ...
    completed_by_id: Optional[UUID]
    completed_at: Optional[datetime]
    cancelled_by_id: Optional[UUID]
    cancelled_at: Optional[datetime]
    reason_for_cancellation: Optional[str]
```

#### New Schema: `AppointmentStatusUpdate`
```python
class AppointmentStatusUpdate(BaseModel):
    status: str  # SCHEDULED, COMPLETED, or CANCELLED
    completed_by_id: Optional[UUID]  # Required if status = COMPLETED
    cancelled_by_id: Optional[UUID]  # Required if status = CANCELLED
    reason_for_cancellation: Optional[str]
    notes: Optional[str]
```

## Implementation Checklist

### Database Migration
- [x] Update appointments table schema
- [x] Add new columns with constraints
- [x] Update status default from PENDING to SCHEDULED
- [x] Add unique constraints for time slots and queue
- [x] Add CHECK constraints for audit trail
- [x] Create status transition validation trigger
- [x] Create/update indices for performance
- [x] Add trigger functions for auto-escalation

### Backend (FastAPI)

#### Models (`backend/models/appointment.py`)
- [ ] Add `completed_by_id` field
- [ ] Add `completed_at` field
- [ ] Add `cancelled_by_id` field
- [ ] Add `cancelled_at` field
- [ ] Add `reason_for_cancellation` field

#### Schemas (`backend/schemas/appointment.py`)
- [x] Update `AppointmentResponse` with new fields
- [x] Create `AppointmentStatusUpdate` schema

#### Services (`backend/services/appointment_service.py`)

**Queue Number Generation**:
```python
def _get_next_queue_number(
    db: Session,
    specialist_id: str,
    appointment_date: datetime
) -> int:
    """Generate next queue number for specialist on given day"""
    existing = db.query(Appointment).filter(
        Appointment.specialist_id == specialist_id,
        DATE(Appointment.appointment_date) == appointment_date.date(),
        Appointment.status == 'SCHEDULED'
    ).all()
    return max([apt.queue_number for apt in existing] or [0]) + 1
```

**Status Update Validation**:
```python
def _validate_status_transition(
    current_status: str,
    new_status: str,
    current_user: User,
    appointment: Appointment
) -> bool:
    """Validate if status transition is allowed"""
    # Only SCHEDULED can transition to COMPLETED or CANCELLED
    if current_status != 'SCHEDULED':
        return False
    
    if new_status == 'COMPLETED':
        # Only assigned specialist or admin
        return (current_user.role == UserRole.ADMIN or 
                current_user.id == appointment.specialist_id)
    
    elif new_status == 'CANCELLED':
        # Patient, assigned specialist, or admin
        return (current_user.id == appointment.created_by_id or
                current_user.id == appointment.specialist_id or
                current_user.role == UserRole.ADMIN)
    
    return False
```

**Update Status Method**:
```python
@staticmethod
def update_appointment_status(
    db: Session,
    appointment_id: str,
    status_update: AppointmentStatusUpdate,
    current_user: User
) -> AppointmentResponse:
    """Update appointment status with validation and audit trail"""
    appointment = db.query(Appointment).filter(
        Appointment.id == appointment_id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Validate transition
    if not AppointmentService._validate_status_transition(
        appointment.status,
        status_update.status,
        current_user,
        appointment
    ):
        raise HTTPException(
            status_code=403,
            detail=f"Cannot transition from {appointment.status} to {status_update.status}"
        )
    
    # Update fields
    appointment.status = status_update.status
    
    if status_update.status == 'COMPLETED':
        appointment.completed_by_id = status_update.completed_by_id or current_user.id
    elif status_update.status == 'CANCELLED':
        appointment.cancelled_by_id = status_update.cancelled_by_id or current_user.id
        appointment.reason_for_cancellation = status_update.reason_for_cancellation
    
    db.commit()
    return AppointmentService._serialize_appointment(db, appointment)
```

#### API Routes (`backend/api/v1/appointments.py`)

**Update Status Endpoint**:
```python
@router.patch("/{appointment_id}/status", response_model=AppointmentResponse)
def update_appointment_status(
    appointment_id: str,
    status_update: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Update appointment status (SCHEDULED → COMPLETED/CANCELLED)"""
    return AppointmentService.update_appointment_status(
        db, appointment_id, status_update, current_user
    )
```

**Create Appointment Endpoint** (Update to auto-assign queue):
```python
# After creating appointment, call:
next_queue = AppointmentService._get_next_queue_number(
    db,
    appointment.specialist_id,
    appointment.appointment_date
)
appointment.queue_number = next_queue
db.commit()
```

### Frontend (`frontend/components/clinical-dashboard.tsx`)

**Status Update Handler**:
```typescript
const updateAppointmentStatus = async (
    appointmentId: string,
    newStatus: string,
    reason?: string
) => {
    try {
        const response = await fetch(
            `${configuredApiBase}/appointments/${appointmentId}/status`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: newStatus,
                    completed_by_id: userProfile?.id,
                    cancelled_by_id: userProfile?.id,
                    reason_for_cancellation: reason
                })
            }
        );
        
        if (response.ok) {
            // Refresh appointments list
            loadDoctorAppointments();
        }
    } catch (error) {
        console.error("Failed to update appointment status:", error);
    }
};
```

## Data Integrity Rules

### Cannot Violate
1. **Double-booking**: Same specialist cannot have 2 appointments at same timestamp
2. **Status terminal states**: COMPLETED and CANCELLED appointments cannot be modified
3. **Audit trail**: Completed/cancelled appointments must have actor ID and timestamp
4. **Queue uniqueness**: No duplicate queue numbers per specialist per day

### Backend Must Enforce
1. **Role-based access control** for status updates
2. **Queue number sequencing** during appointment creation
3. **Required fields** for status transitions

## Testing Checklist

### Database Tests
- [ ] Insert appointment with auto-set queue number
- [ ] Prevent duplicate time slots (UNIQUE constraint)
- [ ] Prevent invalid status transitions (trigger validation)
- [ ] Auto-populate `completed_at` when status = 'COMPLETED'
- [ ] Auto-populate `cancelled_at` when status = 'CANCELLED'
- [ ] Unique queue numbers per specialist per day

### API Tests
- [ ] Create appointment → defaults to SCHEDULED status ✓
- [ ] Transition SCHEDULED → COMPLETED (success)
- [ ] Transition SCHEDULED → CANCELLED (success)
- [ ] Reject transition from COMPLETED (error)
- [ ] Reject unauthorized status update (403 Forbidden)
- [ ] Queue numbers increment correctly
- [ ] Auto-escalation creates SCHEDULED appointment

### Integration Tests
- [ ] End-to-end: Patient books slot → SCHEDULED → Doctor completes → COMPLETED
- [ ] Cancellation flow: Patient cancels appointment
- [ ] Reporting: Filter by status (COMPLETED, CANCELLED)

## Migration Path

### For Existing Data
```sql
-- Update existing PENDING/CONFIRMED appointments to SCHEDULED
UPDATE appointments
SET status = 'SCHEDULED'
WHERE status IN ('PENDING', 'CONFIRMED')
  AND created_at < NOW() - INTERVAL '1 day';

-- Auto-assign queue numbers to existing SCHEDULED appointments
WITH ranked_apts AS (
    SELECT 
        id,
        specialist_id,
        appointment_date,
        ROW_NUMBER() OVER (
            PARTITION BY specialist_id, DATE(appointment_date) 
            ORDER BY appointment_date
        ) as new_queue
    FROM appointments
    WHERE status = 'SCHEDULED'
)
UPDATE appointments
SET queue_number = ranked_apts.new_queue - 1
FROM ranked_apts
WHERE appointments.id = ranked_apts.id;
```

## Future Extensions
This refactored schema is ready for:
- **AI-based triage**: Additional logic before SCHEDULED state
- **Approval workflows**: Add intermediate states if needed
- **No-show tracking**: Add `no_show_at` field
- **Rescheduling**: Track appointment history
- **Performance analytics**: Built-in audit trail supports reporting

## References
- Schema: `backend/db/schema.sql`
- Models: `backend/models/appointment.py`
- Schemas: `backend/schemas/appointment.py`
- API: `backend/api/v1/appointments.py`
- Service: `backend/services/appointment_service.py`
- Frontend: `frontend/components/clinical-dashboard.tsx`
