import sqlite3
import json
import os

db_path = "backend/sql_app.db" # Cần xác định đường dẫn đúng

if not os.path.exists(db_path):
    # Thử tìm trong thư mục backend
    db_path = "quan_ly_tien_do_web_v2/backend/sql_app.db"

print(f"Checking database at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name, objects, project_id FROM diagrams")
    rows = cursor.fetchall()
    
    print(f"Found {len(rows)} diagrams:")
    for row in rows:
        d_id, name, objects, p_id = row
        obj_len = len(json.loads(objects or '[]'))
        print(f"ID: {d_id} | Name: {name} | Objects: {obj_len} items | ProjectID: {p_id}")
        if obj_len == 0:
            print(f"  WARNING: Diagram {d_id} is EMPTY!")
            
    conn.close()
except Exception as e:
    print(f"Error: {e}")
