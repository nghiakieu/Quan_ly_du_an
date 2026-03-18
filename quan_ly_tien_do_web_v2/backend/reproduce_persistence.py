
import requests
import json

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
ADMIN_USER = "NghiaKieu"
ADMIN_PASS = "005f39b0ae76a382ca2b12e9c8afe515"

def test_persistence():
    # 1. Login
    print("Logging in...")
    resp = requests.post(f"{BASE_URL}/auth/login/access-token", data={
        "username": ADMIN_USER,
        "password": ADMIN_PASS
    })
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        return
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get latest diagram
    print("Fetching latest diagram...")
    resp = requests.get(f"{BASE_URL}/diagrams/latest", headers=headers)
    if resp.status_code != 200:
        print(f"Failed to fetch latest diagram: {resp.text}")
        return
    
    diagram = resp.json()
    d_id = diagram["id"]
    print(f"Testing with Diagram ID: {d_id}, Current Name: {diagram['name']}")
    
    # Check if boq_data exists in initial response
    if "boq_data" in diagram:
        print(f"Initial boq_data found, length: {len(diagram['boq_data'])}")
    else:
        print("WARNING: Initial boq_data MISSING from response schema!")

    # 3. Update diagram with test data
    test_objects = json.dumps([{"id": "test_obj", "type": "rectangle", "x": 100, "y": 100}])
    test_boq = json.dumps([{"id": "test_item", "name": "Test Work", "unit": "m", "designQty": 10, "unitPrice": 5000}])
    
    print(f"Updating Diagram {d_id}...")
    update_payload = {
        "objects": test_objects,
        "boq_data": test_boq
    }
    
    resp = requests.put(f"{BASE_URL}/diagrams/{d_id}", json=update_payload, headers=headers)
    if resp.status_code != 200:
        print(f"Update failed: {resp.text}")
        return
    
    print("Update success message received.")

    # 4. Fetch again to verify persistence
    print("Fetching diagram again to verify persistence...")
    resp = requests.get(f"{BASE_URL}/diagrams/{d_id}", headers=headers)
    final_diagram = resp.json()
    
    # Verify objects
    if final_diagram.get("objects") == test_objects:
        print("SUCCESS: Objects persisted correctly.")
    else:
        print(f"FAILURE: Objects reverted! Expected: {test_objects[:50]}..., Got: {final_diagram.get('objects', '')[:50]}...")

    # Verify boq_data
    if "boq_data" in final_diagram:
        print(f"Final boq_data length: {len(final_diagram['boq_data'])}")
        # Note: The backend reconstructs boq_data from BOQItem table, so it might not match the string exactly
    else:
        print("FAILURE: boq_data MISSING from final response schema!")

if __name__ == "__main__":
    test_persistence()
