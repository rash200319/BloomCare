"""Opt-in PHI access audit logging."""

from __future__ import annotations

import logging
from typing import Any, Optional

from backend.core.config import settings
from backend.models.audit import AuditEvent

logger = logging.getLogger("bloomcare.audit")


def _role_name(user: Any) -> Optional[str]:
    if user is None:
        return None
    role = getattr(user, "role", None)
    if role is None:
        return None
    return role.value if hasattr(role, "value") else str(role)


class AuditService:
    @staticmethod
    def record_patient_access(
        db,  # unused; kept for call-site compatibility
        current_user: Any,
        patient_id: str,
        action: str = "phi.read",
        detail: Optional[str] = None,
    ) -> None:
        if not settings.BLOOMCARE_AUDIT_LOG_ENABLED:
            return
        try:
            from backend.db.session import SessionLocal

            with SessionLocal() as audit_db:
                event = AuditEvent(
                    actor_id=str(getattr(current_user, "id", "") or "") or None,
                    actor_role=_role_name(current_user),
                    action=action,
                    resource_type="patient",
                    resource_id=str(patient_id),
                    detail=detail,
                )
                audit_db.add(event)
                audit_db.commit()
        except Exception as exc:
            logger.warning("Failed to write audit event: %s", exc)
