from sqlalchemy.orm import Session
from app.models.project import Project
from app.models.diagram import Diagram
from app.models.boq import BOQItem

def recalculate_diagram_progress(db: Session, diagram_id: int):
    """
    Tính lại % tiến độ của một Diagram dựa trên bảng BOQItem.
    Lưu thẳng vào diagram.cached_progress_percent
    """
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        return
        
    items = db.query(BOQItem).filter(BOQItem.diagram_id == diagram_id).all()
    design_val = sum(item.design_qty * item.price for item in items)
    actual_val = sum(item.actual_qty * item.price for item in items)
    plan_val = sum(item.plan_qty * item.price for item in items)
    
    if design_val > 0:
        diagram.cached_progress_percent = round((actual_val / design_val) * 100, 2)
    else:
        diagram.cached_progress_percent = 100.0 if items and actual_val > 0 else 0.0
        
    diagram.cached_target_value = round(design_val, 2)
    diagram.cached_completed_value = round(actual_val, 2)
    diagram.cached_plan_value = round(plan_val, 2)
        
    db.commit()

def recalculate_project_progress(db: Session, project_id: int):
    """
    Tính lại tiến độ tổng của Project dựa trên tổng giá trị công việc các Diagram.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return
        
    diagrams = db.query(Diagram).filter(Diagram.project_id == project_id).all()
    total_design_val = 0.0
    total_actual_val = 0.0
    total_plan_val = 0.0
    
    for d in diagrams:
        items = db.query(BOQItem).filter(BOQItem.diagram_id == d.id).all()
        total_design_val += sum(item.design_qty * item.price for item in items)
        total_actual_val += sum(item.actual_qty * item.price for item in items)
        total_plan_val += sum(item.plan_qty * item.price for item in items)
        
    if total_design_val > 0:
        project.cached_progress_percent = round((total_actual_val / total_design_val) * 100, 2)
    else:
        project.cached_progress_percent = 0.0
        
    project.cached_completed_value = round(total_actual_val, 2)
    project.cached_plan_value = round(total_plan_val, 2)
    project.cached_total_diagrams = len(diagrams)
    
    db.commit()
