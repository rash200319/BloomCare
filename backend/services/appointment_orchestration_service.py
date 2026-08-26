from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models.appointment import Appointment
from backend.models.appointment_operation import AppointmentBookingOperation
from backend.models.patient import Patient
from backend.models.user import User, UserRole
from backend.models.workflow_outbox import WorkflowOutbox
from backend.schemas.appointment_operation import (
    AppointmentBookingRequest,
    AppointmentOperationAccepted,
    AppointmentOperationResponse,
    BookingOperationStatus,
)
from backend.services.appointment_service import AppointmentService


FINAL_OPERATION_STATUSES = {"COMPLETED", "CANCELLED", "REJECTED", "EXPIRED", "FAILED"}


class AppointmentOrchestrationService:
    @staticmethod
    def _role_name(principal: object) -> str:
        role = getattr(principal, "role", "")
        return role.value if hasattr(role, "value") else str(role)

    @staticmethod
    def create_patient_operation(
        db: Session,
        request: AppointmentBookingRequest,
        current_user: object,
    ) -> AppointmentBookingOperation:
        if AppointmentOrchestrationService._role_name(current_user) != UserRole.PATIENT.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This endpoint is for authenticated patient self-service booking",
            )

        patient_id = str(getattr(current_user, "id", ""))
        patient = db.query(Patient).filter(Patient.id == patient_id, Patient.is_active.is_(True)).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Active patient profile not found")

        specialist = db.query(User).filter(User.id == request.specialist_id, User.is_active.is_(True)).first()
        if not specialist or not AppointmentService._is_specialist_role(specialist.role):
            raise HTTPException(status_code=404, detail="Active clinical specialist not found")

        appointment_date = request.appointment_date
        if appointment_date.tzinfo is None:
            appointment_date = appointment_date.replace(tzinfo=timezone.utc)
        if appointment_date <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Appointment date must be in the future")

        appointment_type = AppointmentService._normalize_type(request.appointment_type)
        if appointment_type not in AppointmentService.STANDARD_APPOINTMENT_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Patients may request standard prenatal appointment types only",
            )

        existing = (
            db.query(AppointmentBookingOperation)
            .filter(
                AppointmentBookingOperation.patient_id == patient_id,
                AppointmentBookingOperation.idempotency_key == request.idempotency_key,
            )
            .first()
        )
        if existing:
            return existing

        operation_id = str(uuid.uuid4())
        workflow_id = f"appointment-booking-{operation_id}"
        operation = AppointmentBookingOperation(
            id=operation_id,
            workflow_id=workflow_id,
            idempotency_key=request.idempotency_key,
            patient_id=patient_id,
            specialist_id=str(specialist.id),
            appointment_date=appointment_date,
            duration_minutes=request.duration_minutes,
            appointment_type=appointment_type,
            notes=request.notes,
            status=BookingOperationStatus.REQUESTED.value,
            schedule_version=1,
        )
        outbox = WorkflowOutbox(
            id=str(uuid.uuid4()),
            operation_id=operation_id,
            event_type="START_APPOINTMENT_BOOKING",
            payload={"operation_id": operation_id},
            status="PENDING",
        )
        db.add(operation)
        db.add(outbox)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            existing = (
                db.query(AppointmentBookingOperation)
                .filter(
                    AppointmentBookingOperation.patient_id == patient_id,
                    AppointmentBookingOperation.idempotency_key == request.idempotency_key,
                )
                .first()
            )
            if existing:
                return existing
            raise
        db.refresh(operation)
        return operation

    @staticmethod
    def can_access_operation(db: Session, operation: AppointmentBookingOperation, current_user: object) -> bool:
        role = AppointmentOrchestrationService._role_name(current_user)
        user_id = str(getattr(current_user, "id", ""))
        if role == UserRole.ADMIN.value:
            return True
        if role == UserRole.PATIENT.value:
            return operation.patient_id == user_id
        if AppointmentService._is_specialist_role(role):
            return operation.specialist_id == user_id
        if role == UserRole.FRONTLINE_STAFF.value and operation.appointment_id:
            appointment = db.query(Appointment).filter(Appointment.id == operation.appointment_id).first()
            return bool(appointment and appointment.created_by_id == user_id)
        return False

    @staticmethod
    def get_authorized_operation(
        db: Session, operation_id: str, current_user: object
    ) -> AppointmentBookingOperation:
        operation = db.query(AppointmentBookingOperation).filter(
            AppointmentBookingOperation.id == operation_id
        ).first()
        if not operation:
            raise HTTPException(status_code=404, detail="Booking operation not found")
        if not AppointmentOrchestrationService.can_access_operation(db, operation, current_user):
            raise HTTPException(status_code=403, detail="Not authorized to access this booking operation")
        return operation

    @staticmethod
    def to_response(operation: AppointmentBookingOperation) -> AppointmentOperationResponse:
        return AppointmentOperationResponse(
            operation_id=operation.id,
            workflow_id=operation.workflow_id,
            patient_id=operation.patient_id,
            specialist_id=operation.specialist_id,
            appointment_id=operation.appointment_id,
            appointment_date=operation.appointment_date,
            duration_minutes=operation.duration_minutes,
            appointment_type=operation.appointment_type,
            status=operation.status,
            schedule_version=operation.schedule_version,
            decision_reason=operation.decision_reason,
            error_code=operation.error_code,
            error_message=operation.error_message,
            created_at=operation.created_at,
            updated_at=operation.updated_at,
            completed_at=operation.completed_at,
        )

    @staticmethod
    def to_accepted(operation: AppointmentBookingOperation) -> AppointmentOperationAccepted:
        return AppointmentOperationAccepted(
            operation_id=operation.id,
            workflow_id=operation.workflow_id,
            status=operation.status,
            appointment_id=operation.appointment_id,
            status_url=f"/api/v1/appointment-operations/{operation.id}",
        )

