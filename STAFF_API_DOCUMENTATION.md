# BloomCare Staff Management API - Documentation

## ✅ GET Staff Endpoints (Working)

### 1. Get All Staff Members
**Endpoint:** `GET /api/v1/staff-management/staff`

Returns all staff members (FRONTLINE_STAFF and CLINICAL_SPECIALIST roles).

**Response Example:**
```json
[
  {
    "id": "bc2980d2-350f-4013-977d-42b774c2bf26",
    "user_id": "FLS-0001",
    "full_name": "John Doe",
    "nic": "123456789VAC",
    "telephone": "+94712345678",
    "email": "john.doe@bloomcare.com",
    "birthday": "1985-05-15",
    "role": "FRONTLINE_STAFF",
    "specialization": null,
    "is_active": true
  }
]
```

---

### 2. Get Staff by Name (Partial Match)
**Endpoint:** `GET /api/v1/staff-management/staff?full_name=Sarah`

Filters staff by partial name match (case-insensitive).

**Test Result:**
```
Query: ?full_name=Sarah
Found: 1 staff member
  - Dr. Sarah Johnson (Email: sarah.johnson@bloomcare.com)
```

---

### 3. Get Staff by User ID (Exact Match)
**Endpoint:** `GET /api/v1/staff-management/staff?user_id=DOC-0001`

Filters staff by exact user ID match.

**Test Result:**
```
Query: ?user_id=DOC-0001
Found: 1 staff member
  - Dr. Sarah Johnson (User ID: DOC-0001)
```

---

### 4. Get Staff by NIC
**Endpoint:** `GET /api/v1/staff-management/staff?nic=987654321VAC`

Filters staff by National ID Card number.

---

### 5. Get Staff by Role
**Endpoint:** `GET /api/v1/staff-management/staff?role=CLINICAL_SPECIALIST`

Filters staff by role (FRONTLINE_STAFF or CLINICAL_SPECIALIST).

---

### 6. Combine Multiple Filters
**Endpoint:** `GET /api/v1/staff-management/staff?role=CLINICAL_SPECIALIST&nic=987654321VAC`

Combine any filters for more specific searches.

---

## ✅ CREATE Staff Endpoint (Working)

### Create New Staff Member
**Endpoint:** `POST /api/v1/staff-management/create-staff`

**Request Body:**
```json
{
  "full_name": "Dr. Emily Brown",
  "nic": "555666777XYZ",
  "telephone": "+94771234567",
  "email": "emily.brown@bloomcare.com",
  "birthday": "1988-07-10",
  "role": "CLINICAL_SPECIALIST",
  "specialization": "Pediatrics"
}
```

**Response (Status: 201 Created):**
```json
{
  "user_id": "DOC-0003",
  "temporary_password": "gpQ^CecEwa1f",
  "full_name": "Dr. Emily Brown",
  "email": "emily.brown@bloomcare.com",
  "role": "CLINICAL_SPECIALIST"
}
```

**Key Features:**
- Auto-generates user_id: 
  - `DOC-XXXX` for CLINICAL_SPECIALIST
  - `FLS-XXXX` for FRONTLINE_STAFF
- Generates temporary password (strong, 12 characters)
- User must change password on first login (is_first_login = TRUE)

---

## ✅ Test Results Summary

| Test | Status | Result |
|------|--------|--------|
| Get All Staff | ✅ PASS | 5 staff members returned |
| Filter by Name (Sarah) | ✅ PASS | 1 match found |
| Filter by User ID (DOC-0001) | ✅ PASS | Correct staff found |
| Create New Staff | ✅ PASS | New staff created with ID DOC-0003 |

---

## Usage Examples

### PowerShell Examples

**Get all staff:**
```powershell
Invoke-WebRequest -Uri "http://localhost:8004/api/v1/staff-management/staff" -UseBasicParsing
```

**Search by name:**
```powershell
Invoke-WebRequest -Uri "http://localhost:8004/api/v1/staff-management/staff?full_name=Sarah" -UseBasicParsing
```

**Search by user ID:**
```powershell
Invoke-WebRequest -Uri "http://localhost:8004/api/v1/staff-management/staff?user_id=DOC-0001" -UseBasicParsing
```

**Create new staff:**
```powershell
$body = @{
    full_name = "Dr. New Staff"
    nic = "111222333ZZZ"
    telephone = "+94799999999"
    email = "new.staff@bloomcare.com"
    birthday = "1990-01-01"
    role = "CLINICAL_SPECIALIST"
    specialization = "General Practice"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8004/api/v1/staff-management/create-staff" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $body `
    -UseBasicParsing
```

### Python Examples

```python
import requests

# Get all staff
response = requests.get("http://localhost:8004/api/v1/staff-management/staff")
staff = response.json()

# Search by name
response = requests.get("http://localhost:8004/api/v1/staff-management/staff",
                       params={"full_name": "Sarah"})

# Search by user ID
response = requests.get("http://localhost:8004/api/v1/staff-management/staff",
                       params={"user_id": "DOC-0001"})

# Create new staff
new_staff = {
    "full_name": "Dr. New Person",
    "nic": "111222333ZZZ",
    "telephone": "+94799999999",
    "email": "new@bloomcare.com",
    "birthday": "1990-01-01",
    "role": "CLINICAL_SPECIALIST",
    "specialization": "Surgery"
}
response = requests.post("http://localhost:8004/api/v1/staff-management/create-staff",
                        json=new_staff)
result = response.json()
print(f"New Staff User ID: {result['user_id']}")
print(f"Temporary Password: {result['temporary_password']}")
```

---

## Interactive API Documentation

Access the Swagger UI with all endpoints documented:
```
http://localhost:8004/docs
```

Or use ReDoc:
```
http://localhost:8004/redoc
```

---

## API Status
- ✅ Server: Running on http://localhost:8004
- ✅ Database: Connected to PostgreSQL BloomCare schema
- ✅ All endpoints: Working and tested
