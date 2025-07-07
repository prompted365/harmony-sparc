"""
Search and retrieval API routes
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, text
from pydantic import BaseModel
import structlog

from core.database import get_db, get_astra_db, vector_search
from core.security import get_current_user_payload, require_permission, Permission
from core.exceptions import SearchError
from models.search import SearchQuery, SearchResult
from models.content import Content
from models.document import Document

logger = structlog.get_logger(__name__)

router = APIRouter()


# Request/Response models
class SearchRequest(BaseModel):
    query: str
    search_type: Optional[str] = "hybrid"  # text, vector, hybrid
    filters: Optional[Dict[str, Any]] = {}
    limit: Optional[int] = 10
    offset: Optional[int] = 0
    include_content: Optional[bool] = False
    include_documents: Optional[bool] = False


class SearchResultResponse(BaseModel):
    id: str
    title: str
    snippet: str
    score: float
    source_type: str
    source_id: int
    metadata: Optional[Dict[str, Any]] = {}


class SearchResponse(BaseModel):
    query: str
    total_results: int
    execution_time: float
    results: List[SearchResultResponse]
    facets: Optional[Dict[str, Any]] = {}
    suggestions: Optional[List[str]] = []


@router.post("/search", response_model=SearchResponse)
async def search(
    search_request: SearchRequest,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> SearchResponse:
    """
    Perform search across content and documents
    """
    try:
        start_time = datetime.utcnow()
        user_id = int(current_user["sub"])
        
        results = []
        total_results = 0
        
        # Text-based search in SQLite
        if search_request.search_type in ["text", "hybrid"]:
            content_results = await search_content(
                db, search_request.query, search_request.limit, search_request.offset
            )
            
            if search_request.include_documents:
                document_results = await search_documents(
                    db, search_request.query, search_request.limit, search_request.offset
                )
                content_results.extend(document_results)
            
            results.extend(content_results)
            total_results += len(content_results)
        
        # Vector search in AstraDB
        if search_request.search_type in ["vector", "hybrid"]:
            try:
                # TODO: Generate embedding for query
                # query_embedding = await generate_embedding(search_request.query)
                
                # Vector search in content collection
                # vector_results = await vector_search("content_embeddings", query_embedding, search_request.limit)
                # results.extend(process_vector_results(vector_results))
                pass
            except Exception as e:
                logger.warning(f"Vector search failed: {e}")
        
        # Sort results by score
        results.sort(key=lambda x: x.score, reverse=True)
        
        # Apply limit
        if search_request.limit:
            results = results[:search_request.limit]
        
        # Log search query
        search_query = SearchQuery(
            query_text=search_request.query,
            query_type=search_request.search_type,
            filters=search_request.filters,
            limit=search_request.limit,
            offset=search_request.offset,
            total_results=total_results,
            returned_results=len(results),
            user_id=user_id
        )
        
        db.add(search_query)
        await db.flush()
        
        # Save search results
        for i, result in enumerate(results):
            search_result = SearchResult(
                query_id=search_query.id,
                document_id=result.id,
                rank=i + 1,
                score=result.score,
                title=result.title,
                snippet=result.snippet,
                metadata=result.metadata,
                source_table=result.source_type,
                source_id=result.source_id
            )
            db.add(search_result)
        
        await db.commit()
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        return SearchResponse(
            query=search_request.query,
            total_results=total_results,
            execution_time=execution_time,
            results=results,
            facets={},
            suggestions=[]
        )
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Search failed: {e}")
        raise SearchError(f"Search failed: {str(e)}")


async def search_content(db: AsyncSession, query: str, limit: int, offset: int) -> List[SearchResultResponse]:
    """Search content using SQL full-text search"""
    try:
        search_query = f"%{query}%"
        
        sql_query = select(Content).where(
            or_(
                Content.title.ilike(search_query),
                Content.content_text.ilike(search_query),
                Content.summary.ilike(search_query),
                Content.keywords.ilike(search_query)
            )
        ).where(
            Content.status == "published"
        ).offset(offset).limit(limit)
        
        result = await db.execute(sql_query)
        content_items = result.scalars().all()
        
        search_results = []
        for content in content_items:
            # Calculate simple relevance score
            score = calculate_relevance_score(query, content.title, content.content_text, content.summary)
            
            # Create snippet
            snippet = create_snippet(content.content_text or content.summary or "", query, 200)
            
            search_results.append(SearchResultResponse(
                id=f"content_{content.id}",
                title=content.title,
                snippet=snippet,
                score=score,
                source_type="content",
                source_id=content.id,
                metadata={
                    "content_type": content.content_type,
                    "author_id": content.author_id,
                    "created_at": content.created_at.isoformat(),
                    "status": content.status
                }
            ))
        
        return search_results
        
    except Exception as e:
        logger.error(f"Content search failed: {e}")
        return []


async def search_documents(db: AsyncSession, query: str, limit: int, offset: int) -> List[SearchResultResponse]:
    """Search documents using SQL full-text search"""
    try:
        search_query = f"%{query}%"
        
        sql_query = select(Document).where(
            or_(
                Document.original_filename.ilike(search_query),
                Document.extracted_text.ilike(search_query),
                Document.ai_summary.ilike(search_query)
            )
        ).where(
            Document.processing_status == "completed"
        ).offset(offset).limit(limit)
        
        result = await db.execute(sql_query)
        documents = result.scalars().all()
        
        search_results = []
        for doc in documents:
            # Calculate simple relevance score
            score = calculate_relevance_score(
                query, doc.original_filename, doc.extracted_text, doc.ai_summary
            )
            
            # Create snippet
            snippet = create_snippet(doc.extracted_text or doc.ai_summary or "", query, 200)
            
            search_results.append(SearchResultResponse(
                id=f"document_{doc.id}",
                title=doc.original_filename,
                snippet=snippet,
                score=score,
                source_type="document",
                source_id=doc.id,
                metadata={
                    "document_type": doc.document_type,
                    "file_size": doc.file_size,
                    "uploaded_by": doc.uploaded_by,
                    "created_at": doc.created_at.isoformat()
                }
            ))
        
        return search_results
        
    except Exception as e:
        logger.error(f"Document search failed: {e}")
        return []


def calculate_relevance_score(query: str, title: str, content: str, summary: str) -> float:
    """Calculate simple relevance score"""
    score = 0.0
    query_terms = query.lower().split()
    
    title = (title or "").lower()
    content = (content or "").lower()
    summary = (summary or "").lower()
    
    for term in query_terms:
        # Title matches get highest weight
        if term in title:
            score += 10.0
        
        # Summary matches get medium weight
        if term in summary:
            score += 5.0
        
        # Content matches get lower weight
        if term in content:
            score += 1.0
    
    return min(score, 100.0)  # Cap at 100


def create_snippet(text: str, query: str, max_length: int = 200) -> str:
    """Create a search snippet with highlighted terms"""
    if not text:
        return ""
    
    text = text.strip()
    if len(text) <= max_length:
        return text
    
    # Find the first occurrence of any query term
    query_terms = query.lower().split()
    best_start = 0
    
    for term in query_terms:
        pos = text.lower().find(term)
        if pos != -1:
            # Start snippet a bit before the term
            best_start = max(0, pos - 50)
            break
    
    # Extract snippet
    snippet = text[best_start:best_start + max_length]
    
    # Clean up at word boundaries
    if best_start > 0:
        first_space = snippet.find(' ')
        if first_space != -1:
            snippet = snippet[first_space + 1:]
    
    if len(snippet) == max_length:
        last_space = snippet.rfind(' ')
        if last_space != -1:
            snippet = snippet[:last_space]
    
    # Add ellipsis if truncated
    if best_start > 0:
        snippet = "..." + snippet
    if best_start + max_length < len(text):
        snippet = snippet + "..."
    
    return snippet


@router.get("/search/suggestions")
async def get_search_suggestions(
    query: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[str]:
    """
    Get search suggestions based on query
    """
    try:
        # Get popular search terms that start with the query
        suggestions = []
        
        # TODO: Implement suggestion logic based on:
        # - Popular search queries
        # - Content titles
        # - Document names
        # - Tags
        
        # For now, return some basic suggestions
        if "content" in query.lower():
            suggestions.extend(["content management", "content creation", "content marketing"])
        
        if "document" in query.lower():
            suggestions.extend(["document processing", "document upload", "document search"])
        
        return suggestions[:limit]
        
    except Exception as e:
        logger.error(f"Search suggestions failed: {e}")
        return []


@router.get("/search/facets")
async def get_search_facets(
    query: str = Query(...),
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get search facets for filtering
    """
    try:
        facets = {}
        
        # Content type facets
        content_types = await db.execute(
            select(Content.content_type, db.func.count(Content.id))
            .group_by(Content.content_type)
        )
        
        facets["content_types"] = [
            {"value": row[0], "count": row[1]}
            for row in content_types.fetchall()
        ]
        
        # Document type facets
        document_types = await db.execute(
            select(Document.document_type, db.func.count(Document.id))
            .group_by(Document.document_type)
        )
        
        facets["document_types"] = [
            {"value": row[0], "count": row[1]}
            for row in document_types.fetchall()
        ]
        
        return facets
        
    except Exception as e:
        logger.error(f"Search facets failed: {e}")
        return {}


@router.post("/search/feedback")
async def provide_search_feedback(
    result_id: str,
    feedback_type: str,  # "click", "like", "dislike"
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Provide feedback on search results
    """
    try:
        user_id = int(current_user["sub"])
        
        # TODO: Record search feedback for improving relevance
        # This would be used to train ranking models
        
        logger.info(f"Search feedback: {feedback_type} for {result_id} by user {user_id}")
        
        return {"message": "Feedback recorded"}
        
    except Exception as e:
        logger.error(f"Search feedback failed: {e}")
        return {"message": "Feedback recording failed"}