import sys

log_path = 'c:/Users/KTTC CAU - NGHIA/Quan_ly_tien_do/quan_ly_tien_do_web_v2/backend/error_log.txt'
try:
    with open(log_path, 'rb') as f:
        data = f.read()
        
    # Find the last traceback
    content = data.decode('utf-8', errors='replace')
    parts = content.split('Traceback (most recent call last):')
    if len(parts) > 1:
        print("Last Traceback found:")
        print("Traceback (most recent call last):" + parts[-1])
    else:
        print("No traceback found in last chunk. Last 1000 characters:")
        print(content[-1000:])
except Exception as e:
    print(f"Error: {e}")
