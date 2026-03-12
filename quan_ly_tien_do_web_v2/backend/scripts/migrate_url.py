import sqlite3
import os

db_path = "sql_app.db"

def upgrade_db():
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Kiem tra xem cot map_url da ton tai chua
    cursor.execute("PRAGMA table_info(projects)")
    columns = [info[1] for info in cursor.fetchall()]
    
    added = False
    if "map_url" not in columns:
        cursor.execute("ALTER TABLE projects ADD COLUMN map_url VARCHAR")
        print("Adđed map_url column to projects.")
        added = True
    
    if "drive_url" not in columns:
        cursor.execute("ALTER TABLE projects ADD COLUMN drive_url VARCHAR")
        print("Adđed drive_url column to projects.")
        added = True
        
    if not added:
        print("Columns already exist.")

    conn.commit()
    conn.close()
    print("Database upgrade completed successfully.")

if __name__ == "__main__":
    upgrade_db()
