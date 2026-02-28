from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from sqlalchemy.orm import Session
import asyncio

from app.api.deps import get_db
from app.api.api_v1.endpoints.ai import invalidate_ai_cache
from app.models.diagram import Diagram as DiagramModel
from app.schemas.diagram import Diagram, DiagramCreate, DiagramUpdate
from app.models import diagram as models
from app.api import deps
from app.models.user import User
from app.api.ws_manager import manager


router = APIRouter()

from typing import Optional

@router.get("/", response_model=List[Diagram])
def read_diagrams(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = None,
    db: Session = Depends(get_db)
) -> Any:
    """
    Retrieve diagrams.
    """
    query = db.query(DiagramModel)
    if project_id is not None:
        query = query.filter(DiagramModel.project_id == project_id)
    diagrams = query.offset(skip).limit(limit).all()
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
        boq_data=diagram_in.boq_data,
        project_id=diagram_in.project_id
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
    invalidate_ai_cache()
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
    invalidate_ai_cache()
    
    # Phát tín hiệu báo sơ đồ có thay đổi
    background_tasks.add_task(
        manager.broadcast_to_diagram,
        diagram_id=str(diagram_id), 
        message={"event": "diagram_updated"}
    )

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

