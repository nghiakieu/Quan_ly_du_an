from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Any, Dict

from app.db.database import get_db, engine
from app.models.block import Block as BlockModel
from app.schemas.block import Block
from app.services.excel_service import ExcelService
from app.models import block as models
from app.api import deps
from app.models.user import User

# Create tables if not exist (quick setup for dev)
models.Base.metadata.create_all(bind=engine)

router = APIRouter()

@router.get("/", response_model=List[Block])
def read_blocks(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
) -> Any:
    """
    Retrieve blocks.
    """
    blocks = db.query(BlockModel).offset(skip).limit(limit).all()
    return blocks

@router.get("/stats")
def read_stats(db: Session = Depends(get_db)) -> Any:
    """
    Get dashboard statistics.
    """
    return ExcelService.get_stats(db)

@router.post("/upload")
async def upload_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Upload Excel file to update blocks.
    """
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload Excel file.")
    
    content = await file.read()
    result = ExcelService.process_excel_file(content, db)
    
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
        
    return result

@router.delete("/")
def clear_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Clear all data (Dev only).
    """
    db.query(BlockModel).delete()
    db.commit()
    return {"message": "All data cleared"}
