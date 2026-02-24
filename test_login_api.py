import requests

url = "http://localhost:8002/api/v1/auth/login/access-token"
data = {"username": "admin", "password": "admin123"}
headers = {"Content-Type": "application/x-www-form-urlencoded"}

try:
    response = requests.post(url, data=data, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Lỗi kết nối: {e}")
