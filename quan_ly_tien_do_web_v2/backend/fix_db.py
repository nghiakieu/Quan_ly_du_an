from app.db.database import SessionLocal
from app.models.diagram import Diagram

db = SessionLocal()

diag2 = db.query(Diagram).filter(Diagram.id == 2).first()
diag1 = db.query(Diagram).filter(Diagram.id == 1).first()

if diag2 and diag1:
    diag1.objects = diag2.objects
    diag1.boq_data = diag2.boq_data
    diag1.name = diag2.name
    db.commit()
    print("Restore completely! Reload browser")
else:
    print("Cannot find diagram 1 or 2")
