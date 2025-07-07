"""
Performance tests for EESystem Content Curation Platform
Tests system performance, scalability, and load handling
"""
import pytest
import asyncio
import time
import statistics
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import httpx
from unittest.mock import patch, AsyncMock
import psutil
import gc
import sys

from backend.main import app
from backend.core.ai_agents import AIAgentManager, AgentRequest, AgentType
from backend.core.database import DatabaseManager
from backend.core.config import settings

class TestSystemPerformance:
    """Test overall system performance"""
    
    @pytest.fixture
    async def test_client(self):
        """Create test client for performance testing"""
        async with httpx.AsyncClient(
            app=app, 
            base_url="http://testserver",
            timeout=httpx.Timeout(60.0)
        ) as client:
            yield client
    
    @pytest.fixture
    async def agent_manager(self):
        """Create AI agent manager for performance testing"""
        manager = AIAgentManager()
        await manager.initialize()
        yield manager
        await manager.shutdown()
    
    @pytest.fixture
    async def db_manager(self):
        """Create database manager for performance testing"""
        manager = DatabaseManager()
        with patch.object(manager, '_init_astra_db', new_callable=AsyncMock):
            await manager.initialize()
        yield manager
        await manager.close()
    
    @pytest.mark.asyncio
    async def test_api_response_times(self, test_client: httpx.AsyncClient):
        """Test API endpoint response times"""
        headers = {"Authorization": "Bearer test_token"}
        
        with patch('backend.api.routers.auth.verify_token') as mock_verify:
            mock_verify.return_value = {"user_id": "test_user", "role": "content_creator"}
            
            endpoints = [
                ("GET", "/api/v1/health"),
                ("GET", "/api/v1/auth/me"),
                ("GET", "/api/v1/content/list"),
                ("GET", "/api/v1/analytics/overview"),
                ("GET", "/api/v1/compliance/summary")
            ]
            
            response_times = {}
            
            for method, endpoint in endpoints:
                times = []
                
                # Test each endpoint 10 times
                for _ in range(10):
                    start_time = time.time()
                    
                    if method == "GET":
                        response = await test_client.get(endpoint, headers=headers)
                    
                    end_time = time.time()
                    response_time = (end_time - start_time) * 1000  # Convert to milliseconds
                    
                    assert response.status_code < 500  # No server errors
                    times.append(response_time)
                
                response_times[endpoint] = {
                    "average": statistics.mean(times),
                    "median": statistics.median(times),
                    "min": min(times),
                    "max": max(times),
                    "p95": statistics.quantiles(times, n=20)[18]  # 95th percentile
                }
                
                # Performance assertions
                assert response_times[endpoint]["average"] < 1000  # < 1 second average
                assert response_times[endpoint]["p95"] < 2000      # < 2 seconds 95th percentile
    
    @pytest.mark.asyncio
    async def test_concurrent_content_creation(self, test_client: httpx.AsyncClient):
        """Test concurrent content creation performance"""
        headers = {"Authorization": "Bearer test_token"}
        
        with patch('backend.api.routers.auth.verify_token') as mock_verify:
            mock_verify.return_value = {"user_id": "test_user", "role": "content_creator"}
            
            with patch('backend.core.ai_agents.AIAgentManager.process_request') as mock_agent:
                mock_agent.return_value = AsyncMock()
                mock_agent.return_value.status = "completed"
                mock_agent.return_value.result = {
                    "title": "Generated Content",
                    "content": "This is AI-generated content about EESystem",
                    "compliance_score": 0.95
                }
                
                # Create 50 concurrent content creation requests
                tasks = []
                for i in range(50):
                    content_brief = {
                        "title": f"Performance Test Content {i}",
                        "brief": f"Create content about EESystem benefit {i}",
                        "content_type": "blog_post",
                        "platform": "web"
                    }
                    
                    task = test_client.post(
                        "/api/v1/content/brief",
                        json=content_brief,
                        headers=headers
                    )
                    tasks.append(task)
                
                # Execute all requests and measure performance
                start_time = time.time()
                responses = await asyncio.gather(*tasks, return_exceptions=True)
                end_time = time.time()
                
                total_time = end_time - start_time
                successful_responses = sum(
                    1 for response in responses 
                    if hasattr(response, 'status_code') and response.status_code < 400
                )
                
                # Performance assertions
                assert successful_responses >= 45  # 90% success rate minimum
                assert total_time < 30.0           # Complete within 30 seconds
                
                # Calculate throughput
                throughput = successful_responses / total_time
                assert throughput >= 1.5  # At least 1.5 requests per second
    
    @pytest.mark.asyncio
    async def test_ai_agent_performance(self, agent_manager: AIAgentManager):
        """Test AI agent processing performance"""
        with patch('backend.core.ai_agents.RequestyAIClient.route_request') as mock_route:
            mock_route.return_value = {
                "content": '{"title": "Test Content", "content": "Generated content"}',
                "model_used": "gpt-4",
                "tokens_used": 150
            }
            
            # Test single agent performance
            single_agent_times = []
            
            for _ in range(20):
                request = AgentRequest(
                    agent_type=AgentType.CONTENT_CREATOR,
                    input_data={
                        "brief": "Create content about EESystem wellness benefits",
                        "type": "blog_post"
                    }
                )
                
                start_time = time.time()
                response = await agent_manager.process_request(request)
                end_time = time.time()
                
                processing_time = (end_time - start_time) * 1000  # milliseconds
                single_agent_times.append(processing_time)
                
                assert response.status.value == "completed"
            
            # Single agent performance assertions
            avg_single_time = statistics.mean(single_agent_times)
            assert avg_single_time < 5000  # < 5 seconds average
            
            # Test batch processing performance
            batch_requests = [
                AgentRequest(
                    agent_type=AgentType.CONTENT_CREATOR,
                    input_data={
                        "brief": f"Create content {i}",
                        "type": "social_post"
                    }
                )
                for i in range(20)
            ]
            
            start_time = time.time()
            batch_responses = await agent_manager.process_batch(batch_requests)
            end_time = time.time()
            
            batch_time = (end_time - start_time) * 1000  # milliseconds
            
            # Batch processing should be more efficient than sequential
            sequential_estimate = avg_single_time * len(batch_requests)
            efficiency_ratio = batch_time / sequential_estimate
            
            assert efficiency_ratio < 0.8  # Batch should be at least 20% faster
            assert all(r.status.value == "completed" for r in batch_responses)
    
    @pytest.mark.asyncio
    async def test_database_performance(self, db_manager: DatabaseManager):
        """Test database operation performance"""
        # Test SQLite performance
        db = db_manager.sqlite_db
        
        # Bulk insert performance
        cache_entries = [
            {
                "key": f"perf_test_key_{i}",
                "value": f'{{"data": "performance test value {i}", "index": {i}}}',
                "expires_at": "2024-12-31 23:59:59",
                "size": 100
            }
            for i in range(1000)
        ]
        
        start_time = time.time()
        db["cache"].insert_all(cache_entries)
        insert_time = time.time() - start_time
        
        # Bulk insert should complete quickly
        assert insert_time < 5.0  # < 5 seconds for 1000 records
        
        # Query performance
        start_time = time.time()
        results = list(db["cache"].rows_where("key LIKE ?", ["perf_test_key_%"]))
        query_time = time.time() - start_time
        
        assert len(results) == 1000
        assert query_time < 1.0  # < 1 second to query 1000 records
        
        # Complex query performance
        start_time = time.time()
        complex_results = list(db["cache"].rows_where(
            "key LIKE ? AND size > ?",
            ["perf_test_key_%", 50],
            order_by="key"
        ))
        complex_query_time = time.time() - start_time
        
        assert len(complex_results) == 1000
        assert complex_query_time < 2.0  # < 2 seconds for complex query
        
        # Update performance
        start_time = time.time()
        for i in range(100):
            db["cache"].update(f"perf_test_key_{i}", {"size": 200})
        update_time = time.time() - start_time
        
        assert update_time < 2.0  # < 2 seconds for 100 updates
        
        # Delete performance
        start_time = time.time()
        deleted_count = db["cache"].delete_where("key LIKE ?", ["perf_test_key_%"])
        delete_time = time.time() - start_time
        
        assert deleted_count == 1000
        assert delete_time < 1.0  # < 1 second to delete 1000 records
    
    @pytest.mark.asyncio
    async def test_memory_usage(self, agent_manager: AIAgentManager):
        """Test memory usage during intensive operations"""
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        with patch('backend.core.ai_agents.RequestyAIClient.route_request') as mock_route:
            mock_route.return_value = {
                "content": '{"title": "Test", "content": "Content"}',
                "model_used": "gpt-4"
            }
            
            # Process many requests to test memory usage
            for batch in range(10):
                requests = [
                    AgentRequest(
                        agent_type=AgentType.CONTENT_CREATOR,
                        input_data={"brief": f"Content {batch}_{i}"}
                    )
                    for i in range(20)
                ]
                
                await agent_manager.process_batch(requests)
                
                # Force garbage collection
                gc.collect()
                
                current_memory = process.memory_info().rss / 1024 / 1024  # MB
                memory_increase = current_memory - initial_memory
                
                # Memory usage shouldn't grow excessively
                assert memory_increase < 500  # < 500MB increase
        
        # Final memory check after processing
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        total_memory_increase = final_memory - initial_memory
        
        # Total memory increase should be reasonable
        assert total_memory_increase < 200  # < 200MB total increase
    
    @pytest.mark.asyncio
    async def test_cpu_usage_under_load(self, test_client: httpx.AsyncClient):
        """Test CPU usage under sustained load"""
        headers = {"Authorization": "Bearer test_token"}
        
        with patch('backend.api.routers.auth.verify_token') as mock_verify:
            mock_verify.return_value = {"user_id": "test_user", "role": "content_creator"}
            
            # Monitor CPU usage during load test
            cpu_percentages = []
            
            async def monitor_cpu():
                for _ in range(30):  # Monitor for 30 seconds
                    cpu_percent = psutil.cpu_percent(interval=1)
                    cpu_percentages.append(cpu_percent)
            
            async def generate_load():
                tasks = []
                for i in range(100):
                    if i % 4 == 0:
                        task = test_client.get("/api/v1/content/list", headers=headers)
                    elif i % 4 == 1:
                        task = test_client.get("/api/v1/analytics/overview", headers=headers)
                    elif i % 4 == 2:
                        task = test_client.get("/api/v1/compliance/summary", headers=headers)
                    else:
                        task = test_client.post(
                            "/api/v1/content/brief",
                            json={
                                "title": f"Load Test {i}",
                                "brief": f"Brief {i}",
                                "content_type": "social_post"
                            },
                            headers=headers
                        )
                    tasks.append(task)
                
                # Execute load in batches to avoid overwhelming
                batch_size = 10
                for i in range(0, len(tasks), batch_size):
                    batch = tasks[i:i+batch_size]
                    await asyncio.gather(*batch, return_exceptions=True)
                    await asyncio.sleep(0.1)  # Small delay between batches
            
            # Run CPU monitoring and load generation concurrently
            await asyncio.gather(
                monitor_cpu(),
                generate_load()
            )
            
            # Analyze CPU usage
            if cpu_percentages:
                avg_cpu = statistics.mean(cpu_percentages)
                max_cpu = max(cpu_percentages)
                
                # CPU usage should be reasonable
                assert avg_cpu < 80  # Average CPU < 80%
                assert max_cpu < 95  # Peak CPU < 95%
    
    def test_startup_time(self):
        """Test application startup time"""
        import subprocess
        import sys
        
        # Measure startup time by importing main modules
        start_time = time.time()
        
        # Import key modules (simulating startup)
        import backend.main
        import backend.core.ai_agents
        import backend.core.database
        import backend.core.config
        
        end_time = time.time()
        startup_time = end_time - start_time
        
        # Startup should be fast
        assert startup_time < 5.0  # < 5 seconds to import all modules
    
    @pytest.mark.asyncio
    async def test_concurrent_user_sessions(self, test_client: httpx.AsyncClient):
        """Test performance with multiple concurrent user sessions"""
        with patch('backend.api.routers.auth.verify_token') as mock_verify:
            # Simulate different users
            users = [f"user_{i}" for i in range(20)]
            
            async def user_session(user_id: str):
                headers = {"Authorization": f"Bearer token_{user_id}"}
                mock_verify.return_value = {"user_id": user_id, "role": "content_creator"}
                
                # Simulate user workflow
                actions = [
                    test_client.get("/api/v1/auth/me", headers=headers),
                    test_client.get("/api/v1/content/list", headers=headers),
                    test_client.post(
                        "/api/v1/content/brief",
                        json={
                            "title": f"Content by {user_id}",
                            "brief": f"Brief by {user_id}",
                            "content_type": "blog_post"
                        },
                        headers=headers
                    ),
                    test_client.get("/api/v1/analytics/overview", headers=headers)
                ]
                
                return await asyncio.gather(*actions, return_exceptions=True)
            
            # Run concurrent user sessions
            start_time = time.time()
            session_tasks = [user_session(user) for user in users]
            session_results = await asyncio.gather(*session_tasks)
            end_time = time.time()
            
            total_time = end_time - start_time
            
            # Check that all sessions completed successfully
            successful_sessions = 0
            for session_result in session_results:
                if all(
                    hasattr(response, 'status_code') and response.status_code < 400 
                    for response in session_result 
                    if hasattr(response, 'status_code')
                ):
                    successful_sessions += 1
            
            # Performance assertions
            assert successful_sessions >= 18  # 90% success rate
            assert total_time < 20.0          # Complete within 20 seconds
            
            # Throughput check
            total_requests = len(users) * 4  # 4 requests per user
            throughput = successful_sessions * 4 / total_time
            assert throughput >= 2.0  # At least 2 requests per second

class TestScalabilityLimits:
    """Test system scalability and limits"""
    
    @pytest.mark.asyncio
    async def test_maximum_agent_capacity(self):
        """Test maximum AI agent capacity"""
        manager = AIAgentManager()
        await manager.initialize()
        
        try:
            with patch('backend.core.ai_agents.RequestyAIClient.route_request') as mock_route:
                mock_route.return_value = {
                    "content": '{"title": "Test", "content": "Content"}',
                    "model_used": "gpt-4"
                }
                
                # Create requests up to maximum capacity
                max_agents = settings.MAX_CONCURRENT_AGENTS
                requests = [
                    AgentRequest(
                        agent_type=AgentType.CONTENT_CREATOR,
                        input_data={"brief": f"Content {i}"}
                    )
                    for i in range(max_agents * 2)  # Try to exceed capacity
                ]
                
                start_time = time.time()
                responses = await manager.process_batch(requests)
                end_time = time.time()
                
                processing_time = end_time - start_time
                
                # All requests should complete eventually
                assert len(responses) == len(requests)
                assert all(r.status.value in ["completed", "failed"] for r in responses)
                
                # Should handle gracefully even when exceeding capacity
                successful_responses = sum(1 for r in responses if r.status.value == "completed")
                assert successful_responses >= len(requests) * 0.8  # 80% success rate
                
        finally:
            await manager.shutdown()
    
    @pytest.mark.asyncio
    async def test_large_content_processing(self, test_client: httpx.AsyncClient):
        """Test processing of large content"""
        headers = {"Authorization": "Bearer test_token"}
        
        with patch('backend.api.routers.auth.verify_token') as mock_verify:
            mock_verify.return_value = {"user_id": "test_user", "role": "content_creator"}
            
            # Create large content brief
            large_brief = "Create comprehensive content about EESystem technology. " * 1000  # ~50KB
            
            content_data = {
                "title": "Large Content Test",
                "brief": large_brief,
                "content_type": "long_form_article",
                "platform": "web"
            }
            
            start_time = time.time()
            response = await test_client.post(
                "/api/v1/content/brief",
                json=content_data,
                headers=headers
            )
            end_time = time.time()
            
            processing_time = end_time - start_time
            
            # Should handle large content gracefully
            assert response.status_code in [200, 201, 202]  # Success or accepted
            assert processing_time < 30.0  # Complete within 30 seconds
    
    @pytest.mark.asyncio
    async def test_database_storage_limits(self, db_manager: DatabaseManager):
        """Test database storage limits"""
        db = db_manager.sqlite_db
        
        # Test large record storage
        large_data = {
            "id": "large_content_test",
            "user_id": "test_user",
            "title": "Large Content Storage Test",
            "content": "This is a large content entry. " * 10000,  # ~300KB
            "content_type": "large_article",
            "metadata": '{"test": "large_storage_test"}'
        }
        
        start_time = time.time()
        db["content_drafts"].insert(large_data)
        insert_time = time.time() - start_time
        
        # Should handle large records
        assert insert_time < 5.0  # Insert within 5 seconds
        
        # Verify retrieval
        start_time = time.time()
        retrieved = db["content_drafts"].get("large_content_test")
        retrieval_time = time.time() - start_time
        
        assert retrieved is not None
        assert len(retrieved["content"]) > 250000  # ~250KB+
        assert retrieval_time < 2.0  # Retrieve within 2 seconds

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-x"])