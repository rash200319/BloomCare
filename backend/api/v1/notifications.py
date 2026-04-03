from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any

from backend.core.deps import get_db, get_current_user
from backend.models.user import User
from backend.services.notification_service import NotificationService
from backend.schemas.notification import NotificationListResponse, NotificationResponse

router = APIRouter()


@router.get(
    "/",
    response_model=NotificationListResponse,
    summary="Get User Notifications",
    description="Get notifications for currently authenticated user",
)
def get_notifications(
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get notifications for the current user"""
    return NotificationService.get_user_notifications(
        db, current_user.id, limit=limit, offset=offset, unread_only=unread_only
    )


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark Notification as Read",
    description="Mark a notification as read",
)
def mark_as_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Mark a notification as read"""
    try:
        return NotificationService.mark_notification_as_read(db, notification_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post(
    "/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark All Notifications as Read",
    description="Mark all notifications as read for current user",
)
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Mark all notifications as read for the current user"""
    NotificationService.mark_all_as_read(db, current_user.id)


@router.delete(
    "/{notification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Notification",
    description="Delete a notification",
)
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a notification"""
    NotificationService.delete_notification(db, notification_id)
