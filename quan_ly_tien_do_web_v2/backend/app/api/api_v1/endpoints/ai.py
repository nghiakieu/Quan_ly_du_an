from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session
import google.generativeai as genai
import json
import traceback
import time
from datetime import datetime

from app.api.deps import get_db
from app.models.diagram import Diagram as DiagramModel
from app.models.project import Project as ProjectModel
from app.models.boq import BOQItem as BOQItemModel
from app.models.task import Task as TaskModel
from app.api import deps
from app.models.user import User
from app.core.config import settings

router = APIRouter()

# Initialize Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

# ============================================================
# SCHEMA
# ============================================================
class ChatMessage(BaseModel):
    role: str  # "user" | "ai"
    content: str

class ChatRequest(BaseModel):
    message: str
    api_key: str | None = None
    history: List[ChatMessage] = []  # Multi-turn conversation history
    project_id: Optional[int] = None  # If None => all projects

# ============================================================
# UTILITIES
# ============================================================
def safe_float(val, default: float = 0.0) -> float:
    """Safely convert any value to float, handling None, empty string, etc."""
    if val is None or val == '':
        return default
    try:
        result = float(val)
        return result if result == result else default  # NaN check
    except (ValueError, TypeError):
        return default

# ============================================================
# GLOBAL IN-MEMORY CACHE (per scope)
# Key strategy:
#   - "all"               => summary for toàn bộ dự án
#   - f"project:{id}"     => summary cho 1 dự án cụ thể
# ============================================================
_global_ai_context_cache: Dict[str, str] = {}
_global_ai_context_timestamp: Dict[str, float] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes

def invalidate_ai_cache(project_id: Optional[int] = None):
    """
    Xóa cache AI.
    - Nếu project_id=None  => xóa toàn bộ cache (all scopes)
    - Nếu project_id!=None => xóa cache cho project đó + cache "all"
    """
    global _global_ai_context_cache, _global_ai_context_timestamp
    if project_id is None:
        _global_ai_context_cache.clear()
        _global_ai_context_timestamp.clear()
    else:
        key = f"project:{project_id}"
        _global_ai_context_cache.pop(key, None)
        _global_ai_context_timestamp.pop(key, None)
        # Cache tổng hợp "all" cũng cần làm mới
        _global_ai_context_cache.pop("all", None)
        _global_ai_context_timestamp.pop("all", None)

# ============================================================
# DATA PROCESSING PIPELINE
# Step 1: Extract raw data from DB
# Step 2: Process Objects → grouped components + financial metrics
# Step 3: Process BOQ → sorted by value, top items
# Step 4: Process Tasks → kanban summary
# Step 5: Aggregate KPI per project
# Step 6: Serialize to compact JSON string for AI context
# ============================================================
#
# Diagram object progress types (stored in each object in diagram.objects JSON):
# - "percentage": totalQuantity, actualQuantity, unit → progress_pct = actual/total*100
# - "segments": segments[] with { id, name, weight (0..1), status } → progress_pct = sum(weight where status=='completed')*100
# - "none" or missing: single status field → progress_pct 0|50|100
# ============================================================

def _resolve_object_progress(obj: dict) -> tuple:
    """
    Resolve effective status and progress_pct (0..100) from an diagram object.
    Returns (effective_status, progress_pct).
    """
    progress_type = obj.get("progressType") or "none"
    if progress_type == "percentage":
        total = safe_float(obj.get("totalQuantity"), 0)
        actual = safe_float(obj.get("actualQuantity"), 0)
        if total <= 0:
            return ("not_started", 0.0)
        pct = min(100.0, (actual / total) * 100.0)
        if pct >= 99.99:
            return ("completed", 100.0)
        if pct <= 0:
            return ("not_started", 0.0)
        return ("in_progress", round(pct, 1))
    if progress_type == "segments":
        segments = obj.get("segments") or []
        if not segments:
            return (obj.get("status") or "not_started", 0.0)
        total_weight = 0.0
        completed_weight = 0.0
        has_in_progress = False
        for seg in segments:
            w = safe_float(seg.get("weight"), 1.0 / max(len(segments), 1))
            total_weight += w
            s = (seg.get("status") or "not_started").lower()
            if s == "completed":
                completed_weight += w
            elif s in ("in_progress", "in progress"):
                has_in_progress = True
        if total_weight <= 0:
            return ("not_started", 0.0)
        pct = (completed_weight / total_weight) * 100.0
        if pct >= 99.99:
            return ("completed", 100.0)
        if pct <= 0 and not has_in_progress:
            return ("not_started", 0.0)
        return ("in_progress" if has_in_progress or pct > 0 else "not_started", round(pct, 1))
    # none / legacy: single status
    status = obj.get("status") or "not_started"
    if status == "completed":
        return ("completed", 100.0)
    if status == "in_progress":
        return ("in_progress", 50.0)
    return ("not_started", 0.0)


def _process_diagram_objects(objects: list, boq_data: list) -> dict:
    """
    Step 2: Process diagram objects into structured analytics.
    
    Input: raw objects list + boq_data list
    Output: {
        "component_groups": { label: { counts, financial, timeline } },
        "monthly_cashflow": { "YYYY-MM": value },
        "totals": { total_components, completed, in_progress, ... }
    }
    """
    # Build BOQ lookup dict for O(1) price resolution
    boq_dict = {}
    for item in boq_data:
        item_id = str(item.get('id', ''))
        if item_id:
            boq_dict[item_id] = item

    component_groups = {}
    monthly_cashflow = {}
    totals = {
        "total_components": 0,
        "completed": 0,
        "in_progress": 0,
        "not_started": 0,
        "total_value": 0.0,
        "completed_value": 0.0,
        "in_progress_value": 0.0,
        "remaining_value": 0.0
    }

    for obj in objects:
        if obj.get('type') not in ('rectangle', 'circle'):
            continue

        label = obj.get('label', 'Không tên')
        metadata = obj.get('metadata', {})
        completed_at = metadata.get('completedAt') or obj.get('completionDate')

        # ----- Resolve effective status and progress % (supports percentage + segments) -----
        status, progress_pct = _resolve_object_progress(obj)

        # ----- Calculate value from BOQ mapping or fallback -----
        value = 0.0
        boq_ids_map = obj.get('boqIds')
        if boq_ids_map and isinstance(boq_ids_map, dict):
            for bid, assigned_qty in boq_ids_map.items():
                master_item = boq_dict.get(str(bid), {})
                price = safe_float(master_item.get('unitPrice', 0))
                value += safe_float(assigned_qty) * price
        else:
            fallback_val = obj.get('contractAmount')
            if fallback_val:
                value = safe_float(fallback_val)
            else:
                value = safe_float(obj.get('designQty', 0)) * safe_float(obj.get('unitPrice', 0))

        # ----- Initialize group if new -----
        if label not in component_groups:
            component_groups[label] = {
                "count": 0,
                "status": {"not_started": 0, "in_progress": 0, "completed": 0},
                "value": {"total": 0, "completed": 0, "in_progress": 0, "remaining": 0},
                "timeline": []
            }

        grp = component_groups[label]
        grp["count"] += 1
        totals["total_components"] += 1

        # ----- Status counting (by effective status) -----
        if status in grp["status"]:
            grp["status"][status] += 1
        if status == "completed":
            totals["completed"] += 1
        elif status == "in_progress":
            totals["in_progress"] += 1
        else:
            totals["not_started"] += 1

        # ----- Financial aggregation (by progress %) -----
        completed_val = value * (progress_pct / 100.0)
        remaining_val = value * (1.0 - progress_pct / 100.0)
        grp["value"]["total"] += value
        grp["value"]["completed"] += completed_val
        grp["value"]["remaining"] += remaining_val
        if status == "in_progress":
            grp["value"]["in_progress"] += value
            totals["in_progress_value"] += value
        totals["total_value"] += value
        totals["completed_value"] += completed_val
        totals["remaining_value"] += remaining_val

        # ----- Completion timeline + monthly cashflow -----
        if status == 'completed' and completed_at:
            grp["timeline"].append(completed_at)
            try:
                dt_obj = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
                month_key = dt_obj.strftime("%Y-%m")
            except Exception:
                month_key = str(completed_at)[:7]

            monthly_cashflow[month_key] = monthly_cashflow.get(month_key, 0) + value

    # Round financial values for cleaner output
    totals["total_value"] = round(totals["total_value"], 0)
    totals["completed_value"] = round(totals["completed_value"], 0)
    totals["in_progress_value"] = round(totals["in_progress_value"], 0)
    totals["remaining_value"] = round(totals["remaining_value"], 0)

    for grp in component_groups.values():
        for k in grp["value"]:
            grp["value"][k] = round(grp["value"][k], 0)

    return {
        "component_groups": component_groups,
        "monthly_cashflow": dict(sorted(monthly_cashflow.items())),
        "totals": totals
    }


def _process_boq_top_items(boq_data: list, top_n: int = 20) -> dict:
    """
    Step 3: Extract top BOQ items sorted by estimated value (desc).
    
    Returns: { "total_items": N, "top_items": [...], "total_estimated_value": X }
    """
    def item_value(item):
        return safe_float(item.get('designQty', 0)) * safe_float(item.get('unitPrice', 0))

    sorted_boq = sorted(boq_data, key=item_value, reverse=True)

    top_items = []
    for item in sorted_boq[:top_n]:
        top_items.append({
            "name": str(item.get('name', ''))[:80],
            "qty": safe_float(item.get('designQty', 0)),
            "unit": item.get('unit', ''),
            "price": safe_float(item.get('unitPrice', 0)),
            "est_value": round(item_value(item), 0),
            "status": item.get('status', 0),
        })

    return {
        "total_items": len(boq_data),
        "shown": len(top_items),
        "total_estimated_value": round(sum(item_value(i) for i in boq_data), 0),
        "top_items": top_items
    }


def _process_kanban_tasks(db: Session, project_id: int) -> dict:
    """
    Step 4: Summarize Kanban tasks for a project.
    
    Returns: { "todo": N, "in_progress": N, "done": N, "total": N }
    """
    tasks = db.query(TaskModel).filter(TaskModel.project_id == project_id).all()
    summary = {"todo": 0, "in_progress": 0, "done": 0}
    for t in tasks:
        col = t.status if t.status in summary else "todo"
        summary[col] += 1
    summary["total"] = sum(summary.values())
    return summary


def get_summarized_context(
    db: Session,
    project_id: Optional[int] = None,
    force_refresh: bool = False,
) -> str:
    """
    Main pipeline: Load → Process → Cache → Return context string.
    
    Data Flow:
      DB → Step 1 (Extract) → Step 2-4 (Process) → Step 5 (Aggregate KPI) → Step 6 (Serialize)
    """
    global _global_ai_context_cache, _global_ai_context_timestamp

    current_time = time.time()
    cache_key = f"project:{project_id}" if project_id is not None else "all"

    # Cache hit?
    if (
        not force_refresh
        and cache_key in _global_ai_context_cache
        and (current_time - _global_ai_context_timestamp.get(cache_key, 0)) < CACHE_TTL_SECONDS
    ):
        return _global_ai_context_cache[cache_key]

    print(f"[AI Cache] {'Force refresh' if force_refresh else 'Cache miss'}: Rebuilding context...")

    # ---- STEP 1: Extract raw data ----
    query = db.query(ProjectModel)
    if project_id is not None:
        query = query.filter(ProjectModel.id == project_id)
    all_projects = query.all()
    output = {"projects": []}

    for project in all_projects:
        proj = {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "investor": getattr(project, 'investor', None),
            "budget": getattr(project, 'total_budget', None),
            "start": str(project.start_date)[:10] if getattr(project, 'start_date', None) else None,
            "end": str(project.end_date)[:10] if getattr(project, 'end_date', None) else None,
            "diagrams": [],
            "kanban": _process_kanban_tasks(db, project.id),
        }

        # ---- STEP 2-3: Process each diagram ----
        diagrams = db.query(DiagramModel).filter(DiagramModel.project_id == project.id).all()
        
        project_total_value = 0.0
        project_completed_value = 0.0
        project_total_components = 0
        project_completed_components = 0

        for diagram in diagrams:
            try:
                objects = json.loads(diagram.objects) if diagram.objects else []
                
                db_items = db.query(BOQItemModel).filter(BOQItemModel.diagram_id == diagram.id).all()
                boq_data = [{
                    'id': str(bi.external_id),
                    'name': bi.work_name,
                    'unit': bi.unit,
                    'designQty': bi.design_qty,
                    'actualQty': bi.actual_qty,
                    'planQty': bi.plan_qty,
                    'unitPrice': bi.price,
                } for bi in db_items]

                analysis = _process_diagram_objects(objects, boq_data)
                boq_summary = _process_boq_top_items(boq_data)

                # Accumulate for project KPI
                t = analysis["totals"]
                project_total_value += t["total_value"]
                project_completed_value += t["completed_value"]
                project_total_components += t["total_components"]
                project_completed_components += t["completed"]

                proj["diagrams"].append({
                    "name": diagram.name,
                    "groups": analysis["component_groups"],
                    "cashflow": analysis["monthly_cashflow"],
                    "totals": analysis["totals"],
                    "boq": boq_summary
                })
            except Exception as e:
                print(f"[AI Cache] Warn: Diagram {diagram.id} parse failed: {e}")

        # ---- STEP 5: Aggregate project-level KPI ----
        proj["kpi"] = {
            "total_components": project_total_components,
            "completed": project_completed_components,
            "progress_pct": round(project_completed_components / project_total_components * 100, 1) if project_total_components > 0 else 0,
            "total_value": round(project_total_value, 0),
            "completed_value": round(project_completed_value, 0),
            "financial_pct": round(project_completed_value / project_total_value * 100, 1) if project_total_value > 0 else 0,
            "kanban_done": proj["kanban"]["done"],
            "kanban_total": proj["kanban"]["total"],
        }

        output["projects"].append(proj)

    # ---- STEP 6: Serialize to compact JSON ----
    cache_str = json.dumps(output, ensure_ascii=False, separators=(',', ':'))

    _global_ai_context_cache[cache_key] = cache_str
    _global_ai_context_timestamp[cache_key] = current_time
    print(f"[AI Cache] Built scope='{cache_key}': {len(output['projects'])} projects, {len(cache_str)} chars")

    return cache_str


# ============================================================
# API ENDPOINTS
# ============================================================

@router.get("/sync")
def sync_data_to_ram(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> Any:
    """Force refresh the in-memory cache with latest DB data."""
    try:
        ctx = get_summarized_context(db, project_id=project_id, force_refresh=True)
        return {
            "message": "Đồng bộ dữ liệu lên RAM Server thành công.",
            "timestamp": time.time(),
            "context_size": len(ctx)
        }
    except Exception as e:
        print(f"[AI Sync] Error: {e}")
        raise HTTPException(status_code=500, detail="Không thể đồng bộ dữ liệu vào lúc này.")


# System instruction for Gemini - separated from data for clarity
SYSTEM_INSTRUCTION = """Bạn là Trợ lý AI phân tích dữ liệu Quản lý Dự án Xây dựng.

NHIỆM VỤ:
- Phân tích dữ liệu JSON của TẤT CẢ dự án trong hệ thống
- Trả lời chính xác câu hỏi dựa trên DỮ LIỆU THỰC TẾ, không đoán mò
- Trình bày rõ ràng, dễ hiểu, bằng tiếng Việt

CẤU TRÚC DỮ LIỆU:
- Mỗi project chứa: thông tin chung, diagrams (sơ đồ thi công), kanban (task management), kpi (chỉ số tổng hợp)
- Mỗi diagram chứa: groups (nhóm cấu kiện), cashflow (dòng tiền theo tháng), totals (tổng hợp), boq (bảng khối lượng top items)
- KPI cấp dự án: progress_pct (% tiến độ), financial_pct (% giải ngân), total_value/completed_value (giá trị tiền VNĐ)
- Status cấu kiện: completed (đã xong), in_progress (đang thi công), not_started (chưa bắt đầu)
- Tiến độ hạng mục có thể theo % khối lượng (totalQuantity, actualQuantity) hoặc theo đợt (segments); totals đã phản ánh giá trị theo % hoàn thành

QUY TẮC:
1. Khi hỏi về số lượng → báo cáo COUNT với breakdown theo status
2. Khi hỏi về tiền/giá trị → dùng financial data, đơn vị VNĐ, format số đẹp
3. Khi hỏi tiến độ tháng → dùng cashflow (YYYY-MM: value)
4. Ưu tiên dùng KPI tổng hợp (kpi) thay vì tự tính lại từ groups
5. Nếu user hỏi chung → tổng hợp xuyên suốt tất cả dự án
6. Nếu user hỏi cụ thể 1 dự án → filter đúng project đó"""


@router.post("/chat")
def chat_with_project_data(
    *,
    db: Session = Depends(get_db),
    request_data: ChatRequest,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Chat with AI about project data, supports multi-turn conversation."""
    active_key = request_data.api_key if request_data.api_key else settings.GEMINI_API_KEY
    if not active_key:
        raise HTTPException(
            status_code=500,
            detail="Hệ thống chưa cấu hình API Key. Vui lòng nhập API Key cá nhân."
        )

    # Step 1: Get cached data context (theo project nếu có)
    context_str = get_summarized_context(db, project_id=request_data.project_id)

    # Step 2: Build system instruction with data
    full_system = f"{SYSTEM_INSTRUCTION}\n\n[DỮ LIỆU DỰ ÁN]\n{context_str}"

    # Step 3: Build multi-turn conversation contents
    contents = []
    for msg in request_data.history[-6:]:  # Last 6 messages for context
        role = "user" if msg.role == "user" else "model"
        contents.append({"role": role, "parts": [msg.content]})
    contents.append({"role": "user", "parts": [request_data.message]})

    # Step 4: Call Gemini with structured prompt
    try:
        genai.configure(api_key=active_key)
        model = genai.GenerativeModel(
            'gemini-2.5-flash',
            system_instruction=full_system
        )
        response = model.generate_content(contents)
        return {"response": response.text}
    except Exception as e:
        print(f"[AI Chat] Gemini error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
