from fastapi import APIRouter

from .v1 import auth, patients, triage, diagnose, appointments, assistant

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients"])
api_router.include_router(appointments.router, prefix="/appointments", tags=["Appointments"])
api_router.include_router(triage.router, prefix="/triage", tags=["Triage"])
api_router.include_router(diagnose.router, prefix="/diagnose", tags=["Diagnose"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["Assistant"])


@api_router.get("/health", tags=["Health"])
def api_v1_health():
	# Minimal health summary for API v1 used by tests
	return {"status": "healthy", "components": {"database": "ok", "llm": "mock"}}
