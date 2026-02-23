from typing import Optional, Any, List, Dict
from pydantic import BaseModel
from datetime import datetime

class DiagramBase(BaseModel):
    name: str
    description: Optional[str] = None

class DiagramCreate(DiagramBase):
    objects: str  # JSON string
    boq_data: str # JSON string

class DiagramUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    objects: Optional[str] = None
    boq_data: Optional[str] = None

class Diagram(DiagramBase):
    id: int
    objects: Optional[str] = None
    boq_data: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
