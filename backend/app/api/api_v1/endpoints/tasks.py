from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.deps import get_db, get_current_active_user
from app.models.task import Task
from app.models.project import Project
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate, TaskReorder, TaskResponse

router = APIRouter()


def _task_to_response(task: Task, db: Session) -> TaskResponse:
    """Convert Task model to TaskResponse with assignee name."""
    assignee_name = None
    if task.assigned_to:
        user = db.query(User).filter(User.id == task.assigned_to).first()
        if user:
            assignee_name = user.username
    return TaskResponse(
        id=task.id,
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        assigned_to=task.assigned_to,
        assignee_name=assignee_name,
        order_index=task.order_index,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.get("/{project_id}/tasks", response_model=List[TaskResponse])
def get_project_tasks(
    project_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get all tasks for a project, optionally filtered by status."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(Task).filter(Task.project_id == project_id)
    if status:
        query = query.filter(Task.status == status)
    tasks = query.order_by(Task.order_index, Task.created_at).all()
    return [_task_to_response(t, db) for t in tasks]


@router.post("/{project_id}/tasks", response_model=TaskResponse)
def create_task(
    project_id: int,
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new task in a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get max order_index for the status column
    max_order = db.query(Task).filter(
        Task.project_id == project_id,
        Task.status == (data.status or "todo")
    ).count()

    task = Task(
        project_id=project_id,
        title=data.title,
        description=data.description,
        status=data.status or "todo",
        priority=data.priority or "medium",
        assigned_to=data.assigned_to,
        order_index=max_order,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_to_response(task, db)


@router.put("/{project_id}/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    project_id: int,
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update a task."""
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return _task_to_response(task, db)


@router.delete("/{project_id}/tasks/{task_id}")
def delete_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a task."""
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}


@router.put("/{project_id}/tasks-reorder/{status}")
def reorder_tasks(
    project_id: int,
    status: str,
    data: TaskReorder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Reorder tasks within a status column after drag-drop."""
    for index, task_id in enumerate(data.task_ids):
        task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
        if task:
            task.order_index = index
            task.status = status
    db.commit()
    return {"message": "Tasks reordered"}
