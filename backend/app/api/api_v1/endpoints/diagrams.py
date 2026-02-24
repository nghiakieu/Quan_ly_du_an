from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from sqlalchemy.orm import Session
import asyncio

from app.db.database import get_db, engine
from app.models.diagram import Diagram as DiagramModel
from app.schemas.diagram import Diagram, DiagramCreate, DiagramUpdate
from app.models import diagram as models
from app.api import deps
from app.models.user import User
from app.api.ws_manager import manager

# Create tables if not exist (quick setup for dev)
models.Base.metadata.create_all(bind=engine)

router = APIRouter()

@router.get("/", response_model=List[Diagram])
def read_diagrams(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
) -> Any:
    """
    Retrieve diagrams.
    """
    diagrams = db.query(DiagramModel).offset(skip).limit(limit).all()
    return diagrams

@router.post("/", response_model=Diagram)
def create_diagram(
    *,
    db: Session = Depends(get_db),
    diagram_in: DiagramCreate,
    current_user: User = Depends(deps.get_current_active_user),
    background_tasks: BackgroundTasks
) -> Any:
    """
    Create new diagram.
    """
    diagram = DiagramModel(
        name=diagram_in.name,
        description=diagram_in.description,
        objects=diagram_in.objects,
        boq_data=diagram_in.boq_data
    )
    db.add(diagram)
    db.commit()
    db.refresh(diagram)
    
    # Broadcast to websocket clients that a new diagram might be available
    background_tasks.add_task(
        manager.broadcast_to_diagram,
        diagram_id="all", 
        message={"event": "new_diagram", "data": {"id": diagram.id}}
    )
    return diagram

@router.put("/{diagram_id}", response_model=Diagram)
def update_diagram(
    *,
    db: Session = Depends(get_db),
    diagram_id: int,
    diagram_in: DiagramUpdate,
    current_user: User = Depends(deps.get_current_active_user),
    background_tasks: BackgroundTasks
) -> Any:
    """
    Update a diagram.
    """
    diagram = db.query(DiagramModel).filter(DiagramModel.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    
    update_data = diagram_in.dict(exclude_unset=True)
    for field in update_data:
        setattr(diagram, field, update_data[field])

    db.add(diagram)
    db.commit()
    db.refresh(diagram)
    
    # Phát tín hiệu báo sơ đồ có thay đổi
    asyncio.create_task(manager.broadcast_to_diagram(
        diagram_id=str(diagram_id), 
        message={"event": "diagram_updated"}
    ))

    return diagram

@router.get("/latest", response_model=Diagram)
def read_latest_diagram(
    *,
    db: Session = Depends(get_db)
) -> Any:
    """
    Get the most recently created or updated diagram.
    """
    diagram = db.query(DiagramModel).order_by(DiagramModel.id.desc()).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="No diagrams found")
    return diagram

@router.get("/{diagram_id}", response_model=Diagram)
def read_diagram(
    *,
    db: Session = Depends(get_db),
    diagram_id: int
) -> Any:
    """
    Get diagram by ID.
    """
    diagram = db.query(DiagramModel).filter(DiagramModel.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    return diagram

@router.delete("/{diagram_id}", response_model=Diagram)
def delete_diagram(
    *,
    db: Session = Depends(get_db),
    diagram_id: int,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Delete a diagram.
    """
    diagram = db.query(DiagramModel).filter(DiagramModel.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    db.delete(diagram)
    db.commit()
    return diagram

@router.websocket("/ws/{diagram_id}")
async def websocket_diagram_endpoint(websocket: WebSocket, diagram_id: str):
    """
    Kênh WebSocket cho Client.
    Client Connect vào để lắng nghe khi có sự thay đổi của Sơ đồ
    """
    await manager.connect(diagram_id, websocket)
    try:
        while True:
            # Ở bản này ta chỉ quan tâm Broadcast từ Server xuống. 
            # Dòng code này giữ kết nối luôn mở và bắt ping messages từ client nếu có.
            data = await websocket.receive_text() 
    except WebSocketDisconnect:
        manager.disconnect(diagram_id, websocket)
