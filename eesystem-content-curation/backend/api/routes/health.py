"""
Health check API routes
"""
from datetime import datetime
from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from core.database import get_db, health_check
from core.config import settings

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check_endpoint(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Health check endpoint
    """
    try:
        # Check database health
        db_health = await health_check()
        
        # Overall health status
        is_healthy = all(db_health.values())
        
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0",
            "services": {
                "database": {
                    "sqlite": {
                        "status": "healthy" if db_health["sqlite"] else "unhealthy"
                    },
                    "astra": {
                        "status": "healthy" if db_health["astra"] else "unhealthy"
                    }
                },
                "redis": {
                    "status": "unknown"  # Will be implemented with Redis integration
                },
                "celery": {
                    "status": "unknown"  # Will be implemented with Celery integration
                }
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }


@router.get("/health/ready")
async def readiness_check() -> Dict[str, Any]:
    """
    Readiness check endpoint
    """
    return {
        "status": "ready",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/live")
async def liveness_check() -> Dict[str, Any]:
    """
    Liveness check endpoint
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat()
    }