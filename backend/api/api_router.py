from fastapi import APIRouter

from backend.api.v1 import (
    auth, patients, triage, diagnose, appointments, assistant, reports, longitudinal,
    staff_management, patient_management
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(
    patients.router, prefix="/patients", tags=["Patients"])
api_router.include_router(
    appointments.router, prefix="/appointments", tags=["Appointments"])
api_router.include_router(triage.router, prefix="/triage", tags=["Triage"])
api_router.include_router(
    diagnose.router, prefix="/diagnose", tags=["Diagnose"])
api_router.include_router(
    assistant.router, prefix="/assistant", tags=["Assistant"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(longitudinal.router, tags=["Longitudinal Tracking"])

# NEW: Staff & Patient Management Endpoints
api_router.include_router(staff_management.router,
                          prefix="/staff-management", tags=["Staff Management"])
api_router.include_router(patient_management.router,
                          prefix="/patient-management", tags=["Patient Management"])
