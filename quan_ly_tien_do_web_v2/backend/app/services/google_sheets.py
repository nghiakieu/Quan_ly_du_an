import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
import json

# Khai báo quyền truy cập (scope) API
scope = [
    "https://spreadsheets.google.com/feeds",
    'https://www.googleapis.com/auth/spreadsheets',
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive"
]

def get_client():
    # File credentials.json lấy từ thư mục gốc của backend
    creds_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "google-credentials.json")
    if not os.path.exists(creds_path):
        raise Exception(f"Không tìm thấy file chứng chỉ Google tại: {creds_path}\nSếp cần lưu file JSON vào đường dẫn này.")
    
    creds = ServiceAccountCredentials.from_json_keyfile_name(creds_path, scope)
    client = gspread.authorize(creds)
    return client

def sync_from_sheet(sheet_url: str, tab_name: str, current_objects: list) -> list:
    client = get_client()
    sheet = client.open_by_url(sheet_url)
    worksheet = sheet.worksheet(tab_name) if tab_name else sheet.sheet1
    
    # Lấy toàn bộ dữ liệu dưới dạng dictionary (Cột tiêu đề làm Key)
    records = worksheet.get_all_records()
    
    # Tạo map để lookup O(1)
    record_map = {}
    for r in records:
        obj_id = str(r.get("ID Đối tượng", "")).strip()
        if obj_id:
            record_map[obj_id] = r
            
    # Cập nhật danh sách objects hiện tại
    for obj in current_objects:
        obj_id = obj.get("id")
        if obj_id in record_map:
            row_data = record_map[obj_id]
            if "Tên (Label)" in row_data:
                obj["label"] = str(row_data["Tên (Label)"])
            if "Trạng thái" in row_data:
                status_str = str(row_data["Trạng thái"]).strip().lower()
                if status_str in ["hoàn thành", "completed"]:
                    obj["status"] = "completed"
                elif status_str in ["đang làm", "in_progress", "in progress"]:
                    obj["status"] = "in_progress"
                else:
                    obj["status"] = "not_started"
            if "Ngày hoàn thành" in row_data:
                obj["completionDate"] = str(row_data["Ngày hoàn thành"])
                
    return current_objects
    
def sync_to_sheet(sheet_url: str, tab_name: str, current_objects: list):
    client = get_client()
    sheet = client.open_by_url(sheet_url)
    worksheet = sheet.worksheet(tab_name) if tab_name else sheet.sheet1
    
    worksheet.clear()
    headers = ["STT", "ID Đối tượng", "Tên (Label)", "Loại", "Trạng thái", "Ngày hoàn thành"]
    rows = [headers]
    
    # Render dữ liệu
    for idx, obj in enumerate(current_objects):
        status = obj.get("status", "not_started")
        if status == "completed":
            status_vn = "Hoàn thành"
        elif status == "in_progress":
            status_vn = "Đang làm"
        else:
            status_vn = "Chưa bắt đầu"
            
        row = [
            idx + 1,
            obj.get("id", ""),
            obj.get("label", ""),
            obj.get("type", ""),
            status_vn,
            obj.get("completionDate", "")
        ]
        rows.append(row)
        
    worksheet.update("A1", rows)
