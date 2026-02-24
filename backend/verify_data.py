import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.diagram import Diagram
from app.models.block import Block

def verify():
    db = SessionLocal()
    try:
        diagrams_count = db.query(Diagram).count()
        blocks_count = db.query(Block).count()
        print(f"Kiểm tra trên Supabase: {diagrams_count} Diagrams, {blocks_count} Blocks.")
    except Exception as e:
        print(f"Lỗi: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify()
