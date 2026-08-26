from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class NotificationAppointmentContext(BaseModel):
    """Compact appointment context returned with a notification."""
    id: str
    appointment_date: datetime
    appointment_type: str
    status: str
    created_by_id: Optional[str] = None

    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    """Schema for creating a notification"""
    recipient_id: str
    recipient_type: str = "STAFF"
    appointment_id: Optional[str] = None
    notification_type: str
    title: str
    message: str
    related_data: Optional[dict] = None
    deduplication_key: Optional[str] = None


class NotificationResponse(BaseModel):
    """Schema for notification response"""
    id: str
    recipient_id: str
    recipient_type: str = "STAFF"
    appointment_id: Optional[str]
    notification_type: str
    title: str
    message: str
    is_read: bool
    read_at: Optional[datetime]
    related_data: Optional[dict]
    deduplication_key: Optional[str] = None
    created_at: datetime
    appointment: Optional[NotificationAppointmentContext] = None

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """Response for listing notifications"""
    notifications: list[NotificationResponse]
    total: int
    unread_count: int
