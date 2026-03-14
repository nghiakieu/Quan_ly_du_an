"""
Script migration v1.5: Thêm đầy đủ các cột cache vào bảng projects và diagrams
Chạy lệnh: python scripts/migrate_v1_5_charts.py
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
            # Use ALTER TABLE for SQLite or Postgres
            print(f"  [*] Adding {table_name}.{column_name}...")
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))
            print(f"  [+] Added {table_name}.{column_name}")
        else:
            print(f"  [=] {table_name}.{column_name} already exists")
    except Exception as e:
        print(f"  [!] Error adding {table_name}.{column_name}: {e}")

def run_migrations():
    print("=== Running Comprehensive Database Migrations (Cache Columns) ===\n")
    
    with engine.connect() as conn:
        # migrations for 'diagrams' table
        print("[diagrams table]")
        add_column_if_not_exists(conn, "diagrams", "cached_progress_percent", "FLOAT")
        add_column_if_not_exists(conn, "diagrams", "cached_target_value", "FLOAT")
        add_column_if_not_exists(conn, "diagrams", "cached_completed_value", "FLOAT")
        add_column_if_not_exists(conn, "diagrams", "cached_plan_value", "FLOAT")
        
        # migrations for 'projects' table
        print("\n[projects table]")
        add_column_if_not_exists(conn, "projects", "cached_progress_percent", "FLOAT")
        add_column_if_not_exists(conn, "projects", "cached_completed_value", "FLOAT")
        add_column_if_not_exists(conn, "projects", "cached_plan_value", "FLOAT")
        add_column_if_not_exists(conn, "projects", "cached_total_diagrams", "INTEGER")
        
        conn.commit()
        
    print("\n=== Migration Complete ===")
    
    # Recalculate progress to populate the new columns
    print("\n[Recalculating progress to populate new columns...]")
    try:
        from app.utils.progress_cache import recalculate_project_progress
        from app.models.project import Project
        db = SessionLocal()
        projects = db.query(Project).all()
        for project in projects:
            print(f"  [*] Recalculating progress for project: {project.name} (ID: {project.id})")
            try:
                recalculate_project_progress(db, project.id)
                print(f"  [OK] Done for project: {project.name}")
            except Exception as pe:
                print(f"  [!] Failed for project {project.id}: {pe}")
        db.close()
        print("\n[OK] Progress recalculation finished.")
    except Exception as e:
        print(f"  [ERROR] Progress recalculation setup failed: {e}")

if __name__ == "__main__":
    run_migrations()
