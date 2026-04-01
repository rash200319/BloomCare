#!/usr/bin/env python3
"""
Comprehensive Test Suite for Staff & Patient Management API
Tests all new endpoints with realistic scenarios
"""
import requests
import json
from datetime import datetime


BASE_URL = "http://localhost:8004/api"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def test_create_staff():
    """Test creating staff members"""
    print_section("TEST 1: Create Staff Members")

    # Create Frontline Staff
    print("Creating Frontline Staff...")
    fls_data = {
        "full_name": "Anura Perera",
        "nic": "891234567V",
        "telephone": "+94771234567",
        "birthday": "1987-03-15",
        "email": "anura@bloomcare.com",
        "role": "FRONTLINE_STAFF"
    }

    response = requests.post(
        f"{BASE_URL}/staff-management/create-staff", json=fls_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        fls_result = response.json()
        print(f"✓ Created: {fls_result['full_name']}")
        print(f"  User ID: {fls_result['user_id']}")
        print(f"  Temp Password: {fls_result['temporary_password']}")
        fls_user_id = fls_result['user_id']
    else:
        print(f"✗ Error: {response.text}")
        return

    # Create Clinical Specialist
    print("\nCreating Clinical Specialist...")
    doc_data = {
        "full_name": "Dr. Priya Kumara",
        "nic": "891234568V",
        "telephone": "+94712345678",
        "birthday": "1985-07-22",
        "email": "priya@hospital.com",
        "role": "CLINICAL_SPECIALIST",
        "specialization": "Obstetrics & Gynecology"
    }

    response = requests.post(
        f"{BASE_URL}/staff-management/create-staff", json=doc_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        doc_result = response.json()
        print(f"✓ Created: {doc_result['full_name']}")
        print(f"  User ID: {doc_result['user_id']}")
        print(f"  Specialization: {doc_data['specialization']}")
        doc_user_id = doc_result['user_id']
    else:
        print(f"✗ Error: {response.text}")
        return

    return fls_user_id, doc_user_id, fls_result['temporary_password'], doc_result['temporary_password']


def test_get_staff():
    """Test retrieving staff members"""
    print_section("TEST 2: Retrieve Staff Members")

    # Get all staff
    print("Getting all staff...")
    response = requests.get(f"{BASE_URL}/staff-management/staff")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        staff_list = response.json()
        print(f"✓ Found {len(staff_list)} staff member(s)")
        for staff in staff_list:
            print(
                f"  - {staff['full_name']} ({staff['user_id']}) - {staff['role']}")

    # Filter by role
    print("\nFiltering by role (FRONTLINE_STAFF)...")
    response = requests.get(
        f"{BASE_URL}/staff-management/staff?role=FRONTLINE_STAFF")
    if response.status_code == 200:
        fls_staff = response.json()
        print(f"✓ Found {len(fls_staff)} frontline staff member(s)")


def test_create_patient():
    """Test creating patients"""
    print_section("TEST 3: Create Patients")

    print("Creating Patient...")
    patient_data = {
        "full_name": "Niran Jayawardene",
        "national_id": "987654321V",
        "date_of_birth": "1992-11-05",
        "age": 31,
        "contact_number": "+94779876543",
        "emergency_contact": "+94701234567",
        "blood_group": "O+"
    }

    response = requests.post(
        f"{BASE_URL}/patient-management/create-patient", json=patient_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        patient_result = response.json()
        print(f"✓ Created: {patient_result['full_name']}")
        print(f"  User ID: {patient_result['user_id']}")
        print(f"  Role: {patient_result['role']}")
        print(f"  Temp Password: {patient_result['temporary_password']}")
        return patient_result['user_id'], patient_result['temporary_password']
    else:
        print(f"✗ Error: {response.text}")
        return None, None


def test_get_patients():
    """Test retrieving patients"""
    print_section("TEST 4: Retrieve Patients")

    print("Getting all patients...")
    response = requests.get(f"{BASE_URL}/patient-management/patients")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        patients_list = response.json()
        print(f"✓ Found {len(patients_list)} patient(s)")
        for patient in patients_list:
            print(f"  - {patient['full_name']} ({patient['user_id']})")


def test_login_and_password_change(user_id, temp_password, role):
    """Test login and password change"""
    print_section(f"TEST 5: Login & Password Change - {role} ({user_id})")

    # Test login with temporary password
    print(f"Logging in with user_id: {user_id}...")
    login_data = {
        "user_id": user_id,
        "password": temp_password
    }

    response = requests.post(f"{BASE_URL}/auth/login-user-id", json=login_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        login_result = response.json()
        print(f"✓ Login successful")
        print(f"  Full Name: {login_result['full_name']}")
        print(f"  Role: {login_result['role']}")
        print(f"  Is First Login: {login_result['is_first_login']}")
        access_token = login_result['access_token']

        # Test password change
        print(f"\nChanging password for {user_id}...")
        new_password = "NewSecurePass123!"
        change_pwd_data = {
            "old_password": temp_password,
            "new_password": new_password
        }

        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.post(
            f"{BASE_URL}/auth/change-password", json=change_pwd_data, headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"✓ Password changed successfully")
            result = response.json()
            print(f"  Message: {result.get('message', 'Success')}")

            # Try logging in with new password
            print(f"\nTesting login with new password...")
            login_data['password'] = new_password
            response = requests.post(
                f"{BASE_URL}/auth/login-user-id", json=login_data)
            if response.status_code == 200:
                print(f"✓ Login with new password successful")
            else:
                print(f"✗ Login failed: {response.text}")
        else:
            print(f"✗ Password change failed: {response.text}")
    else:
        print(f"✗ Login failed: {response.text}")


def test_error_handling():
    """Test error handling"""
    print_section("TEST 6: Error Handling")

    # Test duplicate email
    print("Testing duplicate email handling...")
    duplicate_data = {
        "full_name": "Anura Perera",
        "nic": "891111111V",
        "telephone": "+94771234567",
        "email": "anura@bloomcare.com",
        "role": "FRONTLINE_STAFF"
    }

    response = requests.post(
        f"{BASE_URL}/staff-management/create-staff", json=duplicate_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 400:
        print(f"✓ Correctly rejected duplicate email")

    # Test duplicate NIC
    print("\nTesting duplicate NIC handling...")
    duplicate_nic = {
        "full_name": "Another Person",
        "nic": "891234567V",
        "telephone": "+94770000000",
        "email": "another@test.com",
        "role": "FRONTLINE_STAFF"
    }

    response = requests.post(
        f"{BASE_URL}/staff-management/create-staff", json=duplicate_nic)
    print(f"Status: {response.status_code}")
    if response.status_code == 400:
        print(f"✓ Correctly rejected duplicate NIC")

    # Test weak password
    print("\nTesting weak password handling...")
    login_data = {"user_id": "FLS-0001", "password": "123456"}
    response = requests.post(f"{BASE_URL}/auth/login-user-id", json=login_data)
    print(f"Status: {response.status_code}")
    if response.status_code in [401, 400]:
        print(f"✓ Correctly rejected weak/invalid credentials")


def run_all_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("  BLOOMCARE STAFF & PATIENT MANAGEMENT API TEST SUITE")
    print("="*60)

    try:
        # Test 1: Create staff
        result = test_create_staff()
        if result:
            fls_id, doc_id, fls_pwd, doc_pwd = result
        else:
            return

        # Test 2: Get staff
        test_get_staff()

        # Test 3: Create patient
        patient_id, patient_pwd = test_create_patient()

        # Test 4: Get patients
        test_get_patients()

        # Test 5: Login and password change
        if fls_id and fls_pwd:
            test_login_and_password_change(fls_id, fls_pwd, "Frontline Staff")

        if doc_id and doc_pwd:
            test_login_and_password_change(
                doc_id, doc_pwd, "Clinical Specialist")

        if patient_id and patient_pwd:
            test_login_and_password_change(patient_id, patient_pwd, "Patient")

        # Test 6: Error handling
        test_error_handling()

        print("\n" + "="*60)
        print("  ALL TESTS COMPLETED")
        print("="*60 + "\n")

    except Exception as e:
        print(f"\n✗ Test suite error: {e}\n")


if __name__ == "__main__":
    run_all_tests()
