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

def get_summarized_context(db: Session) -> str:
    """Load all projects and summarize data to string for AI context, with caching."""
    global _global_ai_context_cache, _global_ai_context_timestamp
    
    current_time = time.time()
    if _global_ai_context_cache is not None and (current_time - _global_ai_context_timestamp) < CACHE_TTL_SECONDS:
        return _global_ai_context_cache
        
    print("AI Cache Miss: Reloading ALL projects from DB...")
    
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
                
                # Group Objects by Label for Richer Context instead of naive truncation
                object_groups = {}
                for obj in objects:
                    if obj.get('type') in ['rectangle', 'circle']:
                        label = obj.get('label', 'Một phần công trình')
                        st = obj.get('status', 'not_started')
                        metadata = obj.get('metadata', {})
                        completed_at = metadata.get('completedAt')
                        
                        if label not in object_groups:
                            object_groups[label] = {
                                "total_count": 0,
                                "status_counts": {"not_started": 0, "in_progress": 0, "completed": 0, "planned": 0},
                                "completion_timeline": [] # Chỉ lưu ngày hoàn thành của các item trong nhóm này
                            }
                            
                        grp = object_groups[label]
                        grp["total_count"] += 1
                        if st in grp["status_counts"]:
                            grp["status_counts"][st] += 1
                        
                        if st == 'completed' and completed_at:
                            # Lưu lại một mốc thời gian hoàn thành (không cần lưu ID để tiết kiệm mem)
                            grp["completion_timeline"].append(completed_at)
                
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
                    "component_groups_summary": object_groups, # Nhóm component thông minh
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
Dưới đây là Cấu trúc Dữ liệu JSON chứa toàn bộ thông tin của TẤT CẢ các Dự Án (all_projects), mỗi dự án đi kèm với (diagrams) bao gồm Bảng khối lượng (boq) và Trạng thái thi công.
Chú thích Trạng thái: 'completed' (đã xong), 'in_progress' (đang thi công), 'not_started' (chưa bắt đầu).

[DỮ LIỆU TỔNG HỢP TOÀN BỘ DỰ ÁN]
{context_str}

[YÊU CẦU CỦA NGƯỜI DÙNG]
{request_data.message}

Hãy Lắng nghe Yêu cầu để xem người dùng đang hỏi về DỰ ÁN NÀO, hay là hỏi CHUNG TẤT CẢ Dự án để đưa lời phân tích chính xác nhất. Hạn chế đoán mò.
Trình bày rõ ràng, dễ hiểu, sử dụng tiếng Việt. Có dấu mác Markdown. Phân tích chi tiết số liệu trạng thái thi công.
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
