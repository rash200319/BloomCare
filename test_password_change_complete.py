#!/usr/bin/env python3
"""Test password change with new staff creation"""
import requests
import json

BASE_URL = "http://localhost:8004/api/v1"

print("\n" + "="*70)
print("BLOOMCARE PASSWORD CHANGE - FULL WORKFLOW TEST")
print("="*70)

# Step 1: Create a new staff member
print("\n✅ STEP 1: CREATE NEW STAFF MEMBER")
print("-"*70)

new_staff = {
    "full_name": "Dr. Test Password",
    "nic": "999888777PPP",
    "telephone": "+94788888888",
    "email": "test.password@bloomcare.com",
    "birthday": "1990-01-01",
    "role": "CLINICAL_SPECIALIST",
    "specialization": "Cardiology"
}

try:
    response = requests.post(f"{BASE_URL}/staff-management/create-staff", json=new_staff)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 201:
        staff_result = response.json()
        user_id = staff_result['user_id']
        temp_password = staff_result['temporary_password']
        
        print(f"\n✓ Staff created successfully!")
        print(f"  User ID: {user_id}")
        print(f"  Name: {staff_result['full_name']}")
        print(f"  Temporary Password: {temp_password}")
        
        # Step 2: Login with temporary password
        print("\n✅ STEP 2: LOGIN WITH TEMPORARY PASSWORD")
        print("-"*70)
        
        login_data = {
            "user_id": user_id,
            "password": temp_password
        }
        
        print(f"Logging in with:")
        print(f"  user_id: {user_id}")
        print(f"  password: {temp_password}")
        
        response = requests.post(f"{BASE_URL}/auth/login-user-id", json=login_data)
        print(f"\nStatus: {response.status_code}")
        
        if response.status_code == 200:
            login_result = response.json()
            print(f"\n✓ Login successful!")
            print(f"  User: {login_result['full_name']}")
            print(f"  Role: {login_result['role']}")
            print(f"  First Login: {login_result['is_first_login']}")
            
            access_token = login_result['access_token']
            print(f"  Access Token: {access_token[:30]}...")
            
            # Step 3: Change password
            print("\n✅ STEP 3: CHANGE PASSWORD")
            print("-"*70)
            
            change_pwd_data = {
                "old_password": temp_password,
                "new_password": "NewPassword@2024"
            }
            
            print(f"Changing password:")
            print(f"  Old Password: {temp_password}")
            print(f"  New Password: NewPassword@2024")
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{BASE_URL}/auth/change-password",
                json=change_pwd_data,
                headers=headers
            )
            
            print(f"\nStatus: {response.status_code}")
            print(f"Response: {response.json()}")
            
            if response.status_code == 200:
                print("\n✓ Password changed successfully!")
                
                # Step 4: Try to login with old password (should fail)
                print("\n✅ STEP 4: TRY LOGIN WITH OLD PASSWORD (should fail)")
                print("-"*70)
                
                old_login_data = {
                    "user_id": user_id,
                    "password": temp_password
                }
                
                response = requests.post(f"{BASE_URL}/auth/login-user-id", json=old_login_data)
                print(f"Status: {response.status_code}")
                
                if response.status_code != 200:
                    print(f"✓ Correctly rejected old password")
                    print(f"  Error: {response.json()['detail']}")
                else:
                    print(f"✗ Old password still works (should not!)")
                
                # Step 5: Login with new password
                print("\n✅ STEP 5: LOGIN WITH NEW PASSWORD")
                print("-"*70)
                
                new_login_data = {
                    "user_id": user_id,
                    "password": "NewPassword@2024"
                }
                
                response = requests.post(f"{BASE_URL}/auth/login-user-id", json=new_login_data)
                print(f"Status: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"✓ Successfully logged in with new password!")
                    print(f"  User: {result['full_name']}")
                    print(f"  is_first_login: {result['is_first_login']}")
                else:
                    print(f"✗ Failed to login with new password")
                    print(f"  Error: {response.json()}")
            else:
                print(f"\n✗ Failed to change password")
                print(f"  Error: {response.json()}")
        else:
            print(f"\n✗ Login with temporary password failed")
            print(f"  Error: {response.json()}")
    else:
        print(f"\n✗ Failed to create staff")
        print(f"  Error: {response.json()}")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "="*70)
print("✅ TEST COMPLETED")
print("="*70 + "\n")
