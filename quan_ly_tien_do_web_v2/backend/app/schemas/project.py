from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "planning"
    investor: Optional[str] = None
    total_budget: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    investor: Optional[str] = None
    total_budget: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

# Diagram summary for embedding in project response
class DiagramSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Project(ProjectBase):
    id: int
    manager_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    diagrams: List[DiagramSummary] = []

    class Config:
        from_attributes = True
