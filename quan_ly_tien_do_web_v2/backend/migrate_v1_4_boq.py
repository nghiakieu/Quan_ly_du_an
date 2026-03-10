"""
One-time script to migrate old boq_data (JSON strings) from diagrams
into the new boq_items relational table. 
Also calculates and seeds the cached_progress_percent for Diagram and Project.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from sqlalchemy import text as sa_text, inspect as sa_inspect
from app.db.database import SessionLocal, engine, Base
from app.models import Diagram, Project
from app.models.boq import BOQItem
import json

def safe_add_column(engine_inst, table, column, col_type, default=None):
    try:
        inspector = sa_inspect(engine_inst)
        existing_cols = [c["name"] for c in inspector.get_columns(table)]
        if column not in existing_cols:
            default_clause = f" DEFAULT {default}" if default else ""
            with engine_inst.begin() as conn:
                conn.execute(sa_text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}{default_clause}"))
                print(f"[Migration] Added column {column} to {table}")
    except Exception as e:
        print(f"[Migration] Skipped adding {column} to {table}: {e}")

def migrate():
    # 1. Create missing tables (BOQItem)
    Base.metadata.create_all(bind=engine, checkfirst=True)
    
    # 2. Add cached_progress_percent and diagram counts
    safe_add_column(engine, "projects", "cached_progress_percent", "FLOAT")
    safe_add_column(engine, "projects", "cached_completed_value", "FLOAT")
    safe_add_column(engine, "projects", "cached_total_diagrams", "INTEGER")
    safe_add_column(engine, "diagrams", "cached_progress_percent", "FLOAT")

    db: Session = SessionLocal()
    print("Starting Phase 1 Migration: JSON to BOQItem...")
    try:
        # Lấy tất cả diagram có chứa boq_data
        diagrams = db.query(Diagram).filter(Diagram.boq_data.isnot(None), Diagram.boq_data != '', Diagram.boq_data != '[]', Diagram.boq_data != '{}').all()
        print(f"Found {len(diagrams)} diagrams with boq_data")

        for diag in diagrams:
            # Check if already migrated
            existing_count = db.query(BOQItem).filter(BOQItem.diagram_id == diag.id).count()
            if existing_count > 0:
                print(f"Diagram {diag.id} already migrated ({existing_count} items). Skipping.")
                # Recalculate cache to be safe
                pass
            else:
                try:
                    boq_list = json.loads(diag.boq_data)
                    # support legacy format
                    items = boq_list if isinstance(boq_list, list) else (list(boq_list.values()) if isinstance(boq_list, dict) else [])
                    
                    boq_objects = []
                    for idx, data in enumerate(items):
                        # Bóc tách Data từ format React. 
                        # Ở React type BOQItem: { id: string, name: string, unit: string, designQty: number, actualQty: number, planQty: number, price: number, order: number }
                        
                        boq_obj = BOQItem(
                            diagram_id=diag.id,
                            work_name=data.get("name", "Unknown Task"),
                            unit=data.get("unit", ""),
                            design_qty=float(data.get("designQty", data.get("design_qty", 0.0))),
                            actual_qty=float(data.get("actualQty", data.get("actual_qty", 0.0))),
                            plan_qty=float(data.get("planQty", data.get("plan_qty", 0.0))),
                            price=float(data.get("price", 0.0)),
                            order=int(data.get("order", idx)),
                            external_id=str(data.get("id", ""))
                        )
                        boq_objects.append(boq_obj)
                    
                    if boq_objects:
                        db.add_all(boq_objects)
                        print(f"Diagram {diag.id}: Migrated {len(boq_objects)} items.")
                
                except Exception as e:
                    print(f"Error parsing JSON for diagram {diag.id}: {e}")
        
        db.commit()

        # Phase 1b: Populate Caches
        print("Calculating initial cache fields...")
        projects = db.query(Project).all()
        for p in projects:
            p_design_val = 0.0
            p_actual_val = 0.0
            
            project_diagrams = db.query(Diagram).filter(Diagram.project_id == p.id).all()
            for d in project_diagrams:
                d_items = db.query(BOQItem).filter(BOQItem.diagram_id == d.id).all()
                d_design_val = sum(item.design_qty * item.price for item in d_items)
                d_actual_val = sum(item.actual_qty * item.price for item in d_items)
                
                if d_design_val > 0:
                    d.cached_progress_percent = round((d_actual_val / d_design_val) * 100, 2)
                else:
                    # Nếu chưa có khối lượng thiết kế nhưng đã có thực tế hoặc item rỗng
                    d.cached_progress_percent = 100.0 if d_items and d_actual_val > 0 else 0.0
                    
                p_design_val += d_design_val
                p_actual_val += d_actual_val
            
            if p_design_val > 0:
                p.cached_progress_percent = round((p_actual_val / p_design_val) * 100, 2)
            else:
                p.cached_progress_percent = 0.0
            
            p.cached_completed_value = p_actual_val
            p.cached_total_diagrams = len(project_diagrams)
            
        db.commit()
        print("Done!")

    except Exception as e:
        print(f"Migration Failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    migrate()
