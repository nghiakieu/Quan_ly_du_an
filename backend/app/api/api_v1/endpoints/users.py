from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.schemas.user import User as UserSchema

router = APIRouter()

@router.get("/", response_model=List[UserSchema])
def read_users(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_admin),
) -> Any:
    """
    Retrieve users. Only allowed for admins.
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@router.put("/{user_id}/approve", response_model=UserSchema)
def approve_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: User = Depends(deps.get_current_active_admin),
) -> Any:
    """
    Approve a user by setting is_active=True. Only allowed for admins.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = True
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.put("/{user_id}/role", response_model=UserSchema)
def update_user_role(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    role: str,
    current_user: User = Depends(deps.get_current_active_admin),
) -> Any:
    """
    Update a user's role (admin, editor, viewer). Only allowed for admins.
    """
    if current_user.role != "admin": # Only true admins can change roles
        raise HTTPException(status_code=403, detail="Only 'admin' can change roles")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if role not in ["admin", "editor", "viewer"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be admin, editor, or viewer")

    user.role = role
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}", response_model=UserSchema)
def delete_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: User = Depends(deps.get_current_active_admin),
) -> Any:
    """
    Delete a user. Only allowed for admins.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return user
