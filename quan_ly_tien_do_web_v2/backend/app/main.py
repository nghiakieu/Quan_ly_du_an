import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
import jwt
from app.schemas.token import TokenPayload
from app.api.api_v1.api import api_router
from app.core.config import settings
from app.api.ws_manager import manager
from app.db.database import engine, Base
# Import all models so Base.metadata includes them
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DB Migrations should be handled via Alembic in Phase 2
    # Base.metadata.create_all is kept for basic table creation until Alembic is fully configured.
    Base.metadata.create_all(bind=engine, checkfirst=True)

    # Step 3: Create Default Admin Account if not exists
    from app.db.database import SessionLocal
    from app.models.user import User as UserModel
    from app.core.security import get_password_hash
    
    db = SessionLocal()
    try:
        default_username = settings.DEFAULT_ADMIN_USERNAME
        existing_admin = db.query(UserModel).filter(UserModel.username == default_username).first()
        if not existing_admin:
            print(f"[Startup] Khởi tạo tài khoản Admin mặc định ({settings.DEFAULT_ADMIN_EMAIL})")
            default_admin = UserModel(
                username=settings.DEFAULT_ADMIN_USERNAME,
                email=settings.DEFAULT_ADMIN_EMAIL,
                hashed_password=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
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
async def websocket_diagram_endpoint(websocket: WebSocket, diagram_id: str, token: str = Query(None)):
    """
    Kênh WebSocket cho Client.
    Yêu cầu token JWT qua query parameters.
    """
    if not token:
        await websocket.close(code=1008)
        return
        
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload)
        if not token_data.sub:
            raise jwt.PyJWTError("Invalid token payload")
    except jwt.PyJWTError:
        await websocket.close(code=1008)
        return

    await manager.connect_diagram(diagram_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                await manager.broadcast_to_diagram(diagram_id, data, exclude=websocket)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect_diagram(diagram_id, websocket)
