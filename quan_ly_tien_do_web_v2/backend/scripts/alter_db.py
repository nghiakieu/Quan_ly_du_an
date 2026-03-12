import os
import sys
from dotenv import load_dotenv

load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.database import SessionLocal

import traceback

def alter_db():
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"))
        db.execute(text("ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS project_id INTEGER"))
        db.commit()
        print("Success alteration")
    except Exception as e:
        print("Error Alter DB:")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    alter_db()
