#!/usr/bin/env python3
"""Simple test script for staff management API"""

import requests
import json

BASE_URL = "http://localhost:8004/api/v1"

print("=" * 60)
print("TESTING BLOOMCARE STAFF MANAGEMENT API")
print("=" * 60)

# Test 1: Get all staff members
print("\n1. GET /staff-management/staff (Get All Staff)")
print("-" * 60)
try:
    response = requests.get(f"{BASE_URL}/staff-management/staff")
    print(f"Status: {response.status_code}")
    staff = response.json()
    print(f"Found {len(staff)} staff members")
    for s in staff[:2]:  # Show first 2
        print(f"  - {s.get('full_name')} (ID: {s.get('user_id')})")
except Exception as e:
    print(f"Error: {e}")

# Test 2: Get staff by name filter
print("\n2. GET /staff-management/staff?full_name=Sarah (Filter by Name)")
print("-" * 60)
try:
    response = requests.get(f"{BASE_URL}/staff-management/staff", 
                          params={"full_name": "Sarah"})
    print(f"Status: {response.status_code}")
    staff = response.json()
    print(f"Found {len(staff)} staff members matching 'Sarah'")
    for s in staff:
        print(f"  - {s.get('full_name')} (Email: {s.get('email')})")
except Exception as e:
    print(f"Error: {e}")

# Test 3: Get staff by user_id filter
print("\n3. GET /staff-management/staff?user_id=DOC-0001 (Filter by User ID)")
print("-" * 60)
try:
    response = requests.get(f"{BASE_URL}/staff-management/staff",
                          params={"user_id": "DOC-0001"})
    print(f"Status: {response.status_code}")
    staff = response.json()
    print(f"Found {len(staff)} staff members with ID 'DOC-0001'")
    for s in staff:
        print(f"  - {s.get('full_name')} (User ID: {s.get('user_id')})")
except Exception as e:
    print(f"Error: {e}")

# Test 4: Create a new staff member
print("\n4. POST /staff-management/create-staff (Create New Staff)")
print("-" * 60)
new_staff = {
    "full_name": "Dr. Emily Brown",
    "nic": "555666777XYZ",
    "telephone": "+94771234567",
    "email": "emily.brown@bloomcare.com",
    "birthday": "1988-07-10",
    "role": "CLINICAL_SPECIALIST",
    "specialization": "Pediatrics"
}
try:
    response = requests.post(f"{BASE_URL}/staff-management/create-staff",
                            json=new_staff)
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"✓ Staff created successfully!")
    print(f"  - User ID: {result.get('user_id')}")
    print(f"  - Name: {result.get('full_name')}")
    print(f"  - Temporary Password: {result.get('temporary_password')}")
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 60)
print("✓ API TESTS COMPLETED")
print("=" * 60)
