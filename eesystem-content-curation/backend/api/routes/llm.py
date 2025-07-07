"""
LLM router integration API routes (Requesty.ai)
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import httpx
import structlog

from core.database import get_db
from core.security import get_current_user_payload, require_permission, Permission
from core.config import settings
from core.exceptions import ExternalServiceError, AIProcessingError

logger = structlog.get_logger(__name__)

router = APIRouter()


# Request/Response models
class LLMRequest(BaseModel):
    model: Optional[str] = None
    messages: List[Dict[str, str]]
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    stream: Optional[bool] = False
    tools: Optional[List[Dict[str, Any]]] = None


class LLMResponse(BaseModel):
    id: str
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]
    created: int


class ContentGenerationRequest(BaseModel):
    content_type: str
    prompt: str
    model: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = {}


class ContentAnalysisRequest(BaseModel):
    content: str
    analysis_type: str  # sentiment, readability, compliance, etc.
    model: Optional[str] = None


@router.post("/llm/chat", response_model=Dict[str, Any])
async def chat_completion(
    request: LLMRequest,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Generic chat completion using Requesty.ai router
    """
    try:
        user_id = int(current_user["sub"])
        
        # Prepare request for Requesty.ai
        requesty_request = {
            "model": request.model or settings.DEFAULT_MODEL,
            "messages": request.messages,
            "temperature": request.temperature or settings.TEMPERATURE,
            "max_tokens": request.max_tokens or settings.MAX_TOKENS,
            "stream": request.stream or False
        }
        
        if request.tools:
            requesty_request["tools"] = request.tools
        
        # Call Requesty.ai API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.REQUESTY_BASE_URL}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.REQUESTY_API_KEY}",
                    "Content-Type": "application/json"
                },
                json=requesty_request,
                timeout=60.0
            )
            
            if response.status_code != 200:
                logger.error(f"Requesty.ai API error: {response.status_code} - {response.text}")
                raise ExternalServiceError("LLM service unavailable", "requesty")
            
            result = response.json()
        
        # Log usage
        logger.info(f"LLM request completed for user {user_id}", extra={
            "model": result.get("model"),
            "usage": result.get("usage", {})
        })
        
        return result
        
    except Exception as e:
        logger.error(f"LLM chat completion failed: {e}")
        raise AIProcessingError(f"Chat completion failed: {str(e)}")


@router.post("/llm/generate-content")
async def generate_content(
    request: ContentGenerationRequest,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Generate content using AI
    """
    try:
        user_id = int(current_user["sub"])
        
        # Build system prompt based on content type
        system_prompts = {
            "blog_post": "You are an expert blog writer. Create engaging, informative blog posts with clear structure and compelling headlines.",
            "social_media": "You are a social media expert. Create engaging, concise social media posts that drive engagement.",
            "email": "You are an email marketing expert. Create compelling email content that drives action.",
            "article": "You are a professional article writer. Create well-researched, informative articles with proper structure.",
            "marketing_copy": "You are a copywriter. Create persuasive marketing copy that converts.",
        }
        
        system_prompt = system_prompts.get(
            request.content_type, 
            "You are a professional content writer. Create high-quality content based on the given prompt."
        )
        
        # Prepare messages
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.prompt}
        ]
        
        # Call LLM
        llm_request = LLMRequest(
            model=request.model,
            messages=messages,
            temperature=request.parameters.get("temperature"),
            max_tokens=request.parameters.get("max_tokens")
        )
        
        result = await chat_completion(llm_request, current_user, db)
        
        # Extract generated content
        if result.get("choices") and len(result["choices"]) > 0:
            generated_content = result["choices"][0]["message"]["content"]
            
            return {
                "content": generated_content,
                "content_type": request.content_type,
                "model_used": result.get("model"),
                "usage": result.get("usage", {}),
                "generated_at": datetime.utcnow().isoformat()
            }
        else:
            raise AIProcessingError("No content generated")
        
    except Exception as e:
        logger.error(f"Content generation failed: {e}")
        raise


@router.post("/llm/analyze-content")
async def analyze_content(
    request: ContentAnalysisRequest,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Analyze content using AI
    """
    try:
        # Build analysis prompts based on type
        analysis_prompts = {
            "sentiment": f"""Analyze the sentiment of the following content and provide:
1. Overall sentiment (positive, negative, neutral)
2. Confidence score (0-1)
3. Key emotional indicators
4. Brief explanation

Content: {request.content}""",
            
            "readability": f"""Analyze the readability of the following content and provide:
1. Reading level (elementary, middle school, high school, college, graduate)
2. Complexity score (1-10)
3. Recommendations for improvement
4. Key issues affecting readability

Content: {request.content}""",
            
            "seo": f"""Analyze the SEO potential of the following content and provide:
1. SEO score (1-10)
2. Keyword density analysis
3. Content structure assessment
4. Recommendations for improvement

Content: {request.content}""",
            
            "compliance": f"""Analyze the brand compliance of the following content and provide:
1. Compliance score (1-10)
2. Brand voice assessment
3. Tone analysis
4. Recommendations for alignment

Content: {request.content}"""
        }
        
        if request.analysis_type not in analysis_prompts:
            raise ValidationError(f"Unsupported analysis type: {request.analysis_type}")
        
        # Prepare messages
        messages = [
            {
                "role": "system", 
                "content": "You are an expert content analyst. Provide detailed, actionable analysis in JSON format."
            },
            {
                "role": "user", 
                "content": analysis_prompts[request.analysis_type]
            }
        ]
        
        # Call LLM
        llm_request = LLMRequest(
            model=request.model,
            messages=messages,
            temperature=0.3  # Lower temperature for analysis
        )
        
        result = await chat_completion(llm_request, current_user, db)
        
        # Extract analysis
        if result.get("choices") and len(result["choices"]) > 0:
            analysis_content = result["choices"][0]["message"]["content"]
            
            # Try to parse as JSON, fallback to text
            try:
                import json
                analysis_data = json.loads(analysis_content)
            except:
                analysis_data = {"analysis": analysis_content}
            
            return {
                "analysis_type": request.analysis_type,
                "analysis": analysis_data,
                "model_used": result.get("model"),
                "analyzed_at": datetime.utcnow().isoformat()
            }
        else:
            raise AIProcessingError("No analysis generated")
        
    except Exception as e:
        logger.error(f"Content analysis failed: {e}")
        raise


@router.post("/llm/summarize")
async def summarize_content(
    content: str,
    max_length: Optional[int] = 200,
    model: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Summarize content using AI
    """
    try:
        # Prepare summarization prompt
        prompt = f"""Create a concise summary of the following content in approximately {max_length} words. 
Focus on the key points and main ideas.

Content: {content}"""
        
        messages = [
            {
                "role": "system", 
                "content": "You are an expert at creating clear, concise summaries that capture the essence of content."
            },
            {"role": "user", "content": prompt}
        ]
        
        # Call LLM
        llm_request = LLMRequest(
            model=model,
            messages=messages,
            temperature=0.3,
            max_tokens=max_length * 2  # Give some buffer
        )
        
        result = await chat_completion(llm_request, current_user, db)
        
        # Extract summary
        if result.get("choices") and len(result["choices"]) > 0:
            summary = result["choices"][0]["message"]["content"]
            
            return {
                "summary": summary,
                "original_length": len(content.split()),
                "summary_length": len(summary.split()),
                "compression_ratio": len(summary.split()) / len(content.split()),
                "model_used": result.get("model"),
                "summarized_at": datetime.utcnow().isoformat()
            }
        else:
            raise AIProcessingError("No summary generated")
        
    except Exception as e:
        logger.error(f"Content summarization failed: {e}")
        raise


@router.post("/llm/translate")
async def translate_content(
    content: str,
    target_language: str,
    source_language: Optional[str] = "auto",
    model: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.WRITE_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Translate content using AI
    """
    try:
        # Prepare translation prompt
        if source_language == "auto":
            prompt = f"Translate the following content to {target_language}. Maintain the original tone and style:\n\n{content}"
        else:
            prompt = f"Translate the following content from {source_language} to {target_language}. Maintain the original tone and style:\n\n{content}"
        
        messages = [
            {
                "role": "system", 
                "content": "You are an expert translator. Provide accurate translations that preserve meaning, tone, and cultural context."
            },
            {"role": "user", "content": prompt}
        ]
        
        # Call LLM
        llm_request = LLMRequest(
            model=model,
            messages=messages,
            temperature=0.3
        )
        
        result = await chat_completion(llm_request, current_user, db)
        
        # Extract translation
        if result.get("choices") and len(result["choices"]) > 0:
            translation = result["choices"][0]["message"]["content"]
            
            return {
                "original_content": content,
                "translated_content": translation,
                "source_language": source_language,
                "target_language": target_language,
                "model_used": result.get("model"),
                "translated_at": datetime.utcnow().isoformat()
            }
        else:
            raise AIProcessingError("No translation generated")
        
    except Exception as e:
        logger.error(f"Content translation failed: {e}")
        raise


@router.get("/llm/models")
async def list_available_models(
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT))
) -> Dict[str, Any]:
    """
    List available models from Requesty.ai
    """
    try:
        # TODO: Call Requesty.ai models endpoint
        # For now, return some common models
        models = [
            {
                "id": "gpt-4",
                "name": "GPT-4",
                "provider": "openai",
                "max_tokens": 8192,
                "capabilities": ["chat", "completion", "analysis"]
            },
            {
                "id": "gpt-3.5-turbo",
                "name": "GPT-3.5 Turbo",
                "provider": "openai",
                "max_tokens": 4096,
                "capabilities": ["chat", "completion"]
            },
            {
                "id": "claude-3-sonnet",
                "name": "Claude 3 Sonnet",
                "provider": "anthropic",
                "max_tokens": 200000,
                "capabilities": ["chat", "completion", "analysis"]
            }
        ]
        
        return {
            "models": models,
            "default_model": settings.DEFAULT_MODEL
        }
        
    except Exception as e:
        logger.error(f"List models failed: {e}")
        return {"models": [], "default_model": settings.DEFAULT_MODEL}