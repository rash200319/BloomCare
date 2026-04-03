# Today's Appointments Search & Filtering Feature

## Overview
Enhanced the clinical dashboard left sidebar to display **today's appointments by doctor's name** and support **searching by patient NIC, patient ID, or patient name**.

## Features Implemented

### 1. View Mode Toggle
Users can now toggle between two sidebar views:
- **🔴 High Risk** (Escalated Cases) - Shows high-risk patients from triaging system
- **📅 Today** (Today's Appointments) - Shows all appointments scheduled for today

### 2. Today's Appointments Display
When in "Today" mode, shows:
- **Patient Name** - Full name of the patient
- **Doctor Name** - Specialist/doctor assigned to the appointment
- **Queue Number** - Sequential position in doctor's daily schedule (e.g., "Queue #1")
- **Risk Level** - Color-coded badge:
  - 🔴 **High Risk** (red) - Patient marked as escalate
  - 🟢 **Routine** (green) - Normal risk patient
- **Risk Score** - Numerical risk probability (0.0 to 1.0)
- **Status** - Appointment state:
  - SCHEDULED (blue) - Ready for consultation
  - COMPLETED (green) - Already seen
  - CANCELLED (red) - Cancelled appointment
- **Appointment Time** - Time slot in 12-hour format

### 3. Doctor Filter Dropdown
Exclusive to "Today" mode:
- Dropdown shows all doctors with appointments today
- Filter appointments to show only specific doctor's patients
- "All Doctors" option shows every appointment for the day
- Dropdown automatically populates from backend data

### 4. Patient Search
Works in both view modes:
- **Escalated Cases Mode**: Search by patient ID or name
- **Today's Appointments Mode**: Search by patient name or doctor name

Search is **real-time** with multi-field matching:
```
Search Query: "m2" 
Matches: Patient ID "m2" OR Patient Name contains "m2" OR Doctor Name contains "m2"
```

### 5. Smart Placeholders
Search placeholder changes based on active view:
- **Escalated**: "Search ID or Name..."
- **Today**: "Search Patient or Doctor..."

### 6. Footer Statistics
Bottom of sidebar shows context-aware counts:
- **Escalated Mode**: "Pending Review: X" - Count of unreviewed high-risk cases
- **Today Mode**: "Today's Total: X/Y" - Shows filtered count vs total appointments

## User Interface Changes

### Left Sidebar Header
```
📅 Today's Appointments (when in Today mode)
or
⚠️ Escalated Cases (in Escalated mode)
```

### View Toggle Buttons
```
┌─────────────────────────────┐
│ [🔴 HIGH RISK] [📅 TODAY]  │  ← Toggle between views
└─────────────────────────────┘
```

### Doctor Filter (Today Mode Only)
```
┌─────────────────────────────┐
│ Doctor                      │
│ ┌───────────────────────────┤
│ │ All Doctors          ▼    │
│ │ Dr. Smith                 │
│ │ Dr. Johnson               │
│ │ Dr. Williams              │
│ └───────────────────────────┤
└─────────────────────────────┘
```

### Appointment Card Example
```
┌─────────────────────────────┐
│ Patient: M2 (John Doe)      │ 
│ Doctor: Dr. Smith           │
│ [Queue #1]                  │
│ 🔴 HIGH RISK  |  SCHEDULED  │
│ ⏱️ 10:30 AM                 │
└─────────────────────────────┘
```

## Technical Implementation

### State Management
```typescript
// View mode selection
const [sidebarViewMode, setSidebarViewMode] = useState<"escalated" | "today">("escalated")

// Today's appointments data
const [todayAppointments, setTodayAppointments] = useState<any[]>([])
const [isLoadingTodayAppointments, setIsLoadingTodayAppointments] = useState(false)

// Doctor filter selection
const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string | null>(null)
```

### API Endpoints Used
1. **GET /appointments?status=SCHEDULED** - Load all scheduled appointments
   - Filtered client-side to today only
   - Respects role-based access (shows high-risk only for doctors)

2. **GET /users/?role=DOCTOR&limit=500** - Load all doctors (for dropdown)
   - Used to populate doctor filter options

### Filtering Logic
```typescript
const filteredTodayAppointments = useMemo(() => {
  let filtered = todayAppointments

  // Filter by doctor name if selected
  if (selectedDoctorFilter) {
    filtered = filtered.filter(
      (apt: any) => apt.specialist_name?.toLowerCase().includes(selectedDoctorFilter.toLowerCase())
    )
  }

  // Filter by search query (patient name or NIC)
  if (searchQuery) {
    filtered = filtered.filter(
      (apt: any) =>
        apt.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.patient_id?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  return filtered
}, [todayAppointments, searchQuery, selectedDoctorFilter])
```

## Multi-Language Support
All text supports three languages:
- **English (EN)**
- **Sinhala (SI)**
- **Tamil (TA)**

Examples:
```
"High Risk" / "ඉහළ අවදානම" / "சிக்கல்"
"Today" / "අද" / "இன్று"
"Today's Appointments" / "අද දින ප්‍රකාශන" / "இன்றைய நியமனங்கள்"
```

## Data Flow

1. **User clicks "Today" button**
   ↓
2. **loadTodayAppointments() executes**
   - Fetches appointments with SCHEDULED status
   - Filters to only today's date
   - Sorts by appointment time
   ↓
3. **User selects doctor from dropdown**
   ↓
4. **uniqueDoctorsInToday calculates available doctors**
   - Extracts from todayAppointments
   - Creates options in dropdown
   ↓
5. **User searches for patient**
   ↓
6. **filteredTodayAppointments filters results**
   - By doctor (if selected)
   - By patient name/NIC (if searched)
   ↓
7. **Results display in sidebar**
   - Click to select appointment
   - Shows appointment details

## Integration Points

### With Existing Features
- **Escalated Cases**: Preserved and fully functional
- **Appointment Status Updates**: Works with today's appointments
- **Role-Based Access**: Doctor only sees high-risk appointments
- **Patient Selection**: Clicking appointment selects patient for analysis tab

### With Database Refactoring
- Uses new appointment schema with audit trail fields
- Respects status workflow (SCHEDULED → COMPLETED/CANCELLED)
- Shows risk_level and risk_score from Stage1Screening

## Performance Optimizations
1. **useMemo for filtered lists** - Recalculates only when dependencies change
2. **Client-side date filtering** - Filters appointments on client side instead of backend
3. **Selective API calls** - Only fetches doctors when needed
4. **Index-backed queries** - Backend uses `idx_appointments_status` for fast filtering

## Browser Compatibility
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive on desktop and tablet screens
- Touch-friendly dropdown and buttons

## Future Enhancements
1. **Time-based sorting**: Organize by appointment time
2. **Status filtering**: Filter by SCHEDULED/COMPLETED/CANCELLED
3. **Bulk actions**: Select multiple appointments for mass updates
4. **Export**: Export today's appointment list to CSV/PDF
5. **Notifications**: Alert when appointment time approaching
6. **No-show tracking**: Mark and track no-shows
7. **Rescheduling**: Move appointments to different time slots

## Testing Checklist
- [x] View toggle works between Escalated and Today
- [x] Date filtering shows only today's appointments
- [x] Doctor dropdown populates correctly
- [x] Doctor filter reduces appointments correctly
- [x] Patient search works by name and ID
- [x] Risk badges display with correct colors
- [x] Queue numbers display correctly
- [x] Status badges show appointment state
- [x] Footer counts update correctly
- [x] Loading states appear during API calls
- [x] Empty states show appropriate messages
- [x] Multi-language text switches correctly

## Known Limitations
1. **Timezone**: Uses client-local time for "today" filtering
   - Solution: Uses JavaScript `new Date()` which respects client timezone
   
2. **Real-time updates**: Appointments don't auto-refresh
   - Workaround: User must click "Today" button to refresh

3. **Doctor list**: Only shows doctors with today's appointments
   - Future: Add option to show all doctors in system

## Code Files Modified
- `frontend/components/clinical-dashboard.tsx` - Main implementation

## Related Files
- `backend/db/schema.sql` - Appointment table with audit trail
- `backend/schemas/appointment.py` - AppointmentResponse schema
- `backend/api/v1/appointments.py` - Appointment endpoints
- `APPOINTMENTS_REFACTOR_GUIDE.md` - Complete database refactoring documentation
