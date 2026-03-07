import requests

base_url = "http://localhost:8002/api/v1"

# Login
login_data = {
    "username": "admin",
    "password": "password"  # Replace if you know default password or use another way
}
res = requests.post(f"{base_url}/auth/login/access-token", data=login_data)
if res.status_code == 200:
    token = res.json().get("access_token")
    print(f"Token: {token[:10]}...")

    # Call AI chat
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    data = {"project_id": 1, "message": "hello"}
    res2 = requests.post(f"{base_url}/ai/chat", json=data, headers=headers)
    print(f"Status: {res2.status_code}")
    print(f"Text: {res2.text}")
else:
    print(f"Login failed: {res.text}")
