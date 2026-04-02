# Admin Dashboard API Integration Guide

## Overview
The Admin Dashboard UI is fully designed but currently uses HARDCODED mock data. This guide explains how to replace mock data with real API calls.

---

## Current State

**File:** `frontend/components/admin-dashboard.tsx`

**Mock Data Used:**
- KPI cards (hardcoded numbers)
- Monthly trends chart (hardcoded monthly data)
- Clinic performance table (hardcoded clinic stats)
- Risk distribution pie chart (hardcoded percentages)
- Condition breakdown pie chart (hardcoded percentages)
- Live activity feed (hardcoded activity items)

---

## Backend API Requirements

### Available Endpoints (from inference)
- `GET /export/monthly-screening-trends` - Get monthly trending data
- `GET /patients/` - Get all patients (filterable)
- `GET /appointments/specialist/{specialist_name}` - Get appointments
- `GET /diagnose/statistics` - (May exist for diagnostics stats)

### Required Data for Dashboard Sections

#### 1. KPI Cards (Top Section)
**Needed:**
- Total Screenings (count)
- High Risk Cases Detected (count)
- Cost Savings (calculated)
- Active Clinics/Facilities (count)

**Calculation:**
```
HIGH_RISK = Screenings where edge_risk_classification = "High"
TOTAL_SAVINGS = HIGH_RISK * SCREENING_COST_PREVENTED
               = HIGH_RISK * 70000 LKR (approx cost difference)
```

**API Calls:**
```typescript
// Get patients count and high-risk distribution
const patientsResponse = await apiRequest("/patients/?limit=10000")
const patients = await patientsResponse.json()
const highRiskCount = patients.filter(p => p.risk_level === "HIGH").length
const totalScreenings = patients.length
```

#### 2. Monthly Trends (Line Chart)
**Needed:**
- Month-by-month screening volume
- Sequence: Jan, Feb, Mar, Apr, May, Jun

**API Integration:**
```typescript
const trendResponse = await apiRequest("/export/monthly-screening-trends")
const trendData = await trendResponse.json()
// Expected response format:
// {
//   "months": ["Jan", "Feb", "Mar", ...],
//   "screening_counts": [150, 200, 250, ...],
//   "high_risk_counts": [20, 35, 45, ...]
// }
```

#### 3. Clinic Performance (Table)
**Needed:**
- Clinic name
- Total screenings at clinic
- High-risk cases detected
- Average gestational week at screening

**Challenge:** No direct clinic-linked patient data in current schema  
**Solution:** 
- Aggregate by `assigned_worker_id` (instead of clinic)
- Or create clinic master data if available
- Fall back to worker-based statistics

#### 4. Risk Distribution (Pie Chart)
**Needed:**
- Low risk: % of patients with score < 0.3
- Moderate risk: % with score 0.3-0.6
- High risk: % with score > 0.6

**API Integration:**
```typescript
const allScreenings = await getTriageHistory()
const riskDistribution = {
  low: allScreenings.filter(s => s.edge_risk_score < 0.3).length,
  moderate: allScreenings.filter(s => s.edge_risk_score >= 0.3 && s.edge_risk_score < 0.6).length,
  high: allScreenings.filter(s => s.edge_risk_score >= 0.6).length
}
```

#### 5. Condition Breakdown (Pie Chart)
**Needed:**
- Preeclampsia: % of cases
- GDM: % of cases
- Preterm Birth: % of cases

**API Integration:**
```typescript
const allDiagnostics = await apiRequest("/diagnose/statistics")
// Or aggregate from stage2_diagnostic records:
const diagnostics = await getAllStage2Diagnostics()
const conditions = {
  preeclampsia: diagnostics.filter(d => d.dominant_condition === "preeclampsia").length,
  gdm: diagnostics.filter(d => d.dominant_condition === "gdm").length,
  preterm_birth: diagnostics.filter(d => d.dominant_condition === "preterm_birth").length
}
```

#### 6. Live Activity Feed
**Needed:**
- Recent appointments
- Recent screenings
- Recent diagnoses
- Timestamps

**API Integration:**
```typescript
// Get recent appointments
const appointments = await apiRequest("/appointments/")
// Get recent screenings  
const screenings = await apiRequest("/triage/history?limit=10")
// Combine and sort by timestamp
```

---

## Implementation Steps

### Step 1: Add State Variables

```typescript
interface AdminDashboardState {
  // Data states
  allPatients: BackendPatient[]
  allScreenings: PatientScreening[]
  allDiagnostics: Stage2Diagnostic[]
  allAppointments: Appointment[]
  
  // Calculated KPIs
  totalScreenings: number
  highRiskCount: number
  costSavings: number
  activeClinics: number
  
  // Chart data
  monthlyTrends: MonthlyTrendData[]
  riskDistribution: RiskDistributionData
  conditionBreakdown: ConditionBreakdownData
  clinicPerformance: ClinicPerformanceData[]
  activityFeed: ActivityFeedItem[]
  
  // Loading & error states
  isLoading: boolean
  error: string | null
}

const [allPatients, setAllPatients] = useState<BackendPatient[]>([])
const [allScreenings, setAllScreenings] = useState<PatientScreening[]>([])
const [allDiagnostics, setAllDiagnostics] = useState<Stage2Diagnostic[]>([])
const [allAppointments, setAllAppointments] = useState<Appointment[]>([])
const [isLoadingData, setIsLoadingData] = useState(false)
const [dataError, setDataError] = useState<string | null>(null)
```

### Step 2: Add Data Fetching Function

```typescript
const loadDashboardData = async () => {
  try {
    setIsLoadingData(true)
    setDataError(null)

    // Fetch all required data in parallel
    const [patientsRes, screeningsRes, diagnosticsRes, appointmentsRes] = await Promise.all([
      apiRequest("/patients/?limit=10000"),
      apiRequest("/triage/history?limit=10000"),
      apiRequest("/diagnose/all"), // May not exist, handle gracefully
      apiRequest("/appointments/") // Get all appointments
    ])

    const patients = await patientsRes.json()
    const screenings = await screeningsRes.json()
    const diagnostics = await Promise.all([
      diagnosticsRes.ok ? diagnosticsRes.json() : []
    ])
    const appointments = appointmentsRes.ok ? await appointmentsRes.json() : []

    setAllPatients(patients)
    setAllScreenings(screenings)
    setAllDiagnostics(diagnostics)
    setAllAppointments(appointments)
  } catch (err) {
    setDataError(err instanceof Error ? err.message : "Failed to load dashboard data")
  } finally {
    setIsLoadingData(false)
  }
}

// Call in useEffect on mount
useEffect(() => {
  loadDashboardData()
}, [])
```

### Step 3: Calculate KPIs from Real Data

```typescript
const kpis = useMemo(() => {
  if (allScreenings.length === 0) return null

  const totalScreenings = allScreenings.length
  const highRiskCount = allScreenings.filter(
    s => (s.edge_risk_score || 0) > 0.6
  ).length
  const costSavings = highRiskCount * 70000 // LKR per case prevented
  const activeClinics = [...new Set(allPatients.map(p => p.assigned_worker_id || "Unknown"))].length

  return {
    totalScreenings,
    highRiskCount,
    costSavings,
    activeClinics
  }
}, [allScreenings, allPatients])
```

### Step 4: Calculate Chart Data

```typescript
const monthlyTrendData = useMemo(() => {
  // Group screenings by month
  const grouped = new Map<string, number>()
  
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
  const currentMonth = new Date().getMonth()
  
  months.forEach((month, idx) => {
    const count = allScreenings.filter(s => {
      const date = new Date(s.collected_at || s.synced_at)
      return date.getMonth() === idx
    }).length
    grouped.set(month, count)
  })

  return months.map(month => ({
    month,
    screenings: grouped.get(month) || 0
  }))
}, [allScreenings])

const riskDistributionData = useMemo(() => {
  const low = allScreenings.filter(s => (s.edge_risk_score || 0) < 0.3).length
  const moderate = allScreenings.filter(
    s => (s.edge_risk_score || 0) >= 0.3 && (s.edge_risk_score || 0) < 0.6
  ).length
  const high = allScreenings.filter(s => (s.edge_risk_score || 0) >= 0.6).length
  const total = low + moderate + high

  return [
    { name: "Low", value: Math.round((low / total) * 100) },
    { name: "Moderate", value: Math.round((moderate / total) * 100) },
    { name: "High", value: Math.round((high / total) * 100) }
  ]
}, [allScreenings])

const conditionBreakdownData = useMemo(() => {
  const pe = allDiagnostics.filter(d => d.dominant_condition === "preeclampsia").length
  const gdm = allDiagnostics.filter(d => d.dominant_condition === "gdm").length
  const preterm = allDiagnostics.filter(d => d.dominant_condition === "preterm_birth").length
  const total = pe + gdm + preterm

  return [
    { name: "Preeclampsia", value: Math.round((pe / total) * 100) },
    { name: "GDM", value: Math.round((gdm / total) * 100) },
    { name: "Preterm", value: Math.round((preterm / total) * 100) }
  ]
}, [allDiagnostics])
```

### Step 5: Replace Hardcoded Values in JSX

Find sections like:
```jsx
// OLD - Hardcoded
<p className="text-4xl font-black text-slate-900">2,847</p>
```

Replace with:
```jsx
// NEW - Real data
<p className="text-4xl font-black text-slate-900">{kpis?.totalScreenings || 0}</p>
```

Do this for:
- KPI card values
- Chart data props
- Table data
- Statistics text

### Step 6: Update Chart Components

```jsx
// OLD (hardcoded data)
<LineChart
  data={[
    { month: "Jan", screenings: 150 },
    { month: "Feb", screenings: 200 },
    ...
  ]}
/>

// NEW (real data)
<LineChart data={monthlyTrendData}>
  {/* chart config unchanged */}
</LineChart>
```

---

## Features Requiring Backend Enhancement

### Currently Unable to Implement (Missing Endpoints)
1. **Clinic-specific performance metrics** - Need clinic master data or clinic-linked appointments
2. **Geographic distribution map** - Need address data per patient/clinic
3. **Provider-specific KPIs** - Need specialist performance metrics endpoint
4. **Real-time activity feed** - May need WebSocket for live updates

### Workarounds
1. Use `assigned_worker_id` as proxy for clinic/provider grouping
2. Calculate aggregates in frontend from available data
3. Cache results with 5-minute TTL to reduce API calls
4. Implement pagination for large datasets (>1000 records)

---

## Error Handling Best Practices

```typescript
const loadDashboardData = async () => {
  try {
    // ... load data ...
  } catch (err) {
    // Log error for debugging
    console.error("Dashboard data load failed:", err)
    
    // Set user-friendly error message
    setDataError("Unable to load dashboard data. Please refresh page.")
    
    // Could also:
    // - Show cached data if available
    // - Reload with exponential backoff
    // - Fall back to summary view
  }
}
```

---

## Performance Optimization

**Large Dataset Handling:**
```typescript
// Paginate instead of loading all 10000+ records
const [offset, setOffset] = useState(0)
const [limit, setLimit] = useState(1000)

const loadMore = async () => {
  const response = await apiRequest(
    `/patients/?limit=${limit}&offset=${offset}`
  )
  // Append to existing data
}
```

**Caching:**
```typescript
const [lastLoadTime, setLastLoadTime] = useState(0)
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

const loadDashboardData = async () => {
  const now = Date.now()
  if (now - lastLoadTime < CACHE_DURATION && allPatients.length > 0) {
    return // Use cached data
  }
  // ... load fresh data ...
  setLastLoadTime(now)
}
```

---

## Testing Checklist

- [ ] KPI values update when new data is added to backend
- [ ] Charts render with real data (not hardcoded)
- [ ] Table pagination works with large datasets
- [ ] Error handling shows user-friendly messages
- [ ] Loading states show while data is fetching
- [ ] Language switching doesn't break calculations
- [ ] Mobile responsive with real data
- [ ] No API call errors in console

---

## Estimated Implementation Time

**Time Breakdown:**
- Add state variables: 10 minutes
- Data fetching function: 10 minutes
- KPI calculations: 10 minutes
- Chart data mapping: 15 minutes
- JSX replacements: 15 minutes
- Error handling & optimization: 10 minutes
- Testing: 20 minutes

**Total: ~90 minutes**

---

## Related Guides
- [Longitudinal Tracking Integration](./longitudinal-tracker.tsx)
- [AI Assistant Integration](./AI_ASSISTANT_INTEGRATION_GUIDE.md)
- [Patient Portal Integration](#)
