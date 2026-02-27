import requests

url = "http://localhost:8002/api/v1/auth/login/access-token"
data = {"username": "admin", "password": "password"}
r = requests.post(url, data=data)
if r.status_code == 200:
    token = r.json()["access_token"]
    
    # Try multiple IDs to find a valid project
    for i in range(1, 10):
        print(f"\n--- Testing Project ID {i} ---")
        chat_url = "http://localhost:8002/api/v1/ai/chat"
        headers = {"Authorization": f"Bearer {token}"}
        chat_data = {"project_id": i, "message": "hello"}
        
        chat_r = requests.post(chat_url, json=chat_data, headers=headers)
        if chat_r.status_code != 404:
            print(f"Status: {chat_r.status_code}")
            print(f"Response: {chat_r.text}")
            break
else:
    print("Login fail")
