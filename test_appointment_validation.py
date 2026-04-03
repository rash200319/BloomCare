import requests
import json
from datetime import datetime, timedelta

base_url = 'http://localhost:8005/api/v1/appointments/by-nic'
future_date = (datetime.now() + timedelta(days=30)
               ).strftime('%Y-%m-%dT10:30:00')

# Test 1: Invalid patient NIC
print("Test 1: Invalid Patient NIC")
response = requests.post(base_url, json={
    'patient_nic': 'INVALID-NIC-999',
    'patient_full_name': 'm2',
    'specialist_name': 'doc1',
    'appointment_date': future_date,
})
print(f"  Status: {response.status_code}")
if response.status_code != 201:
    print(f"  Error: {response.json()['detail']}")

# Test 2: Patient name mismatch
print("\nTest 2: Patient Name Mismatch")
response = requests.post(base_url, json={
    'patient_nic': '200052000660',
    'patient_full_name': 'Wrong Name',
    'specialist_name': 'doc1',
    'appointment_date': future_date,
})
print(f"  Status: {response.status_code}")
if response.status_code != 201:
    print(f"  Error: {response.json()['detail']}")

# Test 3: Invalid specialist
print("\nTest 3: Invalid Specialist")
response = requests.post(base_url, json={
    'patient_nic': '200052000660',
    'patient_full_name': 'm2',
    'specialist_name': 'Dr. NonExistent',
    'appointment_date': future_date,
})
print(f"  Status: {response.status_code}")
if response.status_code != 201:
    print(f"  Error: {response.json()['detail']}")

# Test 4: Past appointment date
print("\nTest 4: Past Appointment Date")
past_date = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%dT10:30:00')
response = requests.post(base_url, json={
    'patient_nic': '200052000660',
    'patient_full_name': 'm2',
    'specialist_name': 'doc1',
    'appointment_date': past_date,
})
print(f"  Status: {response.status_code}")
if response.status_code != 201:
    print(f"  Error: {response.json()['detail']}")

print("\n✓ All validation tests completed!")
