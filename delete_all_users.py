"""
Xóa toàn bộ users dùng TRUNCATE CASCADE.
Chạy: python delete_all_users.py
"""
import sys
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres.owbbllnotrmxutvceahi:kieulinhnghia@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"

engine = create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT")

with engine.connect() as conn:
    result = conn.execute(text("SELECT id, username, email, role, is_active FROM users ORDER BY id"))
    users = result.fetchall()

    if not users:
        print("Khong co user nao trong DB.")
        engine.dispose()
        sys.exit(0)

    print(f"Tim thay {len(users)} user(s):")
    for u in users:
        print(f"  id={u[0]}, username={u[1]}, email={u[2]}, role={u[3]}, active={u[4]}")

    confirm = input(f"\nXOA HET {len(users)} tai khoan? (go 'yes' de xac nhan): ")
    if confirm.strip().lower() == 'yes':
        # TRUNCATE CASCADE xóa toàn bộ và reset FK
        conn.execute(text("TRUNCATE TABLE users CASCADE"))
        print("Da xoa toan bo tai khoan!")
        print("Bay gio hay vao trang web -> Dang ky -> tai khoan dau tien se la ADMIN tu dong.")
    else:
        print("Da huy.")

engine.dispose()
