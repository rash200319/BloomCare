# Patient Portal API Integration Guide

## Overview
The Patient Portal UI is designed for patient self-service features but currently uses HARDCODED patient data. This guide explains how to integrate real API calls to fetch patient-specific information.

---

## Current State

**File:** `frontend/components/patient-portal.tsx`

**Hardcoded Data:**
- Patient profile (name, email, gestational week, DOB, blood group, due date)
- Vitals history chart (Systolic/Diastolic/Weight trends)
- Upcoming appointments list
- Medical history timeline
- Symptom tracking
- Medication/prenatal checklist
- Messages from providers

---

## Backend API Requirements

### Required Endpoints
1. `GET /patients/{patient_id}` - Get patient profile
2. `GET /patients/{patient_id}/history` - Get screening history (vitals)
3. `GET /appointments/patient/{patient_id}` or similar - Get patient appointments
4. `GET /longitudinal/{patient_id}/risk-journey` - Get risk trends
5. `GET /patients/{patient_id}/reports` - Get patient reports

### Data Flow

```
Login (Bearer Token)
↓
Get Current User Info from Token
↓
Fetch /patients/{user_id}
↓
Fetch /patients/{patient_id}/history
↓
Fetch /appointments/patient/{patient_id}
↓
Fetch /longitudinal/{patient_id}/risk-journey
↓
Display integrated patient view
```

---

## Implementation Steps

### Step 1: Extract Patient ID from Auth Context

Patient ID must come from:
- Backend response during login (returned in user object)
- Or derived from `user_id` if it's the patient_id
- Stored in localStorage along with auth token

```typescript
// In login component (already done):
const loginResponse = await apiRequest("/auth/login-user-id", {
  method: "POST",
  body: JSON.stringify({ user_id, password })
})
const loginData = await loginResponse.json()
localStorage.setItem("bloomcare_access_token", loginData.access_token)
localStorage.setItem("bloomcare_patient_id", loginData.patient_id) // NEW
localStorage.setItem("bloomcare_user_id", loginData.user_id)
localStorage.setItem("bloomcare_role", loginData.role)

// In patient portal:
const patientId = localStorage.getItem("bloomcare_patient_id") || patientName
```

### Step 2: Add State Variables

```typescript
interface PatientData {
  id: string
  user_id: string
  full_name: string
  date_of_birth?: string
  blood_group?: string
  contact_number?: string
  assigned_worker_id?: string
}

interface VitalRecord {
  systolic?: number
  diastolic?: number
  heart_rate?: number
  temperature?: number
  blood_sugar?: number
  bmi?: number
  collected_at: string
}

interface PatientAppointment {
  id: string
  specialist_id: string
  specialist_name: string
  appointment_date: string
  duration_minutes: number
  status: string
  notes?: string
}

// State
const [patientProfile, setPatientProfile] = useState<PatientData | null>(null)
const [vitalsHistory, setVitalsHistory] = useState<VitalRecord[]>([])
const [appointments, setAppointments] = useState<PatientAppointment[]>([])
const [riskJourney, setRiskJourney] = useState<any[]>([])
const [isLoadingProfile, setIsLoadingProfile] = useState(false)
const [profileError, setProfileError] = useState<string | null>(null)
```

### Step 3: Add Data Fetching Function

```typescript
const loadPatientData = async (patientId: string) => {
  try {
    setIsLoadingProfile(true)
    setProfileError(null)

    // Fetch in parallel for performance
    const [profileRes, historyRes, appointmentsRes, riskRes] = await Promise.all([
      apiRequest(`/patients/${patientId}`),
      apiRequest(`/patients/${patientId}/history`),
      apiRequest(`/appointments/patient/${patientId}`),
      apiRequest(`/longitudinal/${patientId}/risk-journey`)
    ])

    // Handle profile
    if (profileRes.ok) {
      const profile = await profileRes.json()
      setPatientProfile(profile)
    }

    // Handle history/vitals
    if (historyRes.ok) {
      const history = await historyRes.json()
      // Extract vitals from screening history
      const vitals = history.screenings?.map((s: any) => ({
        systolic: s.systolic,
        diastolic: s.diastolic,
        heart_rate: s.heart_rate,
        temperature: s.temperature,
        blood_sugar: s.blood_sugar,
        bmi: s.bmi,
        collected_at: s.collected_at
      })) || []
      setVitalsHistory(vitals)
    }

    // Handle appointments
    if (appointmentsRes.ok) {
      const appts = await appointmentsRes.json()
      setAppointments(appts)
    }

    // Handle risk journey
    if (riskRes.ok) {
      const risk = await riskRes.json()
      setRiskJourney(Array.isArray(risk) ? risk : risk.screenings || [])
    }
  } catch (err) {
    setProfileError(err instanceof Error ? err.message : "Failed to load your profile")
    console.warn("Patient data load error:", err)
  } finally {
    setIsLoadingProfile(false)
  }
}

// Call on mount
useEffect(() => {
  const patientId = localStorage.getItem("bloomcare_patient_id")
  if (patientId) {
    loadPatientData(patientId)
  }
}, [])
```

### Step 4: Calculate Patient Details from Real Data

```typescript
// Calculate gestational age from due date or last menstrual period
const calculateGestationalWeeks = (): number => {
  if (!patientProfile?.date_of_birth) return 0
  
  // If we have due date in profile, calculate from that
  // Otherwise estimate from DOB + pregnancy duration
  // Typical: ~40 weeks from LMP
  const today = new Date()
  // You may need to get LMP from patient profile if available
  // For now, return 0 if not available
  return 0
}

// Calculate due date
const calculateDueDate = (): string => {
  if (!patientProfile?.date_of_birth) return ""
  // If gestational weeks available, add to current date
  // Otherwise use profile data if available
  return new Date(patientProfile.date_of_birth).toLocaleDateString()
}

const gestationalWeeks = useMemo(() => calculateGestationalWeeks(), [patientProfile])
const dueDate = useMemo(() => calculateDueDate(), [patientProfile])
```

### Step 5: Transform Vitals Data for Chart

```typescript
const chartData = useMemo(() => {
  return vitalsHistory.map(v => ({
    date: new Date(v.collected_at).toLocaleDateString(),
    systolic: v.systolic || 0,
    diastolic: v.diastolic || 0,
    weight: v.bmi ? (v.bmi * 1.73).toFixed(1) : 0 // Approximate from BMI
  }))
}, [vitalsHistory])
```

### Step 6: Transform Risk Journey for Timeline

```typescript
const medicalHistory = useMemo(() => {
  return riskJourney.map(entry => ({
    date: new Date(entry.screened_at).toLocaleDateString(),
    type: entry.general_risk_flag ? "High Risk Detected" : "Screening",
    description: `Risk Score: ${(entry.probability_score * 100).toFixed(1)}%`,
    severity: entry.general_risk_flag ? "high" : "normal"
  }))
}, [riskJourney])
```

### Step 7: Format Upcoming Appointments

```typescript
const upcomingAppointments = useMemo(() => {
  const today = new Date()
  return appointments
    .filter(apt => new Date(apt.appointment_date) >= today && apt.status === "SCHEDULED")
    .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())
    .slice(0, 5) // Show next 5
}, [appointments])
```

### Step 8: Replace Hardcoded Values in JSX

**Profile Section:**
```jsx
// OLD (hardcoded)
<p className="text-2xl font-bold text-slate-900">Sarah Johnson</p>

// NEW (real data)
<p className="text-2xl font-bold text-slate-900">{patientProfile?.full_name || "N/A"}</p>

// OLD
<p className="text-sm text-slate-600">sarah.johnson@email.com</p>

// NEW
<p className="text-sm text-slate-600">{patientProfile?.contact_number || "N/A"}</p>

// OLD
<div className="text-2xl font-bold text-primary">24 weeks</div>

// NEW
<div className="text-2xl font-bold text-primary">{gestationalWeeks} weeks</div>
```

**Vitals Chart:**
```jsx
// OLD (hardcoded chartData)
<LineChart data={[
  { date: "Jan 1", systolic: 120, diastolic: 80 },
  ...
]}>

// NEW
<LineChart data={chartData}>
```

**Appointments List:**
```jsx
// OLD (hardcoded array)
{[...].map(apt => (...))}

// NEW
{upcomingAppointments.map(apt => (
  <div key={apt.id} className="...">
    <p className="font-medium">{apt.specialist_name}</p>
    <p className="text-sm text-gray-500">
      {new Date(apt.appointment_date).toLocaleDateString()}
    </p>
    <p className="text-sm text-gray-500">
      {new Date(apt.appointment_date).toLocaleTimeString()}
    </p>
    <Badge variant={apt.status === "SCHEDULED" ? "default" : "secondary"}>
      {apt.status}
    </Badge>
  </div>
))}
```

**Medical History Timeline:**
```jsx
// OLD (hardcoded entries)
{[...].map(entry => (...))}

// NEW
{medicalHistory.map((entry, idx) => (
  <div key={idx} className="flex gap-4">
    <div className="text-sm font-medium">{entry.date}</div>
    <div>
      <p className="font-medium text-slate-900">{entry.type}</p>
      <p className="text-sm text-slate-600">{entry.description}</p>
    </div>
  </div>
))}
```

### Step 9: Add Loading & Error States

```jsx
{isLoadingProfile && (
  <div className="py-12 text-center">
    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    <p className="mt-4 text-gray-600">Loading your profile...</p>
  </div>
)}

{profileError && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
    <p className="text-sm text-red-900">{profileError}</p>
    <button 
      onClick={() => loadPatientData(localStorage.getItem("bloomcare_patient_id") || "")}
      className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
    >
      Retry
    </button>
  </div>
)}

{!isLoadingProfile && patientProfile && (
  // Show real data
)}
```

### Step 10: Add Refresh Capability

```typescript
const handleRefresh = async () => {
  const patientId = localStorage.getItem("bloomcare_patient_id")
  if (patientId) {
    await loadPatientData(patientId)
  }
}

// Add refresh button to header
<Button 
  onClick={handleRefresh}
  disabled={isLoadingProfile}
  variant="outline"
  size="sm"
>
  <RefreshCw className="w-4 h-4 mr-2" />
  Refresh
</Button>
```

---

## Additional Features to Consider

### 1. Medication/Prenatal Checklist
- Can be stored in patient profile or separate endpoint
- Currently hardcoded → needs backend schema update

### 2. Provider Messages
- Requires message/notification system
- May need WebSocket for live updates
- Not currently implemented in backend

### 3. Symptom Tracking
- Could use longitudinal endpoint with additional fields
- Or separate symptoms endpoint
- Currently appears hardcoded

### 4. Reports History
- Use `/patients/{patient_id}/reports` endpoint
- Display downloadable/viewable reports

---

## Error Handling

```typescript
const apiRequest = async (path: string, init?: RequestInit) => {
  try {
    const response = await fetch(url, { ...init, headers })
    
    if (response.status === 401) {
      // Session expired, redirect to login
      localStorage.clear()
      window.location.href = "/"
      return response
    }
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }
    
    return response
  } catch (error) {
    // Network error, show user-friendly message
    console.error(error)
    throw error
  }
}
```

---

## Performance Optimization

**Data Refresh Strategy:**
```typescript
// Don't refetch on every component update
useEffect(() => {
  const patientId = localStorage.getItem("bloomcare_patient_id")
  if (patientId && !patientProfile) { // Only load if not already loaded
    loadPatientData(patientId)
  }
}, [patientProfile]) // Dependency prevents unnecessary refetches
```

**Pagination for Large Histories:**
```typescript
const [historyPage, setHistoryPage] = useState(0)
const pageSize = 20

const paginatedHistory = useMemo(() => {
  const start = historyPage * pageSize
  return medicalHistory.slice(start, start + pageSize)
}, [medicalHistory, historyPage])
```

---

## Testing Checklist

- [ ] Patient profile loads correctly from API
- [ ] All patient vitals display in chart
- [ ] Upcoming appointments filtered and sorted
- [ ] Medical history shows in timeline
- [ ] Risk scores calculated from journey data
- [ ] Language switching works with real data
- [ ] Refresh button refetches data
- [ ] Error messages display appropriately
- [ ] Loading states show while fetching
- [ ] Mobile responsive with different data sizes
- [ ] Logout clears patient data

---

## Estimated Implementation Time

**Time Breakdown:**
- Add state variables: 10 minutes
- Data fetching function: 15 minutes
- Data transformation & calculations: 15 minutes
- JSX replacements: 20 minutes
- Error handling & loading states: 10 minutes
- Testing: 15 minutes

**Total: ~85 minutes**

---

## Security Considerations

1. **Patient ID in localStorage:** Ensure not exposed in XSS attacks
2. **Bearer token scope:** Should only allow access to own patient data
3. **Appointment details:** Verify user can only see own appointments
4. **Medical history:** Should be encrypted in transit (HTTPS)
5. **Logout:** Clear all patient data from localStorage

---

## Related Guides
- [Appointment Scheduling Integration](#appointment-scheduling.tsx)
- [Longitudinal Tracking Integration](#longitudinal-tracker.tsx)
- [Admin Dashboard Integration](./ADMIN_DASHBOARD_INTEGRATION_GUIDE.md)

---

**Last Updated:** April 2, 2026  
**Status:** Ready for Implementation
