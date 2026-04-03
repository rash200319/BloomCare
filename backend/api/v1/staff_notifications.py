from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.core.deps import get_current_user, get_db
from backend.models.user import User, UserRole
from backend.schemas.notification import NotificationListResponse, NotificationResponse
from backend.services.notification_service import NotificationService

router = APIRouter()


def _require_frontline_staff(current_user: User) -> None:
    role_name = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_name != UserRole.FRONTLINE_STAFF.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only frontline staff can access staff notifications",
        )


@router.get(
    "/notifications",
    response_model=NotificationListResponse,
    summary="Get Staff Notifications",
    description="Get notifications for the current frontline staff user, including notifications linked to appointments they created.",
)
def get_staff_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    is_read: Optional[bool] = Query(None, description="Filter by read state. Pass false to get unread notifications."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    _require_frontline_staff(current_user)
    return NotificationService.get_user_notifications(
        db,
        current_user.id,
        limit=limit,
        offset=offset,
        is_read=is_read,
    )


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark Staff Notification as Read",
    description="Mark a staff notification as read if it belongs to the current frontline staff user.",
)
def mark_staff_notification_as_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    _require_frontline_staff(current_user)
    try:
        return NotificationService.mark_notification_as_read_for_user(db, notification_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
