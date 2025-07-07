"""
AI Agent System for EESystem Content Curation Platform
Integrates with requesty.ai LLM router for intelligent content processing
"""
import asyncio
import json
import uuid
from typing import Dict, List, Optional, Any, Union, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import structlog
import httpx
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import hashlib

from core.config import settings, AI_AGENT_CONFIGS, BRAND_GUIDELINES, CONTENT_CATEGORIES
from core.database import get_sqlite_db, AIAgentResultModel
from services.cache import CacheService

logger = structlog.get_logger(__name__)

class AgentStatus(Enum):
    """Agent execution status"""
    IDLE = "idle"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"

class AgentType(Enum):
    """Types of AI agents"""
    CONTENT_CREATOR = "content_creator"
    COMPLIANCE_CHECKER = "compliance_checker"
    BRAND_VOICE_VALIDATOR = "brand_voice_validator"
    SOCIAL_MEDIA_OPTIMIZER = "social_media_optimizer"
    HEALTH_CLAIMS_VALIDATOR = "health_claims_validator"
    CONTENT_MODERATOR = "content_moderator"
    ANALYTICS_PROCESSOR = "analytics_processor"
    SCHEDULER_OPTIMIZER = "scheduler_optimizer"

@dataclass
class AgentRequest:
    """Request for AI agent processing"""
    agent_type: AgentType
    input_data: Dict[str, Any]
    context: Optional[Dict[str, Any]] = None
    priority: int = 0
    timeout: int = 30
    retry_count: int = 3
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class AgentResponse:
    """Response from AI agent processing"""
    agent_id: str
    agent_type: AgentType
    status: AgentStatus
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    confidence_score: float = 0.0
    processing_time: float = 0.0
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result['agent_type'] = self.agent_type.value
        result['status'] = self.status.value
        return result

class RequestyAIClient:
    """Client for requesty.ai LLM router"""
    
    def __init__(self):
        self.base_url = settings.REQUESTY_AI_BASE_URL
        self.api_key = settings.REQUESTY_AI_API_KEY
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(60.0),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
        )
    
    async def route_request(
        self,
        agent_type: AgentType,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
        model_preferences: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Route request to appropriate LLM via requesty.ai"""
        try:
            # Get agent configuration
            config = AI_AGENT_CONFIGS.get(agent_type.value, {})
            
            # Prepare request payload
            payload = {
                "prompt": prompt,
                "context": context or {},
                "model_preferences": model_preferences or [config.get("model", "gpt-4")],
                "temperature": config.get("temperature", 0.7),
                "max_tokens": config.get("max_tokens", 2000),
                "system_prompt": config.get("system_prompt", ""),
                "routing_strategy": "performance",  # Use best performing model
                "fallback_strategy": "cascade"      # Fallback to other models if needed
            }
            
            # Make request to requesty.ai
            response = await self.client.post(
                f"{self.base_url}/route",
                json=payload
            )
            
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error in requesty.ai request: {e}")
            raise
        except Exception as e:
            logger.error(f"Error in requesty.ai request: {e}")
            raise
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()

class AIAgent:
    """Individual AI agent for specific tasks"""
    
    def __init__(self, agent_type: AgentType, agent_id: str = None):
        self.agent_type = agent_type
        self.agent_id = agent_id or str(uuid.uuid4())
        self.status = AgentStatus.IDLE
        self.requesty_client = RequestyAIClient()
        self.cache_service = CacheService()
        
    async def process(self, request: AgentRequest) -> AgentResponse:
        """Process request using AI agent"""
        start_time = time.time()
        
        try:
            self.status = AgentStatus.PROCESSING
            
            # Generate cache key
            cache_key = self._generate_cache_key(request)
            
            # Check cache first
            cached_result = await self.cache_service.get(cache_key)
            if cached_result:
                logger.info(f"Cache hit for agent {self.agent_id}")
                return AgentResponse(
                    agent_id=self.agent_id,
                    agent_type=self.agent_type,
                    status=AgentStatus.COMPLETED,
                    result=cached_result,
                    processing_time=time.time() - start_time,
                    metadata={"cache_hit": True}
                )
            
            # Process based on agent type
            result = await self._process_by_type(request)
            
            # Cache result
            await self.cache_service.set(
                cache_key,
                result,
                ttl=settings.CACHE_TTL
            )
            
            # Calculate confidence score
            confidence_score = self._calculate_confidence(result)
            
            processing_time = time.time() - start_time
            
            # Store result in database
            await self._store_result(request, result, confidence_score, processing_time)
            
            self.status = AgentStatus.COMPLETED
            
            return AgentResponse(
                agent_id=self.agent_id,
                agent_type=self.agent_type,
                status=AgentStatus.COMPLETED,
                result=result,
                confidence_score=confidence_score,
                processing_time=processing_time,
                metadata={"cache_hit": False}
            )
            
        except asyncio.TimeoutError:
            self.status = AgentStatus.TIMEOUT
            return AgentResponse(
                agent_id=self.agent_id,
                agent_type=self.agent_type,
                status=AgentStatus.TIMEOUT,
                error="Agent processing timeout",
                processing_time=time.time() - start_time
            )
        except Exception as e:
            self.status = AgentStatus.FAILED
            logger.error(f"Agent {self.agent_id} processing failed: {e}")
            
            return AgentResponse(
                agent_id=self.agent_id,
                agent_type=self.agent_type,
                status=AgentStatus.FAILED,
                error=str(e),
                processing_time=time.time() - start_time
            )
    
    async def _process_by_type(self, request: AgentRequest) -> Dict[str, Any]:
        """Process request based on agent type"""
        if self.agent_type == AgentType.CONTENT_CREATOR:
            return await self._process_content_creation(request)
        elif self.agent_type == AgentType.COMPLIANCE_CHECKER:
            return await self._process_compliance_check(request)
        elif self.agent_type == AgentType.BRAND_VOICE_VALIDATOR:
            return await self._process_brand_voice_validation(request)
        elif self.agent_type == AgentType.SOCIAL_MEDIA_OPTIMIZER:
            return await self._process_social_media_optimization(request)
        elif self.agent_type == AgentType.HEALTH_CLAIMS_VALIDATOR:
            return await self._process_health_claims_validation(request)
        elif self.agent_type == AgentType.CONTENT_MODERATOR:
            return await self._process_content_moderation(request)
        elif self.agent_type == AgentType.ANALYTICS_PROCESSOR:
            return await self._process_analytics(request)
        elif self.agent_type == AgentType.SCHEDULER_OPTIMIZER:
            return await self._process_scheduler_optimization(request)
        else:
            raise ValueError(f"Unknown agent type: {self.agent_type}")
    
    async def _process_content_creation(self, request: AgentRequest) -> Dict[str, Any]:
        """Process content creation request"""
        content_brief = request.input_data.get("brief", "")
        content_type = request.input_data.get("type", "blog_post")
        target_platform = request.input_data.get("platform", "web")
        target_audience = request.input_data.get("audience", "general")
        
        # Build comprehensive prompt
        prompt = f"""
        Create {content_type} content for {target_platform} targeting {target_audience}.
        
        Brief: {content_brief}
        
        Brand Guidelines:
        - Voice: {BRAND_GUIDELINES['voice_and_tone']['voice']}
        - Tone: {BRAND_GUIDELINES['voice_and_tone']['tone']}
        - Language: {BRAND_GUIDELINES['voice_and_tone']['language']}
        
        Content Themes:
        {json.dumps(BRAND_GUIDELINES['content_themes'], indent=2)}
        
        Requirements:
        1. Follow EESystem brand voice and tone
        2. Include appropriate health disclaimers
        3. Ensure content is engaging and informative
        4. Optimize for the target platform
        5. Include call-to-action where appropriate
        
        Provide the content in JSON format with the following structure:
        {{
            "title": "Content title",
            "content": "Main content body",
            "summary": "Brief summary",
            "tags": ["tag1", "tag2"],
            "call_to_action": "CTA text",
            "disclaimers": ["disclaimer1", "disclaimer2"],
            "seo_keywords": ["keyword1", "keyword2"]
        }}
        """
        
        # Route to requesty.ai
        response = await self.requesty_client.route_request(
            agent_type=self.agent_type,
            prompt=prompt,
            context=request.context,
            model_preferences=["gpt-4", "claude-3-opus"]
        )
        
        # Parse and validate response
        try:
            content_data = json.loads(response.get("content", "{}"))
            
            # Add metadata
            content_data["metadata"] = {
                "created_by": self.agent_id,
                "created_at": datetime.utcnow().isoformat(),
                "content_type": content_type,
                "platform": target_platform,
                "audience": target_audience,
                "model_used": response.get("model_used", "unknown"),
                "tokens_used": response.get("tokens_used", 0)
            }
            
            return content_data
            
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return {
                "title": "Generated Content",
                "content": response.get("content", ""),
                "summary": "AI-generated content",
                "tags": [],
                "call_to_action": "",
                "disclaimers": BRAND_GUIDELINES["required_disclaimers"],
                "seo_keywords": [],
                "metadata": {
                    "created_by": self.agent_id,
                    "created_at": datetime.utcnow().isoformat(),
                    "content_type": content_type,
                    "platform": target_platform,
                    "audience": target_audience,
                    "model_used": response.get("model_used", "unknown"),
                    "tokens_used": response.get("tokens_used", 0)
                }
            }
    
    async def _process_compliance_check(self, request: AgentRequest) -> Dict[str, Any]:
        """Process compliance check request"""
        content = request.input_data.get("content", "")
        content_type = request.input_data.get("type", "general")
        
        prompt = f"""
        Analyze the following content for compliance with health claims regulations and EESystem brand guidelines.
        
        Content to analyze:
        {content}
        
        Content Type: {content_type}
        
        Brand Guidelines:
        {json.dumps(BRAND_GUIDELINES, indent=2)}
        
        Check for:
        1. Unsubstantiated health claims
        2. Required disclaimers
        3. Brand guideline adherence
        4. Prohibited content
        5. Regulatory compliance
        
        Provide response in JSON format:
        {{
            "compliance_score": 0.95,
            "is_compliant": true,
            "findings": [
                {{
                    "type": "warning",
                    "description": "Issue description",
                    "location": "Content location",
                    "recommendation": "How to fix"
                }}
            ],
            "required_disclaimers": ["disclaimer1", "disclaimer2"],
            "brand_alignment": 0.9,
            "health_claims_valid": true,
            "overall_assessment": "Assessment summary"
        }}
        """
        
        response = await self.requesty_client.route_request(
            agent_type=self.agent_type,
            prompt=prompt,
            context=request.context,
            model_preferences=["gpt-4", "claude-3-opus"]
        )
        
        try:
            compliance_data = json.loads(response.get("content", "{}"))
            compliance_data["metadata"] = {
                "analyzed_by": self.agent_id,
                "analyzed_at": datetime.utcnow().isoformat(),
                "model_used": response.get("model_used", "unknown")
            }
            return compliance_data
        except json.JSONDecodeError:
            return {
                "compliance_score": 0.0,
                "is_compliant": False,
                "findings": [{"type": "error", "description": "Analysis failed"}],
                "required_disclaimers": BRAND_GUIDELINES["required_disclaimers"],
                "brand_alignment": 0.0,
                "health_claims_valid": False,
                "overall_assessment": "Analysis failed - manual review required"
            }
    
    async def _process_brand_voice_validation(self, request: AgentRequest) -> Dict[str, Any]:
        """Process brand voice validation request"""
        content = request.input_data.get("content", "")
        
        prompt = f"""
        Validate the following content against EESystem's brand voice and tone guidelines.
        
        Content to validate:
        {content}
        
        Brand Voice Guidelines:
        {json.dumps(BRAND_GUIDELINES['voice_and_tone'], indent=2)}
        
        Analyze:
        1. Voice consistency
        2. Tone appropriateness
        3. Language alignment
        4. Brand personality reflection
        
        Provide response in JSON format:
        {{
            "voice_score": 0.9,
            "tone_score": 0.85,
            "language_score": 0.95,
            "overall_brand_score": 0.9,
            "is_brand_compliant": true,
            "recommendations": [
                "Specific improvement suggestions"
            ],
            "strengths": [
                "What works well"
            ],
            "areas_for_improvement": [
                "What needs work"
            ]
        }}
        """
        
        response = await self.requesty_client.route_request(
            agent_type=self.agent_type,
            prompt=prompt,
            context=request.context
        )
        
        try:
            validation_data = json.loads(response.get("content", "{}"))
            validation_data["metadata"] = {
                "validated_by": self.agent_id,
                "validated_at": datetime.utcnow().isoformat(),
                "model_used": response.get("model_used", "unknown")
            }
            return validation_data
        except json.JSONDecodeError:
            return {
                "voice_score": 0.0,
                "tone_score": 0.0,
                "language_score": 0.0,
                "overall_brand_score": 0.0,
                "is_brand_compliant": False,
                "recommendations": ["Manual review required"],
                "strengths": [],
                "areas_for_improvement": ["Analysis failed"]
            }
    
    async def _process_social_media_optimization(self, request: AgentRequest) -> Dict[str, Any]:
        """Process social media optimization request"""
        content = request.input_data.get("content", "")
        platform = request.input_data.get("platform", "facebook")
        
        platform_config = settings.SOCIAL_PLATFORMS.get(platform, {})
        
        prompt = f"""
        Optimize the following content for {platform} while maintaining EESystem brand guidelines.
        
        Original content:
        {content}
        
        Platform: {platform}
        Platform constraints:
        {json.dumps(platform_config, indent=2)}
        
        Optimize for:
        1. Character limits
        2. Platform-specific best practices
        3. Engagement optimization
        4. Hashtag strategy
        5. Visual content recommendations
        
        Provide response in JSON format:
        {{
            "optimized_content": "Platform-optimized content",
            "hashtags": ["#hashtag1", "#hashtag2"],
            "posting_time_recommendations": ["best times to post"],
            "engagement_tips": ["tips for better engagement"],
            "visual_recommendations": ["image/video suggestions"],
            "character_count": 150,
            "platform_score": 0.9
        }}
        """
        
        response = await self.requesty_client.route_request(
            agent_type=self.agent_type,
            prompt=prompt,
            context=request.context
        )
        
        try:
            optimization_data = json.loads(response.get("content", "{}"))
            optimization_data["metadata"] = {
                "optimized_by": self.agent_id,
                "optimized_at": datetime.utcnow().isoformat(),
                "platform": platform,
                "model_used": response.get("model_used", "unknown")
            }
            return optimization_data
        except json.JSONDecodeError:
            return {
                "optimized_content": content,
                "hashtags": [],
                "posting_time_recommendations": [],
                "engagement_tips": [],
                "visual_recommendations": [],
                "character_count": len(content),
                "platform_score": 0.0
            }
    
    async def _process_health_claims_validation(self, request: AgentRequest) -> Dict[str, Any]:
        """Process health claims validation request"""
        content = request.input_data.get("content", "")
        
        prompt = f"""
        Analyze the following content for health claims and validate their accuracy and regulatory compliance.
        
        Content to analyze:
        {content}
        
        Check for:
        1. Specific health claims
        2. Scientific backing requirements
        3. FDA compliance
        4. Required disclaimers
        5. Risk assessment
        
        Provide response in JSON format:
        {{
            "health_claims_found": ["claim1", "claim2"],
            "claims_validation": [
                {{
                    "claim": "specific claim",
                    "is_valid": true,
                    "confidence": 0.9,
                    "evidence_level": "strong",
                    "required_disclaimers": ["disclaimer"]
                }}
            ],
            "overall_compliance": true,
            "risk_level": "low",
            "recommendations": ["specific recommendations"]
        }}
        """
        
        response = await self.requesty_client.route_request(
            agent_type=self.agent_type,
            prompt=prompt,
            context=request.context
        )
        
        try:
            validation_data = json.loads(response.get("content", "{}"))
            validation_data["metadata"] = {
                "validated_by": self.agent_id,
                "validated_at": datetime.utcnow().isoformat(),
                "model_used": response.get("model_used", "unknown")
            }
            return validation_data
        except json.JSONDecodeError:
            return {
                "health_claims_found": [],
                "claims_validation": [],
                "overall_compliance": False,
                "risk_level": "unknown",
                "recommendations": ["Manual review required"]
            }
    
    async def _process_content_moderation(self, request: AgentRequest) -> Dict[str, Any]:
        """Process content moderation request"""
        content = request.input_data.get("content", "")
        
        prompt = f"""
        Moderate the following content for inappropriate material, misinformation, and brand safety.
        
        Content to moderate:
        {content}
        
        Check for:
        1. Inappropriate language
        2. Misinformation
        3. Brand safety issues
        4. Sensitive topics
        5. Compliance violations
        
        Provide response in JSON format:
        {{
            "is_appropriate": true,
            "moderation_score": 0.95,
            "flags": [
                {{
                    "type": "warning",
                    "description": "Issue description",
                    "severity": "medium"
                }}
            ],
            "recommendations": ["specific recommendations"],
            "approval_status": "approved"
        }}
        """
        
        response = await self.requesty_client.route_request(
            agent_type=self.agent_type,
            prompt=prompt,
            context=request.context
        )
        
        try:
            moderation_data = json.loads(response.get("content", "{}"))
            moderation_data["metadata"] = {
                "moderated_by": self.agent_id,
                "moderated_at": datetime.utcnow().isoformat(),
                "model_used": response.get("model_used", "unknown")
            }
            return moderation_data
        except json.JSONDecodeError:
            return {
                "is_appropriate": False,
                "moderation_score": 0.0,
                "flags": [{"type": "error", "description": "Moderation failed"}],
                "recommendations": ["Manual review required"],
                "approval_status": "pending"
            }
    
    async def _process_analytics(self, request: AgentRequest) -> Dict[str, Any]:
        """Process analytics request"""
        analytics_data = request.input_data.get("data", {})
        
        # This would typically process analytics data
        # For now, return processed analytics
        return {
            "processed_data": analytics_data,
            "insights": ["Generated insights"],
            "recommendations": ["Recommendations based on data"],
            "metadata": {
                "processed_by": self.agent_id,
                "processed_at": datetime.utcnow().isoformat()
            }
        }
    
    async def _process_scheduler_optimization(self, request: AgentRequest) -> Dict[str, Any]:
        """Process scheduler optimization request"""
        schedule_data = request.input_data.get("schedule", {})
        
        # This would typically optimize scheduling
        # For now, return optimized schedule
        return {
            "optimized_schedule": schedule_data,
            "recommendations": ["Scheduling recommendations"],
            "metadata": {
                "optimized_by": self.agent_id,
                "optimized_at": datetime.utcnow().isoformat()
            }
        }
    
    def _generate_cache_key(self, request: AgentRequest) -> str:
        """Generate cache key for request"""
        key_data = {
            "agent_type": self.agent_type.value,
            "input_data": request.input_data,
            "context": request.context
        }
        key_string = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def _calculate_confidence(self, result: Dict[str, Any]) -> float:
        """Calculate confidence score for result"""
        # This would implement confidence calculation logic
        # For now, return a default confidence
        return 0.85
    
    async def _store_result(
        self,
        request: AgentRequest,
        result: Dict[str, Any],
        confidence_score: float,
        processing_time: float
    ):
        """Store agent result in database"""
        try:
            # This would store the result using the database models
            # For now, just log the result
            logger.info(
                "Agent result stored",
                agent_id=self.agent_id,
                agent_type=self.agent_type.value,
                confidence_score=confidence_score,
                processing_time=processing_time
            )
        except Exception as e:
            logger.error(f"Failed to store agent result: {e}")
    
    async def close(self):
        """Close agent resources"""
        await self.requesty_client.close()

class AIAgentManager:
    """Manages AI agents and coordinates their execution"""
    
    def __init__(self):
        self.agents: Dict[str, AIAgent] = {}
        self.agent_pool: Dict[AgentType, List[AIAgent]] = {}
        self.executor = ThreadPoolExecutor(max_workers=settings.MAX_CONCURRENT_AGENTS)
        self.request_queue = asyncio.Queue()
        self.processing_tasks = []
        
    async def initialize(self):
        """Initialize agent manager"""
        try:
            # Create agent pools for each type
            for agent_type in AgentType:
                self.agent_pool[agent_type] = []
                
                # Create initial agents for each type
                for i in range(2):  # 2 agents per type initially
                    agent = AIAgent(agent_type)
                    self.agents[agent.agent_id] = agent
                    self.agent_pool[agent_type].append(agent)
            
            # Start processing queue
            asyncio.create_task(self._process_queue())
            
            logger.info("AI Agent Manager initialized", agent_count=len(self.agents))
            
        except Exception as e:
            logger.error("Failed to initialize AI Agent Manager", exc_info=e)
            raise
    
    async def process_request(self, request: AgentRequest) -> AgentResponse:
        """Process a single request"""
        try:
            # Get available agent
            agent = await self._get_available_agent(request.agent_type)
            
            # Process request
            response = await agent.process(request)
            
            # Return agent to pool
            await self._return_agent(agent)
            
            return response
            
        except Exception as e:
            logger.error(f"Failed to process agent request: {e}")
            return AgentResponse(
                agent_id="unknown",
                agent_type=request.agent_type,
                status=AgentStatus.FAILED,
                error=str(e)
            )
    
    async def process_batch(self, requests: List[AgentRequest]) -> List[AgentResponse]:
        """Process multiple requests in parallel"""
        try:
            # Create tasks for all requests
            tasks = []
            for request in requests:
                task = asyncio.create_task(self.process_request(request))
                tasks.append(task)
            
            # Wait for all tasks to complete
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle exceptions
            processed_responses = []
            for i, response in enumerate(responses):
                if isinstance(response, Exception):
                    processed_responses.append(AgentResponse(
                        agent_id="unknown",
                        agent_type=requests[i].agent_type,
                        status=AgentStatus.FAILED,
                        error=str(response)
                    ))
                else:
                    processed_responses.append(response)
            
            return processed_responses
            
        except Exception as e:
            logger.error(f"Failed to process batch requests: {e}")
            return [
                AgentResponse(
                    agent_id="unknown",
                    agent_type=req.agent_type,
                    status=AgentStatus.FAILED,
                    error=str(e)
                )
                for req in requests
            ]
    
    async def _get_available_agent(self, agent_type: AgentType) -> AIAgent:
        """Get available agent from pool"""
        try:
            # Try to get agent from pool
            if self.agent_pool[agent_type]:
                return self.agent_pool[agent_type].pop(0)
            
            # Create new agent if pool is empty
            agent = AIAgent(agent_type)
            self.agents[agent.agent_id] = agent
            return agent
            
        except Exception as e:
            logger.error(f"Failed to get available agent: {e}")
            raise
    
    async def _return_agent(self, agent: AIAgent):
        """Return agent to pool"""
        try:
            if agent.status in [AgentStatus.COMPLETED, AgentStatus.FAILED, AgentStatus.TIMEOUT]:
                agent.status = AgentStatus.IDLE
                self.agent_pool[agent.agent_type].append(agent)
                
        except Exception as e:
            logger.error(f"Failed to return agent to pool: {e}")
    
    async def _process_queue(self):
        """Process queued requests"""
        while True:
            try:
                # Wait for request
                request = await self.request_queue.get()
                
                # Process request
                response = await self.process_request(request)
                
                # Mark task as done
                self.request_queue.task_done()
                
            except Exception as e:
                logger.error(f"Error processing queue: {e}")
                await asyncio.sleep(1)
    
    async def health_check(self) -> str:
        """Check agent manager health"""
        try:
            active_agents = sum(1 for agent in self.agents.values() if agent.status != AgentStatus.FAILED)
            total_agents = len(self.agents)
            
            if active_agents >= total_agents * 0.8:
                return "healthy"
            elif active_agents >= total_agents * 0.5:
                return "degraded"
            else:
                return "unhealthy"
                
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return "unhealthy"
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get agent manager statistics"""
        try:
            stats = {
                "total_agents": len(self.agents),
                "agent_types": {},
                "status_counts": {},
                "queue_size": self.request_queue.qsize()
            }
            
            for agent in self.agents.values():
                # Count by type
                type_name = agent.agent_type.value
                if type_name not in stats["agent_types"]:
                    stats["agent_types"][type_name] = 0
                stats["agent_types"][type_name] += 1
                
                # Count by status
                status_name = agent.status.value
                if status_name not in stats["status_counts"]:
                    stats["status_counts"][status_name] = 0
                stats["status_counts"][status_name] += 1
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get statistics: {e}")
            return {}
    
    async def shutdown(self):
        """Shutdown agent manager"""
        try:
            # Close all agents
            for agent in self.agents.values():
                await agent.close()
            
            # Shutdown executor
            self.executor.shutdown(wait=True)
            
            logger.info("AI Agent Manager shutdown complete")
            
        except Exception as e:
            logger.error("Error during agent manager shutdown", exc_info=e)