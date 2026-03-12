import os

path = 'c:/Users/KTTC CAU - NGHIA/Quan_ly_tien_do/quan_ly_tien_do_web_v2/backend/app/models/diagram.py'
try:
    with open(path, 'rb') as f:
        data = f.read()
    print(f"File size: {len(data)} bytes")
    print(f"First 10 bytes: {data[:10].hex()}")
    
    # Try different encodings
    for encoding in ['utf-8', 'utf-16', 'utf-16le', 'utf-16be', 'cp1252']:
        try:
            content = data.decode(encoding)
            print(f"\n--- Decoded with {encoding} ---")
            print(content[:500]) # First 500 chars
            if 'boq_data' in content:
                print(f"Found 'boq_data' in {encoding} decoding!")
            break
        except:
            continue
except Exception as e:
    print(f"Error: {e}")
