"""
AI Agent coordination API routes
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_
from pydantic import BaseModel
import structlog

from core.database import get_db
from core.security import get_current_user_payload, require_permission, Permission
from core.exceptions import NotFoundError, ValidationError, AgentCoordinationError
from models.agent import Agent, AgentType, AgentStatus, AgentTask, TaskStatus, AgentCapability

logger = structlog.get_logger(__name__)

router = APIRouter()


# Request/Response models
class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    agent_type: AgentType
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    provider: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 2048
    config: Optional[Dict[str, Any]] = {}
    capabilities: Optional[List[str]] = []
    is_public: Optional[bool] = False


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[AgentStatus] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    config: Optional[Dict[str, Any]] = None
    capabilities: Optional[List[str]] = None


class AgentResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    agent_type: str
    status: str
    model_name: Optional[str]
    provider: Optional[str]
    owner_id: Optional[int]
    is_public: bool
    tasks_completed: int
    success_rate: Optional[float]
    created_at: datetime
    last_active: Optional[datetime]
    
    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    agent_id: int
    task_type: str
    title: str
    description: Optional[str] = None
    input_data: Dict[str, Any]
    priority: Optional[int] = 5
    scheduled_at: Optional[datetime] = None
    context: Optional[Dict[str, Any]] = {}


class TaskResponse(BaseModel):
    id: int
    agent_id: int
    task_type: str
    title: str
    description: Optional[str]
    status: str
    priority: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    execution_time: Optional[float]
    
    class Config:
        from_attributes = True


@router.post("/agents", response_model=AgentResponse)
async def create_agent(
    agent_data: AgentCreate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.MANAGE_AGENTS)),
    db: AsyncSession = Depends(get_db)
) -> AgentResponse:
    """
    Create a new AI agent
    """
    try:
        user_id = int(current_user["sub"])
        
        # Create agent
        agent = Agent(
            name=agent_data.name,
            description=agent_data.description,
            agent_type=agent_data.agent_type,
            model_name=agent_data.model_name,
            model_version=agent_data.model_version,
            provider=agent_data.provider,
            system_prompt=agent_data.system_prompt,
            temperature=agent_data.temperature,
            max_tokens=agent_data.max_tokens,
            config=agent_data.config,
            capabilities=agent_data.capabilities,
            owner_id=user_id,
            is_public=agent_data.is_public
        )
        
        db.add(agent)
        await db.flush()
        
        # Add capabilities
        if agent_data.capabilities:
            for capability_name in agent_data.capabilities:
                capability = AgentCapability(
                    agent_id=agent.id,
                    name=capability_name,
                    capability_type="default"
                )
                db.add(capability)
        
        await db.commit()
        await db.refresh(agent)
        
        logger.info(f"Agent created: {agent.id} by user {user_id}")
        
        return AgentResponse.from_orm(agent)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Agent creation failed: {e}")
        raise


@router.get("/agents", response_model=List[AgentResponse])
async def list_agents(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    agent_type: Optional[AgentType] = None,
    status: Optional[AgentStatus] = None,
    owner_id: Optional[int] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[AgentResponse]:
    """
    List agents with filters
    """
    try:
        query = select(Agent)
        
        # Apply filters
        filters = []
        
        if agent_type:
            filters.append(Agent.agent_type == agent_type)
        
        if status:
            filters.append(Agent.status == status)
        
        if owner_id:
            filters.append(Agent.owner_id == owner_id)
        
        # Show public agents or user's own agents
        user_id = int(current_user["sub"])
        filters.append(or_(Agent.is_public == True, Agent.owner_id == user_id))
        
        if filters:
            query = query.where(and_(*filters))
        
        # Apply pagination
        query = query.offset(skip).limit(limit).order_by(Agent.created_at.desc())
        
        result = await db.execute(query)
        agents = result.scalars().all()
        
        return [AgentResponse.from_orm(agent) for agent in agents]
        
    except Exception as e:
        logger.error(f"Agent listing failed: {e}")
        raise


@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> AgentResponse:
    """
    Get agent by ID
    """
    try:
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise NotFoundError("Agent not found")
        
        # Check access permissions
        user_id = int(current_user["sub"])
        if not agent.is_public and agent.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this agent"
            )
        
        return AgentResponse.from_orm(agent)
        
    except Exception as e:
        logger.error(f"Get agent failed: {e}")
        raise


@router.put("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: int,
    agent_data: AgentUpdate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.MANAGE_AGENTS)),
    db: AsyncSession = Depends(get_db)
) -> AgentResponse:
    """
    Update agent
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get agent
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise NotFoundError("Agent not found")
        
        # Check permissions
        if agent.owner_id != user_id and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this agent"
            )
        
        # Update fields
        update_data = agent_data.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(agent, field, value)
        
        agent.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(agent)
        
        logger.info(f"Agent updated: {agent_id} by user {user_id}")
        
        return AgentResponse.from_orm(agent)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Agent update failed: {e}")
        raise


@router.delete("/agents/{agent_id}")
async def delete_agent(
    agent_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.MANAGE_AGENTS)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Delete agent
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get agent
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise NotFoundError("Agent not found")
        
        # Check permissions
        if agent.owner_id != user_id and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this agent"
            )
        
        # Check if agent has running tasks
        result = await db.execute(
            select(AgentTask).where(
                and_(AgentTask.agent_id == agent_id, AgentTask.status == TaskStatus.RUNNING)
            )
        )
        running_tasks = result.scalars().all()
        
        if running_tasks:
            raise ValidationError("Cannot delete agent with running tasks")
        
        # Delete agent
        await db.execute(delete(Agent).where(Agent.id == agent_id))
        await db.commit()
        
        logger.info(f"Agent deleted: {agent_id} by user {user_id}")
        
        return {"message": "Agent deleted successfully"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Agent deletion failed: {e}")
        raise


@router.post("/agents/tasks", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> TaskResponse:
    """
    Create a new agent task
    """
    try:
        user_id = int(current_user["sub"])
        
        # Verify agent exists and is available
        result = await db.execute(select(Agent).where(Agent.id == task_data.agent_id))
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise NotFoundError("Agent not found")
        
        if agent.status != AgentStatus.ACTIVE:
            raise ValidationError("Agent is not available")
        
        # Create task
        task = AgentTask(
            agent_id=task_data.agent_id,
            task_type=task_data.task_type,
            title=task_data.title,
            description=task_data.description,
            input_data=task_data.input_data,
            priority=task_data.priority,
            scheduled_at=task_data.scheduled_at,
            context=task_data.context,
            created_by=user_id
        )
        
        db.add(task)
        await db.commit()
        await db.refresh(task)
        
        # TODO: Trigger task execution
        # await execute_agent_task.delay(task.id)
        
        logger.info(f"Agent task created: {task.id} for agent {task_data.agent_id}")
        
        return TaskResponse.from_orm(task)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Agent task creation failed: {e}")
        raise


@router.get("/agents/tasks", response_model=List[TaskResponse])
async def list_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    agent_id: Optional[int] = None,
    status: Optional[TaskStatus] = None,
    task_type: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[TaskResponse]:
    """
    List agent tasks with filters
    """
    try:
        query = select(AgentTask)
        
        # Apply filters
        filters = []
        
        if agent_id:
            filters.append(AgentTask.agent_id == agent_id)
        
        if status:
            filters.append(AgentTask.status == status)
        
        if task_type:
            filters.append(AgentTask.task_type == task_type)
        
        # Show only user's tasks unless admin
        if current_user.get("role") != "admin":
            user_id = int(current_user["sub"])
            filters.append(AgentTask.created_by == user_id)
        
        if filters:
            query = query.where(and_(*filters))
        
        # Apply pagination
        query = query.offset(skip).limit(limit).order_by(AgentTask.created_at.desc())
        
        result = await db.execute(query)
        tasks = result.scalars().all()
        
        return [TaskResponse.from_orm(task) for task in tasks]
        
    except Exception as e:
        logger.error(f"Task listing failed: {e}")
        raise


@router.get("/agents/tasks/{task_id}", response_model=Dict[str, Any])
async def get_task(
    task_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get task details including input and output data
    """
    try:
        result = await db.execute(select(AgentTask).where(AgentTask.id == task_id))
        task = result.scalar_one_or_none()
        
        if not task:
            raise NotFoundError("Task not found")
        
        # Check permissions
        if current_user.get("role") != "admin" and task.created_by != int(current_user["sub"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this task"
            )
        
        return {
            "id": task.id,
            "agent_id": task.agent_id,
            "task_type": task.task_type,
            "title": task.title,
            "description": task.description,
            "status": task.status,
            "priority": task.priority,
            "input_data": task.input_data,
            "output_data": task.output_data,
            "context": task.context,
            "error_message": task.error_message,
            "created_at": task.created_at,
            "started_at": task.started_at,
            "completed_at": task.completed_at,
            "execution_time": task.execution_time
        }
        
    except Exception as e:
        logger.error(f"Get task failed: {e}")
        raise


@router.post("/agents/tasks/{task_id}/cancel")
async def cancel_task(
    task_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Cancel a running task
    """
    try:
        result = await db.execute(select(AgentTask).where(AgentTask.id == task_id))
        task = result.scalar_one_or_none()
        
        if not task:
            raise NotFoundError("Task not found")
        
        # Check permissions
        if current_user.get("role") != "admin" and task.created_by != int(current_user["sub"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this task"
            )
        
        if task.status not in [TaskStatus.PENDING, TaskStatus.RUNNING]:
            raise ValidationError("Task cannot be cancelled in current status")
        
        # Update task status
        task.status = TaskStatus.CANCELLED
        task.completed_at = datetime.utcnow()
        
        await db.commit()
        
        # TODO: Signal task cancellation to worker
        
        logger.info(f"Task cancelled: {task_id}")
        
        return {"message": "Task cancelled successfully"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Task cancellation failed: {e}")
        raise