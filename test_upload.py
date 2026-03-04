import requests

# Test upload API
url = "http://localhost:8000/api/v1/blocks/upload"
files = {"file": open("Du_an_Mau_Test.xlsx", "rb")}

try:
    response = requests.post(url, files=files)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'response'):
        print(f"Response text: {e.response.text}")
