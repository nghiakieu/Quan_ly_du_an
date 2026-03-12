import sys
import os
from sqlalchemy.orm import Session, joinedload, defer

# Add app to path
sys.path.insert(0, os.path.abspath('.'))

from app.db.database import SessionLocal, engine
from app import models

def test_query():
    db = SessionLocal()
    try:
        print("Testing query from projects.py...")
        query = db.query(models.Project).options(
            defer(models.Project.boq_data),
            joinedload(models.Project.diagrams).defer(models.Diagram.objects)
        )
        projects = query.offset(0).limit(100).all()
        print(f"Success! Found {len(projects)} projects.")
    except Exception as e:
        print(f"FAILED: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_query()
