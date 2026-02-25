from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.database import get_db
from app import models, schemas
from app.api import deps
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[schemas.Project])
def read_projects(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
) -> Any:
    """
    Retrieve projects with optional status filter.
    Eager-loads diagrams for progress calculation.
    """
    query = db.query(models.Project).options(joinedload(models.Project.diagrams))
    if status:
        query = query.filter(models.Project.status == status)
    projects = query.offset(skip).limit(limit).all()
    return projects

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
    return project

@router.get("/{project_id}", response_model=schemas.Project)
def read_project(
    *,
    db: Session = Depends(get_db),
    project_id: int,
) -> Any:
    """
    Get project by ID with diagrams list.
    """
    project = db.query(models.Project).options(
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
) -> Any:
    """
    Calculate project progress from diagram block statuses.
    Returns total/completed/in_progress counts and percentage.
    """
    import json
    project = db.query(models.Project).options(
        joinedload(models.Project.diagrams)
    ).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    total = 0
    completed = 0
    in_progress = 0
    
    for diagram in project.diagrams:
        if diagram.boq_data:
            try:
                boq = json.loads(diagram.boq_data)
                if isinstance(boq, dict):
                    for key, item in boq.items():
                        if isinstance(item, dict) and 'status' in item:
                            total += 1
                            if item['status'] == 2:
                                completed += 1
                            elif item['status'] == 1:
                                in_progress += 1
            except (json.JSONDecodeError, TypeError):
                pass
    
    progress_percent = round((completed / total * 100), 1) if total > 0 else 0
    
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
    return {"message": "Project deleted successfully"}


@router.get("/{project_id}/report")
def get_project_report(
    *,
    db: Session = Depends(get_db),
    project_id: int,
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
        if diagram.boq_data:
            try:
                boq = json.loads(diagram.boq_data)
                if isinstance(boq, list):
                    for item in boq:
                        design_amount = (item.get('designQty') or 0) * (item.get('unitPrice') or 0)
                        actual_amount = (item.get('actualQty') or 0) * (item.get('unitPrice') or 0)
                        status = item.get('status', 0)
                        boq_items.append({
                            'code': item.get('code', ''),
                            'name': item.get('name', item.get('categoryName', '')),
                            'unit': item.get('unit', ''),
                            'design_qty': item.get('designQty', 0),
                            'actual_qty': item.get('actualQty', 0),
                            'unit_price': item.get('unitPrice', 0),
                            'design_amount': design_amount,
                            'actual_amount': actual_amount,
                            'status': status,
                        })
                        total_design += design_amount
                        total_actual += actual_amount
                        total_blocks += 1
                        if status == 2:
                            total_completed += 1
                        elif status == 1:
                            total_in_progress += 1
            except (json.JSONDecodeError, TypeError):
                pass

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
) -> Any:
    """
    C4: Aggregated BOQ across all diagrams in a project.
    Groups by category, shows design vs actual quantities.
    """
    import json

    project = db.query(models.Project).options(
        joinedload(models.Project.diagrams)
    ).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    category_map: dict = {}

    for diagram in project.diagrams:
        if not diagram.boq_data:
            continue
        try:
            boq = json.loads(diagram.boq_data)
            if not isinstance(boq, list):
                continue
            for item in boq:
                cat = item.get('categoryName') or item.get('name', 'Khác')
                unit = item.get('unit', '')
                if cat not in category_map:
                    category_map[cat] = {
                        'category': cat,
                        'unit': unit,
                        'design_qty': 0.0,
                        'actual_qty': 0.0,
                        'design_amount': 0.0,
                        'actual_amount': 0.0,
                        'unit_price': item.get('unitPrice', 0),
                        'status_counts': {'done': 0, 'in_progress': 0, 'todo': 0},
                    }
                entry = category_map[cat]
                dqty = item.get('designQty') or 0
                aqty = item.get('actualQty') or 0
                price = item.get('unitPrice') or 0
                status = item.get('status', 0)
                entry['design_qty'] += dqty
                entry['actual_qty'] += aqty
                entry['design_amount'] += dqty * price
                entry['actual_amount'] += aqty * price
                if status == 2:
                    entry['status_counts']['done'] += 1
                elif status == 1:
                    entry['status_counts']['in_progress'] += 1
                else:
                    entry['status_counts']['todo'] += 1
        except (json.JSONDecodeError, TypeError):
            continue

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
