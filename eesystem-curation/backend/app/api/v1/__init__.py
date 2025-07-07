"""
API v1 router
"""
from fastapi import APIRouter
from app.api.v1.endpoints import content, auth, users, health, settings

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(content.router, prefix="/content", tags=["content"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])