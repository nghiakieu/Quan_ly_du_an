from fastapi import APIRouter

from app.api.api_v1.endpoints import blocks, config, diagrams

api_router = APIRouter()
api_router.include_router(blocks.router, prefix="/blocks", tags=["blocks"])
api_router.include_router(config.router, prefix="/config", tags=["config"])
api_router.include_router(diagrams.router, prefix="/diagrams", tags=["diagrams"])
