from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.api.deps import get_db, get_current_active_user, get_current_active_admin
from app.models.project import Project
from app.models.project_user import ProjectUser
from app.models.user import User
from app.schemas.project_member import ProjectMemberAdd, ProjectMemberUpdate, ProjectMemberInfo

router = APIRouter()


@router.get("/{project_id}/members", response_model=List[ProjectMemberInfo])
def get_project_members(
    project_id: int,
    db: Session = Depends(get_db),
):
    """Get all members of a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    members = db.query(ProjectUser).filter(ProjectUser.project_id == project_id).all()
    result = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            result.append(ProjectMemberInfo(
                id=m.id,
                user_id=m.user_id,
                username=user.username,
                role=m.role,
                added_at=m.added_at,
            ))
    return result


@router.post("/{project_id}/members", response_model=ProjectMemberInfo)
def add_project_member(
    project_id: int,
    data: ProjectMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    """Add a user to a project. Only admin/editor can do this."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already a member
    existing = db.query(ProjectUser).filter(
        ProjectUser.project_id == project_id,
        ProjectUser.user_id == data.user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this project")

    member = ProjectUser(
        project_id=project_id,
        user_id=data.user_id,
        role=data.role,
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return ProjectMemberInfo(
        id=member.id,
        user_id=member.user_id,
        username=user.username,
        role=member.role,
        added_at=member.added_at,
    )


@router.put("/{project_id}/members/{member_id}", response_model=ProjectMemberInfo)
def update_project_member_role(
    project_id: int,
    member_id: int,
    data: ProjectMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    """Update a member's role within a project."""
    member = db.query(ProjectUser).filter(
        ProjectUser.id == member_id,
        ProjectUser.project_id == project_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.role = data.role
    db.commit()
    db.refresh(member)

    user = db.query(User).filter(User.id == member.user_id).first()
    return ProjectMemberInfo(
        id=member.id,
        user_id=member.user_id,
        username=user.username if user else "unknown",
        role=member.role,
        added_at=member.added_at,
    )


@router.delete("/{project_id}/members/{member_id}")
def remove_project_member(
    project_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    """Remove a member from a project."""
    member = db.query(ProjectUser).filter(
        ProjectUser.id == member_id,
        ProjectUser.project_id == project_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(member)
    db.commit()
    return {"message": "Member removed successfully"}
