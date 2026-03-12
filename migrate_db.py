"""
Script migration đơn giản - chạy trực tiếp không cần import app.
"""
import psycopg2

# Connection string từ backend/.env
DATABASE_URL = "postgresql://postgres.owbbllnotrmxutvceahi:kieulinhnghia@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"

SQL_COMMANDS = [
    # diagrams table
    "ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS cached_progress_percent FLOAT",
    "ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS cached_target_value FLOAT",
    "ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS cached_completed_value FLOAT",
    # projects table
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS investor VARCHAR",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_budget FLOAT",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS map_url VARCHAR",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS drive_url VARCHAR",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS sheet_url VARCHAR",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS boq_data TEXT",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id)",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS cached_progress_percent FLOAT",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS cached_completed_value FLOAT",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS cached_total_diagrams INTEGER",
    # boqitem table - check table name
    "ALTER TABLE boqitem ADD COLUMN IF NOT EXISTS plan_qty FLOAT",
    'ALTER TABLE boqitem ADD COLUMN IF NOT EXISTS "order" INTEGER',
    "ALTER TABLE boqitem ADD COLUMN IF NOT EXISTS external_id VARCHAR",
]

def main():
    print("=== Database Migration Script ===\n")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()
        print(f"Connected to database OK!\n")
        
        for sql in SQL_COMMANDS:
            try:
                cur.execute(sql)
                print(f"  [OK] {sql[:80]}...")
            except Exception as e:
                err = str(e).strip()
                if 'already exists' in err:
                    print(f"  [=] Column already exists: {sql[:60]}")
                else:
                    print(f"  [ERROR] {sql[:60]}: {err}")
        
        # Test query
        print("\n--- Testing query ---")
        cur.execute("SELECT id, name FROM projects LIMIT 3")
        rows = cur.fetchall()
        print(f"  Projects found: {len(rows)}")
        for r in rows:
            print(f"  - {r}")
            
        cur.close()
        conn.close()
        print("\n=== Migration Complete ===")
        
    except Exception as e:
        print(f"Connection error: {e}")

if __name__ == "__main__":
    main()
