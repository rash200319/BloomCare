from __future__ import annotations

from datetime import timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.core.deps import get_current_active_user, get_db
from backend.models.appointment_operation import AppointmentBookingOperation
from backend.models.user import User, UserRole
from backend.models.workflow_outbox import WorkflowOutbox
from backend.schemas.appointment_operation import (
    AppointmentBookingRequest,
    AppointmentDecisionRequest,
    AppointmentOperationAccepted,
    AppointmentOperationResponse,
    AppointmentRescheduleRequest,
    AppointmentWorkflowCommandResponse,
)
from backend.services.appointment_orchestration_service import AppointmentOrchestrationService
from backend.services.appointment_service import AppointmentService

router = APIRouter()


@router.post(
    "",
    response_model=AppointmentOperationAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Request an asynchronous patient appointment",
)
async def create_booking_operation(
    payload: AppointmentBookingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    operation = AppointmentOrchestrationService.create_patient_operation(db, payload, current_user)

    # Low-latency dispatch when Temporal is enabled. The transactional outbox
    # remains authoritative and the worker relay retries if this attempt fails.
    if settings.TEMPORAL_ENABLED:
        try:
            from backend.orchestration.appointments.outbox_relay import dispatch_pending_once

            await dispatch_pending_once(limit=1)
            db.refresh(operation)
        except Exception:
            # Returning 202 is safe: the committed outbox record remains queued.
            pass
    return AppointmentOrchestrationService.to_accepted(operation)


@router.get(
    "/{operation_id}",
    response_model=AppointmentOperationResponse,
    summary="Get appointment booking operation status",
)
def get_booking_operation(
    operation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    operation = AppointmentOrchestrationService.get_authorized_operation(
        db, operation_id, current_user
    )
    return AppointmentOrchestrationService.to_response(operation, db)


@router.get(
    "",
    response_model=list[AppointmentOperationResponse],
    summary="List visible appointment booking operations",
)
def list_booking_operations(
    operation_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    role = AppointmentOrchestrationService._role_name(current_user)
    query = db.query(AppointmentBookingOperation)
    if role == UserRole.PATIENT.value:
        query = query.filter(AppointmentBookingOperation.patient_id == str(current_user.id))
    elif AppointmentService._is_specialist_role(role):
        query = query.filter(AppointmentBookingOperation.specialist_id == str(current_user.id))
    elif role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Not authorized to list booking operations")
    if operation_status:
        query = query.filter(AppointmentBookingOperation.status == operation_status.strip().upper())
    operations = query.order_by(AppointmentBookingOperation.created_at.desc()).limit(limit).all()
    return [AppointmentOrchestrationService.to_response(item, db) for item in operations]


@router.post(
    "/{operation_id}/decision",
    response_model=AppointmentWorkflowCommandResponse,
    summary="Confirm, cancel, or complete an orchestrated appointment",
)
async def decide_booking_operation(
    operation_id: str,
    payload: AppointmentDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    operation = AppointmentOrchestrationService.get_authorized_operation(
        db, operation_id, current_user
    )
    role = AppointmentOrchestrationService._role_name(current_user)
    decision = payload.decision.value

    if role == UserRole.PATIENT.value and decision != "CANCEL":
        raise HTTPException(status_code=403, detail="Patients may only cancel their own request")
    if role not in {UserRole.PATIENT.value, UserRole.ADMIN.value} and not AppointmentService._is_specialist_role(role):
        raise HTTPException(status_code=403, detail="Not authorized to decide this appointment")
    if not settings.TEMPORAL_ENABLED:
        raise HTTPException(status_code=503, detail="Temporal appointment orchestration is disabled")

    operation.decision_reason = payload.reason
    db.commit()
    try:
        from backend.orchestration.appointments.temporal_client import submit_booking_decision

        message = await submit_booking_decision(operation.workflow_id, decision)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Unable to submit workflow decision: {exc}") from exc

    db.refresh(operation)
    return AppointmentWorkflowCommandResponse(
        operation_id=operation.id,
        status=operation.status,
        message=message,
    )


@router.post(
    "/{operation_id}/reschedule",
    response_model=AppointmentWorkflowCommandResponse,
    summary="Atomically reschedule an orchestrated appointment",
)
async def reschedule_booking_operation(
    operation_id: str,
    payload: AppointmentRescheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    operation = AppointmentOrchestrationService.get_authorized_operation(
        db, operation_id, current_user
    )
    role = AppointmentOrchestrationService._role_name(current_user)
    if role not in {UserRole.PATIENT.value, UserRole.ADMIN.value} and not AppointmentService._is_specialist_role(role):
        raise HTTPException(status_code=403, detail="Not authorized to reschedule this appointment")
    if not settings.TEMPORAL_ENABLED:
        raise HTTPException(status_code=503, detail="Temporal appointment orchestration is disabled")

    appointment_date = payload.appointment_date
    if appointment_date.tzinfo is None:
        appointment_date = appointment_date.replace(tzinfo=timezone.utc)
    duration_minutes = payload.duration_minutes or operation.duration_minutes
    try:
        from backend.orchestration.appointments.temporal_client import submit_booking_reschedule

        message = await submit_booking_reschedule(
            operation.workflow_id,
            appointment_timestamp=appointment_date.timestamp(),
            duration_minutes=duration_minutes,
            reason=payload.reason,
        )
    except Exception as exc:
        detail = str(exc)
        conflict_markers = (
            "SLOT_UNAVAILABLE",
            "replacement slot is unavailable",
            "Rescheduling is not allowed",
            "already final",
            "must be in the future",
        )
        if any(marker.lower() in detail.lower() for marker in conflict_markers):
            raise HTTPException(status_code=409, detail=detail) from exc
        raise HTTPException(status_code=503, detail=f"Unable to reschedule appointment: {detail}") from exc

    db.refresh(operation)
    return AppointmentWorkflowCommandResponse(
        operation_id=operation.id,
        status=operation.status,
        message=message,
    )
