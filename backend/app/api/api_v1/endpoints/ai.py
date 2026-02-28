from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session
import google.generativeai as genai
import json
import traceback
import time
from datetime import datetime

from app.db.database import get_db
from app.models.diagram import Diagram as DiagramModel
from app.models.project import Project as ProjectModel
from app.api import deps
from app.models.user import User
from app.core.config import settings

router = APIRouter()

# Initialize Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

class ChatRequest(BaseModel):
    message: str
    api_key: str | None = None

# ---- GLOBAL IN-MEMORY CACHE FOR AI CONTEXT ----
_global_ai_context_cache = None
_global_ai_context_timestamp = 0
CACHE_TTL_SECONDS = 300  # 5 phút

def get_summarized_context(db: Session, force_refresh: bool = False) -> str:
    """Load all projects and summarize data to string for AI context, with caching."""
    global _global_ai_context_cache, _global_ai_context_timestamp
    
    current_time = time.time()
    
    if not force_refresh and _global_ai_context_cache is not None and (current_time - _global_ai_context_timestamp) < CACHE_TTL_SECONDS:
        return _global_ai_context_cache
        
    print(f"AI Cache Miss (Force: {force_refresh}): Reloading ALL projects from DB...")
    
    all_projects = db.query(ProjectModel).all()
    context_data = {"all_projects": []}
    
    for project in all_projects:
        proj_dict = {
            "project_id": project.id,
            "project_name": project.name,
            "description": project.description,
            "status": project.status,
            "diagrams": []
        }
        
        diagrams = db.query(DiagramModel).filter(DiagramModel.project_id == project.id).all()
        for diagram in diagrams:
            try:
                objects = json.loads(diagram.objects) if diagram.objects else []
                boq_data = json.loads(diagram.boq_data) if diagram.boq_data else []
                
                # Master BOQ dict for quick lookup
                boq_dict = {str(item.get('id', '')): item for item in boq_data}
                
                # Group Objects by Label for Richer Context and Financial Analytics
                object_groups = {}
                completed_value_by_month = {} # Format: {"2024-02": 500000000}
                
                for obj in objects:
                    if obj.get('type') in ['rectangle', 'circle']:
                        label = obj.get('label', 'Một phần công trình')
                        st = obj.get('status', 'not_started')
                        metadata = obj.get('metadata', {})
                        
                        # Fallback for completion timestamp/date
                        completed_at = metadata.get('completedAt') or obj.get('completionDate')
                        
                        # Calculate Value
                        value = 0.0
                        boq_ids_map = obj.get('boqIds')
                        if boq_ids_map and isinstance(boq_ids_map, dict):
                            # Mapped object logic (boqId: assigned_qty)
                            for bid, assigned_qty in boq_ids_map.items():
                                master_item = boq_dict.get(str(bid), {})
                                price = master_item.get('unitPrice', 0)
                                try:
                                    value += float(assigned_qty) * float(price)
                                except (ValueError, TypeError):
                                    pass
                        else:
                            # Fallback standard object logic
                            fallback_val = obj.get('contractAmount') 
                            if not fallback_val:
                                qty = obj.get('designQty') or 0
                                price = obj.get('unitPrice') or 0
                                try:
                                    value = float(qty) * float(price)
                                except (ValueError, TypeError):
                                    value = 0.0
                            else:
                                try:
                                    value = float(fallback_val)
                                except ValueError:
                                    value = 0.0
                                    
                        # Initialize Group
                        if label not in object_groups:
                            object_groups[label] = {
                                "total_count": 0,
                                "status_counts": {"not_started": 0, "in_progress": 0, "completed": 0, "planned": 0},
                                "financial_summary": {
                                    "total_value": 0,
                                    "completed_value": 0,
                                    "in_progress_value": 0,
                                    "remaining_value": 0
                                },
                                "completion_timeline": [] 
                            }
                            
                        grp = object_groups[label]
                        grp["total_count"] += 1
                        
                        if st in grp["status_counts"]:
                            grp["status_counts"][st] += 1
                        
                        # Add value to financial summary
                        grp["financial_summary"]["total_value"] += value
                        if st == 'completed':
                            grp["financial_summary"]["completed_value"] += value
                        elif st == 'in_progress':
                            grp["financial_summary"]["in_progress_value"] += value
                        else:
                            grp["financial_summary"]["remaining_value"] += value
                        
                        # Process Completion Timeline & Monthly Value
                        if st == 'completed' and completed_at:
                            grp["completion_timeline"].append(completed_at)
                            
                            # Extract YYYY-MM for Monthly Aggregation
                            try:
                                # Convert ISO string or simple YYYY-MM-DD to YYYY-MM
                                dt_obj = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
                                month_key = dt_obj.strftime("%Y-%m")
                            except Exception:
                                month_key = str(completed_at)[:7] # fallback string slicing YYYY-MM
                                
                            if month_key not in completed_value_by_month:
                                completed_value_by_month[month_key] = 0
                            completed_value_by_month[month_key] += value
                
                # Truncate BOQ: Lấy Top 30 mục đắt nhất hoặc chỉ lấy tổng khối lượng
                compact_boq = []
                for item in boq_data[:30]: 
                    compact_boq.append({
                        "name": item.get('name', '')[:80], # Trim text
                        "designQty": item.get('designQty', 0),
                        "unit": item.get('unit', '')
                    })
                
                proj_dict["diagrams"].append({
                    "diagram_name": diagram.name,
                    "component_groups_summary": object_groups, 
                    "completed_value_by_month": completed_value_by_month, # Dòng tiền hoàn thành theo tháng của Sơ đồ
                    "boq_sample_items": compact_boq
                })
            except Exception as e:
                print(f"Warn: Parse diagram {diagram.id} fail: {e}")
                
        context_data["all_projects"].append(proj_dict)
        
    # Nén JSON
    cache_str = json.dumps(context_data, ensure_ascii=False)
    
    # Update Cache
    _global_ai_context_cache = cache_str
    _global_ai_context_timestamp = current_time
    
    return cache_str

@router.get("/sync")
def sync_data_to_ram(db: Session = Depends(get_db)) -> Any:
    """
    Force refresh the in-memory cache with the latest DB data.
    """
    try:
        get_summarized_context(db, force_refresh=True)
        return {"message": "Đồng bộ dữ liệu lên RAM Server thành công.", "timestamp": time.time()}
    except Exception as e:
        print(f"Lỗi khi đồng bộ CACHE: {e}")
        raise HTTPException(status_code=500, detail="Không thể đồng bộ dữ liệu vào lúc này.")

@router.post("/chat")
def chat_with_project_data(
    *,
    db: Session = Depends(get_db),
    request_data: ChatRequest,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Chat with AI about project data.
    """
    active_key = request_data.api_key if request_data.api_key else settings.GEMINI_API_KEY
    if not active_key:
        raise HTTPException(status_code=500, detail="Hệ thống chưa cấu hình API Key. Vui lòng nhập API Key cá nhân của bạn trong phần Cài đặt.")

    # 1. Trích xuất Context có Caching Thông Minh
    context_str = get_summarized_context(db)

    # 2. Gọi Gemini API
    prompt = f"""Bạn là một trợ lý ảo phân tích dữ liệu Quản lý Dự án, nhiệm vụ của bạn là truy vấn thông tin TỔNG QUAN XUYÊN SUỐT các dự án của hệ thống để trả lời người dùng.
Dưới đây là Cấu trúc Dữ liệu JSON chứa thông tin của TẤT CẢ các Dự Án (all_projects). Mỗi dự án sẽ đi kèm với Sơ đồ (diagrams), Bảng khối lượng (boq_sample_items) và Cấu trúc tóm tắt cấu kiện (component_groups_summary).
Chú ý các chỉ số quan trọng: 'completed' (đã xong), 'in_progress' (đang thi công), 'not_started' (chưa bắt đầu).

[ĐẶC BIỆT LƯU Ý VỀ TÀI CHÍNH / TIẾN ĐỘ THÁNG LÀM VIỆC]
- Mỗi Cấu kiện (Group) đều có `financial_summary` chứa các trường Giá trị Tiền: `total_value` (Tổng giá trị), `completed_value` (Giá trị đã làm xong), `remaining_value` (Giá trị còn lại chưa làm). Đơn vị tiền tệ hiển thị tự nhiên (VNĐ).
- Để biết tiến độ làm xong của tháng nào, hãy xem danh sách `completion_timeline` của từng Cấu kiện. Đặc biệt, hãy dùng mục `completed_value_by_month` (biểu đồ Dòng tiền Hoàn Thành Theo Tháng có Format Key là YYYY-MM) để tính toán nhanh TỔNG TIỀN KIẾM ĐƯỢC CỦA MỖI THÁNG trong dự án thay vì phải tự đếm thủ công.

[DỮ LIỆU TỔNG HỢP TOÀN BỘ DỰ ÁN]
{context_str}

[YÊU CẦU CỦA NGƯỜI DÙNG]
{request_data.message}

Hãy Lắng nghe Yêu cầu để xem người dùng đang hỏi về DỰ ÁN NÀO, hay là hỏi CHUNG TẤT CẢ Dự án để đưa lời phân tích chính xác nhất. Hạn chế đoán mò.
Trình bày rõ ràng, dễ hiểu, sử dụng tiếng Việt. Nếu người dùng hỏi về Số lượng, báo cáo Số Lượng. Nếu hỏi về Giá Trị (Tiền, Tổng mức), báo cáo Giá Trị và Tháng Hoàn Thành. Bạn có quyền tính tổng Giá trị của nhiều Nhóm Cấu Kiện lại với nhau để ra số Tổng cho Từng Sơ đồ.
"""
    try:
        genai.configure(api_key=active_key)
        model = genai.GenerativeModel('gemini-2.5-flash') # Sử dụng model 2.5-flash có sẵn và xử lý context tốt
        response = model.generate_content(prompt)
        return {"response": response.text}
    except Exception as e:
         print(f"Lỗi gọi Gemini: {e}")
         traceback.print_exc()
         raise HTTPException(status_code=500, detail=str(e))
