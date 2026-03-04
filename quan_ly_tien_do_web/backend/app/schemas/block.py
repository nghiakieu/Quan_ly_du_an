from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class BlockBase(BaseModel):
    code: str
    category_name: Optional[str] = None
    pier: Optional[str] = None
    span: Optional[str] = None
    segment: Optional[str] = None
    volume: Optional[float] = None
    unit: Optional[str] = "m³"
    unit_price: Optional[float] = None
    total_value: Optional[float] = None
    status: int = 0
    notes: Optional[str] = None

class BlockCreate(BlockBase):
    pass

class BlockUpdate(BlockBase):
    pass

class Block(BlockBase):
    id: int
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
