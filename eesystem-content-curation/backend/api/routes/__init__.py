"""
API routes for the EESystem Content Curation Platform
"""
from .auth import router as auth_router
from .health import router as health_router
from .content import router as content_router
from .document import router as document_router
from .agent import router as agent_router
from .search import router as search_router
from .publishing import router as publishing_router
from .brand import router as brand_router
from .analytics import router as analytics_router
from .memory import router as memory_router
from .llm import router as llm_router

__all__ = [
    "auth_router",
    "health_router",
    "content_router",
    "document_router",
    "agent_router",
    "search_router",
    "publishing_router",
    "brand_router",
    "analytics_router",
    "memory_router",
    "llm_router",
]