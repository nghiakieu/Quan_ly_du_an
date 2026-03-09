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

    # Step 2: ALTER TABLE - add missing columns (compatible with both SQLite and PostgreSQL)
    def safe_add_column(engine_inst, table, column, col_type, default=None):
        """Add a column if it doesn't already exist. Works for both SQLite and PostgreSQL."""
        try:
            from sqlalchemy import text as sa_text, inspect as sa_inspect
            inspector = sa_inspect(engine_inst)
            existing_cols = [c["name"] for c in inspector.get_columns(table)]
            if column not in existing_cols:
                default_clause = f" DEFAULT {default}" if default else ""
                with engine_inst.begin() as conn:
                    conn.execute(sa_text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}{default_clause}"))
                    print(f"[Migration] Added column {column} to {table}")
        except Exception as e:
            print(f"[Migration] Skipped adding {column} to {table}: {e}")

    try:
        # Projects table
        safe_add_column(engine, "projects", "investor", "TEXT")
        safe_add_column(engine, "projects", "total_budget", "FLOAT")
        safe_add_column(engine, "projects", "start_date", "TIMESTAMP")
        safe_add_column(engine, "projects", "end_date", "TIMESTAMP")
        safe_add_column(engine, "projects", "manager_id", "INTEGER")
        safe_add_column(engine, "projects", "status", "VARCHAR", "'planning'")
        safe_add_column(engine, "projects", "boq_data", "TEXT")
        safe_add_column(engine, "projects", "map_url", "VARCHAR")
        safe_add_column(engine, "projects", "drive_url", "VARCHAR")
        safe_add_column(engine, "projects", "sheet_url", "VARCHAR")
        # Diagrams table
        safe_add_column(engine, "diagrams", "created_at", "TIMESTAMP")
        # Users table
        safe_add_column(engine, "users", "reset_token", "VARCHAR")
        safe_add_column(engine, "users", "reset_token_expire", "TIMESTAMP")
    except Exception as e:
        print(f"[Migration] Top level migration error: {e}")

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
