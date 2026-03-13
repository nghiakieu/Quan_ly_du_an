from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from sqlalchemy.orm import Session, defer
import asyncio
import json
from app.models.boq import BOQItem
from app.utils.progress_cache import recalculate_diagram_progress, recalculate_project_progress

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
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve diagrams.
    """
    query = db.query(DiagramModel).options(
        defer(DiagramModel.objects)
    )
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
    boq_str = diagram_in.boq_data
    diagram = DiagramModel(
        name=diagram_in.name,
        description=diagram_in.description,
        objects=diagram_in.objects,
        project_id=diagram_in.project_id
    )
    db.add(diagram)
    db.commit()
    db.refresh(diagram)
    
    if boq_str:
        try:
            boq_list = json.loads(boq_str)
            items = []
            for bi in boq_list:
                items.append(BOQItem(
                    diagram_id=diagram.id,
                    work_name=bi.get("name", "Unknown"),
                    unit=bi.get("unit"),
                    design_qty=bi.get("designQty") or 0.0,
                    actual_qty=bi.get("actualQty") or 0.0,
                    plan_qty=bi.get("planQty") or 0.0,
                    price=bi.get("unitPrice") or 0.0,
                    order=int(bi.get("order", 0)) if str(bi.get("order", "0")).isdigit() else 0,
                    external_id=str(bi.get("id", ""))
                ))
            db.add_all(items)
            db.commit()
            recalculate_diagram_progress(db, diagram.id)
            if diagram.project_id:
                recalculate_project_progress(db, diagram.project_id)
        except Exception as e:
            print("Create Diagram parse BOQ error: ", e)
    
    setattr(diagram, "boq_data", boq_str)  # Transient load for Pydantic
    
    # Broadcast to websocket clients that a new diagram might be available
    background_tasks.add_task(
        manager.broadcast_to_diagram,
        diagram_id="all", 
        message={"event": "new_diagram", "data": {"id": diagram.id}}
    )
    invalidate_ai_cache(diagram.project_id)
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
    boq_str = update_data.pop("boq_data", None)
    
    for field in update_data:
        setattr(diagram, field, update_data[field])

    db.add(diagram)
    db.commit()
    
    if boq_str is not None:
        db.query(BOQItem).filter(BOQItem.diagram_id == diagram.id).delete()
        try:
            boq_list = json.loads(boq_str)
            items = []
            for bi in boq_list:
                items.append(BOQItem(
                    diagram_id=diagram.id,
                    work_name=bi.get("name", "Unknown"),
                    unit=bi.get("unit"),
                    design_qty=bi.get("designQty") or 0.0,
                    actual_qty=bi.get("actualQty") or 0.0,
                    plan_qty=bi.get("planQty") or 0.0,
                    price=bi.get("unitPrice") or 0.0,
                    order=int(bi.get("order", 0)) if str(bi.get("order", "0")).isdigit() else 0,
                    external_id=str(bi.get("id", ""))
                ))
            db.add_all(items)
            db.commit()
            recalculate_diagram_progress(db, diagram.id)
            if diagram.project_id:
                recalculate_project_progress(db, diagram.project_id)
        except Exception as e:
            print("Update Diagram parse BOQ error: ", e)

    db.refresh(diagram)
    
    # Reload items for response
    fetched_items = db.query(BOQItem).filter(BOQItem.diagram_id == diagram.id).all()
    boq_list_resp = []
    for bi in fetched_items:
        boq_list_resp.append({
            "id": bi.external_id, "name": bi.work_name, "unit": bi.unit,
            "designQty": bi.design_qty, "actualQty": bi.actual_qty, "planQty": bi.plan_qty,
            "unitPrice": bi.price, "order": bi.order,
            "contractAmount": round(bi.design_qty * bi.price, 2),
            "actualAmount": round(bi.actual_qty * bi.price, 2),
            "planAmount": round(bi.plan_qty * bi.price, 2)
        })
    setattr(diagram, "boq_data", json.dumps(boq_list_resp, ensure_ascii=False) if boq_list_resp else "[]")
    invalidate_ai_cache(diagram.project_id)
    
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
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get the most recently created or updated diagram.
    """
    diagram = db.query(DiagramModel).order_by(DiagramModel.id.desc()).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="No diagrams found")
        
    fetched_items = db.query(BOQItem).filter(BOQItem.diagram_id == diagram.id).all()
    boq_list_resp = []
    for bi in fetched_items:
        boq_list_resp.append({
            "id": bi.external_id, "name": bi.work_name, "unit": bi.unit,
            "designQty": bi.design_qty, "actualQty": bi.actual_qty, "planQty": bi.plan_qty,
            "unitPrice": bi.price, "order": bi.order,
            "contractAmount": round(bi.design_qty * bi.price, 2),
            "actualAmount": round(bi.actual_qty * bi.price, 2),
            "planAmount": round(bi.plan_qty * bi.price, 2)
        })
    setattr(diagram, "boq_data", json.dumps(boq_list_resp, ensure_ascii=False) if boq_list_resp else "[]")
    
    return diagram

@router.get("/{diagram_id}", response_model=Diagram)
def read_diagram(
    *,
    db: Session = Depends(get_db),
    diagram_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get diagram by ID.
    """
    diagram = db.query(DiagramModel).filter(DiagramModel.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
        
    fetched_items = db.query(BOQItem).filter(BOQItem.diagram_id == diagram.id).all()
    boq_list_resp = []
    for bi in fetched_items:
        boq_list_resp.append({
            "id": bi.external_id, "name": bi.work_name, "unit": bi.unit,
            "designQty": bi.design_qty, "actualQty": bi.actual_qty, "planQty": bi.plan_qty,
            "unitPrice": bi.price, "order": bi.order,
            "contractAmount": round(bi.design_qty * bi.price, 2),
            "actualAmount": round(bi.actual_qty * bi.price, 2),
            "planAmount": round(bi.plan_qty * bi.price, 2)
        })
    setattr(diagram, "boq_data", json.dumps(boq_list_resp, ensure_ascii=False) if boq_list_resp else "[]")
    
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
    project_id = diagram.project_id
    db.delete(diagram)
    db.commit()
    invalidate_ai_cache(project_id)
    return diagram

