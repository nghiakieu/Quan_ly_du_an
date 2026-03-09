import sqlite3
import os

db_path = "sql_app.db"

def upgrade_db():
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA table_info(projects)")
    columns = [info[1] for info in cursor.fetchall()]
    
    if "sheet_url" not in columns:
        cursor.execute("ALTER TABLE projects ADD COLUMN sheet_url VARCHAR")
        print("Added sheet_url column to projects.")
    else:
        print("Column sheet_url already exists.")

    conn.commit()
    conn.close()
    print("Database upgrade completed successfully.")

if __name__ == "__main__":
    upgrade_db()
