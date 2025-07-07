"""
Memory management API routes for persistent storage and context
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, delete
from pydantic import BaseModel
import structlog

from core.database import get_db
from core.security import get_current_user_payload, require_permission, Permission
from core.exceptions import NotFoundError, ValidationError, MemoryError
from models.memory import Memory, MemoryType, MemoryContext, ConversationMemory, KnowledgeBase

logger = structlog.get_logger(__name__)

router = APIRouter()


# Request/Response models
class MemoryCreate(BaseModel):
    key: str
    memory_type: MemoryType
    namespace: Optional[str] = "default"
    value: Optional[Dict[str, Any]] = None
    text_value: Optional[str] = None
    context: Optional[Dict[str, Any]] = {}
    tags: Optional[List[str]] = []
    expires_at: Optional[datetime] = None
    importance: Optional[int] = 5
    priority: Optional[int] = 5
    is_public: Optional[bool] = False


class MemoryUpdate(BaseModel):
    value: Optional[Dict[str, Any]] = None
    text_value: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    expires_at: Optional[datetime] = None
    importance: Optional[int] = None
    priority: Optional[int] = None


class MemoryResponse(BaseModel):
    id: int
    key: str
    memory_type: str
    namespace: str
    importance: int
    priority: int
    access_count: int
    is_public: bool
    user_id: Optional[int]
    agent_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    last_accessed: Optional[datetime]
    
    class Config:
        from_attributes = True


class MemoryDetailResponse(MemoryResponse):
    value: Optional[Dict[str, Any]]
    text_value: Optional[str]
    context: Optional[Dict[str, Any]]
    tags: Optional[List[str]]
    expires_at: Optional[datetime]


class ConversationCreate(BaseModel):
    conversation_id: str
    role: str  # user, assistant, system
    content: str
    context: Optional[Dict[str, Any]] = {}
    metadata: Optional[Dict[str, Any]] = {}


@router.post("/memory", response_model=MemoryResponse)
async def create_memory(
    memory_data: MemoryCreate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> MemoryResponse:
    """
    Create a new memory entry
    """
    try:
        user_id = int(current_user["sub"])
        
        # Check if key already exists in namespace
        result = await db.execute(
            select(Memory).where(
                and_(
                    Memory.key == memory_data.key,
                    Memory.namespace == memory_data.namespace,
                    Memory.user_id == user_id
                )
            )
        )
        existing_memory = result.scalar_one_or_none()
        
        if existing_memory:
            raise ValidationError(f"Memory with key '{memory_data.key}' already exists in namespace '{memory_data.namespace}'")
        
        # Create memory
        memory = Memory(
            key=memory_data.key,
            memory_type=memory_data.memory_type,
            namespace=memory_data.namespace,
            value=memory_data.value,
            text_value=memory_data.text_value,
            context=memory_data.context,
            tags=memory_data.tags,
            expires_at=memory_data.expires_at,
            importance=memory_data.importance,
            priority=memory_data.priority,
            is_public=memory_data.is_public,
            user_id=user_id
        )
        
        db.add(memory)
        await db.commit()
        await db.refresh(memory)
        
        logger.info(f"Memory created: {memory.id} by user {user_id}")
        
        return MemoryResponse.from_orm(memory)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Memory creation failed: {e}")
        raise MemoryError(f"Failed to create memory: {str(e)}")


@router.get("/memory", response_model=List[MemoryResponse])
async def list_memories(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    memory_type: Optional[MemoryType] = None,
    namespace: Optional[str] = None,
    tags: Optional[str] = None,
    search: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[MemoryResponse]:
    """
    List memory entries with filters
    """
    try:
        user_id = int(current_user["sub"])
        
        query = select(Memory)
        
        # Apply filters
        filters = []
        
        # Access control: show public memories or user's own memories
        filters.append(or_(Memory.is_public == True, Memory.user_id == user_id))
        
        if memory_type:
            filters.append(Memory.memory_type == memory_type)
        
        if namespace:
            filters.append(Memory.namespace == namespace)
        
        if search:
            search_filter = or_(
                Memory.key.ilike(f"%{search}%"),
                Memory.text_value.ilike(f"%{search}%")
            )
            filters.append(search_filter)
        
        if tags:
            tag_list = [tag.strip() for tag in tags.split(",")]
            # Check if any of the specified tags exist in the memory tags
            filters.append(Memory.tags.op("&&")(tag_list))
        
        if filters:
            query = query.where(and_(*filters))
        
        # Apply pagination and ordering
        query = query.offset(skip).limit(limit).order_by(Memory.priority.desc(), Memory.updated_at.desc())
        
        result = await db.execute(query)
        memories = result.scalars().all()
        
        return [MemoryResponse.from_orm(memory) for memory in memories]
        
    except Exception as e:
        logger.error(f"Memory listing failed: {e}")
        raise MemoryError(f"Failed to list memories: {str(e)}")


@router.get("/memory/{memory_id}", response_model=MemoryDetailResponse)
async def get_memory(
    memory_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> MemoryDetailResponse:
    """
    Get memory by ID
    """
    try:
        user_id = int(current_user["sub"])
        
        result = await db.execute(select(Memory).where(Memory.id == memory_id))
        memory = result.scalar_one_or_none()
        
        if not memory:
            raise NotFoundError("Memory not found")
        
        # Check access permissions
        if not memory.is_public and memory.user_id != user_id:
            raise ValidationError("Not authorized to access this memory")
        
        # Update access tracking
        memory.access_count += 1
        memory.last_accessed = datetime.utcnow()
        await db.commit()
        
        return MemoryDetailResponse.from_orm(memory)
        
    except Exception as e:
        logger.error(f"Get memory failed: {e}")
        raise MemoryError(f"Failed to get memory: {str(e)}")


@router.get("/memory/key/{key}", response_model=MemoryDetailResponse)
async def get_memory_by_key(
    key: str,
    namespace: str = Query("default"),
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> MemoryDetailResponse:
    """
    Get memory by key and namespace
    """
    try:
        user_id = int(current_user["sub"])
        
        result = await db.execute(
            select(Memory).where(
                and_(
                    Memory.key == key,
                    Memory.namespace == namespace,
                    or_(Memory.is_public == True, Memory.user_id == user_id)
                )
            )
        )
        memory = result.scalar_one_or_none()
        
        if not memory:
            raise NotFoundError(f"Memory not found with key '{key}' in namespace '{namespace}'")
        
        # Update access tracking
        memory.access_count += 1
        memory.last_accessed = datetime.utcnow()
        await db.commit()
        
        return MemoryDetailResponse.from_orm(memory)
        
    except Exception as e:
        logger.error(f"Get memory by key failed: {e}")
        raise MemoryError(f"Failed to get memory by key: {str(e)}")


@router.put("/memory/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: int,
    memory_data: MemoryUpdate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> MemoryResponse:
    """
    Update memory entry
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get memory
        result = await db.execute(select(Memory).where(Memory.id == memory_id))
        memory = result.scalar_one_or_none()
        
        if not memory:
            raise NotFoundError("Memory not found")
        
        # Check permissions
        if memory.user_id != user_id and current_user.get("role") != "admin":
            raise ValidationError("Not authorized to update this memory")
        
        # Update fields
        update_data = memory_data.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(memory, field, value)
        
        # Increment version and update timestamp
        memory.version += 1
        memory.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(memory)
        
        logger.info(f"Memory updated: {memory_id} by user {user_id}")
        
        return MemoryResponse.from_orm(memory)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Memory update failed: {e}")
        raise MemoryError(f"Failed to update memory: {str(e)}")


@router.delete("/memory/{memory_id}")
async def delete_memory(
    memory_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Delete memory entry
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get memory
        result = await db.execute(select(Memory).where(Memory.id == memory_id))
        memory = result.scalar_one_or_none()
        
        if not memory:
            raise NotFoundError("Memory not found")
        
        # Check permissions
        if memory.user_id != user_id and current_user.get("role") != "admin":
            raise ValidationError("Not authorized to delete this memory")
        
        # Delete memory
        await db.execute(delete(Memory).where(Memory.id == memory_id))
        await db.commit()
        
        logger.info(f"Memory deleted: {memory_id} by user {user_id}")
        
        return {"message": "Memory deleted successfully"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Memory deletion failed: {e}")
        raise MemoryError(f"Failed to delete memory: {str(e)}")


@router.post("/memory/conversations")
async def save_conversation(
    conversation_data: ConversationCreate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Save conversation message to memory
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get current message index for this conversation
        result = await db.execute(
            select(ConversationMemory.message_index)
            .where(ConversationMemory.conversation_id == conversation_data.conversation_id)
            .order_by(ConversationMemory.message_index.desc())
            .limit(1)
        )
        
        last_index = result.scalar_one_or_none()
        message_index = (last_index + 1) if last_index is not None else 0
        
        # Create conversation memory
        conversation = ConversationMemory(
            conversation_id=conversation_data.conversation_id,
            message_index=message_index,
            role=conversation_data.role,
            content=conversation_data.content,
            context=conversation_data.context,
            metadata=conversation_data.metadata,
            user_id=user_id
        )
        
        db.add(conversation)
        await db.commit()
        
        logger.info(f"Conversation message saved: {conversation_data.conversation_id}[{message_index}]")
        
        return {"message": "Conversation saved successfully"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Conversation save failed: {e}")
        raise MemoryError(f"Failed to save conversation: {str(e)}")


@router.get("/memory/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Get conversation history
    """
    try:
        user_id = int(current_user["sub"])
        
        result = await db.execute(
            select(ConversationMemory)
            .where(
                and_(
                    ConversationMemory.conversation_id == conversation_id,
                    ConversationMemory.user_id == user_id
                )
            )
            .order_by(ConversationMemory.message_index.asc())
            .limit(limit)
        )
        
        messages = result.scalars().all()
        
        return [
            {
                "message_index": msg.message_index,
                "role": msg.role,
                "content": msg.content,
                "context": msg.context,
                "metadata": msg.metadata,
                "timestamp": msg.timestamp.isoformat()
            }
            for msg in messages
        ]
        
    except Exception as e:
        logger.error(f"Get conversation failed: {e}")
        raise MemoryError(f"Failed to get conversation: {str(e)}")


@router.post("/memory/knowledge")
async def create_knowledge_entry(
    title: str,
    content: str,
    category: Optional[str] = None,
    tags: Optional[List[str]] = None,
    source_url: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Create knowledge base entry
    """
    try:
        user_id = int(current_user["sub"])
        
        # Create knowledge entry
        knowledge = KnowledgeBase(
            title=title,
            content=content,
            category=category,
            tags=tags or [],
            source_url=source_url,
            created_by=user_id
        )
        
        db.add(knowledge)
        await db.commit()
        await db.refresh(knowledge)
        
        logger.info(f"Knowledge entry created: {knowledge.id} by user {user_id}")
        
        return {
            "id": knowledge.id,
            "title": knowledge.title,
            "category": knowledge.category,
            "created_at": knowledge.created_at.isoformat()
        }
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Knowledge creation failed: {e}")
        raise MemoryError(f"Failed to create knowledge entry: {str(e)}")


@router.get("/memory/knowledge")
async def search_knowledge(
    query: Optional[str] = None,
    category: Optional[str] = None,
    tags: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Search knowledge base
    """
    try:
        knowledge_query = select(KnowledgeBase)
        
        # Apply filters
        filters = []
        
        if query:
            search_filter = or_(
                KnowledgeBase.title.ilike(f"%{query}%"),
                KnowledgeBase.content.ilike(f"%{query}%")
            )
            filters.append(search_filter)
        
        if category:
            filters.append(KnowledgeBase.category == category)
        
        if tags:
            tag_list = [tag.strip() for tag in tags.split(",")]
            filters.append(KnowledgeBase.tags.op("&&")(tag_list))
        
        if filters:
            knowledge_query = knowledge_query.where(and_(*filters))
        
        knowledge_query = knowledge_query.offset(skip).limit(limit).order_by(KnowledgeBase.created_at.desc())
        
        result = await db.execute(knowledge_query)
        knowledge_entries = result.scalars().all()
        
        return [
            {
                "id": entry.id,
                "title": entry.title,
                "summary": entry.summary,
                "category": entry.category,
                "tags": entry.tags,
                "confidence_score": entry.confidence_score,
                "verified": entry.verified,
                "access_count": entry.access_count,
                "created_at": entry.created_at.isoformat()
            }
            for entry in knowledge_entries
        ]
        
    except Exception as e:
        logger.error(f"Knowledge search failed: {e}")
        raise MemoryError(f"Failed to search knowledge: {str(e)}")


@router.delete("/memory/cleanup")
async def cleanup_expired_memories(
    current_user: Dict[str, Any] = Depends(require_permission(Permission.MANAGE_SYSTEM)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Cleanup expired memories
    """
    try:
        # Delete expired memories
        result = await db.execute(
            delete(Memory).where(
                and_(
                    Memory.expires_at.is_not(None),
                    Memory.expires_at < datetime.utcnow()
                )
            )
        )
        
        deleted_count = result.rowcount
        await db.commit()
        
        logger.info(f"Cleaned up {deleted_count} expired memories")
        
        return {
            "deleted_count": deleted_count,
            "cleanup_time": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Memory cleanup failed: {e}")
        raise MemoryError(f"Failed to cleanup memories: {str(e)}")