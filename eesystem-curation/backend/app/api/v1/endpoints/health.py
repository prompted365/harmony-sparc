"""
Health check endpoints for monitoring and deployment
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import redis
import logging
from datetime import datetime
from typing import Dict, Any
import psutil
import os

from app.core.database import get_db
from app.config.settings import settings

router = APIRouter()
logger = logging.getLogger(__name__)


async def check_database_health(db: AsyncSession) -> Dict[str, Any]:
    """Check database connectivity and basic operations"""
    try:
        # Test database connection
        result = await db.execute(text("SELECT 1"))
        result.fetchone()
        
        # Test database write/read
        await db.execute(text("CREATE TABLE IF NOT EXISTS health_check (id SERIAL PRIMARY KEY, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        await db.execute(text("INSERT INTO health_check (timestamp) VALUES (NOW())"))
        await db.commit()
        
        # Clean up old health check records (keep last 10)
        await db.execute(text("DELETE FROM health_check WHERE id NOT IN (SELECT id FROM health_check ORDER BY id DESC LIMIT 10)"))
        await db.commit()
        
        return {
            "status": "healthy",
            "response_time_ms": 0,  # Could measure actual response time
            "checks": {
                "connection": "ok",
                "read": "ok",
                "write": "ok"
            }
        }
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "checks": {
                "connection": "failed",
                "read": "failed",
                "write": "failed"
            }
        }


async def check_redis_health() -> Dict[str, Any]:
    """Check Redis connectivity and basic operations"""
    try:
        # Connect to Redis
        redis_client = redis.from_url(settings.REDIS_URL)
        
        # Test Redis connection
        ping_result = redis_client.ping()
        
        # Test Redis write/read
        test_key = "health_check:timestamp"
        test_value = str(datetime.utcnow().timestamp())
        redis_client.set(test_key, test_value, ex=60)  # Expire in 60 seconds
        retrieved_value = redis_client.get(test_key)
        
        redis_client.close()
        
        if retrieved_value and retrieved_value.decode() == test_value:
            return {
                "status": "healthy",
                "checks": {
                    "connection": "ok",
                    "ping": "ok",
                    "read": "ok",
                    "write": "ok"
                }
            }
        else:
            return {
                "status": "unhealthy",
                "error": "Redis read/write test failed",
                "checks": {
                    "connection": "ok",
                    "ping": "ok",
                    "read": "failed",
                    "write": "failed"
                }
            }
    except Exception as e:
        logger.error(f"Redis health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "checks": {
                "connection": "failed",
                "ping": "failed",
                "read": "failed",
                "write": "failed"
            }
        }


def get_system_metrics() -> Dict[str, Any]:
    """Get system performance metrics"""
    try:
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        
        # Memory usage
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        memory_available = memory.available
        
        # Disk usage
        disk = psutil.disk_usage('/')
        disk_percent = disk.percent
        disk_free = disk.free
        
        # Process info
        process = psutil.Process()
        process_memory = process.memory_info().rss / 1024 / 1024  # MB
        process_cpu = process.cpu_percent()
        
        return {
            "cpu": {
                "usage_percent": cpu_percent,
                "count": cpu_count,
                "process_percent": process_cpu
            },
            "memory": {
                "usage_percent": memory_percent,
                "available_bytes": memory_available,
                "process_mb": process_memory
            },
            "disk": {
                "usage_percent": disk_percent,
                "free_bytes": disk_free
            }
        }
    except Exception as e:
        logger.error(f"System metrics collection failed: {str(e)}")
        return {
            "error": str(e),
            "cpu": {"usage_percent": 0, "count": 0, "process_percent": 0},
            "memory": {"usage_percent": 0, "available_bytes": 0, "process_mb": 0},
            "disk": {"usage_percent": 0, "free_bytes": 0}
        }


@router.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "service": "eesystem-curation-backend",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": os.getenv("NODE_ENV", "development")
    }


@router.get("/health/detailed")
async def detailed_health_check(db: AsyncSession = Depends(get_db)):
    """Detailed health check with dependency checks"""
    start_time = datetime.utcnow()
    
    # Check database health
    db_health = await check_database_health(db)
    
    # Check Redis health
    redis_health = await check_redis_health()
    
    # Get system metrics
    system_metrics = get_system_metrics()
    
    # Calculate overall health status
    overall_status = "healthy"
    if db_health["status"] != "healthy" or redis_health["status"] != "healthy":
        overall_status = "unhealthy"
    elif system_metrics.get("cpu", {}).get("usage_percent", 0) > 90:
        overall_status = "degraded"
    elif system_metrics.get("memory", {}).get("usage_percent", 0) > 90:
        overall_status = "degraded"
    elif system_metrics.get("disk", {}).get("usage_percent", 0) > 90:
        overall_status = "degraded"
    
    end_time = datetime.utcnow()
    response_time = (end_time - start_time).total_seconds() * 1000
    
    health_report = {
        "status": overall_status,
        "service": "eesystem-curation-backend",
        "version": "1.0.0",
        "timestamp": end_time.isoformat(),
        "environment": os.getenv("NODE_ENV", "development"),
        "response_time_ms": response_time,
        "dependencies": {
            "database": db_health,
            "redis": redis_health
        },
        "system": system_metrics
    }
    
    # Return appropriate HTTP status code
    if overall_status == "unhealthy":
        raise HTTPException(status_code=503, detail=health_report)
    
    return health_report


@router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness check for Kubernetes/Railway deployment"""
    try:
        # Check if database is ready
        await db.execute(text("SELECT 1"))
        
        # Check if Redis is ready
        redis_client = redis.from_url(settings.REDIS_URL)
        redis_client.ping()
        redis_client.close()
        
        return {
            "status": "ready",
            "service": "eesystem-curation-backend",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Readiness check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not_ready",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )


@router.get("/health/live")
async def liveness_check():
    """Liveness check for Kubernetes/Railway deployment"""
    return {
        "status": "alive",
        "service": "eesystem-curation-backend",
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_seconds": psutil.boot_time()
    }


@router.get("/metrics")
async def metrics_endpoint():
    """Prometheus-style metrics endpoint"""
    metrics = get_system_metrics()
    
    # Format as Prometheus metrics
    prometheus_metrics = f"""
# HELP eesystem_cpu_usage_percent CPU usage percentage
# TYPE eesystem_cpu_usage_percent gauge
eesystem_cpu_usage_percent {metrics['cpu']['usage_percent']}

# HELP eesystem_memory_usage_percent Memory usage percentage
# TYPE eesystem_memory_usage_percent gauge
eesystem_memory_usage_percent {metrics['memory']['usage_percent']}

# HELP eesystem_disk_usage_percent Disk usage percentage
# TYPE eesystem_disk_usage_percent gauge
eesystem_disk_usage_percent {metrics['disk']['usage_percent']}

# HELP eesystem_process_memory_mb Process memory usage in MB
# TYPE eesystem_process_memory_mb gauge
eesystem_process_memory_mb {metrics['memory']['process_mb']}

# HELP eesystem_process_cpu_percent Process CPU usage percentage
# TYPE eesystem_process_cpu_percent gauge
eesystem_process_cpu_percent {metrics['cpu']['process_percent']}
"""
    
    return prometheus_metrics.strip()