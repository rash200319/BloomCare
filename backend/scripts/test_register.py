import http.client
import json

conn = http.client.HTTPConnection('127.0.0.1', 8001)
payload = json.dumps({
    "email": "staff1@example.com",
    "password": "rash2003",
    "full_name": "Staff One",
    "role": "FRONTLINE_STAFF"
})
headers = {"Content-Type": "application/json"}
conn.request('POST', '/api/v1/auth/register', payload, headers)
res = conn.getresponse()
print(res.status)
print(res.read().decode())
