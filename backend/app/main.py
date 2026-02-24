from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.api.api_v1.api import api_router
from app.core.config import settings
from app.api.ws_manager import manager

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
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
    return {"message": "Welcome to Quan Ly Tien Do API"}

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
