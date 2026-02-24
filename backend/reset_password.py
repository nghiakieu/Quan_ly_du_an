import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.user import User
from sqlalchemy import text
from app.core.security import get_password_hash

def reset_admin_password():
    db = SessionLocal()
    try:
        # Hash mới sinh ra từ thư viện bcrypt thuần (nằm trong security.py)
        new_hash = get_password_hash("admin123")
        
        # Cập nhật bằng Raw SQL:
        result = db.execute(
            text("UPDATE users SET hashed_password = :hash WHERE username = 'admin'"),
            {"hash": new_hash}
        )
        db.commit()
        print("Đã đặt lại mật khẩu thành công bằng SQL Raw cho admin: 'admin123'")
    except Exception as e:
        print(f"Lỗi: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_admin_password()
