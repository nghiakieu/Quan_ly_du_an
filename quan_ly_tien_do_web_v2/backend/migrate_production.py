"""
Migration script: Add missing v1.3 columns to projects table on production.
Run this on Render Shell: python migrate_production.py
"""
import os
import sys

# Try to use the app's database connection
try:
    from app.db.database import engine
    from sqlalchemy import text

    def run_migration():
        statements = [
            # Add investor column
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS investor TEXT",
            # Add total_budget column
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_budget FLOAT",
            # Add start_date column
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ",
            # Add end_date column
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ",
            # Add manager_id (FK to users)
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
            # Add status column
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'planning'",
            # Create project_users table
            """CREATE TABLE IF NOT EXISTS project_users (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role VARCHAR DEFAULT 'viewer',
                added_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(project_id, user_id)
            )""",
            # Create tasks table
            """CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                status VARCHAR DEFAULT 'todo',
                priority VARCHAR DEFAULT 'medium',
                assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )""",
        ]

        with engine.connect() as conn:
            for stmt in statements:
                try:
                    conn.execute(text(stmt))
                    print(f"✅ OK: {stmt[:60]}...")
                except Exception as e:
                    print(f"⚠️  Skip (may already exist): {e}")
            conn.commit()
        print("\n🎉 Migration completed!")

    run_migration()

except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
