import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

try:
    # 1. Login
    req1 = urllib.request.Request(
        'http://127.0.0.1:8002/api/v1/auth/login/access-token', 
        method='POST', 
        data=b'username=admin&password=admin123', 
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    res1 = urllib.request.urlopen(req1)
    token = json.loads(res1.read())['access_token']
    print("Token fetched")

    # 2. PUT
    req2 = urllib.request.Request(
        'http://127.0.0.1:8002/api/v1/diagrams/1', 
        method='PUT', 
        data=json.dumps({"name": "a", "objects": "[]", "boq_data": "[]"}).encode(), 
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    res2 = urllib.request.urlopen(req2)
    print("Status:", res2.status)
    print("Response:", res2.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.read().decode())
except Exception as e:
    print("Error:", e)
