from fastapi import APIRouter

from app.api.api_v1.endpoints import blocks, config, diagrams, auth, users, projects, project_members, tasks, websocket

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(blocks.router, prefix="/blocks", tags=["blocks"])
api_router.include_router(config.router, prefix="/config", tags=["config"])
api_router.include_router(diagrams.router, prefix="/diagrams", tags=["diagrams"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(project_members.router, prefix="/projects", tags=["project-members"])
api_router.include_router(tasks.router, prefix="/projects", tags=["tasks"])
api_router.include_router(websocket.router, prefix="", tags=["websocket"])
