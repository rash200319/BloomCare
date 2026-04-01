#!/usr/bin/env python3
"""Test new dedicated staff endpoints"""
import requests
import json

BASE_URL = "http://localhost:8004/api/v1/staff-management"

print("\n" + "="*70)
print("BLOOMCARE STAFF MANAGEMENT API - NEW ENDPOINTS TEST")
print("="*70)

# Test 1: Get staff by name
print("\n✅ TEST 1: GET /by-name/{name}")
print("-"*70)
try:
    response = requests.get(f"{BASE_URL}/by-name/Sarah")
    print(f"Status: {response.status_code}")
    staff = response.json()
    print(f"Found {len(staff)} staff with name 'Sarah':")
    for s in staff:
        print(f"  - {s['full_name']} (User ID: {s['user_id']}, Email: {s['email']})")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 2: Get staff by user_id
print("\n✅ TEST 2: GET /by-id/{user_id}")
print("-"*70)
try:
    response = requests.get(f"{BASE_URL}/by-id/DOC-0001")
    print(f"Status: {response.status_code}")
    staff = response.json()
    print(f"Found {len(staff)} staff with user_id 'DOC-0001':")
    for s in staff:
        print(f"  - {s['full_name']}")
        print(f"    User ID: {s['user_id']}")
        print(f"    Email: {s['email']}")
        print(f"    NIC: {s['nic']}")
        print(f"    Telephone: {s['telephone']}")
        print(f"    Role: {s['role']}")
        if s['specialization']:
            print(f"    Specialization: {s['specialization']}")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 3: Get staff by another name
print("\n✅ TEST 3: GET /by-name/{name} - Another Example")
print("-"*70)
try:
    response = requests.get(f"{BASE_URL}/by-name/Emily")
    print(f"Status: {response.status_code}")
    staff = response.json()
    print(f"Found {len(staff)} staff with name 'Emily':")
    for s in staff:
        print(f"  - {s['full_name']} (ID: {s['user_id']})")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 4: Get staff by different user_id
print("\n✅ TEST 4: GET /by-id/{user_id} - Another Example")
print("-"*70)
try:
    response = requests.get(f"{BASE_URL}/by-id/DOC-0003")
    print(f"Status: {response.status_code}")
    staff = response.json()
    if staff:
        print(f"Found staff with user_id 'DOC-0003':")
        for s in staff:
            print(f"  - {s['full_name']}")
            print(f"    User ID: {s['user_id']}")
            print(f"    Specialization: {s.get('specialization', 'N/A')}")
    else:
        print("No staff found with this ID")
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "="*70)
print("✅ ALL TESTS COMPLETED!")
print("="*70 + "\n")
