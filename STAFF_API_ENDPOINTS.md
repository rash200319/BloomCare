# BloomCare Staff Management API - Dedicated Endpoints

## 📌 Two Main Endpoints for Getting Staff Details

---

## **1️⃣ GET STAFF BY NAME**

### Endpoint
```
GET /api/v1/staff-management/by-name/{name}
```

### Description
Search for staff members by their name (partial match, case-insensitive).

### Parameters
- **name** (path): Staff member's name or partial name

### Example Requests

**Get staff named "Sarah":**
```
GET /api/v1/staff-management/by-name/Sarah
```

**Get staff named "Emily":**
```
GET /api/v1/staff-management/by-name/Emily
```

### Example Response (Status: 200 OK)
```json
[
  {
    "id": "8f95d37a-a180-456e-b190-de250e512c14",
    "user_id": "DOC-0001",
    "full_name": "Dr. Sarah Johnson",
    "nic": "987654321VAC",
    "telephone": "+94712345678",
    "email": "sarah.johnson@bloomcare.com",
    "birthday": "1980-05-15",
    "role": "CLINICAL_SPECIALIST",
    "specialization": "Obstetrics",
    "is_active": true
  }
]
```

---

## **2️⃣ GET STAFF BY USER ID**

### Endpoint
```
GET /api/v1/staff-management/by-id/{user_id}
```

### Description
Get staff member details using their unique user ID (e.g., DOC-0001, FLS-0001).

### Parameters
- **user_id** (path): Staff member's unique ID (DOC-XXXX or FLS-XXXX format)

### Example Requests

**Get staff with ID "DOC-0001":**
```
GET /api/v1/staff-management/by-id/DOC-0001
```

**Get staff with ID "DOC-0003":**
```
GET /api/v1/staff-management/by-id/DOC-0003
```

**Get frontline staff with ID "FLS-0001":**
```
GET /api/v1/staff-management/by-id/FLS-0001
```

### Example Response (Status: 200 OK)
```json
[
  {
    "id": "8f95d37a-a180-456e-b190-de250e512c14",
    "user_id": "DOC-0001",
    "full_name": "Dr. Sarah Johnson",
    "nic": "987654321VAC",
    "telephone": "+94712345678",
    "email": "sarah.johnson@bloomcare.com",
    "birthday": "1980-05-15",
    "role": "CLINICAL_SPECIALIST",
    "specialization": "Obstetrics",
    "is_active": true
  }
]
```

---

## 🧪 Test Results

| Test | Endpoint | Result |
|------|----------|--------|
| Get by name "Sarah" | GET /by-name/Sarah | ✅ Found: Dr. Sarah Johnson (DOC-0001) |
| Get by ID "DOC-0001" | GET /by-id/DOC-0001 | ✅ Found: Dr. Sarah Johnson with full details |
| Get by name "Emily" | GET /by-name/Emily | ✅ Found: Dr. Emily Brown (DOC-0003) |
| Get by ID "DOC-0003" | GET /by-id/DOC-0003 | ✅ Found: Dr. Emily Brown with full details |

---

## 💻 Usage Examples

### PowerShell

**Get staff by name:**
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:8004/api/v1/staff-management/by-name/Sarah" -UseBasicParsing
$response.Content | ConvertFrom-Json | ConvertTo-Json
```

**Get staff by user_id:**
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:8004/api/v1/staff-management/by-id/DOC-0001" -UseBasicParsing
$response.Content | ConvertFrom-Json | ConvertTo-Json
```

### Python

**Get staff by name:**
```python
import requests

response = requests.get("http://localhost:8004/api/v1/staff-management/by-name/Sarah")
staff = response.json()

for s in staff:
    print(f"Name: {s['full_name']}")
    print(f"User ID: {s['user_id']}")
    print(f"Email: {s['email']}")
    print(f"Role: {s['role']}")
```

**Get staff by user_id:**
```python
import requests

response = requests.get("http://localhost:8004/api/v1/staff-management/by-id/DOC-0001")
staff = response.json()

for s in staff:
    print(f"Name: {s['full_name']}")
    print(f"User ID: {s['user_id']}")
    print(f"NIC: {s['nic']}")
    print(f"Telephone: {s['telephone']}")
    print(f"Specialization: {s['specialization']}")
```

### cURL

**Get staff by name:**
```bash
curl "http://localhost:8004/api/v1/staff-management/by-name/Sarah"
```

**Get staff by user_id:**
```bash
curl "http://localhost:8004/api/v1/staff-management/by-id/DOC-0001"
```

---

## 📊 Response Fields Explained

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (string) | Internal database ID |
| `user_id` | string | Auto-generated unique ID (DOC-XXXX or FLS-XXXX) |
| `full_name` | string | Staff member's full name |
| `nic` | string | National Identity Card number |
| `telephone` | string | Contact phone number |
| `email` | string | Email address |
| `birthday` | date | Date of birth |
| `role` | string | Role (CLINICAL_SPECIALIST or FRONTLINE_STAFF) |
| `specialization` | string | Medical specialization (for doctors) |
| `is_active` | boolean | Whether staff is active |

---

## 🔄 Additional Endpoints (Still Available)

### Get All Staff
```
GET /api/v1/staff-management/staff
```
Returns all staff members with optional query filters.

### Create New Staff
```
POST /api/v1/staff-management/create-staff
```
Create a new staff member with auto-generated user_id.

---

## 📚 Interactive API Documentation

Access the full API documentation with try-it-out feature:
- **Swagger UI**: http://localhost:8004/docs
- **ReDoc**: http://localhost:8004/redoc

---

## ✅ API Status
- **Server**: Running on http://localhost:8004
- **Database**: PostgreSQL BloomCare schema
- **Status**: All endpoints working ✓
