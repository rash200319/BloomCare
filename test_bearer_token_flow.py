#!/usr/bin/env python3
"""Test the updated authentication flow with bearer token"""
import requests
import json

BASE_URL = "http://localhost:8004/api/v1"

print("\n" + "="*80)
print("BLOOMCARE SIMPLIFIED AUTH FLOW - BEARER TOKEN ONLY")
print("="*80)

# Step 1: Create staff
print("\n✅ STEP 1: CREATE NEW STAFF MEMBER")
print("-"*80)

new_staff = {
    "full_name": "Dr. Bearer Token Test",
    "nic": "111222333BBB",
    "telephone": "+94788888899",
    "email": "bearertoken@bloomcare.com",
    "birthday": "1990-01-01",
    "role": "CLINICAL_SPECIALIST",
    "specialization": "Surgery"
}

try:
    response = requests.post(f"{BASE_URL}/staff-management/create-staff", json=new_staff)
    
    if response.status_code == 201:
        staff_result = response.json()
        user_id = staff_result['user_id']
        temp_password = staff_result['temporary_password']
        
        print(f"✓ Staff created successfully!")
        print(f"  User ID: {user_id}")
        print(f"  Temporary Password: {temp_password}")
        
        # Step 2: Login to get access token
        print("\n✅ STEP 2: LOGIN TO GET ACCESS TOKEN")
        print("-"*80)
        
        login_data = {
            "user_id": user_id,
            "password": temp_password
        }
        
        response = requests.post(f"{BASE_URL}/auth/login-user-id", json=login_data)
        
        if response.status_code == 200:
            login_result = response.json()
            
            print(f"✓ Login successful!")
            print(f"\n📋 LOGIN RESPONSE:")
            print(f"  ├─ user_id: {login_result['user_id']}")
            print(f"  ├─ full_name: {login_result['full_name']}")
            print(f"  ├─ role: {login_result['role']}")
            print(f"  ├─ is_first_login: {login_result['is_first_login']}")
            print(f"  ├─ token_type: {login_result['token_type']}")
            print(f"  └─ access_token: {login_result['access_token'][:50]}...")
            
            access_token = login_result['access_token']
            
            # Step 3: Change password using bearer token
            print("\n✅ STEP 3: CHANGE PASSWORD USING ACCESS TOKEN")
            print("-"*80)
            
            change_pwd_data = {
                "old_password": temp_password,
                "new_password": "NewBearerPassword@2024"
            }
            
            # Use the access token in Authorization header
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            print(f"Authorization Header:")
            print(f"  Authorization: Bearer {access_token[:50]}...")
            
            response = requests.post(
                f"{BASE_URL}/auth/change-password",
                json=change_pwd_data,
                headers=headers
            )
            
            print(f"\n✓ Password change response:")
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.json()}")
            
            if response.status_code == 200:
                # Step 4: Login with new password
                print("\n✅ STEP 4: LOGIN WITH NEW PASSWORD")
                print("-"*80)
                
                new_login_data = {
                    "user_id": user_id,
                    "password": "NewBearerPassword@2024"
                }
                
                response = requests.post(f"{BASE_URL}/auth/login-user-id", json=new_login_data)
                
                if response.status_code == 200:
                    new_result = response.json()
                    print(f"✓ Successfully logged in with new password!")
                    print(f"  User: {new_result['full_name']}")
                    print(f"  Role: {new_result['role']}")
                    print(f"  is_first_login: {new_result['is_first_login']}")
                    
                    print("\n" + "="*80)
                    print("✅ FULL AUTHENTICATION FLOW COMPLETED SUCCESSFULLY!")
                    print("="*80)
                    
                    print("\n📚 HOW TO USE ACCESS TOKEN IN SWAGGER UI:")
                    print("-"*80)
                    print("1. Click the 'Authorize' button at the top right")
                    print("2. Paste the access_token from login response")
                    print("3. Click 'Authorize' button in the dialog")
                    print("4. Now all requests will use Bearer token automatically")
                    print("\n📚 HOW TO USE IN API REQUESTS:")
                    print("-"*80)
                    print(f"curl -H 'Authorization: Bearer {new_result['access_token'][:30]}...' \\")
                    print(f"  http://localhost:8004/api/v1/auth/change-password")
                    
                else:
                    print(f"✗ Login with new password failed: {response.json()}")
            else:
                print(f"✗ Password change failed")
        else:
            print(f"✗ Login failed: {response.json()}")
    else:
        print(f"✗ Failed to create staff: {response.json()}")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "="*80 + "\n")
