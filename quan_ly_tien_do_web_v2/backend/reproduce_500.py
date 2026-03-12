from app.db.database import SessionLocal, engine, Base
from app import models, schemas
from sqlalchemy.orm import joinedload, defer
import json
from pydantic import TypeAdapter
from typing import List

def reproduce():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("Executing Diagram query...")
        diagrams = db.query(models.Diagram).all()
        print(f"Successfully fetched {len(diagrams)} diagrams from DB.")
        
        if not diagrams:
            print("No diagrams found. Creating one...")
            p = db.query(models.Project).first()
            if not p:
                p = models.Project(name="Test Project")
                db.add(p)
                db.commit()
                db.refresh(p)
            d = models.Diagram(name="Test Diagram", project_id=p.id, boq_data="[]")
            db.add(d)
            db.commit()
            diagrams = [d]

        # Simulate FastAPI serialization into schemas.Diagram using Pydantic V2
        print("Simulating FastAPI serialization to List[schemas.Diagram]...")
        diag_adapter = TypeAdapter(List[schemas.Diagram])
        serialized_diags = diag_adapter.validate_python(diagrams, from_attributes=True)
        print(f"Successfully serialized {len(serialized_diags)} diagrams.")
        
        for d in serialized_diags:
            print(f"Diagram: {d.name}, boq_data: {d.boq_data[:50] if d.boq_data else 'None'}")
            
        print("\n--- Testing Project serialization ---")
        query = db.query(models.Project).options(
            defer(models.Project.boq_data),
            joinedload(models.Project.diagrams).defer(models.Diagram.objects)
        )
        projects = query.all()
        
        project_adapter = TypeAdapter(List[schemas.Project])
        serialized_projects = project_adapter.validate_python(projects, from_attributes=True)
        print(f"Successfully serialized {len(serialized_projects)} projects.")
        
    except Exception as e:
        print(f"\n[!!!] FAILED with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    reproduce()
