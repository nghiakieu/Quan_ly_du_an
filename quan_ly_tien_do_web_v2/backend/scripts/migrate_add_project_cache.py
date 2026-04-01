"""
Migration: Add cached_completed_value and cached_plan_value columns to projects table.
Also recalculates all cached values for existing projects.

Run: python scripts/migrate_add_project_cache.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from app.db.database import engine, SessionLocal
from app.utils.progress_cache import recalculate_diagram_progress, recalculate_project_progress
from app.models.project import Project
from app.models.diagram import Diagram

def migrate():
    """Add missing cached columns and recalculate all cached values."""
    
    with engine.connect() as conn:
        # Check and add cached_completed_value column
        try:
            conn.execute(text("SELECT cached_completed_value FROM projects LIMIT 1"))
            print("[OK] Column 'cached_completed_value' already exists")
        except Exception:
            conn.execute(text("ALTER TABLE projects ADD COLUMN cached_completed_value FLOAT"))
            conn.commit()
            print("[ADDED] Column 'cached_completed_value' to projects")
        
        # Check and add cached_plan_value column
        try:
            conn.execute(text("SELECT cached_plan_value FROM projects LIMIT 1"))
            print("[OK] Column 'cached_plan_value' already exists")
        except Exception:
            conn.execute(text("ALTER TABLE projects ADD COLUMN cached_plan_value FLOAT"))
            conn.commit()
            print("[ADDED] Column 'cached_plan_value' to projects")
    
    # Recalculate all cached values
    db = SessionLocal()
    try:
        diagrams = db.query(Diagram).all()
        print(f"\nRecalculating {len(diagrams)} diagrams...")
        for d in diagrams:
            recalculate_diagram_progress(db, d.id)
            print(f"  [OK] Diagram {d.id}: {d.name}")
        
        projects = db.query(Project).all()
        print(f"\nRecalculating {len(projects)} projects...")
        for p in projects:
            recalculate_project_progress(db, p.id)
            print(f"  [OK] Project {p.id}: {p.name} -> {p.cached_progress_percent}% | completed={p.cached_completed_value} | plan={p.cached_plan_value}")
        
        print("\n✅ Migration complete!")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
