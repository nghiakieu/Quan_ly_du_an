import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def create_admin():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "admin").first()
        if user:
            print("Admin user already exists.")
            return

        user = User(
            email="admin@example.com",
            username="admin",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            is_active=True
        )
        db.add(user)
        db.commit()
        print("Created admin user: username='admin', password='admin123'")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
