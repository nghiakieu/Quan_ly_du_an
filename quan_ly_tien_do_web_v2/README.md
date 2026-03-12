## Quản lý Tiến độ Xây dựng V2

Hệ thống quản lý tiến độ / khối lượng xây dựng với:

- **Backend**: `FastAPI` + `SQLAlchemy`, hỗ trợ WebSocket, Auth, Projects/Tasks/Diagrams, AI.
- **Frontend**: `Next.js 16` + `React 19` + `Tailwind CSS v4`, biểu đồ `recharts`, upload Excel.

### Cấu trúc chính

- **backend/**: API FastAPI, models, schemas, migrations script, WebSocket, AI.
- **frontend/**: Ứng dụng Next.js (app router), UI quản lý dự án và tiến độ.

### Yêu cầu môi trường

- **Python**: 3.11+ (khuyến nghị cùng bản dùng để phát triển ban đầu).
- **Node.js**: 20+ (tương thích Next 16 / React 19).
- **CSDL**:
  - Dev: dùng `SQLite` (mặc định).
  - Prod: nên chuyển sang `PostgreSQL`.

### Chạy Backend (dev)

```bash
cd backend

# Tạo và kích hoạt virtualenv (Windows)
python -m venv .venv
.venv\Scripts\activate

# Cài dependencies
pip install -r requirements.txt

# Tạo file cấu hình
copy .env.example .env  # Windows
# Sau đó mở .env và chỉnh:
# - SQLALCHEMY_DATABASE_URI (SQLite hoặc PostgreSQL)
# - SECRET_KEY
# - BACKEND_CORS_ORIGINS
# - GEMINI_API_KEY (nếu dùng AI)

# Chạy server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: truy cập `http://localhost:8000/docs`.

### Chạy Frontend (dev)

```bash
cd frontend

# Cài dependencies
npm install

# Chạy dev server (port 3002)
npm run dev -- -p 3002
```

Web app: truy cập `http://localhost:3002`.

