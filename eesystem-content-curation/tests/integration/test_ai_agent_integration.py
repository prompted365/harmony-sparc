"""
Integration tests for AI Agent System in EESystem Content Curation Platform
"""
import pytest
import asyncio
import json
from typing import Dict, Any
from unittest.mock import Mock, AsyncMock, patch
import uuid
from datetime import datetime

from backend.core.ai_agents import (
    AIAgentManager,
    AIAgent,
    AgentType,
    AgentRequest,
    AgentResponse,
    AgentStatus,
    RequestyAIClient
)
from backend.core.config import settings
from backend.core.database import init_db, close_db

class TestAIAgentIntegration:
    """Test AI agent system integration"""
    
    @pytest.fixture
    async def agent_manager(self):
        """Create AI agent manager for testing"""
        manager = AIAgentManager()
        await manager.initialize()
        yield manager
        await manager.shutdown()
    
    @pytest.fixture
    def mock_requesty_response(self):
        """Mock requesty.ai response"""
        return {
            "content": json.dumps({
                "title": "Test Health Content",
                "content": "This is test health content about EESystem technology.",
                "summary": "Brief summary of the content",
                "tags": ["health", "wellness", "technology"],
                "call_to_action": "Learn more about EESystem",
                "disclaimers": ["This statement has not been evaluated by the FDA"],
                "seo_keywords": ["health", "wellness", "eesystem"]
            }),
            "model_used": "gpt-4",
            "tokens_used": 150,
            "confidence": 0.95
        }
    
    @pytest.mark.asyncio
    async def test_agent_manager_initialization(self, agent_manager):
        """Test agent manager initialization"""
        assert len(agent_manager.agents) > 0
        assert len(agent_manager.agent_pool) == len(AgentType)
        
        # Check that each agent type has agents
        for agent_type in AgentType:
            assert agent_type in agent_manager.agent_pool
            assert len(agent_manager.agent_pool[agent_type]) >= 0
    
    @pytest.mark.asyncio
    async def test_content_creation_agent(self, agent_manager, mock_requesty_response):
        """Test content creation agent"""
        with patch.object(RequestyAIClient, 'route_request', new_callable=AsyncMock) as mock_route:
            mock_route.return_value = mock_requesty_response
            
            request = AgentRequest(
                agent_type=AgentType.CONTENT_CREATOR,
                input_data={
                    "brief": "Create content about EESystem health benefits",
                    "type": "blog_post",
                    "platform": "web",
                    "audience": "health_conscious_consumers"
                },
                context={
                    "brand_guidelines": True,
                    "health_claims_validation": True
                }
            )
            
            response = await agent_manager.process_request(request)
            
            assert response.status == AgentStatus.COMPLETED
            assert response.result is not None
            assert "title" in response.result
            assert "content" in response.result
            assert "disclaimers" in response.result
            assert response.confidence_score > 0
            assert response.processing_time > 0
    
    @pytest.mark.asyncio
    async def test_compliance_checker_agent(self, agent_manager):
        """Test compliance checker agent"""
        with patch.object(RequestyAIClient, 'route_request', new_callable=AsyncMock) as mock_route:
            mock_route.return_value = {
                "content": json.dumps({
                    "compliance_score": 0.95,
                    "is_compliant": True,
                    "findings": [],
                    "required_disclaimers": ["This statement has not been evaluated by the FDA"],
                    "brand_alignment": 0.9,
                    "health_claims_valid": True,
                    "overall_assessment": "Content is compliant with regulations"
                }),
                "model_used": "gpt-4"
            }
            
            request = AgentRequest(
                agent_type=AgentType.COMPLIANCE_CHECKER,
                input_data={
                    "content": "EESystem technology may help improve wellness",
                    "type": "marketing_content"
                }
            )
            
            response = await agent_manager.process_request(request)
            
            assert response.status == AgentStatus.COMPLETED
            assert response.result["compliance_score"] > 0.8
            assert response.result["is_compliant"] is True
    
    @pytest.mark.asyncio
    async def test_brand_voice_validator(self, agent_manager):
        """Test brand voice validator agent"""
        with patch.object(RequestyAIClient, 'route_request', new_callable=AsyncMock) as mock_route:
            mock_route.return_value = {
                "content": json.dumps({
                    "voice_score": 0.9,
                    "tone_score": 0.85,
                    "language_score": 0.95,
                    "overall_brand_score": 0.9,
                    "is_brand_compliant": True,
                    "recommendations": ["Excellent alignment with brand voice"],
                    "strengths": ["Professional tone", "Clear language"],
                    "areas_for_improvement": []
                }),
                "model_used": "gpt-3.5-turbo"
            }
            
            request = AgentRequest(
                agent_type=AgentType.BRAND_VOICE_VALIDATOR,
                input_data={
                    "content": "Discover the power of EESystem technology for holistic wellness"
                }
            )
            
            response = await agent_manager.process_request(request)
            
            assert response.status == AgentStatus.COMPLETED
            assert response.result["overall_brand_score"] > 0.8
            assert response.result["is_brand_compliant"] is True
    
    @pytest.mark.asyncio
    async def test_social_media_optimizer(self, agent_manager):
        """Test social media optimizer agent"""
        with patch.object(RequestyAIClient, 'route_request', new_callable=AsyncMock) as mock_route:
            mock_route.return_value = {
                "content": json.dumps({
                    "optimized_content": "🌟 Discover EESystem wellness technology! #Health #Wellness #EESystem",
                    "hashtags": ["#Health", "#Wellness", "#EESystem", "#Technology"],
                    "posting_time_recommendations": ["9:00 AM", "12:00 PM", "7:00 PM"],
                    "engagement_tips": ["Use engaging visuals", "Ask questions"],
                    "visual_recommendations": ["Health-focused imagery", "Technology demonstrations"],
                    "character_count": 75,
                    "platform_score": 0.9
                }),
                "model_used": "gpt-3.5-turbo"
            }
            
            request = AgentRequest(
                agent_type=AgentType.SOCIAL_MEDIA_OPTIMIZER,
                input_data={
                    "content": "Learn about EESystem technology and its health benefits",
                    "platform": "twitter"
                }
            )
            
            response = await agent_manager.process_request(request)
            
            assert response.status == AgentStatus.COMPLETED
            assert "optimized_content" in response.result
            assert "hashtags" in response.result
            assert response.result["character_count"] <= 280  # Twitter limit
    
    @pytest.mark.asyncio
    async def test_health_claims_validator(self, agent_manager):
        """Test health claims validator agent"""
        with patch.object(RequestyAIClient, 'route_request', new_callable=AsyncMock) as mock_route:
            mock_route.return_value = {
                "content": json.dumps({
                    "health_claims_found": ["may help improve wellness"],
                    "claims_validation": [
                        {
                            "claim": "may help improve wellness",
                            "is_valid": True,
                            "confidence": 0.9,
                            "evidence_level": "moderate",
                            "required_disclaimers": ["Individual results may vary"]
                        }
                    ],
                    "overall_compliance": True,
                    "risk_level": "low",
                    "recommendations": ["Include required disclaimers"]
                }),
                "model_used": "gpt-4"
            }
            
            request = AgentRequest(
                agent_type=AgentType.HEALTH_CLAIMS_VALIDATOR,
                input_data={
                    "content": "EESystem technology may help improve overall wellness"
                }
            )
            
            response = await agent_manager.process_request(request)
            
            assert response.status == AgentStatus.COMPLETED
            assert response.result["overall_compliance"] is True
            assert response.result["risk_level"] == "low"
    
    @pytest.mark.asyncio
    async def test_batch_processing(self, agent_manager, mock_requesty_response):
        """Test batch processing of multiple requests"""
        with patch.object(RequestyAIClient, 'route_request', new_callable=AsyncMock) as mock_route:
            mock_route.return_value = mock_requesty_response
            
            requests = [
                AgentRequest(
                    agent_type=AgentType.CONTENT_CREATOR,
                    input_data={"brief": f"Content brief {i}", "type": "blog_post"}
                )
                for i in range(5)
            ]
            
            responses = await agent_manager.process_batch(requests)
            
            assert len(responses) == 5
            for response in responses:
                assert response.status == AgentStatus.COMPLETED
                assert response.result is not None
    
    @pytest.mark.asyncio
    async def test_agent_error_handling(self, agent_manager):
        """Test agent error handling"""
        with patch.object(RequestyAIClient, 'route_request', new_callable=AsyncMock) as mock_route:
            mock_route.side_effect = Exception("API Error")
            
            request = AgentRequest(
                agent_type=AgentType.CONTENT_CREATOR,
                input_data={"brief": "Test content"}
            )
            
            response = await agent_manager.process_request(request)
            
            assert response.status == AgentStatus.FAILED
            assert "API Error" in response.error
    
    @pytest.mark.asyncio
    async def test_agent_timeout_handling(self, agent_manager):
        """Test agent timeout handling"""
        with patch.object(RequestyAIClient, 'route_request', new_callable=AsyncMock) as mock_route:
            async def slow_response(*args, **kwargs):
                await asyncio.sleep(2)
                return {"content": "delayed response"}
            
            mock_route.side_effect = slow_response
            
            request = AgentRequest(
                agent_type=AgentType.CONTENT_CREATOR,
                input_data={"brief": "Test content"},
                timeout=1  # 1 second timeout
            )
            
            # This should complete without timeout since we're mocking
            response = await agent_manager.process_request(request)
            assert response.status in [AgentStatus.COMPLETED, AgentStatus.TIMEOUT]
    
    @pytest.mark.asyncio
    async def test_requesty_ai_client_integration(self):
        """Test RequestyAI client integration"""
        client = RequestyAIClient()
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {
                "content": "Generated content",
                "model_used": "gpt-4",
                "tokens_used": 100
            }
            mock_response.raise_for_status.return_value = None
            mock_post.return_value = mock_response
            
            result = await client.route_request(
                agent_type=AgentType.CONTENT_CREATOR,
                prompt="Test prompt",
                context={"test": "context"}
            )
            
            assert result["content"] == "Generated content"
            assert result["model_used"] == "gpt-4"
            assert result["tokens_used"] == 100
            
            # Verify the request was made correctly
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            assert call_args[1]["json"]["prompt"] == "Test prompt"
            assert call_args[1]["json"]["context"]["test"] == "context"
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_agent_statistics(self, agent_manager):
        """Test agent manager statistics"""
        stats = await agent_manager.get_statistics()
        
        assert "total_agents" in stats
        assert "agent_types" in stats
        assert "status_counts" in stats
        assert "queue_size" in stats
        assert stats["total_agents"] > 0
    
    @pytest.mark.asyncio
    async def test_agent_health_check(self, agent_manager):
        """Test agent manager health check"""
        health = await agent_manager.health_check()
        
        assert health in ["healthy", "degraded", "unhealthy"]
    
    @pytest.mark.asyncio
    async def test_eesystem_brand_compliance(self, agent_manager, mock_requesty_response):
        """Test EESystem-specific brand compliance"""
        with patch.object(RequestyAIClient, 'route_request', new_callable=AsyncMock) as mock_route:
            # Modify mock response to include EESystem brand elements
            eesystem_response = mock_requesty_response.copy()
            eesystem_content = json.loads(eesystem_response["content"])
            eesystem_content.update({
                "title": "Experience EESystem Wellness Technology",
                "content": "Discover how EESystem's innovative technology supports your wellness journey",
                "disclaimers": [
                    "This statement has not been evaluated by the Food and Drug Administration",
                    "This product is not intended to diagnose, treat, cure, or prevent any disease",
                    "Individual results may vary"
                ],
                "brand_compliance": {
                    "voice_adherence": 0.95,
                    "health_claims_valid": True,
                    "disclaimer_included": True,
                    "eesystem_mentions": 2
                }
            })
            eesystem_response["content"] = json.dumps(eesystem_content)
            mock_route.return_value = eesystem_response
            
            request = AgentRequest(
                agent_type=AgentType.CONTENT_CREATOR,
                input_data={
                    "brief": "Create content highlighting EESystem's wellness benefits",
                    "type": "marketing_content",
                    "platform": "website",
                    "audience": "health_conscious_adults"
                },
                context={
                    "brand": "EESystem",
                    "compliance_required": True,
                    "health_claims_validation": True
                }
            )
            
            response = await agent_manager.process_request(request)
            
            assert response.status == AgentStatus.COMPLETED
            assert "EESystem" in response.result["content"]
            assert len(response.result["disclaimers"]) >= 2
            assert response.result["brand_compliance"]["health_claims_valid"] is True
    
    @pytest.mark.asyncio
    async def test_multi_platform_content_optimization(self, agent_manager):
        """Test content optimization for multiple platforms"""
        platforms = ["facebook", "instagram", "twitter", "linkedin"]
        base_content = "Discover the power of EESystem wellness technology"
        
        for platform in platforms:
            with patch.object(RequestyAIClient, 'route_request', new_callable=AsyncMock) as mock_route:
                platform_config = settings.SOCIAL_PLATFORMS.get(platform, {})
                char_limit = platform_config.get("character_limit", 280)
                
                mock_route.return_value = {
                    "content": json.dumps({
                        "optimized_content": f"✨ EESystem wellness tech! #{platform.title()} #Health",
                        "hashtags": [f"#{platform.title()}", "#Health", "#EESystem"],
                        "character_count": min(len(base_content), char_limit),
                        "platform_score": 0.9
                    }),
                    "model_used": "gpt-3.5-turbo"
                }
                
                request = AgentRequest(
                    agent_type=AgentType.SOCIAL_MEDIA_OPTIMIZER,
                    input_data={
                        "content": base_content,
                        "platform": platform
                    }
                )
                
                response = await agent_manager.process_request(request)
                
                assert response.status == AgentStatus.COMPLETED
                assert response.result["character_count"] <= char_limit
                assert f"#{platform.title()}" in response.result["hashtags"]

class TestAIAgentPerformance:
    """Test AI agent performance and scalability"""
    
    @pytest.mark.asyncio
    async def test_concurrent_agent_processing(self):
        """Test concurrent processing of multiple agents"""
        manager = AIAgentManager()
        await manager.initialize()
        
        try:
            with patch.object(RequestyAIClient, 'route_request', new_callable=AsyncMock) as mock_route:
                mock_route.return_value = {
                    "content": json.dumps({"result": "test"}),
                    "model_used": "gpt-4"
                }
                
                # Create multiple concurrent requests
                requests = [
                    AgentRequest(
                        agent_type=AgentType.CONTENT_CREATOR,
                        input_data={"brief": f"Content {i}"}
                    )
                    for i in range(20)
                ]
                
                start_time = asyncio.get_event_loop().time()
                responses = await manager.process_batch(requests)
                end_time = asyncio.get_event_loop().time()
                
                processing_time = end_time - start_time
                
                assert len(responses) == 20
                assert all(r.status == AgentStatus.COMPLETED for r in responses)
                assert processing_time < 10  # Should complete within 10 seconds
                
        finally:
            await manager.shutdown()
    
    @pytest.mark.asyncio
    async def test_agent_memory_usage(self):
        """Test agent memory efficiency"""
        manager = AIAgentManager()
        await manager.initialize()
        
        try:
            # Process many requests to test memory usage
            for batch in range(5):
                requests = [
                    AgentRequest(
                        agent_type=AgentType.CONTENT_CREATOR,
                        input_data={"brief": f"Batch {batch} Content {i}"}
                    )
                    for i in range(10)
                ]
                
                with patch.object(RequestyAIClient, 'route_request', new_callable=AsyncMock) as mock_route:
                    mock_route.return_value = {
                        "content": json.dumps({"result": "test"}),
                        "model_used": "gpt-4"
                    }
                    
                    responses = await manager.process_batch(requests)
                    assert len(responses) == 10
            
            # Check that agent pool is managed efficiently
            stats = await manager.get_statistics()
            assert stats["total_agents"] <= settings.MAX_CONCURRENT_AGENTS * 2
            
        finally:
            await manager.shutdown()

if __name__ == "__main__":
    pytest.main([__file__, "-v"])