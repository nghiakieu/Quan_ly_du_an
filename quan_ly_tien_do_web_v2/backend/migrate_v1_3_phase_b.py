"""
Migration v1.3 Phase B: Create project_users table for project-level permissions.
"""
import sqlite3

def migrate():
    conn = sqlite3.connect('sql_app.db')
    cursor = conn.cursor()

    # Create project_users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS project_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT DEFAULT 'viewer',
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id, user_id)
        )
    """)
    print("[OK] Created table 'project_users'.")

    # Seed: Add admin user to existing project as manager
    cursor.execute("SELECT id FROM projects LIMIT 1")
    project = cursor.fetchone()
    cursor.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")
    admin = cursor.fetchone()

    if project and admin:
        cursor.execute("""
            INSERT OR IGNORE INTO project_users (project_id, user_id, role)
            VALUES (?, ?, 'manager')
        """, (project[0], admin[0]))
        print(f"[OK] Added admin (ID={admin[0]}) as manager of project (ID={project[0]}).")

    conn.commit()
    conn.close()
    print("\n--- Migration v1.3 Phase B completed ---")

if __name__ == '__main__':
    migrate()
