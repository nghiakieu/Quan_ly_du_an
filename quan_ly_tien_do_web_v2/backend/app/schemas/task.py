from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "todo"
    priority: Optional[str] = "medium"
    assigned_to: Optional[int] = None
    order_index: Optional[int] = 0


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[int] = None
    order_index: Optional[int] = None


class TaskReorder(BaseModel):
    """Batch reorder tasks within a column."""
    task_ids: list[int]  # Ordered list of task IDs


class TaskResponse(TaskBase):
    id: int
    project_id: int
    assignee_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
