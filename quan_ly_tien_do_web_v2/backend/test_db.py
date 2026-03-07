import os
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError

# Load URL from .env (in this simple test we just read it directly for speed)
# Replace with the actual URL from your .env file including the new password
# For example: 
# DATABASE_URL = "postgresql://postgres.owbbllnotrmxutvceahi:QuanLyTienDo12345@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"

def test_connection():
    # Attempt to read from .env file
    db_url = None
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    try:
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('SQLALCHEMY_DATABASE_URI='):
                    db_url = line.strip().split('=', 1)[1]
                    break
    except Exception as e:
        print(f"Lỗi đọc file {env_path}: {e}")
        return

    if not db_url:
        print("Không tìm thấy SQLALCHEMY_DATABASE_URI trong .env")
        return

    print("Đang thử kết nối tới:", db_url.replace(db_url.split('@')[0].split(':')[2], '***'))

    try:
        engine = create_engine(db_url)
        # Try to connect
        with engine.connect() as connection:
            print("\n✅ KẾT NỐI THÀNH CÔNG! Mật khẩu và đường dẫn đã cấu hình ĐÚNG.")
            print("Vui lòng nhắn lại cho trợ lý là 'Đã kết nối thành công' để tiếp tục.")
    except OperationalError as e:
        print("\n❌ KẾT NỐI THẤT BẠI!")
        print(f"Chi tiết lỗi: {e.orig}")
        print("\nHãy kiểm tra lại:")
        print("1. Mật khẩu đã gõ chính xác chưa? (Không chứa ký tự đặc biệt như [] hay @, /)")
        print("2. URL đã dùng chuẩn Connection Pooling của IPv4 chưa?")
    except Exception as e:
         print(f"Lỗi khác: {e}")

if __name__ == "__main__":
    test_connection()
