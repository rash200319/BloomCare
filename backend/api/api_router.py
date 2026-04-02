from fastapi import APIRouter

from api.v1 import auth, patients, triage, diagnose, appointments, assistant, reports, longitudinal, differential, admin_analytics, specialist

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients"])
api_router.include_router(appointments.router, prefix="/appointments", tags=["Appointments"])
api_router.include_router(triage.router, prefix="/triage", tags=["Triage"])
api_router.include_router(diagnose.router, prefix="/diagnose", tags=["Diagnose"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["Assistant"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(longitudinal.router, tags=["Longitudinal Tracking"])
api_router.include_router(differential.router, tags=["Differential Diagnosis"])
api_router.include_router(specialist.router, tags=["Specialist Workflows"])
api_router.include_router(admin_analytics.router, prefix="/admin", tags=["Admin Analytics"])
