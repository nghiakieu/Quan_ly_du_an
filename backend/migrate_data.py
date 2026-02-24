import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Đảm bảo import được các module trong app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from app.models.diagram import Diagram
from app.models.block import Block

def migrate_data():
    # 1. Kết nối cơ sở dữ liệu cũ (SQLite)
    sqlite_url = "sqlite:///./sql_app.db"
    sqlite_engine = create_engine(sqlite_url)
    SqliteSession = sessionmaker(bind=sqlite_engine)
    sqlite_session = SqliteSession()

    # 2. Kết nối cơ sở dữ liệu mới (Postgres)
    postgres_url = os.environ.get("SQLALCHEMY_DATABASE_URI")
    if not postgres_url:
        print("❌ POSTGRES_URL không tìm thấy trong file .env")
        return

    pg_engine = create_engine(postgres_url)
    PgSession = sessionmaker(bind=pg_engine)
    pg_session = PgSession()

    try:
        print("🔄 Đang bắt đầu di chuyển dữ liệu...")

        # 3. Di chuyển bảng Sơ đồ (Diagrams)
        diagrams_count = 0
        diagrams = sqlite_session.query(Diagram).all()
        for d in diagrams:
            # Copy toàn bộ data field chuyển thành dictionary
            data = {c.name: getattr(d, c.name) for c in d.__table__.columns}
            # Sử dụng merge để nếu ID đã tồn tại thì ghi đè, chưa thì tạo mới
            pg_session.merge(Diagram(**data))
            diagrams_count += 1
        pg_session.commit()
        print(f"✅ Đã di chuyển thành công {diagrams_count} sơ đồ (Diagrams).")

        # 4. Di chuyển bảng Khối lượng (Blocks)
        blocks_count = 0
        blocks = sqlite_session.query(Block).all()
        for b in blocks:
            data = {c.name: getattr(b, c.name) for c in b.__table__.columns}
            pg_session.merge(Block(**data))
            blocks_count += 1
        pg_session.commit()
        print(f"✅ Đã di chuyển thành công {blocks_count} khối đối tượng (Blocks).")

        print("🎉 QUÁ TRÌNH DI CHUYỂN DỮ LIỆU ĐÃ HOÀN TẤT TRỌN VẸN!")

    except Exception as e:
        pg_session.rollback()
        print(f"❌ Có lỗi xảy ra trong quá trình di chuyển: {e}")
    finally:
        sqlite_session.close()
        pg_session.close()

if __name__ == "__main__":
    migrate_data()
