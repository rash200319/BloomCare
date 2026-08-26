from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from temporalio.exceptions import ApplicationError

from backend.core.config import settings
from backend.models.appointment_operation import AppointmentBookingOperation
from backend.models.appointment_slot_reservation import AppointmentSlotReservation
from backend.models.notification_delivery import NotificationDelivery
from backend.models.notification import Notification
from backend.models.appointment import Appointment
from backend.models.patient import Patient
from backend.models.user import User, UserRole
from backend.models.workflow_outbox import WorkflowOutbox
from backend.schemas.appointment_operation import AppointmentBookingRequest
from backend.services.appointment_orchestration_service import AppointmentOrchestrationService
from backend.services.slot_reservation_service import SlotReservationService, SlotUnavailableError
from backend.orchestration.appointments.activities import (
    create_reserved_appointment,
    finalize_booking_decision,
    reserve_booking_slot,
    reschedule_booking,
    send_booking_notification,
    validate_booking,
)
from backend.orchestration.appointments.contracts import (
    FinalizeDecisionInput,
    NotificationInput,
    OperationRef,
    RescheduleActivityInput,
)


def _cleanup_operation(db, operation_id: str) -> None:
    # Activities use independent sessions, so refresh objects that this test
    # session may have loaded before an activity linked the appointment.
    db.expire_all()
    operation = db.query(AppointmentBookingOperation).filter(
        AppointmentBookingOperation.id == operation_id
    ).first()
    appointment_id = operation.appointment_id if operation else None
    if appointment_id:
        db.query(Notification).filter(Notification.appointment_id == appointment_id).delete()
    db.query(NotificationDelivery).filter(NotificationDelivery.operation_id == operation_id).delete()
    db.query(AppointmentSlotReservation).filter(
        AppointmentSlotReservation.operation_id == operation_id
    ).delete()
    db.query(WorkflowOutbox).filter(WorkflowOutbox.operation_id == operation_id).delete()
    if appointment_id:
        db.query(Appointment).filter(Appointment.id == appointment_id).delete()
    db.query(AppointmentBookingOperation).filter(
        AppointmentBookingOperation.id == operation_id
    ).delete()
    db.commit()


def test_patient_booking_operation_is_async_and_idempotent(client, demo_password, monkeypatch):
    monkeypatch.setattr(settings, "TEMPORAL_ENABLED", False)
    login = client.post(
        "/api/v1/auth/login/patient",
        json={"national_id": "NIC-900000001V", "password": demo_password},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    from backend.db.session import SessionLocal

    db = SessionLocal()
    operation_id = None
    try:
        specialist = db.query(User).filter(User.role == UserRole.CLINICAL_SPECIALIST).first()
        assert specialist is not None
        idempotency_key = f"test-{uuid.uuid4()}"
        payload = {
            "specialist_id": str(specialist.id),
            "appointment_date": (datetime.now(timezone.utc) + timedelta(days=40)).isoformat(),
            "duration_minutes": 30,
            "appointment_type": "PRENATAL_CHECKUP",
            "idempotency_key": idempotency_key,
        }
        headers = {"Authorization": f"Bearer {token}"}
        first = client.post("/api/v1/appointment-operations", json=payload, headers=headers)
        second = client.post("/api/v1/appointment-operations", json=payload, headers=headers)
        assert first.status_code == 202
        assert second.status_code == 202
        assert first.json()["operation_id"] == second.json()["operation_id"]
        assert first.json()["status"] == "REQUESTED"
        operation_id = first.json()["operation_id"]

        status_response = client.get(
            f"/api/v1/appointment-operations/{operation_id}", headers=headers
        )
        assert status_response.status_code == 200
        assert status_response.json()["patient_id"] == login.json()["id"]
    finally:
        if operation_id:
            _cleanup_operation(db, operation_id)
        db.close()


def test_staff_cannot_use_patient_self_service_booking(client, demo_password, monkeypatch):
    monkeypatch.setattr(settings, "TEMPORAL_ENABLED", False)
    login = client.post(
        "/api/v1/auth/login/staff",
        json={"email": "frontline.staff@bloomcare.health", "password": demo_password},
    )
    assert login.status_code == 200
    response = client.post(
        "/api/v1/appointment-operations",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
        json={
            "specialist_id": str(uuid.uuid4()),
            "appointment_date": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat(),
            "duration_minutes": 30,
            "appointment_type": "PRENATAL_CHECKUP",
            "idempotency_key": f"test-{uuid.uuid4()}",
        },
    )
    assert response.status_code == 403


def test_patient_reschedule_endpoint_submits_temporal_update(client, demo_password, monkeypatch):
    monkeypatch.setattr(settings, "TEMPORAL_ENABLED", False)
    login = client.post(
        "/api/v1/auth/login/patient",
        json={"national_id": "NIC-900000001V", "password": demo_password},
    )
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    from backend.db.session import SessionLocal
    from backend.orchestration.appointments import temporal_client

    db = SessionLocal()
    operation_id = None
    captured: dict[str, object] = {}
    try:
        specialist = db.query(User).filter(User.role == UserRole.CLINICAL_SPECIALIST).first()
        assert specialist is not None
        create_response = client.post(
            "/api/v1/appointment-operations",
            headers=headers,
            json={
                "specialist_id": str(specialist.id),
                "appointment_date": (datetime.now(timezone.utc) + timedelta(days=50)).isoformat(),
                "duration_minutes": 30,
                "appointment_type": "PRENATAL_CHECKUP",
                "idempotency_key": f"test-{uuid.uuid4()}",
            },
        )
        assert create_response.status_code == 202
        operation_id = create_response.json()["operation_id"]

        async def fake_submit(workflow_id: str, **kwargs):
            captured.update({"workflow_id": workflow_id, **kwargs})
            return "Appointment rescheduled (schedule version 2)"

        monkeypatch.setattr(temporal_client, "submit_booking_reschedule", fake_submit)
        monkeypatch.setattr(settings, "TEMPORAL_ENABLED", True)
        replacement = datetime.now(timezone.utc) + timedelta(days=51)
        response = client.post(
            f"/api/v1/appointment-operations/{operation_id}/reschedule",
            headers=headers,
            json={
                "appointment_date": replacement.isoformat(),
                "duration_minutes": 45,
                "reason": "Schedule conflict",
            },
        )
        assert response.status_code == 200
        assert response.json()["operation_id"] == operation_id
        assert captured["duration_minutes"] == 45
        assert captured["reason"] == "Schedule conflict"
    finally:
        monkeypatch.setattr(settings, "TEMPORAL_ENABLED", False)
        if operation_id:
            _cleanup_operation(db, operation_id)
        db.close()


def test_slot_reservation_rejects_overlapping_operation():
    from backend.db.session import SessionLocal

    db = SessionLocal()
    operation_ids: list[str] = []
    try:
        patient = db.query(Patient).filter(Patient.national_id == "NIC-900000001V").first()
        specialist = db.query(User).filter(User.role == UserRole.CLINICAL_SPECIALIST).first()
        assert patient is not None and specialist is not None
        principal = SimpleNamespace(id=patient.id, role=UserRole.PATIENT)
        starts_at = datetime.now(timezone.utc) + timedelta(days=75)

        for _ in range(2):
            operation = AppointmentOrchestrationService.create_patient_operation(
                db,
                AppointmentBookingRequest(
                    specialist_id=str(specialist.id),
                    appointment_date=starts_at,
                    duration_minutes=30,
                    appointment_type="PRENATAL_CHECKUP",
                    idempotency_key=f"test-{uuid.uuid4()}",
                ),
                principal,
            )
            operation_ids.append(operation.id)

        SlotReservationService.reserve(
            db,
            operation_id=operation_ids[0],
            specialist_id=str(specialist.id),
            starts_at=starts_at,
            duration_minutes=30,
            schedule_version=1,
            ttl_minutes=15,
        )
        db.commit()

        with pytest.raises(SlotUnavailableError):
            SlotReservationService.reserve(
                db,
                operation_id=operation_ids[1],
                specialist_id=str(specialist.id),
                starts_at=starts_at + timedelta(minutes=15),
                duration_minutes=30,
                schedule_version=1,
                ttl_minutes=15,
            )
        db.rollback()
    finally:
        for operation_id in reversed(operation_ids):
            _cleanup_operation(db, operation_id)
        db.close()


def test_booking_activities_create_one_appointment_and_idempotent_notification():
    from backend.db.session import SessionLocal

    db = SessionLocal()
    operation_id = None
    blocker_id = None
    try:
        patient = db.query(Patient).filter(Patient.national_id == "NIC-900000001V").first()
        specialist = db.query(User).filter(User.role == UserRole.CLINICAL_SPECIALIST).first()
        assert patient is not None and specialist is not None
        operation = AppointmentOrchestrationService.create_patient_operation(
            db,
            AppointmentBookingRequest(
                specialist_id=str(specialist.id),
                appointment_date=datetime.now(timezone.utc) + timedelta(days=111),
                duration_minutes=30,
                appointment_type="PRENATAL_CHECKUP",
                idempotency_key=f"test-{uuid.uuid4()}",
            ),
            SimpleNamespace(id=patient.id, role=UserRole.PATIENT),
        )
        operation_id = operation.id
        ref = OperationRef(operation_id=operation.id)

        validate_booking(ref)
        reserve_booking_slot(ref)
        appointment_id = create_reserved_appointment(ref)
        assert create_reserved_appointment(ref) == appointment_id

        notification = NotificationInput(
            operation_id=operation.id,
            notification_type="BOOKING_REQUESTED",
            recipient_type="PATIENT",
        )
        assert send_booking_notification(notification) is True
        assert send_booking_notification(notification) is False

        assert finalize_booking_decision(
            FinalizeDecisionInput(operation_id=operation.id, decision="CONFIRM")
        ) == "CONFIRMED"

        replacement_date = datetime.now(timezone.utc) + timedelta(days=112)
        result = reschedule_booking(
            RescheduleActivityInput(
                operation_id=operation.id,
                appointment_timestamp=replacement_date.timestamp(),
                duration_minutes=45,
                target_schedule_version=2,
                reason="Patient requested a new time",
            )
        )
        assert result.schedule_version == 2
        assert reschedule_booking(
            RescheduleActivityInput(
                operation_id=operation.id,
                appointment_timestamp=replacement_date.timestamp(),
                duration_minutes=45,
                target_schedule_version=2,
                reason="Patient requested a new time",
            )
        ).schedule_version == 2

        blocker_id = str(uuid.uuid4())
        blocked_date = datetime.now(timezone.utc) + timedelta(days=113)
        db.add(Appointment(
            id=blocker_id,
            patient_id=patient.id,
            specialist_id=specialist.id,
            created_by_id=specialist.id,
            created_by_role="CLINICAL_SPECIALIST",
            appointment_type="PRENATAL_CHECKUP",
            appointment_date=blocked_date,
            duration_minutes=30,
            queue_number=999,
            status="CONFIRMED",
        ))
        db.commit()
        with pytest.raises(ApplicationError):
            reschedule_booking(
                RescheduleActivityInput(
                    operation_id=operation.id,
                    appointment_timestamp=blocked_date.timestamp(),
                    duration_minutes=30,
                    target_schedule_version=3,
                    reason="Try an occupied slot",
                )
            )
        db.expire_all()
        persisted = db.query(AppointmentBookingOperation).filter(
            AppointmentBookingOperation.id == operation.id
        ).one()
        assert persisted.status == "RESCHEDULED"
        assert persisted.schedule_version == 2
        assert persisted.error_code == "RESCHEDULE_SLOT_UNAVAILABLE"
        assert persisted.duration_minutes == 45
        reservations = db.query(AppointmentSlotReservation).filter(
            AppointmentSlotReservation.operation_id == operation.id
        ).order_by(AppointmentSlotReservation.schedule_version).all()
        assert [(item.schedule_version, item.status) for item in reservations] == [
            (1, "RELEASED"),
            (2, "ACTIVE"),
        ]
        assert db.query(Appointment).filter(
            Appointment.booking_operation_id == operation.id
        ).count() == 1
        assert db.query(NotificationDelivery).filter(
            NotificationDelivery.operation_id == operation.id
        ).count() == 1
    finally:
        db.rollback()
        if blocker_id:
            db.query(Appointment).filter(Appointment.id == blocker_id).delete()
            db.commit()
        if operation_id:
            _cleanup_operation(db, operation_id)
        db.close()
