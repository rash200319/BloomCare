from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.models.notification_preference import PatientNotificationPreference
from backend.models.patient import Patient
from backend.schemas.notification_preference import (
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
)


class NotificationPreferenceService:
    @staticmethod
    def _default_hours() -> list[int]:
        return settings.appointment_reminder_hours or [24, 2]

    @staticmethod
    def get_or_create(db: Session, patient_id: str) -> PatientNotificationPreference:
        preference = db.query(PatientNotificationPreference).filter(
            PatientNotificationPreference.patient_id == patient_id
        ).first()
        if preference:
            return preference
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        preference = PatientNotificationPreference(
            patient_id=patient_id,
            preferred_language="EN",
            reminders_enabled=True,
            in_app_enabled=True,
            reminder_hours=",".join(str(item) for item in NotificationPreferenceService._default_hours()),
            phone_number=patient.contact_number if patient else None,
        )
        db.add(preference)
        db.commit()
        db.refresh(preference)
        return preference

    @staticmethod
    def reminder_hours(preference: PatientNotificationPreference) -> list[int]:
        values: list[int] = []
        for raw in (preference.reminder_hours or "").split(","):
            raw = raw.strip()
            if raw:
                values.append(int(raw))
        return sorted(set(values), reverse=True)

    @staticmethod
    def enabled_channels(preference: PatientNotificationPreference) -> list[str]:
        if not preference.reminders_enabled:
            return []
        flags = {
            "IN_APP": preference.in_app_enabled,
            "SMS": preference.sms_enabled,
            "EMAIL": preference.email_enabled,
            "PUSH": preference.push_enabled,
        }
        return [channel for channel, enabled in flags.items() if enabled]

    @staticmethod
    def update(
        db: Session,
        patient_id: str,
        payload: NotificationPreferenceUpdate,
    ) -> PatientNotificationPreference:
        preference = NotificationPreferenceService.get_or_create(db, patient_id)
        preference.preferred_language = payload.preferred_language
        preference.reminders_enabled = payload.reminders_enabled
        preference.in_app_enabled = payload.in_app_enabled
        preference.sms_enabled = payload.sms_enabled
        preference.email_enabled = payload.email_enabled
        preference.push_enabled = payload.push_enabled
        preference.reminder_hours = ",".join(str(item) for item in payload.reminder_hours)
        preference.phone_number = (payload.phone_number or "").strip() or None
        preference.email_address = str(payload.email_address) if payload.email_address else None
        if payload.clear_push_token:
            preference.push_token = None
            preference.push_enabled = False
        elif payload.push_token is not None:
            preference.push_token = payload.push_token.strip() or None
        if preference.push_enabled and not preference.push_token:
            raise ValueError("push_token is required when push reminders are enabled")
        db.commit()
        db.refresh(preference)
        return preference

    @staticmethod
    def to_response(preference: PatientNotificationPreference) -> NotificationPreferenceResponse:
        return NotificationPreferenceResponse(
            patient_id=str(preference.patient_id),
            preferred_language=preference.preferred_language,
            reminders_enabled=preference.reminders_enabled,
            in_app_enabled=preference.in_app_enabled,
            sms_enabled=preference.sms_enabled,
            email_enabled=preference.email_enabled,
            push_enabled=preference.push_enabled,
            reminder_hours=NotificationPreferenceService.reminder_hours(preference),
            phone_number=preference.phone_number,
            email_address=preference.email_address,
            push_token_configured=bool(preference.push_token),
        )
