from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload, defer

from app.api.deps import get_db
from app import models, schemas
from app.api import deps
from app.models.user import User
from app.api.api_v1.endpoints.ai import invalidate_ai_cache
import json
import io

router = APIRouter()

@router.get("/", response_model=List[schemas.Project])
def read_projects(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve projects with optional status filter.
    Eager-loads diagrams for progress calculation.
    """
    try:
        query = db.query(models.Project).options(
            defer(models.Project.boq_data),
            joinedload(models.Project.diagrams)
        )
        if status:
            query = query.filter(models.Project.status == status)
        projects = query.offset(skip).limit(limit).all()
        
        # Calculate on-the-fly values for charts
        for p in projects:
            p_total_design = 0.0
            p_total_actual = 0.0
            p_total_plan = 0.0
            
            for d in p.diagrams:
                # Calculate for each diagram
                items = db.query(models.boq.BOQItem).filter(models.boq.BOQItem.diagram_id == d.id).all()
                d.cached_target_value = sum((item.design_qty or 0) * (item.price or 0) for item in items)
                d.cached_completed_value = sum((item.actual_qty or 0) * (item.price or 0) for item in items)
                d.cached_plan_value = sum((item.plan_qty or 0) * (item.price or 0) for item in items)
                
                p_total_design += d.cached_target_value
                p_total_actual += d.cached_completed_value
                p_total_plan += d.cached_plan_value
            
            # Note: We don't save these to p.cached_... because those columns might not exist or we want to avoid DB writes.
            # We just set them on the object so the schema can pick them up.
            # However, if these fields are NOT in the model but ARE in the schema, 
            # we can use them as transient attributes.
            p.cached_completed_value = p_total_actual
            p.cached_plan_value = p_total_plan

        return projects
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=schemas.Project)
def create_project(
    *,
    db: Session = Depends(get_db),
    project_in: schemas.ProjectCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new project. Assigns current authenticated user as manager.
    """
    project = models.Project(
        name=project_in.name,
        description=project_in.description,
        status=project_in.status,
        investor=project_in.investor,
        total_budget=project_in.total_budget,
        start_date=project_in.start_date,
        end_date=project_in.end_date,
        manager_id=current_user.id
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    invalidate_ai_cache(project.id)
    return project

@router.get("/{project_id}", response_model=schemas.Project)
def read_project(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get project by ID with diagrams list.
    """
    project = db.query(models.Project).options(
        defer(models.Project.boq_data),
        joinedload(models.Project.diagrams)
    ).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.get("/{project_id}/progress")
def get_project_progress(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Calculate project progress from diagram block statuses.
    Returns total/completed/in_progress counts and percentage.
    """
    import json
    # Load objects without defer
    project = db.query(models.Project).options(
        defer(models.Project.boq_data),
        joinedload(models.Project.diagrams).defer(models.Diagram.objects)
    ).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    total = 0
    completed = 0
    in_progress = 0
    
    # Chúng ta đã loại bỏ việc Parse JSON Canvas Objects để đếm thủ công. 
    # Thay vào đó, Dữ liệu đã được hệ thống Cache qua Trigger xuống Project/Diagram.
    # Count ở đây trả về 0 bảo lưu API structure cũ cho React không bị lỗi.
    
    # Sử dụng cache % tiến độ để phản ánh đúng khối lượng tiền, không chỉ đếm số khối geometry
    progress_percent = project.cached_progress_percent or 0.0
    
    return {
        "project_id": project_id,
        "total_blocks": total,
        "completed": completed,
        "in_progress": in_progress,
        "not_started": total - completed - in_progress,
        "progress_percent": progress_percent,
        "diagram_count": len(project.diagrams)
    }

@router.put("/{project_id}", response_model=schemas.Project)
def update_project(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    project_in: schemas.ProjectUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update a project. Only authenticated users can update.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = project_in.dict(exclude_unset=True)
    for field in update_data:
        setattr(project, field, update_data[field])
        
    db.add(project)
    db.commit()
    db.refresh(project)
    invalidate_ai_cache(project_id)
    return project

@router.delete("/{project_id}")
def delete_project(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete a project. Only authenticated users can delete.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(project)
    db.commit()
    invalidate_ai_cache(project_id)
    return {"message": "Project deleted successfully"}


@router.get("/{project_id}/report")
def get_project_report(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    C3: Full project report data for PDF generation.
    Returns project info, diagrams with BOQ summary, task counts.
    """
    import json
    from datetime import datetime
    from app.models.task import Task

    project = db.query(models.Project).options(
        joinedload(models.Project.diagrams)
    ).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Aggregate BOQ across all diagrams
    diagrams_report = []
    total_design = 0.0
    total_actual = 0.0
    total_completed = 0
    total_in_progress = 0
    total_blocks = 0

    for diagram in project.diagrams:
        boq_items = []
        db_items = db.query(models.boq.BOQItem).filter(models.boq.BOQItem.diagram_id == diagram.id).all()
        for item in db_items:
            design_amount = item.design_qty * item.price
            actual_amount = item.actual_qty * item.price
            
            boq_items.append({
                'code': item.external_id,
                'name': item.work_name,
                'unit': item.unit,
                'design_qty': item.design_qty,
                'actual_qty': item.actual_qty,
                'unit_price': item.price,
                'design_amount': design_amount,
                'actual_amount': actual_amount,
                'status': 0, # Legacy
            })
            total_design += design_amount
            total_actual += actual_amount
            total_blocks += 1
            if item.actual_qty >= item.design_qty and item.design_qty > 0:
                total_completed += 1
            elif item.actual_qty > 0:
                total_in_progress += 1

        diagrams_report.append({
            'id': diagram.id,
            'name': diagram.name,
            'description': diagram.description,
            'boq_items': boq_items,
            'boq_count': len(boq_items),
        })

    # Task stats
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    task_stats = {
        'total': len(tasks),
        'todo': sum(1 for t in tasks if t.status == 'todo'),
        'in_progress': sum(1 for t in tasks if t.status == 'in_progress'),
        'done': sum(1 for t in tasks if t.status == 'done'),
    }

    progress_percent = round((total_completed / total_blocks * 100), 1) if total_blocks > 0 else 0

    return {
        "generated_at": datetime.now().isoformat(),
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "investor": project.investor,
            "total_budget": project.total_budget,
            "status": project.status,
            "start_date": project.start_date.isoformat() if project.start_date else None,
            "end_date": project.end_date.isoformat() if project.end_date else None,
        },
        "summary": {
            "total_blocks": total_blocks,
            "completed": total_completed,
            "in_progress": total_in_progress,
            "not_started": total_blocks - total_completed - total_in_progress,
            "progress_percent": progress_percent,
            "total_design_value": total_design,
            "total_actual_value": total_actual,
            "diagram_count": len(project.diagrams),
        },
        "diagrams": diagrams_report,
        "tasks": task_stats,
    }


@router.get("/{project_id}/boq-summary")
def get_project_boq_summary(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    C4: Aggregated BOQ across all diagrams in a project.
    Groups by category, shows design vs actual quantities.
    """
    import json

    project = db.query(models.Project).options(
        defer(models.Project.boq_data),
        joinedload(models.Project.diagrams).defer(models.Diagram.objects)
    ).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    category_map: dict = {}

    for diagram in project.diagrams:
        db_items = db.query(models.boq.BOQItem).filter(models.boq.BOQItem.diagram_id == diagram.id).all()
        for item in db_items:
            cat = item.work_name
            unit = item.unit
            if cat not in category_map:
                category_map[cat] = {
                    'category': cat,
                    'unit': unit,
                    'design_qty': 0.0,
                    'actual_qty': 0.0,
                    'design_amount': 0.0,
                    'actual_amount': 0.0,
                    'unit_price': item.price,
                    'status_counts': {'done': 0, 'in_progress': 0, 'todo': 0},
                }
            entry = category_map[cat]
            dqty = item.design_qty or 0.0
            aqty = item.actual_qty or 0.0
            price = item.price or 0.0
            status = 0
            entry['design_qty'] += dqty
            entry['actual_qty'] += aqty
            entry['design_amount'] += dqty * price
            entry['actual_amount'] += aqty * price
            if aqty >= dqty and dqty > 0:
                entry['status_counts']['done'] += 1
            elif aqty > 0:
                entry['status_counts']['in_progress'] += 1
            else:
                entry['status_counts']['todo'] += 1

    items = list(category_map.values())
    total_design = sum(i['design_amount'] for i in items)
    total_actual = sum(i['actual_amount'] for i in items)

    return {
        "project_id": project_id,
        "project_name": project.name,
        "items": items,
        "totals": {
            "design_amount": total_design,
            "actual_amount": total_actual,
            "variance": total_actual - total_design,
            "items_count": len(items),
        }
    }


# ============================================================
# BOQ Management Endpoints
# ============================================================

@router.get("/{project_id}/boq")
def get_project_boq(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Get project-level master BOQ data and aggregate actual/plan quantities from diagrams.
    """
    from sqlalchemy.orm import joinedload
    import json
    
    project = db.query(models.Project).options(
        joinedload(models.Project.diagrams)
    ).filter(models.Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    boq = []
    if project.boq_data:
        try:
            boq = json.loads(project.boq_data)
        except (json.JSONDecodeError, TypeError):
            boq = []
            
    # Normalize ID to handle pandas parsing differences (e.g. "1.0" vs "1")
    def normalize_id(item_id):
        s = str(item_id).strip()
        if s.endswith('.0'):
            return s[:-2]
        return s
        
    boq_map = {normalize_id(item.get('id', '')): item for item in boq}
    
    for diagram in project.diagrams:
        db_items = db.query(models.boq.BOQItem).filter(models.boq.BOQItem.diagram_id == diagram.id).all()
        for item in db_items:
            item_id = normalize_id(item.external_id)
            if item_id in boq_map:
                base_item = boq_map[item_id]
                base_item['actualQty'] = base_item.get('actualQty', 0) + (item.actual_qty or 0)
                base_item['planQty'] = base_item.get('planQty', 0) + (item.plan_qty or 0)
            
    # Recalculate amounts
    for item in boq:
        price = item.get('unitPrice') or 0
        item['actualAmount'] = (item.get('actualQty', 0) or 0) * price
        item['planAmount'] = (item.get('planQty', 0) or 0) * price
    
    return {"project_id": project_id, "boq_data": boq, "count": len(boq)}


@router.post("/{project_id}/boq/upload")
async def upload_project_boq(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Upload Excel file to set project-level master BOQ.
    Expected columns: TT | Noi dung | DVT | KL Tke | Don gia
    """
    from app.services.boq_service import BOQService
    import json
    
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload Excel file.")
    
    boq_items = await BOQService.process_project_boq_excel(file)
    
    # Save to project
    project.boq_data = json.dumps(boq_items, ensure_ascii=False)
    db.commit()
    
    try:
        invalidate_ai_cache(project_id)
    except:
        try:
            invalidate_ai_cache()
        except:
            pass
    
    return {
        "status": "success",
        "count": len(boq_items),
        "total_contract": round(sum(i["contractAmount"] for i in boq_items), 0),
        "data": boq_items,
    }


@router.post("/{project_id}/diagrams/{diagram_id}/boq/sync")
async def sync_diagram_boq(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    diagram_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Upload Excel with block columns to sync diagram BOQ and auto-assign to blocks.
    Expected format: TT | Name | DVT | KL Tke | Don gia | BLOCK-ID-1 | BLOCK-ID-2 | ...
    """
    from app.services.boq_service import BOQService
    import json
    
    # Validate project and diagram
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    diagram = db.query(models.Diagram).filter(
        models.Diagram.id == diagram_id,
        models.Diagram.project_id == project_id
    ).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found in this project")
    
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Invalid file format.")
    
    boq_items, sync_report, boq_warnings, objects_list = await BOQService.process_diagram_boq_sync_excel(
        file, project.boq_data, diagram.objects
    )
    
    # Delete old boq items
    from app.models.boq import BOQItem
    from app.utils.progress_cache import recalculate_diagram_progress, recalculate_project_progress
    
    db.query(BOQItem).filter(BOQItem.diagram_id == diagram.id).delete()
    
    # Insert new DB items
    new_db_items = []
    for bi in boq_items:
        try:
            ord_val = int(bi.get("order", 0)) if str(bi.get("order", "0")).isdigit() else 0
        except:
            ord_val = 0
            
        new_db_items.append(BOQItem(
            diagram_id=diagram.id,
            work_name=bi["name"],
            unit=bi["unit"],
            design_qty=bi["designQty"],
            actual_qty=bi["actualQty"],
            plan_qty=bi["planQty"],
            price=bi["unitPrice"],
            order=ord_val,
            external_id=str(bi["id"])
        ))
    if new_db_items:
        db.add_all(new_db_items)
        db.commit()
    
    # Recalculate Cache after commit
    recalculate_diagram_progress(db, diagram.id)
    recalculate_project_progress(db, project_id)
    
    diagram.objects = json.dumps(objects_list, ensure_ascii=False)
    db.commit()
    
    try:
        invalidate_ai_cache(project_id)
    except:
        try:
            invalidate_ai_cache()
        except:
            pass
    
    return {
        "status": "success",
        "boq_count": len(boq_items),
        "blocks_synced": len(sync_report["matched"]),
        "sync_report": sync_report,
        "boq_warnings": boq_warnings,
        "data": boq_items,
    }
