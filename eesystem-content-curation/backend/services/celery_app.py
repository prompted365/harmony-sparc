"""
Celery application for background tasks
"""
from celery import Celery
from core.config import settings

# Create Celery app
celery_app = Celery(
    "eesystem-tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "services.tasks.document_processing",
        "services.tasks.content_generation",
        "services.tasks.publishing",
        "services.tasks.ai_analysis",
        "services.tasks.maintenance"
    ]
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    result_expires=3600,  # 1 hour
)

# Task routing
celery_app.conf.task_routes = {
    "services.tasks.document_processing.*": {"queue": "document_processing"},
    "services.tasks.content_generation.*": {"queue": "content_generation"},
    "services.tasks.publishing.*": {"queue": "publishing"},
    "services.tasks.ai_analysis.*": {"queue": "ai_analysis"},
    "services.tasks.maintenance.*": {"queue": "maintenance"},
}

# Periodic tasks
celery_app.conf.beat_schedule = {
    "cleanup-expired-memories": {
        "task": "services.tasks.maintenance.cleanup_expired_memories",
        "schedule": 3600.0,  # Every hour
    },
    "update-analytics": {
        "task": "services.tasks.maintenance.update_analytics",
        "schedule": 1800.0,  # Every 30 minutes
    },
    "process-scheduled-publications": {
        "task": "services.tasks.publishing.process_scheduled_publications",
        "schedule": 300.0,  # Every 5 minutes
    },
}