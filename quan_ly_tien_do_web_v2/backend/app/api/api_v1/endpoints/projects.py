from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload

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
    invalidate_ai_cache(project.id)
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
                # Support both list and dict format for backward compatibility
                items = boq if isinstance(boq, list) else (list(boq.values()) if isinstance(boq, dict) else [])
                for item in items:
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


# ============================================================
# BOQ Management Endpoints
# ============================================================

@router.get("/{project_id}/boq")
def get_project_boq(
    *,
    db: Session = Depends(get_db),
    project_id: int,
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
        if not diagram.boq_data:
            continue
        try:
            diag_boq = json.loads(diagram.boq_data)
            if not isinstance(diag_boq, list):
                continue
            for item in diag_boq:
                item_id = normalize_id(item.get('id', ''))
                if item_id in boq_map:
                    base_item = boq_map[item_id]
                    base_item['actualQty'] = base_item.get('actualQty', 0) + (item.get('actualQty') or 0)
                    base_item['planQty'] = base_item.get('planQty', 0) + (item.get('planQty') or 0)
        except (json.JSONDecodeError, TypeError):
            pass
            
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
    import pandas as pd
    
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload Excel file.")
    
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content), header=0)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read Excel file: {str(e)}")
    
    # Hardcoded column map based on fixed format
    # 0: ID, 1: STT, 2: Name, 3: Unit, 4: DesignQty, 5: ActualQty, 6: PlanQty, 7: UnitPrice, 8-10: Amounts
    col_map = {
        'id': df.columns[0] if len(df.columns) > 0 else '',
        'tt': df.columns[1] if len(df.columns) > 1 else '',
        'name': df.columns[2] if len(df.columns) > 2 else '',
        'unit': df.columns[3] if len(df.columns) > 3 else '',
        'designQty': df.columns[4] if len(df.columns) > 4 else '',
        'unitPrice': df.columns[7] if len(df.columns) > 7 else '',
    }
    
    if not col_map.get('name'):
        raise HTTPException(status_code=400, detail="Cannot find 'Nội dung công việc' column in Excel file.")
    
    boq_items = []
    for _, row in df.iterrows():
        name_val = row.get(col_map.get('name', ''), '')
        if pd.isna(name_val) or str(name_val).strip() == '':
            continue
        
        item_id = str(row.get(col_map.get('id', ''), '')).strip()
        if item_id.endswith('.0'): item_id = item_id[:-2]
        if pd.isna(item_id) or item_id in ('', 'nan'):
            item_id = str(len(boq_items) + 1)
            
        tt_val = str(row.get(col_map.get('tt', ''), '')).strip()
        if tt_val.endswith('.0'): tt_val = tt_val[:-2]
        if pd.isna(tt_val) or tt_val in ('', 'nan'):
            tt_val = str(len(boq_items) + 1)
        
        def safe_float(val):
            try:
                if pd.isna(val): return 0
                if isinstance(val, str):
                    val = val.replace(',', '').replace(' ', '')
                return float(val)
            except (ValueError, TypeError):
                return 0
        
        design_qty = safe_float(row.get(col_map.get('designQty', ''), 0))
        unit_price = safe_float(row.get(col_map.get('unitPrice', ''), 0))
        
        boq_items.append({
            "id": item_id,
            "order": tt_val,
            "name": str(name_val).strip(),
            "unit": str(row.get(col_map.get('unit', ''), '')).strip() if not pd.isna(row.get(col_map.get('unit', ''), '')) else '',
            "designQty": design_qty,
            "unitPrice": unit_price,
            "contractAmount": round(design_qty * unit_price, 2),
        })
    
    # Save to project
    project.boq_data = json.dumps(boq_items, ensure_ascii=False)
    db.commit()
    
    invalidate_ai_cache()
    
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
    First row headers of block columns must match object IDs on the diagram.
    """
    import pandas as pd
    
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
    
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content), header=0)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read Excel: {str(e)}")
    
    # Load project master BOQ for validation
    master_boq_ids = set()
    if project.boq_data:
        try:
            master_boq = json.loads(project.boq_data)
            master_boq_ids = {str(item.get('id', '')) for item in master_boq if isinstance(item, dict)}
        except (json.JSONDecodeError, TypeError):
            pass
    
    # Hardcoded standard columns (first 11) and dynamic block columns (from column 12+ / index 11)
    col_map = {
        'id': df.columns[0] if len(df.columns) > 0 else '',
        'tt': df.columns[1] if len(df.columns) > 1 else '',
        'name': df.columns[2] if len(df.columns) > 2 else '',
        'unit': df.columns[3] if len(df.columns) > 3 else '',
        'designQty': df.columns[4] if len(df.columns) > 4 else '',
        'unitPrice': df.columns[7] if len(df.columns) > 7 else '',
    }
    
    block_columns = {}  # {block_id: column_name}
    for i, col in enumerate(df.columns):
        if i >= 11:
            block_columns[str(col).strip()] = col
    
    if not col_map.get('name'):
        raise HTTPException(status_code=400, detail="Cannot find 'Nội dung công việc' column.")
    
    # Load existing diagram objects
    objects_list = []
    if diagram.objects:
        try:
            objects_list = json.loads(diagram.objects)
        except (json.JSONDecodeError, TypeError):
            objects_list = []
    
    diagram_block_ids = {str(obj.get('id', '')) for obj in objects_list if isinstance(obj, dict)}
    excel_block_ids = set(block_columns.keys())
    
    def safe_float(val):
        try:
            if pd.isna(val): return 0
            if isinstance(val, str):
                val = val.replace(',', '').replace(' ', '')
            return float(val)
        except (ValueError, TypeError):
            return 0
    
    # Parse BOQ rows
    boq_items = []
    block_boq_map = {bid: {} for bid in excel_block_ids}  # {block_id: {boq_id: qty}}
    
    for _, row in df.iterrows():
        name_val = row.get(col_map.get('name', ''), '')
        if pd.isna(name_val) or str(name_val).strip() == '':
            continue
        
        item_id = str(row.get(col_map.get('id', ''), '')).strip()
        if item_id.endswith('.0'): item_id = item_id[:-2]
        if pd.isna(item_id) or item_id in ('', 'nan'):
            item_id = str(len(boq_items) + 1)
            
        tt_val = str(row.get(col_map.get('tt', ''), '')).strip()
        if tt_val.endswith('.0'): tt_val = tt_val[:-2]
        if pd.isna(tt_val) or tt_val in ('', 'nan'):
            tt_val = str(len(boq_items) + 1)
        
        design_qty = safe_float(row.get(col_map.get('designQty', ''), 0))
        unit_price = safe_float(row.get(col_map.get('unitPrice', ''), 0))
        unit_val = row.get(col_map.get('unit', ''), '')
        
        boq_item = {
            "id": item_id,
            "order": tt_val,
            "name": str(name_val).strip(),
            "unit": str(unit_val).strip() if not pd.isna(unit_val) else '',
            "designQty": design_qty,
            "unitPrice": unit_price,
            "contractAmount": round(design_qty * unit_price, 2),
            "actualQty": 0,
            "actualAmount": 0,
            "planQty": 0,
            "planAmount": 0,
        }
        
        # Calculate actual quantities per block column
        has_any_block_qty = False
        for bid, col_name in block_columns.items():
            qty = safe_float(row.get(col_name, 0))
            if qty > 0:
                block_boq_map[bid][item_id] = qty
                boq_item["actualQty"] += qty
                has_any_block_qty = True
        
        boq_item["actualAmount"] = round(boq_item["actualQty"] * unit_price, 2)
        boq_items.append(boq_item)
    
    # Update diagram.boq_data
    diagram.boq_data = json.dumps(boq_items, ensure_ascii=False)
    
    # Update objects with boqIds mapping
    for obj in objects_list:
        obj_id = str(obj.get('id', ''))
        if obj_id in block_boq_map and block_boq_map[obj_id]:
            obj['boqIds'] = block_boq_map[obj_id]
    
    diagram.objects = json.dumps(objects_list, ensure_ascii=False)
    db.commit()
    
    invalidate_ai_cache()
    
    # Generate Sync Report
    sync_report = {
        "matched": [],       # Block IDs successfully mapped
        "excel_only": [],    # Block IDs in Excel but not on diagram
        "diagram_only": [],  # Block IDs on diagram but not in Excel
        "empty": [],         # Block IDs in Excel with no quantities
    }
    
    for bid in excel_block_ids:
        if bid in diagram_block_ids:
            if block_boq_map.get(bid):
                sync_report["matched"].append({
                    "block_id": bid,
                    "items_count": len(block_boq_map[bid]),
                    "total_qty": round(sum(block_boq_map[bid].values()), 2),
                })
            else:
                sync_report["empty"].append(bid)
        else:
            sync_report["excel_only"].append(bid)
    
    for bid in diagram_block_ids:
        if bid not in excel_block_ids:
            sync_report["diagram_only"].append(bid)
    
    # Validation warning if master BOQ exists
    boq_warnings = []
    if master_boq_ids:
        for item in boq_items:
            if str(item['id']) not in master_boq_ids:
                boq_warnings.append(f"BOQ item '{item['id']}: {item['name']}' not found in project master BOQ")
    
    return {
        "status": "success",
        "boq_count": len(boq_items),
        "blocks_synced": len(sync_report["matched"]),
        "sync_report": sync_report,
        "boq_warnings": boq_warnings,
        "data": boq_items,
    }
