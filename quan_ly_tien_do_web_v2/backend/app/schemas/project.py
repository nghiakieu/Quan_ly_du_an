from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "active"
    investor: Optional[str] = None
    total_budget: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    map_url: Optional[str] = None
    drive_url: Optional[str] = None
    sheet_url: Optional[str] = None

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
    map_url: Optional[str] = None
    drive_url: Optional[str] = None
    sheet_url: Optional[str] = None

# Lightweight diagram info for project list page (no objects/boq_data)
class DiagramBrief(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    updated_at: Optional[datetime] = None
    cached_progress_percent: Optional[float] = None
    cached_target_value: Optional[float] = None
    cached_completed_value: Optional[float] = None

    class Config:
        from_attributes = True

# Full diagram summary for single project detail page
class DiagramSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    objects: Optional[str] = None
    boq_data: Optional[str] = None
    updated_at: Optional[datetime] = None
    cached_progress_percent: Optional[float] = None
    cached_target_value: Optional[float] = None
    cached_completed_value: Optional[float] = None
    cached_plan_value: Optional[float] = None

    class Config:
        from_attributes = True

# Lightweight project for list endpoint (uses DiagramBrief, no heavy data)
class ProjectList(ProjectBase):
    id: int
    manager_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    cached_progress_percent: Optional[float] = None
    cached_total_diagrams: Optional[int] = None
    cached_completed_value: Optional[float] = None
    cached_plan_value: Optional[float] = None
    diagrams: List[DiagramBrief] = []

    class Config:
        from_attributes = True

# Full project for detail endpoint
class Project(ProjectBase):
    id: int
    manager_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    cached_progress_percent: Optional[float] = None
    cached_completed_value: Optional[float] = None
    cached_plan_value: Optional[float] = None
    diagrams: List[DiagramSummary] = []

    class Config:
        from_attributes = True
