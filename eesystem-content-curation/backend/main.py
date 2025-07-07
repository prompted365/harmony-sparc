"""
EESystem Content Curation Platform - FastAPI Backend
Main application entry point
"""
import os
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
import structlog

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.routes import (
    content_router,
    document_router,
    agent_router,
    search_router,
    publishing_router,
    brand_router,
    analytics_router,
    memory_router,
    llm_router,
    auth_router,
    health_router
)
from core.database import init_db, close_db
from core.config import settings
from core.middleware import (
    ErrorHandlerMiddleware,
    RequestLoggingMiddleware,
    SecurityHeadersMiddleware,
    RateLimitMiddleware
)
from core.exceptions import CustomException

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager"""
    logger.info("Starting EESystem Content Curation Platform")
    
    # Initialize database connections
    await init_db()
    
    # Initialize background tasks
    # Note: Celery worker should be started separately
    
    yield
    
    # Cleanup
    logger.info("Shutting down EESystem Content Curation Platform")
    await close_db()


# Create FastAPI application
app = FastAPI(
    title="EESystem Content Curation Platform",
    description="AI-powered content curation and management platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(ErrorHandlerMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# Mount static files
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers
app.include_router(health_router, prefix="/api/v1", tags=["health"])
app.include_router(auth_router, prefix="/api/v1", tags=["authentication"])
app.include_router(content_router, prefix="/api/v1", tags=["content"])
app.include_router(document_router, prefix="/api/v1", tags=["documents"])
app.include_router(agent_router, prefix="/api/v1", tags=["agents"])
app.include_router(search_router, prefix="/api/v1", tags=["search"])
app.include_router(publishing_router, prefix="/api/v1", tags=["publishing"])
app.include_router(brand_router, prefix="/api/v1", tags=["brand"])
app.include_router(analytics_router, prefix="/api/v1", tags=["analytics"])
app.include_router(memory_router, prefix="/api/v1", tags=["memory"])
app.include_router(llm_router, prefix="/api/v1", tags=["llm"])


@app.exception_handler(CustomException)
async def custom_exception_handler(request: Request, exc: CustomException):
    """Handle custom exceptions"""
    logger.error(
        "Custom exception occurred",
        error_code=exc.error_code,
        error_message=exc.message,
        path=request.url.path,
        method=request.method
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details
            }
        }
    )


@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "EESystem Content Curation Platform API",
        "version": "1.0.0",
        "docs": "/api/docs",
        "health": "/api/v1/health"
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
        access_log=True
    )