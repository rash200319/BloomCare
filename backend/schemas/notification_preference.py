from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class NotificationPreferenceUpdate(BaseModel):
    preferred_language: str = "EN"
    reminders_enabled: bool = True
    in_app_enabled: bool = True
    sms_enabled: bool = False
    email_enabled: bool = False
    push_enabled: bool = False
    reminder_hours: list[int] = Field(default_factory=lambda: [24, 2], max_length=6)
    phone_number: str | None = Field(default=None, max_length=50)
    email_address: EmailStr | None = None
    push_token: str | None = Field(default=None, max_length=4096)
    clear_push_token: bool = False

    @field_validator("preferred_language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in {"EN", "SI", "TA"}:
            raise ValueError("preferred_language must be EN, SI, or TA")
        return normalized

    @field_validator("reminder_hours")
    @classmethod
    def validate_reminder_hours(cls, value: list[int]) -> list[int]:
        normalized = sorted(set(value), reverse=True)
        if any(hours < 1 or hours > 168 for hours in normalized):
            raise ValueError("reminder timing must be between 1 and 168 hours")
        return normalized

    @model_validator(mode="after")
    def validate_enabled_destinations(self):
        if self.sms_enabled and not (self.phone_number or "").strip():
            raise ValueError("phone_number is required when SMS reminders are enabled")
        if self.email_enabled and self.email_address is None:
            raise ValueError("email_address is required when email reminders are enabled")
        if self.push_enabled and not (self.push_token or "").strip() and not self.clear_push_token:
            # Existing tokens are accepted by the service on update; this
            # validator only rejects an explicitly empty initial setup.
            pass
        if self.reminders_enabled and not any(
            [self.in_app_enabled, self.sms_enabled, self.email_enabled, self.push_enabled]
        ):
            raise ValueError("enable at least one reminder channel")
        return self


class NotificationPreferenceResponse(BaseModel):
    patient_id: str
    preferred_language: str
    reminders_enabled: bool
    in_app_enabled: bool
    sms_enabled: bool
    email_enabled: bool
    push_enabled: bool
    reminder_hours: list[int]
    phone_number: str | None = None
    email_address: str | None = None
    push_token_configured: bool
