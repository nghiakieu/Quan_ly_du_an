from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectMemberAdd(BaseModel):
    """Request to add a user to a project."""
    user_id: int
    role: str = "viewer"  # "manager", "editor", "viewer"


class ProjectMemberUpdate(BaseModel):
    """Request to update a member's role."""
    role: str  # "manager", "editor", "viewer"


class ProjectMemberInfo(BaseModel):
    """Response: member info within a project."""
    id: int
    user_id: int
    username: str
    role: str
    added_at: Optional[datetime] = None

    class Config:
        from_attributes = True
