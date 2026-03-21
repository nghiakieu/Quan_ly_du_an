from typing import Any, List, Optional, Dict, AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import google.generativeai as genai
import json
import traceback
import time
import asyncio
from datetime import datetime, timedelta

from app.api.deps import get_db
from app.models.diagram import Diagram as DiagramModel
from app.models.project import Project as ProjectModel
from app.models.boq import BOQItem as BOQItemModel
from app.models.task import Task as TaskModel
from app.models.block import Block as BlockModel
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
# Step 3: Process BOQ → sorted by value, top items + deviation analysis
# Step 4a: Process Tasks → kanban summary
# Step 4b: Process Blocks → category summary (pier/span/segment)  [NEW]
# Step 4c: Calc BOQ deviation → plan vs actual gap               [NEW]
# Step 5: Aggregate KPI per project
# Step 6: Serialize + Smart Compress to compact JSON string       [NEW]
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
    Step 4a: Summarize Kanban tasks for a project.
    
    Returns: { "todo": N, "in_progress": N, "done": N, "total": N }
    """
    tasks = db.query(TaskModel).filter(TaskModel.project_id == project_id).all()
    summary = {"todo": 0, "in_progress": 0, "done": 0}
    for t in tasks:
        col = t.status if t.status in summary else "todo"
        summary[col] += 1
    summary["total"] = sum(summary.values())
    return summary


def _process_blocks_summary(db: Session) -> dict:
    """
    Step 4b [NEW]: Tổng hợp dữ liệu bảng blocks (Trụ/Nhịp/Đốt cầu).
    
    blocks.status: 0=Chưa thi công, 1=Đang thi công, 2=Hoàn thành
    
    Returns: {
        "by_category": { 
            category_name: { total, done, in_progress, not_started, value_total, value_done } 
        },
        "totals": { total, done, in_progress, not_started, value_total, value_done },
        "recent_completions": [{ code, category_name, completed_at, total_value }],
        "stalled_30d": int  -- số blocks đang thi công nhưng không cập nhật >30 ngày
    }
    """
    blocks = db.query(BlockModel).all()
    if not blocks:
        return {}

    by_category = {}
    totals = {"total": 0, "done": 0, "in_progress": 0, "not_started": 0,
              "value_total": 0.0, "value_done": 0.0}
    recent_completions = []
    stalled_count = 0
    cutoff_30d = datetime.now() - timedelta(days=30)

    for b in blocks:
        cat = b.category_name or "Không phân loại"
        if cat not in by_category:
            by_category[cat] = {
                "total": 0, "done": 0, "in_progress": 0, "not_started": 0,
                "value_total": 0.0, "value_done": 0.0
            }

        grp = by_category[cat]
        val = safe_float(b.total_value)

        grp["total"] += 1
        grp["value_total"] += val
        totals["total"] += 1
        totals["value_total"] += val

        if b.status == 2:  # Hoàn thành
            grp["done"] += 1
            grp["value_done"] += val
            totals["done"] += 1
            totals["value_done"] += val
            # Collect recent completions (last 60 days)
            if b.completed_at and b.completed_at >= (datetime.now() - timedelta(days=60)):
                recent_completions.append({
                    "code": b.code,
                    "cat": cat[:30],
                    "done_at": str(b.completed_at)[:10],
                    "value": round(val, 0)
                })
        elif b.status == 1:  # Đang thi công
            grp["in_progress"] += 1
            totals["in_progress"] += 1
            # Detect stalled: in_progress but completed_at is None and created long ago
            # (We use completed_at=None as proxy for "not updated recently")
            if b.completed_at is None:
                stalled_count += 1
        else:  # Chưa thi công
            grp["not_started"] += 1
            totals["not_started"] += 1

    # Round values
    totals["value_total"] = round(totals["value_total"], 0)
    totals["value_done"] = round(totals["value_done"], 0)
    for grp in by_category.values():
        grp["value_total"] = round(grp["value_total"], 0)
        grp["value_done"] = round(grp["value_done"], 0)

    # Sort recent completions by date desc, keep top 10
    recent_completions.sort(key=lambda x: x["done_at"], reverse=True)
    recent_completions = recent_completions[:10]

    return {
        "by_category": by_category,
        "totals": totals,
        "recent_completions": recent_completions,
        "stalled_in_progress": stalled_count,
        "progress_pct": round(totals["done"] / totals["total"] * 100, 1) if totals["total"] > 0 else 0
    }


def _calc_boq_deviation(boq_items: list) -> dict:
    """
    Step 4c [NEW]: Tính độ lệch khối lượng kế hoạch vs thực tế cho từng BOQ item.
    
    deviation_pct = (actual_qty - plan_qty) / plan_qty * 100
    
    Returns: {
        "over_items": [...],   -- vượt kế hoạch > 10%
        "under_items": [...],  -- thấp hơn kế hoạch > 10%  
        "on_track": int,       -- số items trong phạm vi ±10%
        "no_plan": int         -- items không có plan_qty
    }
    """
    over_items = []
    under_items = []
    on_track = 0
    no_plan = 0

    for item in boq_items:
        plan = safe_float(item.get('planQty') or item.get('plan_qty'), 0)
        actual = safe_float(item.get('actualQty') or item.get('actual_qty'), 0)
        name = str(item.get('name') or item.get('work_name', ''))[:60]
        unit = item.get('unit', '')

        if plan <= 0:
            no_plan += 1
            continue

        dev_pct = (actual - plan) / plan * 100.0

        if dev_pct > 10.0:
            over_items.append({
                "name": name,
                "plan": round(plan, 2),
                "actual": round(actual, 2),
                "unit": unit,
                "dev_pct": round(dev_pct, 1)
            })
        elif dev_pct < -10.0:
            under_items.append({
                "name": name,
                "plan": round(plan, 2),
                "actual": round(actual, 2),
                "unit": unit,
                "dev_pct": round(dev_pct, 1)
            })
        else:
            on_track += 1

    # Sort by absolute deviation
    over_items.sort(key=lambda x: x["dev_pct"], reverse=True)
    under_items.sort(key=lambda x: x["dev_pct"])

    return {
        "over_plan": over_items[:10],   # Top 10 vượt kế hoạch
        "under_plan": under_items[:10], # Top 10 thấp hơn kế hoạch
        "on_track": on_track,
        "no_plan": no_plan
    }


def _compress_context(output: dict, max_chars: int = 90000) -> dict:
    """
    Step 6b [NEW]: Smart context compression để tránh token overflow với dự án lớn.
    
    Chiến lược:
    1. Luôn giữ: project info, KPI, kanban, blocks summary
    2. Cắt bớt cashflow: chỉ giữ 6 tháng gần nhất
    3. Giảm top_items BOQ từ 20 → 5 nếu cần
    4. Chỉ giữ top 5 component_groups theo total_value
    """
    # Quick check nếu không cần compress
    test_str = json.dumps(output, ensure_ascii=False)
    if len(test_str) <= max_chars:
        return output

    print(f"[AI Compress] Context {len(test_str)} chars > {max_chars}, compressing...")

    for proj in output.get("projects", []):
        for diag in proj.get("diagrams", []):

            # 1. Trim cashflow: chỉ giữ 6 tháng gần nhất
            cashflow = diag.get("cashflow", {})
            if len(cashflow) > 6:
                sorted_keys = sorted(cashflow.keys())
                diag["cashflow"] = {k: cashflow[k] for k in sorted_keys[-6:]}

            # 2. Giảm BOQ top_items: chỉ giữ top 5
            boq = diag.get("boq", {})
            if boq.get("top_items") and len(boq["top_items"]) > 5:
                boq["top_items"] = boq["top_items"][:5]
                boq["shown"] = 5

            # 3. Chỉ giữ top 5 component_groups theo total_value
            groups = diag.get("groups", {})
            if len(groups) > 5:
                sorted_groups = sorted(
                    groups.items(),
                    key=lambda x: x[1].get("value", {}).get("total", 0),
                    reverse=True
                )
                diag["groups"] = dict(sorted_groups[:5])
                diag["groups_note"] = f"(Hiển thị top 5/{len(groups)} nhóm theo giá trị)"

    # 4. Remove timeline arrays (not useful for AI context)
    for proj in output.get("projects", []):
        for diag in proj.get("diagrams", []):
            for grp in diag.get("groups", {}).values():
                grp.pop("timeline", None)

    compressed_str = json.dumps(output, ensure_ascii=False)
    print(f"[AI Compress] Compressed to {len(compressed_str)} chars")
    return output


def get_summarized_context(
    db: Session,
    project_id: Optional[int] = None,
    force_refresh: bool = False,
) -> str:
    """
    Main pipeline: Load → Process → Cache → Return context string.
    
    Data Flow:
      DB → Step 1 (Extract) → Step 2-4c (Process) → Step 5 (KPI) → Step 6 (Serialize+Compress)
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
        project_all_boq_items = []  # Collect all BOQ items for deviation analysis

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

                # Collect all BOQ items for deviation analysis
                project_all_boq_items.extend(boq_data)

                proj["diagrams"].append({
                    "name": diagram.name,
                    "groups": analysis["component_groups"],
                    "cashflow": analysis["monthly_cashflow"],
                    "totals": analysis["totals"],
                    "boq": boq_summary
                })
            except Exception as e:
                print(f"[AI Cache] Warn: Diagram {diagram.id} parse failed: {e}")

        # ---- STEP 4c [NEW]: BOQ Deviation Analysis ----
        if project_all_boq_items:
            proj["boq_deviation"] = _calc_boq_deviation(project_all_boq_items)

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

    # ---- STEP 4b [NEW]: Process Blocks (global, not per-project) ----
    blocks_summary = _process_blocks_summary(db)
    if blocks_summary:
        output["blocks_summary"] = blocks_summary

    # ---- STEP 6 [NEW]: Smart Compress + Serialize ----
    output = _compress_context(output)
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

1. PROJECTS — Danh sách dự án:
   - Thông tin chung: name, investor, budget, start/end date, status
   - diagrams: danh sách sơ đồ thi công của dự án
   - kanban: {todo, in_progress, done, total} — quản lý task
   - kpi: {progress_pct, financial_pct, total_value, completed_value, ...}
   - boq_deviation: phân tích lệch kế hoạch khối lượng

2. DIAGRAMS — Sơ đồ thi công:
   - groups: nhóm cấu kiện {count, status:{not_started,in_progress,completed}, value:{total,completed,remaining}}
   - cashflow: dòng tiền hoàn thành theo tháng {"YYYY-MM": value_VND}
   - totals: tổng hợp toàn sơ đồ
   - boq: bảng khối lượng top items (designQty, actualQty, unitPrice, est_value)

3. BLOCKS_SUMMARY — Dữ liệu thi công chi tiết (Trụ/Nhịp/Đốt):
   - by_category: theo loại hạng mục {total, done, in_progress, not_started, value_total, value_done}
   - totals: tổng toàn bộ blocks
   - recent_completions: danh sách hoàn thành gần đây (60 ngày)
   - stalled_in_progress: số blocks đang thi công nhưng chưa cập nhật ngày hoàn thành
   - progress_pct: % hoàn thành toàn bộ blocks

4. BOQ_DEVIATION — Phân tích lệch kế hoạch:
   - over_plan: hạng mục vượt kế hoạch >10% (dev_pct > 10)
   - under_plan: hạng mục thấp hơn kế hoạch >10% (dev_pct < -10)
   - on_track: số hạng mục trong phạm vi ±10%

QUY TẮC PHÂN TÍCH:
1. Khi hỏi về số lượng → báo cáo COUNT với breakdown theo status
2. Khi hỏi về tiền/giá trị → dùng financial data, đơn vị VNĐ, format số đẹp (tỷ/triệu)
3. Khi hỏi tiến độ tháng → dùng cashflow (YYYY-MM: value)
4. Ưu tiên dùng KPI tổng hợp (kpi) thay vì tự tính lại từ groups
5. Nếu user hỏi chung → tổng hợp xuyên suốt tất cả dự án
6. Nếu user hỏi cụ thể 1 dự án → filter đúng project đó
7. Khi hỏi về Trụ/Nhịp/Đốt → dùng blocks_summary.by_category
8. KHI PHÁT HIỆN RỦI RO → chủ động cảnh báo:
   - 🔴 NGUY HIỂM: progress_pct < 30% mà đã qua 50% thời gian dự án
   - ⚠️ VƯỢT KHỐI LƯỢNG: boq_deviation.over_plan có hạng mục dev_pct > 20%
   - 🟡 ĐÌNH TRỆ: blocks_summary.stalled_in_progress > 5
   - 🟡 TẮC NGHẼN: kanban.todo > 70% tổng tasks"""


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


@router.post("/chat/stream")
def chat_stream(
    *,
    db: Session = Depends(get_db),
    request_data: ChatRequest,
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    [Phase 2] Streaming AI chat via Server-Sent Events (SSE).

    Response format (text/event-stream):
      data: {"token": "<chunk_text>"}\n\n   -- partial text chunk
      data: {"done": true}\n\n              -- stream completion signal
      data: {"error": "<message>"}\n\n       -- error signal
    """
    active_key = request_data.api_key if request_data.api_key else settings.GEMINI_API_KEY
    if not active_key:
        def err_gen():
            yield f'data: {json.dumps({"error": "Chưa cấu hình API Key"}, ensure_ascii=False)}\n\n'
        return StreamingResponse(err_gen(), media_type="text/event-stream")

    context_str = get_summarized_context(db, project_id=request_data.project_id)
    full_system = f"{SYSTEM_INSTRUCTION}\n\n[DỮ LIỆU DỰ ÁN]\n{context_str}"

    contents = []
    for msg in request_data.history[-6:]:
        role = "user" if msg.role == "user" else "model"
        contents.append({"role": role, "parts": [msg.content]})
    contents.append({"role": "user", "parts": [request_data.message]})

    def event_generator():
        try:
            genai.configure(api_key=active_key)
            model = genai.GenerativeModel(
                'gemini-2.5-flash',
                system_instruction=full_system
            )
            response_stream = model.generate_content(contents, stream=True)

            for chunk in response_stream:
                if chunk.text:
                    payload = json.dumps({"token": chunk.text}, ensure_ascii=False)
                    yield f"data: {payload}\n\n"

            # Signal stream completion
            yield f'data: {json.dumps({"done": True})}\n\n'

        except Exception as e:
            print(f"[AI Stream] Error: {e}")
            traceback.print_exc()
            err_payload = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Connection": "keep-alive",
        }
    )


@router.get("/risk-analysis")
def get_risk_analysis(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    [Phase 3] Phân tích rủi ro tự động nâng cao.
    
    Mỗi risk gồm: level, icon, project, type, weight_score (0-100),
    message, detail, action_suggestion.
    """
    risks = []
    context_str = get_summarized_context(db, project_id=project_id)

    try:
        data = json.loads(context_str)
    except Exception:
        raise HTTPException(status_code=500, detail="Không thể phân tích dữ liệu")

    today = datetime.now()

    for proj in data.get("projects", []):
        proj_name = proj.get("name", f"Dự án #{proj.get('id')}")
        proj_id   = proj.get("id")
        kpi       = proj.get("kpi", {})
        kanban    = proj.get("kanban", {})
        deviation = proj.get("boq_deviation", {})

        # ── Risk 1: Tiến độ trễ theo thời gian ──────────────────────────────
        start_str = proj.get("start")
        end_str   = proj.get("end")
        if start_str and end_str:
            try:
                start_dt      = datetime.fromisoformat(start_str)
                end_dt        = datetime.fromisoformat(end_str)
                total_days    = max((end_dt - start_dt).days, 1)
                elapsed_days  = max((today - start_dt).days, 0)
                time_pct      = min(elapsed_days / total_days * 100, 100)
                progress_pct  = kpi.get("progress_pct", 0)
                gap           = time_pct - progress_pct  # dương = trễ

                if gap >= 30 and time_pct >= 40:
                    days_remaining = (end_dt - today).days
                    risks.append({
                        "id": f"{proj_id}_schedule_critical",
                        "level": "CRITICAL",
                        "icon": "🔴",
                        "project": proj_name,
                        "project_id": proj_id,
                        "type": "schedule_delay",
                        "weight_score": min(int(gap * 1.5), 100),
                        "message": f"Trễ tiến độ nghiêm trọng: qua {time_pct:.0f}% thời gian nhưng chỉ đạt {progress_pct:.1f}%",
                        "detail": f"Chênh lệch {gap:.1f}pp. Còn {days_remaining} ngày đến hạn.",
                        "action_suggestion": "Tăng cường nguồn lực, họp khẩn với chủ đầu tư, xem xét điều chỉnh tiến độ hợp đồng.",
                    })
                elif gap >= 15 and time_pct >= 30:
                    risks.append({
                        "id": f"{proj_id}_schedule_warning",
                        "level": "WARNING",
                        "icon": "⚠️",
                        "project": proj_name,
                        "project_id": proj_id,
                        "type": "schedule_delay",
                        "weight_score": min(int(gap * 0.9), 80),
                        "message": f"Nguy cơ trễ hạn: {time_pct:.0f}% thời gian, tiến độ {progress_pct:.1f}%",
                        "detail": f"Chênh lệch {gap:.1f}pp. Cần đẩy nhanh để bù đắp.",
                        "action_suggestion": "Rà soát lịch thi công, ưu tiên các hạng mục trên đường tới hạn.",
                    })
            except Exception:
                pass

        # ── Risk 2: BOQ vượt kế hoạch ────────────────────────────────────────
        over_items  = deviation.get("over_plan", [])
        severe_over = [i for i in over_items if i.get("dev_pct", 0) > 30]
        mild_over   = [i for i in over_items if 15 < i.get("dev_pct", 0) <= 30]

        if severe_over:
            top3    = ", ".join(i.get("name", "?")[:25] for i in severe_over[:3])
            max_dev = max(i.get("dev_pct", 0) for i in severe_over)
            risks.append({
                "id": f"{proj_id}_boq_severe",
                "level": "CRITICAL",
                "icon": "🔴",
                "project": proj_name,
                "project_id": proj_id,
                "type": "boq_overrun",
                "weight_score": min(int(max_dev * 1.2), 95),
                "message": f"{len(severe_over)} hạng mục BOQ vượt kế hoạch >30%: {top3}",
                "detail": f"Lệch tối đa {max_dev:.1f}%. Nguy cơ vượt tổng dự toán.",
                "action_suggestion": "Rà soát HĐ, lập biên bản phát sinh, xin điều chỉnh dự toán nếu cần.",
            })
        elif mild_over:
            top3 = ", ".join(i.get("name", "?")[:25] for i in mild_over[:3])
            risks.append({
                "id": f"{proj_id}_boq_mild",
                "level": "WARNING",
                "icon": "⚠️",
                "project": proj_name,
                "project_id": proj_id,
                "type": "boq_overrun",
                "weight_score": 45,
                "message": f"{len(mild_over)} hạng mục BOQ vượt 15–30%: {top3}",
                "detail": "Cần giám sát chặt để tránh leo thang.",
                "action_suggestion": "Kiểm tra lại dự toán, xác nhận với bên A về khối lượng thực tế.",
            })

        # ── Risk 3: Tài chính thấp hơn tiến độ vật lý ───────────────────────
        financial_pct = kpi.get("financial_pct", 0)
        progress_pct2 = kpi.get("progress_pct", 0)
        if progress_pct2 > 50 and financial_pct < 20:
            risks.append({
                "id": f"{proj_id}_financial_low",
                "level": "WARNING",
                "icon": "💰",
                "project": proj_name,
                "project_id": proj_id,
                "type": "financial_lag",
                "weight_score": 55,
                "message": f"Tiến độ {progress_pct2:.1f}% nhưng giải ngân chỉ {financial_pct:.1f}%",
                "detail": "Rủi ro thiếu vốn — nhà thầu có thể chậm thi công vì chưa được thanh toán.",
                "action_suggestion": "Xúc tiến hồ sơ thanh toán, kiểm tra quy trình phê duyệt giải ngân.",
            })

        # ── Risk 4: Kanban tắc nghẽn ─────────────────────────────────────────
        kanban_total = kanban.get("total", 0)
        kanban_todo  = kanban.get("todo",  0)
        kanban_done  = kanban.get("done",  0)
        if kanban_total >= 5:
            todo_ratio = kanban_todo / kanban_total
            if todo_ratio > 0.7:
                risks.append({
                    "id": f"{proj_id}_kanban_backlog",
                    "level": "WARNING",
                    "icon": "📋",
                    "project": proj_name,
                    "project_id": proj_id,
                    "type": "kanban_backlog",
                    "weight_score": int(todo_ratio * 70),
                    "message": f"Kanban tắc nghẽn: {kanban_todo}/{kanban_total} tasks chưa bắt đầu ({todo_ratio*100:.0f}%)",
                    "detail": f"Chỉ {kanban_done/kanban_total*100:.0f}% tasks đã hoàn thành.",
                    "action_suggestion": "Phân công lại nhân sự, ưu tiên tasks và loại bỏ tasks thừa.",
                })

    # ── Risk 5: Blocks đình trệ — query DB trực tiếp ─────────────────────────
    try:
        stalled_blocks = (
            db.query(BlockModel)
            .filter(BlockModel.status == "in_progress")
            .filter(BlockModel.completion_date == None)  # noqa: E711
            .all()
        )

        if stalled_blocks:
            stall_details  = []
            very_stalled   = []

            for blk in stalled_blocks:
                ref_date = getattr(blk, "updated_at", None) or getattr(blk, "created_at", None)
                blk_name = getattr(blk, "name", None) or getattr(blk, "label", None) or f"Block #{blk.id}"
                if ref_date:
                    if getattr(ref_date, "tzinfo", None):
                        ref_date = ref_date.replace(tzinfo=None)
                    stall_d = (today - ref_date).days
                    rec = {"name": blk_name, "stall_days": stall_d, "category": getattr(blk, "category", "")}
                    stall_details.append(rec)
                    if stall_d >= 7:
                        very_stalled.append(rec)
                else:
                    stall_details.append({"name": blk_name, "stall_days": None, "category": ""})

            total_stalled     = len(stalled_blocks)
            very_stalled_count = len(very_stalled)

            if very_stalled_count > 0:
                sorted_vs = sorted(very_stalled, key=lambda x: x["stall_days"], reverse=True)
                top3 = ", ".join(f"{b['name']} ({b['stall_days']}d)" for b in sorted_vs[:3])
                risks.append({
                    "id": "global_blocks_stalled_severe",
                    "level": "CRITICAL" if very_stalled_count > 10 else "WARNING",
                    "icon": "🧱",
                    "project": "Toàn hệ thống",
                    "project_id": None,
                    "type": "blocks_stalled",
                    "weight_score": min(very_stalled_count * 5 + 30, 90),
                    "message": f"{very_stalled_count} blocks đình trệ ≥7 ngày: {top3}",
                    "detail": f"Tổng {total_stalled} blocks in_progress không có completion_date.",
                    "action_suggestion": "Cập nhật trạng thái thi công, xác nhận tiến độ thực tế với đội hiện trường.",
                    "stall_items": sorted(stall_details, key=lambda x: x.get("stall_days") or 0, reverse=True)[:10],
                })
            elif total_stalled > 5:
                risks.append({
                    "id": "global_blocks_stalled_mild",
                    "level": "INFO",
                    "icon": "🟡",
                    "project": "Toàn hệ thống",
                    "project_id": None,
                    "type": "blocks_stalled",
                    "weight_score": 25,
                    "message": f"{total_stalled} blocks in_progress chưa có completion_date",
                    "detail": "Cần cập nhật thông tin hoàn thành cho các blocks đang thi công.",
                    "action_suggestion": "Nhắc nhở đội hiện trường cập nhật completion_date khi hoàn thành.",
                })
    except Exception as e:
        print(f"[Risk] Block stall check failed: {e}")

    # ── Sort by weight_score desc ─────────────────────────────────────────────
    risks.sort(key=lambda r: r.get("weight_score", 0), reverse=True)

    critical_list = [r for r in risks if r["level"] == "CRITICAL"]
    warning_list  = [r for r in risks if r["level"] == "WARNING"]
    info_list     = [r for r in risks if r["level"] == "INFO"]

    return {
        "risks":       risks,
        "top_risks":   risks[:3],
        "total":       len(risks),
        "critical":    len(critical_list),
        "warning":     len(warning_list),
        "info":        len(info_list),
        "has_critical": len(critical_list) > 0,
        "summary": (
            f"🔴 {len(critical_list)} nghiêm trọng, "
            f"⚠️ {len(warning_list)} cảnh báo, "
            f"🟡 {len(info_list)} thông tin"
            if risks else "✅ Không phát hiện rủi ro đáng kể"
        ),
        "generated_at": today.isoformat(),
    }

