"""
Seed script v1.3: Create sample project CLLS with Cau Thach Han diagram.
Uses existing diagram data (ID=1) which contains the real BOQ and objects.
"""
import sqlite3

def seed_v1_3():
    conn = sqlite3.connect('sql_app.db')
    cursor = conn.cursor()
    
    # 1. Clean up old test projects
    cursor.execute("DELETE FROM projects")
    print("[CLEAN] Removed old test projects.")
    
    # 2. Create the CLLS project
    cursor.execute("""
        INSERT INTO projects (name, description, investor, status, manager_id, total_budget)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        "Gói XL1: Mở rộng cao tốc Cam Lộ - La Sơn",
        "Dự án mở rộng đường cao tốc đoạn Cam Lộ - La Sơn từ 2 làn lên 4 làn xe",
        "Ban QLDA Đường Hồ Chí Minh",
        "active",
        1,  # admin user
        500000000000  # 500 ty VND
    ))
    project_id = cursor.lastrowid
    print(f"[OK] Created project 'Goi XL1: CLLS' (ID={project_id})")
    
    # 3. Link existing diagram ID=1 (has real data) to this project
    # First rename it properly
    cursor.execute("""
        UPDATE diagrams SET 
            name = ?,
            description = ?,
            project_id = ?
        WHERE id = 1
    """, (
        "Cầu Thạch Hãn - Km19+950",
        "Sơ đồ thi công cầu Thạch Hãn tại Km19+950",
        project_id
    ))
    print(f"[OK] Linked Diagram ID=1 as 'Cau Thach Han' to project ID={project_id}")
    
    # 4. Clean up orphan diagram ID=3 (empty data)
    cursor.execute("DELETE FROM diagrams WHERE id = 3")
    print("[CLEAN] Removed empty diagram ID=3.")
    
    conn.commit()
    
    # Verify
    cursor.execute("SELECT id, name, project_id FROM diagrams WHERE project_id = ?", (project_id,))
    rows = cursor.fetchall()
    print(f"\n--- Verification ---")
    print(f"Project ID={project_id}: {len(rows)} diagram(s)")
    for r in rows:
        print(f"  Diagram ID={r[0]}: {r[1]} (project_id={r[2]})")
    
    conn.close()
    print("\n--- Seed v1.3 completed ---")

if __name__ == '__main__':
    seed_v1_3()
