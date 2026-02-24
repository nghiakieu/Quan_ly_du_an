import urllib.request
import json

req = urllib.request.Request('http://127.0.0.1:8002/api/v1/diagrams/')
res = urllib.request.urlopen(req)
data = json.loads(res.read())

print(f"Total diagrams: {len(data)}")
for d in data:
    obj_len = len(d.get("objects", "") or "")
    print(f"ID: {d['id']}, Name: {d['name']}, Objects Length: {obj_len}")
