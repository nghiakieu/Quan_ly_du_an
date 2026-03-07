import sqlite3

def upgrade_db():
    conn = sqlite3.connect('sql_app.db')
    cursor = conn.cursor()
    
    # Create projects table
    try:
        cursor.execute('''
        CREATE TABLE projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR,
            description VARCHAR,
            manager_id INTEGER,
            status VARCHAR DEFAULT 'planning',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (manager_id) REFERENCES users (id)
        )
        ''')
        print("Tạo bảng projects thành công.")
    except Exception as e:
        print(f"Lỗi tạo bảng projects (Có thể đã tồn tại): {e}")

    # Add project_id to diagrams
    try:
        cursor.execute('''
        ALTER TABLE diagrams ADD COLUMN project_id INTEGER REFERENCES projects(id)
        ''')
        print("Tạo cột project_id thành công.")
    except Exception as e:
        print(f"Lỗi tạo cột project_id (Có thể đã tồn tại): {e}")
        
    conn.commit()
    conn.close()

if __name__ == '__main__':
    upgrade_db()
