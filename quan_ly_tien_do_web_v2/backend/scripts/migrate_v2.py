"""
Script migration tự động: Thêm các cột còn thiếu vào database
Chạy lệnh: python scripts/migrate_v2.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from app.db.database import engine, SessionLocal

def add_column_if_not_exists(conn, table_name, column_name, column_type):
    """Add column to table if it doesn't exist."""
    try:
        insp = inspect(engine)
        existing_columns = [col['name'] for col in insp.get_columns(table_name)]
        if column_name not in existing_columns:
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_name} {column_type}"))
            print(f"  [+] Added {table_name}.{column_name}")
        else:
            print(f"  [=] {table_name}.{column_name} already exists")
    except Exception as e:
        print(f"  [!] Error adding {table_name}.{column_name}: {e}")

def run_migrations():
    print("=== Running Database Migrations ===\n")
    
    with engine.connect() as conn:
        # migrations for 'diagrams' table
        print("[diagrams table]")
        add_column_if_not_exists(conn, "diagrams", "cached_progress_percent", "FLOAT")
        add_column_if_not_exists(conn, "diagrams", "cached_target_value", "FLOAT")
        add_column_if_not_exists(conn, "diagrams", "cached_completed_value", "FLOAT")
        
        # migrations for 'projects' table
        print("\n[projects table]")
        add_column_if_not_exists(conn, "projects", "investor", "VARCHAR")
        add_column_if_not_exists(conn, "projects", "total_budget", "FLOAT")
        add_column_if_not_exists(conn, "projects", "start_date", "TIMESTAMPTZ")
        add_column_if_not_exists(conn, "projects", "end_date", "TIMESTAMPTZ")
        add_column_if_not_exists(conn, "projects", "map_url", "VARCHAR")
        add_column_if_not_exists(conn, "projects", "drive_url", "VARCHAR")
        add_column_if_not_exists(conn, "projects", "sheet_url", "VARCHAR")
        add_column_if_not_exists(conn, "projects", "boq_data", "TEXT")
        add_column_if_not_exists(conn, "projects", "manager_id", "INTEGER")
        add_column_if_not_exists(conn, "projects", "cached_progress_percent", "FLOAT")
        add_column_if_not_exists(conn, "projects", "cached_completed_value", "FLOAT")
        add_column_if_not_exists(conn, "projects", "cached_total_diagrams", "INTEGER")
        
        # migrations for 'boqitem' table
        print("\n[boqitem table]")
        add_column_if_not_exists(conn, "boqitem", "plan_qty", "FLOAT")
        add_column_if_not_exists(conn, "boqitem", "order", "INTEGER")
        add_column_if_not_exists(conn, "boqitem", "external_id", "VARCHAR")
        
        # migrations for 'users' table
        print("\n[users table]")
        add_column_if_not_exists(conn, "users", "is_active", "BOOLEAN DEFAULT TRUE")
        
        conn.commit()
        
    print("\n=== Migration Complete ===")
    
    # Test query
    print("\n[Testing /api/v1/projects/ query...]")
    try:
        from app import models
        from sqlalchemy.orm import joinedload
        from sqlalchemy import defer
        db = SessionLocal()
        projects = db.query(models.Project).options(
            defer(models.Project.boq_data),
            joinedload(models.Project.diagrams).defer(models.Diagram.objects)
        ).limit(5).all()
        print(f"  [OK] Query returned {len(projects)} projects")
        db.close()
    except Exception as e:
        print(f"  [ERROR] Query failed: {e}")

if __name__ == "__main__":
    from app import models  # noqa - ensure models registered
    from app.models.diagram import Diagram
    run_migrations()
