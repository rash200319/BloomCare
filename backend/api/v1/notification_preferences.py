from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.deps import get_current_active_user, get_db
from backend.models.user import UserRole
from backend.schemas.notification_preference import (
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
)
from backend.services.notification_preference_service import NotificationPreferenceService

router = APIRouter()


def _patient_id(current_user: object) -> str:
    role = getattr(current_user, "role", "")
    role_name = role.value if hasattr(role, "value") else str(role)
    if role_name != UserRole.PATIENT.value:
        raise HTTPException(status_code=403, detail="Notification preferences are patient-owned")
    return str(getattr(current_user, "id"))


@router.get("", response_model=NotificationPreferenceResponse)
def get_notification_preferences(
    db: Session = Depends(get_db),
    current_user: object = Depends(get_current_active_user),
):
    preference = NotificationPreferenceService.get_or_create(db, _patient_id(current_user))
    return NotificationPreferenceService.to_response(preference)


@router.put("", response_model=NotificationPreferenceResponse)
def update_notification_preferences(
    payload: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: object = Depends(get_current_active_user),
):
    try:
        preference = NotificationPreferenceService.update(
            db,
            _patient_id(current_user),
            payload,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return NotificationPreferenceService.to_response(preference)
