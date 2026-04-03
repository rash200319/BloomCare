# OTP (One-Time Password) Implementation Plan
## BloomCare Patient & Staff Authentication System

**Date**: April 2026  
**Status**: Planning Phase  
**Priority**: High (Enhanced Security)

---

## 1. Overview

Implement a secure OTP (One-Time Password) system for:
- **Patients**: OTP sent via SMS to `contact_number`
- **Staff**: OTP sent via Email to `email`

This enhances security by adding a second factor before allowing login or critical actions (password reset, first-login setup).

---

## 2. Architecture & Components

### 2.1 System Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Patient/   │        │  BloomCare   │        │  Email/SMS  │
│   Staff     │───────▶│   Backend    │───────▶│  Provider   │
│             │        │              │        │             │
└─────────────┘        └──────────────┘        └─────────────┘
                              │
                              │
                         ┌────▼──────┐
                         │  SQLite   │
                         │  Database │
                         └───────────┘
```

### 2.2 Key Components

1. **OTP Model** - Track OTP records in database
2. **OTP Service** - Generate, validate, resend OTP
3. **Email Service** - Send OTP via email (staff)
4. **SMS Service** - Send OTP via SMS (patients)
5. **API Endpoints** - Request OTP, verify OTP, resend OTP
6. **Auth Flow** - Integrate OTP into login/first-login workflow

---

## 3. Database Schema Changes

### 3.1 New Table: `otp_records`

```sql
CREATE TABLE otp_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User/Patient Reference
    patient_id UUID NULL REFERENCES patients(id) ON DELETE CASCADE,
    staff_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- OTP Data
    otp_code VARCHAR(6) NOT NULL,  -- 6-digit code
    otp_type ENUM('LOGIN', 'PASSWORD_RESET', 'FIRST_LOGIN') NOT NULL,
    destination VARCHAR(255) NOT NULL,  -- Email or phone
    
    -- Status & Timing
    is_verified BOOLEAN DEFAULT FALSE,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,  -- TTL (typically 5-10 minutes)
    verified_at TIMESTAMP NULL,
    
    -- Metadata
    ip_address VARCHAR(50) NULL,
    user_agent TEXT NULL,
    
    INDEX idx_patient_id (patient_id),
    INDEX idx_staff_id (staff_id),
    INDEX idx_otp_code (otp_code),
    INDEX idx_expires_at (expires_at)
);
```

### 3.2 Schema Updates to Existing Tables

**For `patients` table:**
```sql
ALTER TABLE patients ADD COLUMN otp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN last_otp_sent_at TIMESTAMP NULL;
ALTER TABLE patients ADD COLUMN otp_failed_attempts INT DEFAULT 0;
```

**For `users` table:**
```sql
ALTER TABLE users ADD COLUMN otp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN last_otp_sent_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN otp_failed_attempts INT DEFAULT 0;
```

---

## 4. OTP Model Definition

**File**: `backend/models/otp.py`

```python
import uuid
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Enum, ForeignKey
import enum
from backend.db.base import Base


class OTPType(str, enum.Enum):
    LOGIN = "LOGIN"
    PASSWORD_RESET = "PASSWORD_RESET"
    FIRST_LOGIN = "FIRST_LOGIN"
    ACCOUNT_VERIFICATION = "ACCOUNT_VERIFICATION"


class OTPRecord(Base):
    __tablename__ = "otp_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # User References
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=True)
    staff_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    
    # OTP Data
    otp_code = Column(String(6), nullable=False, index=True)
    otp_type = Column(Enum(OTPType), nullable=False)
    destination = Column(String(255), nullable=False)  # Phone or Email
    
    # Verification Status
    is_verified = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=5)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    
    # Request Metadata
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(512), nullable=True)
```

---

## 5. API Endpoints

### 5.1 Patient Endpoints

#### POST `/api/v1/auth/otp/request-patient`
**Purpose**: Request OTP for patient login/reset

**Request**:
```json
{
    "national_id": "NIC-900000001V",
    "otp_type": "LOGIN"  // or "PASSWORD_RESET", "FIRST_LOGIN"
}
```

**Response (200)**:
```json
{
    "message": "OTP sent to +94771234501",
    "destination_masked": "+947712****01",
    "expires_in_seconds": 600,
    "request_id": "uuid"
}
```

#### POST `/api/v1/auth/otp/verify-patient`
**Purpose**: Verify OTP and authenticate patient

**Request**:
```json
{
    "national_id": "NIC-900000001V",
    "otp_code": "123456",
    "request_id": "uuid"
}
```

**Response (200)**:
```json
{
    "verified": true,
    "next_step": "login",  // or "password_reset", "first_login"
    "session_token": "temp_token_valid_5_mins"
}
```

#### POST `/api/v1/auth/otp/resend-patient`
**Purpose**: Resend OTP to patient

**Request**:
```json
{
    "national_id": "NIC-900000001V",
    "otp_type": "LOGIN"
}
```

### 5.2 Staff Endpoints

#### POST `/api/v1/auth/otp/request-staff`
**Purpose**: Request OTP for staff login/reset

**Request**:
```json
{
    "email": "staff@bloomcare.health",
    "otp_type": "LOGIN"  // or "PASSWORD_RESET", "FIRST_LOGIN"
}
```

**Response (200)**:
```json
{
    "message": "OTP sent to s****@bloomcare.health",
    "destination_masked": "s****@bloomcare.health",
    "expires_in_seconds": 600,
    "request_id": "uuid"
}
```

#### POST `/api/v1/auth/otp/verify-staff`
**Purpose**: Verify OTP and authenticate staff

**Request**:
```json
{
    "email": "staff@bloomcare.health",
    "otp_code": "123456",
    "request_id": "uuid"
}
```

**Response (200)**:
```json
{
    "verified": true,
    "next_step": "login",
    "access_token": "jwt_token",
    "token_type": "bearer"
}
```

#### POST `/api/v1/auth/otp/resend-staff`
**Purpose**: Resend OTP to staff

**Request**:
```json
{
    "email": "staff@bloomcare.health",
    "otp_type": "LOGIN"
}
```

---

## 6. External Service Integration

### 6.1 Email Service (for Staff)

**Provider Options**:
- SendGrid (Recommended - 100 emails/day free)
- AWS SES
- Mailgun
- Gmail SMTP

**Implementation**:
```python
# backend/core/email_service.py
class EmailService:
    async def send_otp(email: str, otp_code: str, expires_in: int):
        # Send HTML-formatted email with OTP
```

**Environment Variables**:
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your_sendgrid_api_key
SENDER_EMAIL=noreply@bloomcare.health
```

### 6.2 SMS Service (for Patients)

**Provider Options**:
- Twilio (Recommended for Sri Lanka)
- Africa's Talking
- AWS SNS
- Textlocal

**Implementation**:
```python
# backend/core/sms_service.py
class SMSService:
    async def send_otp(phone_number: str, otp_code: str):
        # Send SMS via Twilio/Africa's Talking
```

**Environment Variables**:
```
SMS_PROVIDER=twilio  # or "africas_talking"
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## 7. Security Considerations

### 7.1 OTP Generation & Storage

- **OTP Length**: 6 digits (1,000,000 combinations)
- **Generation**: Cryptographically secure random
- **Hashing**: Hash OTP in database (use bcrypt/argon2)
- **Storage**: DO NOT store plaintext OTP

```python
import secrets
import hashlib

def generate_otp() -> str:
    return ''.join(secrets.choice('0123456789') for _ in range(6))

def hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()
```

### 7.2 Rate Limiting

- **Per User**: Max 5 OTP requests per hour
- **Per Destination**: Max 3 consecutive failed verification attempts
- **Global**: Max 1000 OTP requests per hour across system

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/request-patient")
@limiter.limit("5/hour")
def request_otp_patient(request: Request, ...):
    pass
```

### 7.3 Expiration & Cleanup

- **TTL**: OTP expires in 10 minutes (600 seconds)
- **Cleanup**: Automatic deletion of expired OTPs via scheduled task
- **Max Age**: OTP cannot be used after expiration

```python
# Automatic cleanup every hour
@tasks.periodic_task(run_every=crontab(minute=0))
def cleanup_expired_otps():
    db.query(OTPRecord).filter(
        OTPRecord.expires_at < datetime.utcnow()
    ).delete()
```

### 7.4 Account Lockout Protection

- **Failed Attempts**: Lock account after 5 failed OTP verifications
- **Lockout Duration**: 15 minutes
- **Recovery**: Unlock via admin or time-based

---

## 8. Implementation Timeline

### Phase 1: Database & Models (2-3 hours)
- [ ] Create OTP model (`backend/models/otp.py`)
- [ ] Create database migration/schema updates
- [ ] Add indexes for performance

### Phase 2: Core Services (4-5 hours)
- [ ] Implement OTP generation service
- [ ] Implement email service integration
- [ ] Implement SMS service integration
- [ ] Add rate limiting middleware

### Phase 3: API Endpoints (3-4 hours)
- [ ] Create OTP request endpoints (patient & staff)
- [ ] Create OTP verification endpoints
- [ ] Create OTP resend endpoints
- [ ] Add request/response validation

### Phase 4: Authentication Integration (2-3 hours)
- [ ] Integrate OTP into login flow
- [ ] Integrate OTP into first-login flow
- [ ] Update frontend to handle OTP verification

### Phase 5: Testing & Deployment (3-4 hours)
- [ ] Unit tests for OTP generation/validation
- [ ] Integration tests for endpoints
- [ ] Load testing for rate limiting
- [ ] Deployment to production

**Total Estimated Time**: 14-19 hours

---

## 9. Environment Configuration

### 9.1 Backend `.env` Updates

```bash
# Email Configuration (for Staff)
SMTP_ENABLED=true
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=${SENDGRID_API_KEY}
SENDER_EMAIL=noreply@bloomcare.health
SENDER_NAME=BloomCare OTP

# SMS Configuration (for Patients)
SMS_ENABLED=true
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
TWILIO_PHONE_NUMBER=+1234567890

# OTP Configuration
OTP_LENGTH=6
OTP_EXPIRY_SECONDS=600  # 10 minutes
OTP_MAX_ATTEMPTS=5
OTP_RESEND_WAIT_SECONDS=60  # Min 1 min between requests
```

---

## 10. Frontend Integration

### 10.1 Patient OTP Flow

```
1. Patient enters National ID
   ▼
2. System sends OTP to registered phone
   ▼
3. Patient sees "OTP sent to +947712***01"
   ▼
4. Patient enters 6-digit OTP
   ▼
5. System verifies OTP
   ▼
6. Patient sees login form (username/password) OR
   redirects to password reset if first-time
```

### 10.2 Staff OTP Flow

```
1. Staff enters Email
   ▼
2. System sends OTP to email
   ▼
3. Staff sees "OTP sent to s***@bloomcare.health"
   ▼
4. Staff enters 6-digit OTP
   ▼
5. System verifies OTP + returns JWT token
   ▼
6. Staff is authenticated and redirected to dashboard
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

```python
# tests/test_otp_service.py

def test_generate_otp():
    """OTP should be 6 digits"""
    otp = OTPService.generate_otp()
    assert len(otp) == 6
    assert otp.isdigit()

def test_otp_expiration():
    """OTP should expire after 10 minutes"""
    otp_record = OTPRecord(expires_at=datetime.utcnow() - timedelta(minutes=11))
    assert OTPService.is_expired(otp_record) == True

def test_max_attempts_exceeded():
    """OTP should lock after 5 failed attempts"""
    otp_record = OTPRecord(attempts=5, max_attempts=5)
    assert OTPService.can_attempt(otp_record) == False
```

### 11.2 Integration Tests

```python
def test_request_otp_patient():
    """Should send OTP to patient phone"""
    response = client.post("/api/v1/auth/otp/request-patient", 
        json={"national_id": "NIC-900000001V", "otp_type": "LOGIN"})
    assert response.status_code == 200
    assert "expires_in_seconds" in response.json()

def test_verify_otp_patient():
    """Should verify OTP and return session token"""
    # First request OTP
    req_resp = client.post("/api/v1/auth/otp/request-patient", ...)
    request_id = req_resp.json()["request_id"]
    
    # Then verify with OTP
    ver_resp = client.post("/api/v1/auth/otp/verify-patient",
        json={"national_id": "...", "otp_code": "123456", "request_id": request_id})
    assert ver_resp.status_code == 200
    assert "session_token" in ver_resp.json()
```

---

## 12. Error Handling

### 12.1 Common Error Scenarios

| Error | HTTP Code | Message |
|-------|-----------|---------|
| Invalid National ID/Email | 404 | User not found |
| OTP Expired | 400 | OTP has expired. Request a new one. |
| Invalid OTP Code | 400 | Incorrect OTP code. Attempts remaining: 4/5 |
| Max Attempts Exceeded | 429 | Too many failed attempts. Try again in 15 minutes. |
| Rate Limit Exceeded | 429 | Too many OTP requests. Try again in 1 hour. |
| Invalid Destination | 400 | Phone number or email not configured. |
| SMS/Email Service Down | 503 | Unable to send OTP. Please try again later. |

---

## 13. Deployment Checklist

- [ ] Test email service with SendGrid
- [ ] Test SMS service with Twilio
- [ ] Configure rate limiting middleware
- [ ] Set up database migrations
- [ ] Update .env files in production
- [ ] Set up OTP expiration cleanup task
- [ ] Test end-to-end OTP flow
- [ ] Monitor OTP service logs
- [ ] Document OTP flow for support team

---

## 14. Next Steps

1. **Approve Plan**: Get stakeholder approval for OTP implementation
2. **Setup Services**: Register with SendGrid & Twilio
3. **Create Models**: Implement OTP database model
4. **Implement Services**: Build email/SMS services
5. **Create Endpoints**: Build API endpoints
6. **Frontend Updates**: Update login forms to support OTP
7. **Testing**: Comprehensive testing and QA
8. **Deployment**: Roll out to production

---

## 15. References

- OTP Best Practices: https://owasp.org/www-community/attacks/Brute_force_attack
- Twilio SMS API: https://www.twilio.com/docs/sms
- SendGrid Email API: https://sendgrid.com/docs/
- Rate Limiting: https://fastapi-limiter.readthedocs.io/
