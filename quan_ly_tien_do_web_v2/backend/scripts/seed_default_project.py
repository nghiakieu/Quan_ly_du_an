import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Add app directory to sys path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.project import Project
from app.models.diagram import Diagram

def seed():
    db = SessionLocal()
    try:
        # Create or Get Project "Gói XL1"
        prj = db.query(Project).filter(Project.name.like("%Gói XL1%")).first()
        if not prj:
            prj = Project(
                name="Gói XL1: Mở rộng cao tốc Cam Lộ La Sơn", 
                description="Dự án điểm - tự động update", 
                status="Active", 
                manager_id=1
            )
            db.add(prj)
            db.commit()
            db.refresh(prj)

        # Update all existing diagrams (Cầu Thạch Hãn) to attach to this project
        diagrams = db.query(Diagram).all()
        for d in diagrams:
            d.project_id = prj.id
            d.name = "Cầu Thạch Hãn - Km19+950"
            if not d.description:
                d.description = "Bản đồ tự động gán lúc Migration"
            db.add(d)
        
        db.commit()
        print("Đã cập nhật cấu trúc DB thành công!")
    except Exception as e:
        print(f"Lỗi: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
