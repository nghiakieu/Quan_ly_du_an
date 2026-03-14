"""
Script kiểm tra nhanh dữ liệu dự án
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.project import Project

def verify():
    db = SessionLocal()
    try:
        project_count = db.query(Project).count()
        print(f"Success! Found {project_count} projects in database.")
        
        # Check first project
        first_project = db.query(Project).first()
        if first_project:
            print(f"Project name: {first_project.name}")
            print(f"Cached Plan Value: {first_project.cached_plan_value}")
            print(f"Cached Completed Value: {first_project.cached_completed_value}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify()
