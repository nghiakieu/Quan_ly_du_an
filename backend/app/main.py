from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.api.api_v1.api import api_router
from app.core.config import settings
from app.api.ws_manager import manager
from app.db.database import engine, Base
# Import all models so Base.metadata includes them
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Auto-migration on startup:
    1. Create any missing tables (tasks, project_users, etc.)
    2. Add missing columns to existing tables (ALTER TABLE IF NOT EXISTS)
    """
    from sqlalchemy import text

    # Step 1: Create all missing tables
    Base.metadata.create_all(bind=engine, checkfirst=True)

    # Step 2: ALTER TABLE - add missing v1.3 columns to projects (safe IF NOT EXISTS)
    alter_statements = [
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS investor TEXT",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_budget FLOAT",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'planning'",
        "ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expire TIMESTAMPTZ",
    ]

    try:
        with engine.connect() as conn:
            for stmt in alter_statements:
                try:
                    conn.execute(text(stmt))
                except Exception:
                    pass  # Column already exists or unsupported - skip silently
            conn.commit()
    except Exception:
        pass  # SQLite (local dev) doesn't support IF NOT EXISTS for columns - skip

    # Step 3: Create Default Admin Account if not exists
    from app.db.database import SessionLocal
    from app.models.user import User as UserModel
    from app.core.security import get_password_hash
    
    db = SessionLocal()
    try:
        existing_nghia = db.query(UserModel).filter(UserModel.username == "NghiaKieu").first()
        if not existing_nghia:
            print("[Startup] Khởi tạo tài khoản Admin mặc định (kieulinhnghia@gmail.com)")
            default_admin = UserModel(
                username="NghiaKieu",
                email="kieulinhnghia@gmail.com",
                hashed_password=get_password_hash("kieulinhnghia"),
                role="admin",
                is_active=True
            )
            db.add(default_admin)
            db.commit()
    except Exception as e:
        print(f"[Startup] Lỗi khởi tạo tk Admin: {e}")
    finally:
        db.close()

    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,  # Already a list of strings
        allow_credentials=False, # Must be False when allow_origins is ["*"]
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": "Welcome to Quan Ly Du An API"}

@app.websocket("/api/v1/diagrams/ws/{diagram_id}")
async def websocket_diagram_endpoint(websocket: WebSocket, diagram_id: str):
    """
    Kênh WebSocket cho Client.
    Đưa trực tiếp vào main.py để tránh lỗi 404 do APIRouter prefix chặn connection.
    """
    await manager.connect(diagram_id, websocket)
    try:
        while True:
            data = await websocket.receive_text() 
    except WebSocketDisconnect:
        manager.disconnect(diagram_id, websocket)
