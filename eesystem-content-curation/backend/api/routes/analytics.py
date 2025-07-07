"""
Analytics and performance tracking API routes
"""
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from pydantic import BaseModel
import structlog

from core.database import get_db
from core.security import get_current_user_payload, require_permission, Permission
from core.exceptions import AnalyticsError
from models.analytics import Analytics, AnalyticsEvent, AnalyticsReport, ContentAnalytics, UserAnalytics

logger = structlog.get_logger(__name__)

router = APIRouter()


# Response models
class AnalyticsOverview(BaseModel):
    total_content: int
    total_documents: int
    total_users: int
    total_agents: int
    content_published_today: int
    content_views_today: int
    top_content_types: List[Dict[str, Any]]
    recent_activity: List[Dict[str, Any]]


class ContentMetrics(BaseModel):
    content_id: int
    title: str
    views: int
    likes: int
    shares: int
    comments: int
    engagement_rate: float
    performance_score: float


class UserMetrics(BaseModel):
    user_id: int
    username: str
    content_created: int
    content_published: int
    total_views: int
    avg_engagement: float


@router.get("/analytics/overview", response_model=AnalyticsOverview)
async def get_analytics_overview(
    current_user: Dict[str, Any] = Depends(require_permission(Permission.VIEW_ANALYTICS)),
    db: AsyncSession = Depends(get_db)
) -> AnalyticsOverview:
    """
    Get analytics overview dashboard
    """
    try:
        from models.content import Content
        from models.document import Document
        from models.user import User
        from models.agent import Agent
        
        # Get total counts
        total_content = await db.scalar(select(func.count(Content.id)))
        total_documents = await db.scalar(select(func.count(Document.id)))
        total_users = await db.scalar(select(func.count(User.id)))
        total_agents = await db.scalar(select(func.count(Agent.id)))
        
        # Get today's metrics
        today = datetime.utcnow().date()
        today_start = datetime.combine(today, datetime.min.time())
        
        content_published_today = await db.scalar(
            select(func.count(Content.id)).where(
                and_(
                    Content.status == "published",
                    Content.publish_date >= today_start
                )
            )
        )
        
        # Get total views today (sum from content analytics)
        content_views_today = await db.scalar(
            select(func.sum(ContentAnalytics.views)).where(
                ContentAnalytics.date >= today_start
            )
        ) or 0
        
        # Get top content types
        top_content_types_result = await db.execute(
            select(
                Content.content_type,
                func.count(Content.id).label('count')
            ).group_by(Content.content_type)
            .order_by(func.count(Content.id).desc())
            .limit(5)
        )
        
        top_content_types = [
            {"type": row.content_type, "count": row.count}
            for row in top_content_types_result.fetchall()
        ]
        
        # Get recent activity
        recent_events = await db.execute(
            select(AnalyticsEvent)
            .order_by(AnalyticsEvent.timestamp.desc())
            .limit(10)
        )
        
        recent_activity = [
            {
                "event_type": event.event_type,
                "event_name": event.event_name,
                "timestamp": event.timestamp.isoformat(),
                "properties": event.properties
            }
            for event in recent_events.scalars().all()
        ]
        
        return AnalyticsOverview(
            total_content=total_content or 0,
            total_documents=total_documents or 0,
            total_users=total_users or 0,
            total_agents=total_agents or 0,
            content_published_today=content_published_today or 0,
            content_views_today=content_views_today,
            top_content_types=top_content_types,
            recent_activity=recent_activity
        )
        
    except Exception as e:
        logger.error(f"Analytics overview failed: {e}")
        raise AnalyticsError(f"Failed to get analytics overview: {str(e)}")


@router.get("/analytics/content", response_model=List[ContentMetrics])
async def get_content_analytics(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    days: int = Query(30, ge=1, le=365),
    content_type: Optional[str] = None,
    sort_by: str = Query("views", regex="^(views|likes|shares|engagement_rate|performance_score)$"),
    current_user: Dict[str, Any] = Depends(require_permission(Permission.VIEW_ANALYTICS)),
    db: AsyncSession = Depends(get_db)
) -> List[ContentMetrics]:
    """
    Get content performance analytics
    """
    try:
        from models.content import Content
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Build query
        query = select(
            Content.id,
            Content.title,
            Content.content_type,
            func.sum(ContentAnalytics.views).label('total_views'),
            func.sum(ContentAnalytics.likes).label('total_likes'),
            func.sum(ContentAnalytics.shares).label('total_shares'),
            func.sum(ContentAnalytics.comments).label('total_comments'),
            func.avg(ContentAnalytics.engagement_score).label('avg_engagement'),
            func.avg(ContentAnalytics.performance_score).label('avg_performance')
        ).select_from(
            Content.__table__.join(
                ContentAnalytics.__table__,
                Content.id == ContentAnalytics.content_id,
                isouter=True
            )
        ).where(
            and_(
                Content.status == "published",
                or_(
                    ContentAnalytics.date.is_(None),
                    ContentAnalytics.date >= start_date
                )
            )
        ).group_by(Content.id, Content.title, Content.content_type)
        
        # Apply content type filter
        if content_type:
            query = query.where(Content.content_type == content_type)
        
        # Apply sorting
        sort_column = {
            "views": "total_views",
            "likes": "total_likes", 
            "shares": "total_shares",
            "engagement_rate": "avg_engagement",
            "performance_score": "avg_performance"
        }.get(sort_by, "total_views")
        
        query = query.order_by(getattr(query.column_descriptions[3], sort_column).desc())
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        rows = result.fetchall()
        
        content_metrics = []
        for row in rows:
            views = row.total_views or 0
            likes = row.total_likes or 0
            shares = row.total_shares or 0
            comments = row.total_comments or 0
            
            # Calculate engagement rate
            engagement_rate = 0.0
            if views > 0:
                engagement_rate = ((likes + shares + comments) / views) * 100
            
            content_metrics.append(ContentMetrics(
                content_id=row.id,
                title=row.title,
                views=views,
                likes=likes,
                shares=shares,
                comments=comments,
                engagement_rate=round(engagement_rate, 2),
                performance_score=round(row.avg_performance or 0.0, 2)
            ))
        
        return content_metrics
        
    except Exception as e:
        logger.error(f"Content analytics failed: {e}")
        raise AnalyticsError(f"Failed to get content analytics: {str(e)}")


@router.get("/analytics/users", response_model=List[UserMetrics])
async def get_user_analytics(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    days: int = Query(30, ge=1, le=365),
    current_user: Dict[str, Any] = Depends(require_permission(Permission.VIEW_ANALYTICS)),
    db: AsyncSession = Depends(get_db)
) -> List[UserMetrics]:
    """
    Get user performance analytics
    """
    try:
        from models.user import User
        from models.content import Content
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Build query
        query = select(
            User.id,
            User.username,
            func.count(Content.id).label('content_created'),
            func.sum(
                func.case(
                    (Content.status == "published", 1),
                    else_=0
                )
            ).label('content_published'),
            func.sum(Content.views).label('total_views')
        ).select_from(
            User.__table__.join(
                Content.__table__,
                User.id == Content.author_id,
                isouter=True
            )
        ).where(
            or_(
                Content.created_at.is_(None),
                Content.created_at >= start_date
            )
        ).group_by(User.id, User.username)
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        rows = result.fetchall()
        
        user_metrics = []
        for row in rows:
            content_created = row.content_created or 0
            content_published = row.content_published or 0
            total_views = row.total_views or 0
            
            # Calculate average engagement
            avg_engagement = 0.0
            if content_published > 0:
                avg_engagement = total_views / content_published
            
            user_metrics.append(UserMetrics(
                user_id=row.id,
                username=row.username,
                content_created=content_created,
                content_published=content_published,
                total_views=total_views,
                avg_engagement=round(avg_engagement, 2)
            ))
        
        return user_metrics
        
    except Exception as e:
        logger.error(f"User analytics failed: {e}")
        raise AnalyticsError(f"Failed to get user analytics: {str(e)}")


@router.post("/analytics/events")
async def track_event(
    event_type: str,
    event_name: Optional[str] = None,
    properties: Optional[Dict[str, Any]] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Track an analytics event
    """
    try:
        user_id = int(current_user["sub"])
        
        # Create event
        event = AnalyticsEvent(
            event_type=event_type,
            event_name=event_name,
            properties=properties or {},
            user_id=user_id
        )
        
        db.add(event)
        await db.commit()
        
        logger.info(f"Analytics event tracked: {event_type} for user {user_id}")
        
        return {"message": "Event tracked successfully"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Event tracking failed: {e}")
        raise AnalyticsError(f"Failed to track event: {str(e)}")


@router.get("/analytics/reports", response_model=List[Dict[str, Any]])
async def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    report_type: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.VIEW_ANALYTICS)),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    List analytics reports
    """
    try:
        query = select(AnalyticsReport)
        
        if report_type:
            query = query.where(AnalyticsReport.report_type == report_type)
        
        # Show only user's reports unless admin
        if current_user.get("role") != "admin":
            user_id = int(current_user["sub"])
            query = query.where(AnalyticsReport.created_by == user_id)
        
        query = query.offset(skip).limit(limit).order_by(AnalyticsReport.created_at.desc())
        
        result = await db.execute(query)
        reports = result.scalars().all()
        
        return [
            {
                "id": report.id,
                "name": report.name,
                "description": report.description,
                "report_type": report.report_type,
                "start_date": report.start_date.isoformat() if report.start_date else None,
                "end_date": report.end_date.isoformat() if report.end_date else None,
                "generated_at": report.generated_at.isoformat() if report.generated_at else None,
                "is_scheduled": report.is_scheduled,
                "created_at": report.created_at.isoformat()
            }
            for report in reports
        ]
        
    except Exception as e:
        logger.error(f"Report listing failed: {e}")
        raise AnalyticsError(f"Failed to list reports: {str(e)}")


@router.post("/analytics/reports/generate")
async def generate_report(
    name: str,
    report_type: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    config: Optional[Dict[str, Any]] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.VIEW_ANALYTICS)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Generate an analytics report
    """
    try:
        user_id = int(current_user["sub"])
        
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Generate report data based on type
        report_data = await generate_report_data(report_type, start_date, end_date, config, db)
        
        # Create report record
        report = AnalyticsReport(
            name=name,
            report_type=report_type,
            config=config or {},
            data=report_data,
            start_date=start_date,
            end_date=end_date,
            generated_at=datetime.utcnow(),
            generation_time=0.5,  # TODO: Calculate actual generation time
            created_by=user_id
        )
        
        db.add(report)
        await db.commit()
        await db.refresh(report)
        
        logger.info(f"Analytics report generated: {report.id} by user {user_id}")
        
        return {
            "report_id": report.id,
            "name": report.name,
            "data": report_data,
            "generated_at": report.generated_at.isoformat()
        }
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Report generation failed: {e}")
        raise AnalyticsError(f"Failed to generate report: {str(e)}")


async def generate_report_data(
    report_type: str,
    start_date: datetime,
    end_date: datetime,
    config: Optional[Dict[str, Any]],
    db: AsyncSession
) -> Dict[str, Any]:
    """
    Generate report data based on type
    """
    try:
        if report_type == "content_performance":
            return await generate_content_performance_report(start_date, end_date, db)
        elif report_type == "user_activity":
            return await generate_user_activity_report(start_date, end_date, db)
        elif report_type == "engagement":
            return await generate_engagement_report(start_date, end_date, db)
        else:
            return {"error": f"Unknown report type: {report_type}"}
            
    except Exception as e:
        logger.error(f"Report data generation failed: {e}")
        return {"error": str(e)}


async def generate_content_performance_report(
    start_date: datetime,
    end_date: datetime,
    db: AsyncSession
) -> Dict[str, Any]:
    """Generate content performance report"""
    from models.content import Content
    
    # Get content metrics
    result = await db.execute(
        select(
            func.count(Content.id).label('total_content'),
            func.sum(Content.views).label('total_views'),
            func.avg(Content.views).label('avg_views'),
            func.sum(Content.likes).label('total_likes'),
            func.sum(Content.shares).label('total_shares')
        ).where(
            and_(
                Content.created_at >= start_date,
                Content.created_at <= end_date
            )
        )
    )
    
    row = result.fetchone()
    
    return {
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        },
        "metrics": {
            "total_content": row.total_content or 0,
            "total_views": row.total_views or 0,
            "average_views": round(row.avg_views or 0, 2),
            "total_likes": row.total_likes or 0,
            "total_shares": row.total_shares or 0
        }
    }


async def generate_user_activity_report(
    start_date: datetime,
    end_date: datetime,
    db: AsyncSession
) -> Dict[str, Any]:
    """Generate user activity report"""
    from models.user import User
    
    # Get user metrics
    result = await db.execute(
        select(func.count(User.id)).where(
            and_(
                User.created_at >= start_date,
                User.created_at <= end_date
            )
        )
    )
    
    new_users = result.scalar() or 0
    
    return {
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        },
        "metrics": {
            "new_users": new_users,
            "active_users": 0,  # TODO: Calculate based on activity
            "user_growth_rate": 0.0
        }
    }


async def generate_engagement_report(
    start_date: datetime,
    end_date: datetime,
    db: AsyncSession
) -> Dict[str, Any]:
    """Generate engagement report"""
    # TODO: Implement engagement metrics calculation
    return {
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        },
        "metrics": {
            "average_engagement_rate": 0.0,
            "top_engaging_content": [],
            "engagement_trends": []
        }
    }