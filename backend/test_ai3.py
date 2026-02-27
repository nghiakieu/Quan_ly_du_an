import requests

url = "http://localhost:8002/api/v1/ai/chat"

# Try multiple IDs to find a valid project
found = False
for i in range(1, 10):
    print(f"\n--- Testing Project ID {i} ---")
    chat_data = {"project_id": i, "message": "hello test"}
    
    chat_r = requests.post(url, json=chat_data)
    if chat_r.status_code != 404:
        found = True
        print(f"Status: {chat_r.status_code}")
        print(f"Response: {chat_r.text}")
        if chat_r.status_code == 500:
            print("Found 500 error, please check the uvicorn terminal or this response.")
        break

if not found:
    print("Could not find any valid project ID from 1 to 9.")
