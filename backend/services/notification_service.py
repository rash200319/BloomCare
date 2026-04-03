"""
Notification Service
Handles creating, retrieving, and managing notifications for users
"""
from datetime import datetime, timezone
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload
from backend.models.appointment import Appointment
from backend.models.notification import Notification
from backend.schemas.notification import NotificationCreate, NotificationResponse, NotificationListResponse


class NotificationService:
    """Service for managing notifications"""

    @staticmethod
    def create_appointment_notification(
        db: Session,
        appointment: Appointment,
        new_status: str,
    ) -> NotificationResponse:
        """Create a status-change notification for the appointment creator."""
        if not appointment.created_by_id:
            raise ValueError("Appointment has no creator to notify")

        status_value = new_status.strip().upper()
        if status_value not in {"COMPLETED", "CANCELLED"}:
            raise ValueError(f"Unsupported notification status '{new_status}'")

        patient = appointment.patient
        specialist = appointment.specialist
        patient_name = patient.full_name if patient else "the patient"
        specialist_name = specialist.full_name if specialist else "the specialist"
        appointment_date = appointment.appointment_date

        if status_value == "COMPLETED":
            title = "Appointment Completed"
            message = (
                f"Dr. {specialist_name} marked the appointment for {patient_name} "
                f"on {appointment_date.strftime('%B %d, %Y at %I:%M %p')} as completed."
            )
        else:
            reason_text = (
                f" Reason: {appointment.reason_for_cancellation}."
                if appointment.reason_for_cancellation else ""
            )
            title = "Appointment Cancelled"
            message = (
                f"Dr. {specialist_name} cancelled the appointment for {patient_name} "
                f"scheduled on {appointment_date.strftime('%B %d, %Y at %I:%M %p')}."
                f"{reason_text}"
            )

        notification = NotificationCreate(
            recipient_id=appointment.created_by_id,
            appointment_id=appointment.id,
            notification_type=f"APPOINTMENT_{status_value}",
            title=title,
            message=message,
            related_data={
                "patient_name": patient_name,
                "specialist_name": specialist_name,
                "appointment_date": appointment_date.isoformat(),
                "appointment_type": appointment.appointment_type,
                "new_status": status_value,
            },
        )
        return NotificationService.create_notification(db, notification)

    @staticmethod
    def create_notification(
        db: Session,
        notification_in: NotificationCreate,
    ) -> NotificationResponse:
        """Create a new notification"""
        import sys
        print(f"[CREATE-NOTIF] Creating notification of type: {notification_in.notification_type}", file=sys.stderr)
        notification = Notification(
            recipient_id=notification_in.recipient_id,
            appointment_id=notification_in.appointment_id,
            notification_type=notification_in.notification_type,
            title=notification_in.title,
            message=notification_in.message,
            related_data=notification_in.related_data,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        print(f"[CREATE-NOTIF] Notification created with ID: {notification.id}, type: {notification.notification_type}", file=sys.stderr)
        return NotificationResponse.from_orm(notification)

    @staticmethod
    def create_appointment_confirmation_notification(
        db: Session,
        recipient_id: str,
        appointment_id: str,
        patient_name: str,
        specialist_name: str,
        appointment_date: datetime,
    ) -> NotificationResponse:
        """Create a notification for appointment confirmation"""
        import sys
        print(f"[CONFIRM-NOTIF] Starting confirmation notification for recipient: {recipient_id}, appointment: {appointment_id}", file=sys.stderr)
        notification_create = NotificationCreate(
            recipient_id=recipient_id,
            appointment_id=appointment_id,
            notification_type="APPOINTMENT_CONFIRMED",
            title="Appointment Confirmed",
            message=f"Dr. {specialist_name} confirmed appointment for {patient_name} on {appointment_date.strftime('%B %d, %Y at %I:%M %p')}",
            related_data={
                "patient_name": patient_name,
                "specialist_name": specialist_name,
                "appointment_date": appointment_date.isoformat(),
            },
        )
        print(f"[CONFIRM-NOTIF] Calling create_notification with type: {notification_create.notification_type}", file=sys.stderr)
        result = NotificationService.create_notification(db, notification_create)
        print(f"[CONFIRM-NOTIF] Confirmation notification created successfully: {result.id}", file=sys.stderr)
        return result

    @staticmethod
    def create_appointment_cancellation_notification(
        db: Session,
        recipient_id: str,
        appointment_id: str,
        patient_name: str,
        specialist_name: str,
        appointment_date: datetime,
        reason: str = None,
    ) -> NotificationResponse:
        """Create a notification for appointment cancellation"""
        import sys
        print(f"[CANCEL-NOTIF] Starting cancellation notification for recipient: {recipient_id}, appointment: {appointment_id}", file=sys.stderr)
        reason_text = f" - {reason}" if reason else ""
        print(f"[CANCEL-NOTIF] Reason text: {reason_text}", file=sys.stderr)
        notification_create = NotificationCreate(
            recipient_id=recipient_id,
            appointment_id=appointment_id,
            notification_type="APPOINTMENT_CANCELLED",
            title="Appointment Cancelled",
            message=f"Dr. {specialist_name} cancelled appointment for {patient_name} scheduled on {appointment_date.strftime('%B %d, %Y at %I:%M %p')}{reason_text}",
            related_data={
                "patient_name": patient_name,
                "specialist_name": specialist_name,
                "appointment_date": appointment_date.isoformat(),
                "cancellation_reason": reason,
            },
        )
        print(f"[CANCEL-NOTIF] Calling create_notification with type: {notification_create.notification_type}", file=sys.stderr)
        result = NotificationService.create_notification(db, notification_create)
        print(f"[CANCEL-NOTIF] Cancellation notification created successfully: {result.id}", file=sys.stderr)
        return result

    @staticmethod
    def get_user_notifications(
        db: Session,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
        is_read: bool | None = None,
    ) -> NotificationListResponse:
        """Get notifications for a user"""
        import sys
        print(f"[GET-NOTIF] Fetching notifications for user: {user_id}, limit: {limit}, offset: {offset}, unread_only: {unread_only}, is_read: {is_read}", file=sys.stderr)
        appointment_ids_query = db.query(Appointment.id).filter(
            Appointment.created_by_id == user_id
        )

        query = db.query(Notification).filter(
            or_(
                Notification.recipient_id == user_id,
                Notification.appointment_id.in_(appointment_ids_query),
            )
        ).options(joinedload(Notification.appointment))

        if is_read is not None:
            query = query.filter(Notification.is_read == is_read)
        elif unread_only:
            query = query.filter(Notification.is_read == False)

        total = query.count()
        
        notifications = query.order_by(
            Notification.created_at.desc()
        ).offset(offset).limit(limit).all()

        unread_count = db.query(Notification).filter(
            and_(
                or_(
                    Notification.recipient_id == user_id,
                    Notification.appointment_id.in_(appointment_ids_query),
                ),
                Notification.is_read == False,
            )
        ).count()

        print(f"[GET-NOTIF] Found {len(notifications)} notifications (total: {total}, unread: {unread_count})", file=sys.stderr)
        for n in notifications:
            print(f"[GET-NOTIF]   - Type: {n.notification_type}, Title: {n.title}, Read: {n.is_read}", file=sys.stderr)

        return NotificationListResponse(
            notifications=[NotificationResponse.from_orm(n) for n in notifications],
            total=total,
            unread_count=unread_count,
        )

    @staticmethod
    def mark_notification_as_read_for_user(
        db: Session,
        notification_id: str,
        user_id: str,
    ) -> NotificationResponse:
        """Mark a notification as read if it belongs to the current staff user."""
        notification = db.query(Notification).options(joinedload(Notification.appointment)).filter(
            Notification.id == notification_id
        ).first()

        if not notification:
            raise ValueError(f"Notification {notification_id} not found")

        appointment_owner_id = notification.appointment.created_by_id if notification.appointment else None
        if notification.recipient_id != user_id and appointment_owner_id != user_id:
            raise ValueError("Notification not found")

        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
        return NotificationResponse.from_orm(notification)

    @staticmethod
    def mark_notification_as_read(
        db: Session,
        notification_id: str,
    ) -> NotificationResponse:
        """Mark a notification as read"""
        notification = db.query(Notification).filter(
            Notification.id == notification_id
        ).first()

        if not notification:
            raise ValueError(f"Notification {notification_id} not found")

        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
        return NotificationResponse.from_orm(notification)

    @staticmethod
    def mark_all_as_read(
        db: Session,
        user_id: str,
    ) -> None:
        """Mark all notifications as read for a user"""
        appointment_ids_query = db.query(Appointment.id).filter(
            Appointment.created_by_id == user_id
        )

        db.query(Notification).filter(
            and_(
                or_(
                    Notification.recipient_id == user_id,
                    Notification.appointment_id.in_(appointment_ids_query),
                ),
                Notification.is_read == False,
            )
        ).update({
            Notification.is_read: True,
            Notification.read_at: datetime.now(timezone.utc),
        })
        db.commit()

    @staticmethod
    def delete_notification(
        db: Session,
        notification_id: str,
    ) -> None:
        """Delete a notification"""
        db.query(Notification).filter(
            Notification.id == notification_id
        ).delete()
        db.commit()
