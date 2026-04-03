from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class NotificationCreate(BaseModel):
    """Schema for creating a notification"""
    recipient_id: str
    appointment_id: Optional[str] = None
    notification_type: str
    title: str
    message: str
    related_data: Optional[dict] = None


class NotificationResponse(BaseModel):
    """Schema for notification response"""
    id: str
    recipient_id: str
    appointment_id: Optional[str]
    notification_type: str
    title: str
    message: str
    is_read: bool
    read_at: Optional[datetime]
    related_data: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """Response for listing notifications"""
    notifications: list[NotificationResponse]
    total: int
    unread_count: int
