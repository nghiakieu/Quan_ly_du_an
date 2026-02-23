import pandas as pd
from typing import List, Dict, Any
from io import BytesIO
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.block import Block

# Status mapping
STATUS_TEXT = {
    0: "Chưa",
    1: "Đang",
    2: "Xong"
}

STATUS_FROM_TEXT = {
    "chưa": 0, "chua": 0,
    "đang": 1, "dang": 1,
    "xong": 2, "hoàn thành": 2, "hoan thanh": 2, "done": 2
}

def parse_status(value) -> int:
    """Parse status from various formats."""
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value) if 0 <= value <= 2 else 0
    
    text = str(value).lower().strip()
    return STATUS_FROM_TEXT.get(text, 0)

class ExcelService:
    @staticmethod
    def process_excel_file(file_content: bytes, db: Session) -> Dict[str, Any]:
        """
        Process uploaded Excel file and update database.
        """
        try:
            # Read Excel using pandas
            df = pd.read_excel(BytesIO(file_content), header=1) # Assuming header is on row 2 (index 1)
            
            # Rename columns to match model
            # Assuming columns: Code, Category, Pier, Span, Segment, Volume, Unit, Price, Total, Status, CompletedAt, Notes
            # Need to map by index or verify names
            
            blocks_processed = 0
            blocks_updated = 0
            
            for index, row in df.iterrows():
                if pd.isna(row.iloc[0]):  # Skip empty rows based on code
                    continue
                    
                code = str(row.iloc[0]).strip()
                
                block_data = {
                    "code": code,
                    "category_name": str(row.iloc[1]).strip() if not pd.isna(row.iloc[1]) else "",
                    "pier": str(row.iloc[2]).strip() if not pd.isna(row.iloc[2]) else None,
                    "span": str(row.iloc[3]).strip() if not pd.isna(row.iloc[3]) else None,
                    "segment": str(row.iloc[4]).strip() if not pd.isna(row.iloc[4]) else None,
                    "volume": float(row.iloc[5]) if not pd.isna(row.iloc[5]) else 0.0,
                    "unit": str(row.iloc[6]).strip() if not pd.isna(row.iloc[6]) else "m³",
                    "unit_price": float(row.iloc[7]) if not pd.isna(row.iloc[7]) else 0.0,
                    "total_value": float(row.iloc[8]) if not pd.isna(row.iloc[8]) else 0.0,
                    "status": parse_status(row.iloc[9]),
                    "notes": str(row.iloc[11]).strip() if len(row) > 11 and not pd.isna(row.iloc[11]) else None
                }
                
                # Check if block exists
                existing_block = db.query(Block).filter(Block.code == code).first()
                if existing_block:
                    # Update existing
                    for key, value in block_data.items():
                        setattr(existing_block, key, value)
                    blocks_updated += 1
                else:
                    # Create new
                    new_block = Block(**block_data)
                    db.add(new_block)
                    blocks_processed += 1
            
            db.commit()
            
            return {
                "status": "success",
                "message": f"Processed {blocks_processed} new blocks, updated {blocks_updated} existing blocks.",
                "new_count": blocks_processed,
                "updated_count": blocks_updated
            }
            
        except Exception as e:
            db.rollback()
            return {"status": "error", "message": str(e)}

    @staticmethod
    def get_stats(db: Session) -> Dict[str, Any]:
        """
        Get project statistics.
        """
        total_blocks = db.query(Block).count()
        completed = db.query(Block).filter(Block.status == 2).count()
        in_progress = db.query(Block).filter(Block.status == 1).count()
        not_started = db.query(Block).filter(Block.status == 0).count()
        
        # Calculate value completion
        # Ideally sum(total_value) where status=2, but for now just count
        total_value_sum = 0 # query sum
        completed_value_sum = 0 # query sum
        
        # Using python sum for simplicity if dataset is small, or specialized query
        all_blocks = db.query(Block).all()
        total_value_sum = sum(b.total_value or 0 for b in all_blocks)
        completed_value_sum = sum(b.total_value or 0 for b in all_blocks if b.status == 2)
        
        progress_percent = (completed_value_sum / total_value_sum * 100) if total_value_sum > 0 else 0
        
        return {
            "total_blocks": total_blocks,
            "completed": completed,
            "in_progress": in_progress,
            "not_started": not_started,
            "progress_percent": round(progress_percent, 2),
            "total_value": total_value_sum,
            "completed_value": completed_value_sum
        }
