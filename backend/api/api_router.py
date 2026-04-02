from fastapi import APIRouter

from backend.api.v1 import (
    auth, patients, triage, diagnose, appointments, assistant, reports, longitudinal,
    staff_management, patient_management, dashboard, insights, differential,
    prescriptions,
    admin_analytics, specialist
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients"])
api_router.include_router(appointments.router, prefix="/appointments", tags=["Appointments"])
api_router.include_router(prescriptions.router, prefix="/prescriptions", tags=["Prescriptions"])
api_router.include_router(triage.router, prefix="/triage", tags=["Triage"])
api_router.include_router(diagnose.router, prefix="/diagnose", tags=["Diagnose"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["Assistant"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(longitudinal.router, tags=["Longitudinal Tracking"])

# NEW: Staff & Patient Management Endpoints
api_router.include_router(staff_management.router,
                          prefix="/staff-management", tags=["Staff Management"])
api_router.include_router(patient_management.router,
                          prefix="/patient-management", tags=["Patient Management"])

# NEW: Dashboard Endpoints (Role-Protected)
api_router.include_router(dashboard.router,
                          prefix="/dashboard", tags=["Dashboard"])

# NEW: Insights Endpoints (Weekly Development Tracking)
api_router.include_router(insights.router,
                          prefix="/insights", tags=["Insights"])

# NEW: Differential Diagnosis
api_router.include_router(differential.router, tags=["Differential Diagnosis"])
api_router.include_router(specialist.router, tags=["Specialist Workflows"])
api_router.include_router(admin_analytics.router, prefix="/admin", tags=["Admin Analytics"])