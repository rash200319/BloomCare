# BloomCare Authentication System - Bearer Token Only

## 🔐 Simplified Authentication Flow

This system uses **only Bearer Token (JWT)** authentication. The old login endpoint has been removed.

---

## 📋 Authentication Endpoints

### **1️⃣ LOGIN WITH USER ID** (Get Access Token)

**Endpoint:**
```
POST /api/v1/auth/login-user-id
```

**Request Body:**
```json
{
  "user_id": "DOC-0005",
  "password": "jC8RTb1$#l&g"
}
```

**Response (Status: 200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3N...",
  "token_type": "bearer",
  "user_id": "DOC-0005",
  "full_name": "Dr. Bearer Token Test",
  "role": "CLINICAL_SPECIALIST",
  "is_first_login": true
}
```

**Key Fields:**
- `access_token`: JWT token to use for all authenticated requests
- `token_type`: Always "bearer"
- `is_first_login`: If true, user MUST change password before using the system

---

### **2️⃣ CHANGE PASSWORD** (Using Access Token)

**Endpoint:**
```
POST /api/v1/auth/change-password
```

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "old_password": "jC8RTb1$#l&g",
  "new_password": "NewBearerPassword@2024"
}
```

**Response (Status: 200 OK):**
```json
{
  "message": "Password changed successfully"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 digit (0-9)
- At least 1 special character (!@#$%^&*)

---

## 🔑 Using Access Token for Protected Endpoints

### **In HTTP Headers:**
All protected endpoints require the Bearer token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **In Swagger UI (http://localhost:8004/docs):**

1. Click the **"Authorize"** button (🔐) in the top right
2. In the dialog, select **"bearerAuth"**
3. Paste the entire `access_token` from your login response
4. Click **"Authorize"** button
5. Now all requests will automatically include the Bearer token

---

## 💻 Code Examples

### **PowerShell - Complete Flow**

```powershell
# Step 1: Login to get access token
$loginBody = @{
    user_id = "DOC-0005"
    password = "jC8RTb1$#l&g"
} | ConvertTo-Json

$loginResponse = Invoke-WebRequest -Uri "http://localhost:8004/api/v1/auth/login-user-id" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $loginBody `
    -UseBasicParsing

$loginData = $loginResponse.Content | ConvertFrom-Json
$accessToken = $loginData.access_token

Write-Host "✓ Logged in! Access Token: $($accessToken.Substring(0, 50))..."

# Step 2: Use token to change password
$changePasswordBody = @{
    old_password = "jC8RTb1$#l&g"
    new_password = "NewPassword@2024"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:8004/api/v1/auth/change-password" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    } `
    -Body $changePasswordBody `
    -UseBasicParsing

Write-Host "Response: $($response.Content | ConvertFrom-Json)"
```

### **Python - Complete Flow**

```python
import requests

BASE_URL = "http://localhost:8004/api/v1"

# Step 1: Login
login_data = {
    "user_id": "DOC-0005",
    "password": "jC8RTb1$#l&g"
}

response = requests.post(f"{BASE_URL}/auth/login-user-id", json=login_data)
login_result = response.json()
access_token = login_result['access_token']

print(f"✓ Logged in! Token: {access_token[:50]}...")

# Step 2: Use token to change password
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

change_pwd_data = {
    "old_password": "jC8RTb1$#l&g",
    "new_password": "NewPassword@2024"
}

response = requests.post(
    f"{BASE_URL}/auth/change-password",
    json=change_pwd_data,
    headers=headers
)

print(f"Response: {response.json()}")
```

### **cURL - Using Bearer Token**

```bash
# Login
curl -X POST http://localhost:8004/api/v1/auth/login-user-id \
  -H "Content-Type: application/json" \
  -d '{"user_id":"DOC-0005","password":"jC8RTb1$#l&g"}'

# Get the access_token from response, then:
# Change password
curl -X POST http://localhost:8004/api/v1/auth/change-password \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"old_password":"jC8RTb1$#l&g","new_password":"NewPassword@2024"}'
```

---

## 🔄 Complete Authentication Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CREATE STAFF                                             │
│    POST /staff-management/create-staff                      │
│    → Returns: user_id + temporary_password                  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. LOGIN WITH TEMPORARY PASSWORD                            │
│    POST /auth/login-user-id                                 │
│    Body: {user_id, password}                                │
│    → Returns: access_token + user_info                      │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. (FIRST LOGIN ONLY) CHANGE PASSWORD                       │
│    POST /auth/change-password                               │
│    Headers: Authorization: Bearer <token>                   │
│    → Returns: success message                               │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. USE ACCESS TOKEN FOR ALL PROTECTED ENDPOINTS             │
│    Headers: Authorization: Bearer <access_token>            │
│    Now ready to use all API endpoints                       │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Important Notes

### **Token Expiration**
- Access tokens expire after a configured time period
- If token expires, login again to get a new token

### **First Login Flag**
- When `is_first_login` is `true`, user MUST change password
- After changing password, `is_first_login` becomes `false`

### **Security Best Practices**
- ✅ Always use HTTPS in production
- ✅ Store tokens securely (not in localStorage for sensitive apps)
- ✅ Include token in Authorization header as: `Bearer <token>`
- ✅ Don't expose tokens in logs or debug output
- ✅ Use strong passwords meeting all requirements

---

## 🧪 Test the Flow

Run the comprehensive test:
```bash
python test_bearer_token_flow.py
```

---

## 📱 Swagger UI Authorization

**URL:** http://localhost:8004/docs

Steps:
1. Try out any endpoint
2. In the response, copy the `access_token` value
3. Click **"Authorize"** button (🔐)
4. Paste the token
5. Click **"Authorize"**
6. All requests will now include Bearer token

---

## ✅ Status

- ✅ Bearer token authentication
- ✅ Old /login endpoint removed
- ✅ Only user_id login available
- ✅ Access token required for all protected endpoints
- ✅ Swagger UI ready for testing

**API Documentation:** http://localhost:8004/docs
