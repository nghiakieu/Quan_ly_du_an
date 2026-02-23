from fastapi import APIRouter

from app.api.api_v1.endpoints import blocks, config, diagrams, auth, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(blocks.router, prefix="/blocks", tags=["blocks"])
api_router.include_router(config.router, prefix="/config", tags=["config"])
api_router.include_router(diagrams.router, prefix="/diagrams", tags=["diagrams"])
