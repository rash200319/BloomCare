#!/usr/bin/env python3
"""Test the complete password change flow"""
import requests
import json

BASE_URL = "http://localhost:8004/api/v1"

print("\n" + "="*70)
print("BLOOMCARE PASSWORD CHANGE - COMPLETE FLOW TEST")
print("="*70)

# Step 1: Login to get access token
print("\n✅ STEP 1: LOGIN WITH user_id AND password")
print("-"*70)

login_data = {
    "user_id": "DOC-0001",
    "password": "TempPassword@2024"  # Temporary password from staff creation
}

print(f"Logging in with:")
print(f"  user_id: {login_data['user_id']}")
print(f"  password: {login_data['password']}")

try:
    response = requests.post(f"{BASE_URL}/auth/login-user-id", json=login_data)
    print(f"\nStatus: {response.status_code}")
    
    if response.status_code == 200:
        login_result = response.json()
        print(f"\n✓ Login successful!")
        print(f"  User: {login_result['full_name']}")
        print(f"  Role: {login_result['role']}")
        print(f"  First Login: {login_result['is_first_login']}")
        
        access_token = login_result['access_token']
        print(f"  Access Token: {access_token[:20]}...")
        
        # Step 2: Change password using the token
        print("\n✅ STEP 2: CHANGE PASSWORD")
        print("-"*70)
        
        change_pwd_data = {
            "old_password": "TempPassword@2024",
            "new_password": "NewPassword@2024"
        }
        
        print(f"Changing password:")
        print(f"  Old Password: {change_pwd_data['old_password']}")
        print(f"  New Password: {change_pwd_data['new_password']}")
        
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
            
            # Step 3: Try to login with new password
            print("\n✅ STEP 3: LOGIN WITH NEW PASSWORD")
            print("-"*70)
            
            new_login_data = {
                "user_id": "DOC-0001",
                "password": "NewPassword@2024"
            }
            
            response = requests.post(f"{BASE_URL}/auth/login-user-id", json=new_login_data)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                print("✓ Successfully logged in with new password!")
                result = response.json()
                print(f"  User: {result['full_name']}")
                print(f"  is_first_login: {result['is_first_login']}")
            else:
                print(f"✗ Failed to login with new password")
                print(f"  Error: {response.json()}")
        else:
            print(f"\n✗ Failed to change password")
            print(f"  Error: {response.json()}")
    else:
        print(f"\n✗ Login failed")
        print(f"  Error: {response.json()}")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "="*70)
print("TEST COMPLETED")
print("="*70 + "\n")
