import uuid
from sqlalchemy import Column, String, DateTime, Text
from datetime import datetime
from ..db.base import Base

class SyncQueueLog(Base):
    __tablename__ = "sync_queue_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(String(100))
    payload_hash = Column(String(255), unique=True, nullable=False)
    sync_status = Column(String(50), default="PENDING")
    error_message = Column(Text)
    received_at = Column(DateTime(timezone=True), default=datetime.utcnow)
