"""
End-to-End tests for EESystem Content Curation Platform
Tests complete user workflows from frontend to backend
"""
import pytest
import asyncio
import json
import uuid
from typing import Dict, Any, List
from datetime import datetime, timedelta
import httpx
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
from unittest.mock import patch, AsyncMock

from backend.main import app
from backend.core.config import settings
from backend.core.database import init_db, close_db

class TestCompleteWorkflow:
    """Test complete user workflows"""
    
    @pytest.fixture(scope="session")
    async def test_client(self):
        """Create test client for API testing"""
        async with httpx.AsyncClient(app=app, base_url="http://testserver") as client:
            yield client
    
    @pytest.fixture(scope="session")
    async def browser_context(self):
        """Create browser context for frontend testing"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080}
            )
            yield context
            await context.close()
            await browser.close()
    
    @pytest.fixture
    async def authenticated_page(self, browser_context: BrowserContext):
        """Create authenticated page for testing"""
        page = await browser_context.new_page()
        
        # Mock authentication
        await page.goto("http://localhost:3000")
        await page.evaluate("""
            localStorage.setItem('auth_token', 'test_token_123');
            localStorage.setItem('user_id', 'test_user_456');
            localStorage.setItem('user_role', 'content_creator');
        """)
        
        yield page
        await page.close()
    
    @pytest.mark.asyncio
    async def test_user_authentication_flow(self, test_client: httpx.AsyncClient):
        """Test user authentication workflow"""
        # Test user registration
        registration_data = {
            "email": "test@eesystem.com",
            "username": "testuser",
            "password": "SecurePassword123!",
            "full_name": "Test User",
            "role": "content_creator"
        }
        
        response = await test_client.post("/api/v1/auth/register", json=registration_data)
        assert response.status_code == 201
        
        user_data = response.json()
        assert user_data["email"] == registration_data["email"]
        assert user_data["username"] == registration_data["username"]
        assert "id" in user_data
        
        # Test user login
        login_data = {
            "username": registration_data["username"],
            "password": registration_data["password"]
        }
        
        response = await test_client.post("/api/v1/auth/login", json=login_data)
        assert response.status_code == 200
        
        login_response = response.json()
        assert "access_token" in login_response
        assert "token_type" in login_response
        assert login_response["token_type"] == "bearer"
        
        # Test authenticated request
        headers = {"Authorization": f"Bearer {login_response['access_token']}"}
        response = await test_client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 200
        
        user_profile = response.json()
        assert user_profile["email"] == registration_data["email"]
    
    @pytest.mark.asyncio
    async def test_content_creation_workflow(self, test_client: httpx.AsyncClient):
        """Test complete content creation workflow"""
        # Mock authentication
        headers = {"Authorization": "Bearer test_token"}
        
        with patch('backend.api.routers.auth.verify_token') as mock_verify:
            mock_verify.return_value = {
                "user_id": "test_user_123",
                "role": "content_creator"
            }
            
            # Step 1: Create content brief
            content_brief = {
                "title": "EESystem Wellness Technology Benefits",
                "brief": "Create an informative article about the health benefits of EESystem technology",
                "content_type": "blog_post",
                "target_audience": "health_conscious_adults",
                "platform": "web",
                "category": "educational",
                "subcategory": "health_benefits",
                "required_disclaimers": True,
                "brand_compliance_check": True
            }
            
            response = await test_client.post(
                "/api/v1/content/brief",
                json=content_brief,
                headers=headers
            )
            assert response.status_code == 201
            
            brief_response = response.json()
            brief_id = brief_response["id"]
            assert brief_response["title"] == content_brief["title"]
            assert brief_response["status"] == "pending"
            
            # Step 2: Generate content using AI agents
            with patch('backend.core.ai_agents.AIAgentManager.process_request') as mock_agent:
                mock_agent.return_value = AsyncMock()
                mock_agent.return_value.status = "completed"
                mock_agent.return_value.result = {
                    "title": "The Science Behind EESystem Wellness Technology",
                    "content": "EESystem represents a breakthrough in wellness technology...",
                    "summary": "An overview of EESystem's scientifically-backed approach to wellness",
                    "tags": ["wellness", "technology", "health", "science"],
                    "call_to_action": "Discover how EESystem can support your wellness journey",
                    "disclaimers": [
                        "This statement has not been evaluated by the Food and Drug Administration",
                        "Individual results may vary"
                    ],
                    "seo_keywords": ["EESystem", "wellness technology", "health benefits"],
                    "metadata": {
                        "word_count": 1500,
                        "reading_time": "6 minutes",
                        "created_by": "ai_agent_content_creator"
                    }
                }
                
                response = await test_client.post(
                    f"/api/v1/content/{brief_id}/generate",
                    headers=headers
                )
                assert response.status_code == 200
                
                generation_response = response.json()
                content_id = generation_response["content_id"]
                assert generation_response["status"] == "generated"
                assert "ai_agent_results" in generation_response
            
            # Step 3: Run compliance check
            with patch('backend.core.ai_agents.AIAgentManager.process_request') as mock_compliance:
                mock_compliance.return_value = AsyncMock()
                mock_compliance.return_value.status = "completed"
                mock_compliance.return_value.result = {
                    "compliance_score": 0.95,
                    "is_compliant": True,
                    "findings": [],
                    "required_disclaimers": [
                        "This statement has not been evaluated by the Food and Drug Administration"
                    ],
                    "brand_alignment": 0.92,
                    "health_claims_valid": True,
                    "overall_assessment": "Content meets all compliance requirements"
                }
                
                response = await test_client.post(
                    f"/api/v1/compliance/check/{content_id}",
                    headers=headers
                )
                assert response.status_code == 200
                
                compliance_response = response.json()
                assert compliance_response["compliance_score"] >= 0.9
                assert compliance_response["is_compliant"] is True
            
            # Step 4: Brand voice validation
            with patch('backend.core.ai_agents.AIAgentManager.process_request') as mock_brand:
                mock_brand.return_value = AsyncMock()
                mock_brand.return_value.status = "completed"
                mock_brand.return_value.result = {
                    "voice_score": 0.94,
                    "tone_score": 0.91,
                    "language_score": 0.96,
                    "overall_brand_score": 0.93,
                    "is_brand_compliant": True,
                    "recommendations": ["Excellent alignment with EESystem brand voice"],
                    "strengths": ["Professional tone", "Scientific accuracy", "Clear communication"],
                    "areas_for_improvement": []
                }
                
                response = await test_client.post(
                    f"/api/v1/content/{content_id}/brand-validation",
                    headers=headers
                )
                assert response.status_code == 200
                
                brand_response = response.json()
                assert brand_response["overall_brand_score"] >= 0.9
                assert brand_response["is_brand_compliant"] is True
            
            # Step 5: Multi-platform optimization
            platforms = ["facebook", "instagram", "twitter", "linkedin"]
            
            for platform in platforms:
                with patch('backend.core.ai_agents.AIAgentManager.process_request') as mock_optimize:
                    mock_optimize.return_value = AsyncMock()
                    mock_optimize.return_value.status = "completed"
                    mock_optimize.return_value.result = {
                        "optimized_content": f"✨ Discover EESystem wellness technology! Perfect for {platform} #Health #Wellness",
                        "hashtags": [f"#{platform.title()}", "#Health", "#Wellness", "#EESystem"],
                        "posting_time_recommendations": ["9:00 AM", "12:00 PM", "7:00 PM"],
                        "engagement_tips": ["Use compelling visuals", "Ask engaging questions"],
                        "visual_recommendations": ["Health technology imagery", "Before/after testimonials"],
                        "character_count": 85,
                        "platform_score": 0.92
                    }
                    
                    response = await test_client.post(
                        f"/api/v1/content/{content_id}/optimize/{platform}",
                        headers=headers
                    )
                    assert response.status_code == 200
                    
                    optimize_response = response.json()
                    assert "optimized_content" in optimize_response
                    assert optimize_response["platform"] == platform
                    
                    # Verify platform-specific constraints
                    platform_config = settings.SOCIAL_PLATFORMS.get(platform, {})
                    if "character_limit" in platform_config:
                        assert optimize_response["character_count"] <= platform_config["character_limit"]
            
            # Step 6: Schedule content for publication
            schedule_data = {
                "platforms": ["web", "facebook", "instagram"],
                "schedule_times": {
                    "web": "2024-01-15T10:00:00Z",
                    "facebook": "2024-01-15T12:00:00Z",
                    "instagram": "2024-01-15T14:00:00Z"
                },
                "auto_publish": False,
                "approval_required": True
            }
            
            response = await test_client.post(
                f"/api/v1/content/{content_id}/schedule",
                json=schedule_data,
                headers=headers
            )
            assert response.status_code == 201
            
            schedule_response = response.json()
            assert len(schedule_response["scheduled_items"]) == 3
            for item in schedule_response["scheduled_items"]:
                assert item["status"] == "scheduled"
                assert item["platform"] in schedule_data["platforms"]
            
            # Step 7: Final content approval
            approval_data = {
                "approved": True,
                "approval_notes": "Content meets all brand and compliance requirements",
                "approved_platforms": ["web", "facebook", "instagram"]
            }
            
            response = await test_client.post(
                f"/api/v1/content/{content_id}/approve",
                json=approval_data,
                headers=headers
            )
            assert response.status_code == 200
            
            approval_response = response.json()
            assert approval_response["status"] == "approved"
            assert approval_response["approved_platforms"] == approval_data["approved_platforms"]
    
    @pytest.mark.asyncio
    async def test_frontend_content_creation_flow(self, authenticated_page: Page):
        """Test frontend content creation workflow"""
        # Navigate to content creation page
        await authenticated_page.goto("http://localhost:3000/content/create")
        
        # Wait for page to load
        await authenticated_page.wait_for_selector('[data-testid="content-creation-form"]')
        
        # Fill in content brief form
        await authenticated_page.fill('[data-testid="content-title"]', 'EESystem Wellness Benefits')
        await authenticated_page.fill(
            '[data-testid="content-brief"]',
            'Create an educational article about the health benefits of EESystem technology'
        )
        await authenticated_page.select_option('[data-testid="content-type"]', 'blog_post')
        await authenticated_page.select_option('[data-testid="target-platform"]', 'web')
        await authenticated_page.select_option('[data-testid="target-audience"]', 'health_conscious_adults')
        
        # Enable compliance checking
        await authenticated_page.check('[data-testid="brand-compliance-check"]')
        await authenticated_page.check('[data-testid="health-claims-validation"]')
        
        # Submit content brief
        await authenticated_page.click('[data-testid="submit-brief"]')
        
        # Wait for AI generation to start
        await authenticated_page.wait_for_selector('[data-testid="ai-generation-progress"]')
        
        # Mock AI agent responses
        await authenticated_page.evaluate("""
            window.mockAIResponse = {
                title: 'The Science Behind EESystem Wellness Technology',
                content: 'EESystem represents a breakthrough in wellness technology...',
                compliance_score: 0.95,
                brand_score: 0.93,
                status: 'completed'
            };
        """)
        
        # Wait for generation to complete
        await authenticated_page.wait_for_selector('[data-testid="generated-content"]', timeout=30000)
        
        # Verify generated content is displayed
        title_element = await authenticated_page.query_selector('[data-testid="generated-title"]')
        title_text = await title_element.text_content()
        assert "EESystem" in title_text
        
        content_element = await authenticated_page.query_selector('[data-testid="generated-content-body"]')
        content_text = await content_element.text_content()
        assert len(content_text) > 100  # Ensure substantial content was generated
        
        # Check compliance scores
        compliance_score = await authenticated_page.query_selector('[data-testid="compliance-score"]')
        compliance_text = await compliance_score.text_content()
        assert "95%" in compliance_text or "0.95" in compliance_text
        
        brand_score = await authenticated_page.query_selector('[data-testid="brand-score"]')
        brand_text = await brand_score.text_content()
        assert "93%" in brand_text or "0.93" in brand_text
        
        # Test platform optimization
        await authenticated_page.click('[data-testid="optimize-for-platforms"]')
        
        # Select platforms for optimization
        await authenticated_page.check('[data-testid="platform-facebook"]')
        await authenticated_page.check('[data-testid="platform-instagram"]')
        await authenticated_page.check('[data-testid="platform-twitter"]')
        
        await authenticated_page.click('[data-testid="start-optimization"]')
        
        # Wait for optimization to complete
        await authenticated_page.wait_for_selector('[data-testid="platform-optimizations"]')
        
        # Verify optimized content for each platform
        facebook_content = await authenticated_page.query_selector('[data-testid="facebook-optimized"]')
        assert facebook_content is not None
        
        instagram_content = await authenticated_page.query_selector('[data-testid="instagram-optimized"]')
        assert instagram_content is not None
        
        twitter_content = await authenticated_page.query_selector('[data-testid="twitter-optimized"]')
        assert twitter_content is not None
        
        # Test scheduling interface
        await authenticated_page.click('[data-testid="schedule-content"]')
        
        # Set schedule times
        await authenticated_page.fill(
            '[data-testid="web-schedule-time"]',
            '2024-01-15T10:00'
        )
        await authenticated_page.fill(
            '[data-testid="facebook-schedule-time"]',
            '2024-01-15T12:00'
        )
        await authenticated_page.fill(
            '[data-testid="instagram-schedule-time"]',
            '2024-01-15T14:00'
        )
        
        # Enable approval workflow
        await authenticated_page.check('[data-testid="require-approval"]')
        
        # Submit schedule
        await authenticated_page.click('[data-testid="submit-schedule"]')
        
        # Wait for confirmation
        await authenticated_page.wait_for_selector('[data-testid="schedule-confirmation"]')
        
        confirmation_text = await authenticated_page.query_selector('[data-testid="schedule-confirmation"]')
        confirmation_content = await confirmation_text.text_content()
        assert "scheduled" in confirmation_content.lower()
        
        # Test approval workflow
        await authenticated_page.click('[data-testid="approve-content"]')
        
        # Add approval notes
        await authenticated_page.fill(
            '[data-testid="approval-notes"]',
            'Content meets all brand and compliance requirements'
        )
        
        await authenticated_page.click('[data-testid="final-approval"]')
        
        # Wait for approval confirmation
        await authenticated_page.wait_for_selector('[data-testid="approval-confirmation"]')
        
        approval_confirmation = await authenticated_page.query_selector('[data-testid="approval-confirmation"]')
        approval_text = await approval_confirmation.text_content()
        assert "approved" in approval_text.lower()
    
    @pytest.mark.asyncio
    async def test_analytics_dashboard_workflow(self, authenticated_page: Page):
        """Test analytics dashboard workflow"""
        # Navigate to analytics dashboard
        await authenticated_page.goto("http://localhost:3000/analytics")
        
        # Wait for dashboard to load
        await authenticated_page.wait_for_selector('[data-testid="analytics-dashboard"]')
        
        # Check key metrics are displayed
        total_content = await authenticated_page.query_selector('[data-testid="total-content-metric"]')
        assert total_content is not None
        
        engagement_rate = await authenticated_page.query_selector('[data-testid="engagement-rate-metric"]')
        assert engagement_rate is not None
        
        brand_compliance = await authenticated_page.query_selector('[data-testid="brand-compliance-metric"]')
        assert brand_compliance is not None
        
        # Test date range filtering
        await authenticated_page.click('[data-testid="date-range-picker"]')
        await authenticated_page.click('[data-testid="last-30-days"]')
        
        # Wait for data to refresh
        await authenticated_page.wait_for_timeout(2000)
        
        # Test platform filtering
        await authenticated_page.click('[data-testid="platform-filter"]')
        await authenticated_page.check('[data-testid="filter-facebook"]')
        await authenticated_page.check('[data-testid="filter-instagram"]')
        await authenticated_page.click('[data-testid="apply-filters"]')
        
        # Wait for filtered data
        await authenticated_page.wait_for_timeout(2000)
        
        # Test content performance table
        content_table = await authenticated_page.query_selector('[data-testid="content-performance-table"]')
        assert content_table is not None
        
        # Test export functionality
        await authenticated_page.click('[data-testid="export-analytics"]')
        await authenticated_page.click('[data-testid="export-csv"]')
        
        # Verify download initiated (in real test, would check for download)
        await authenticated_page.wait_for_timeout(1000)
    
    @pytest.mark.asyncio
    async def test_compliance_monitoring_workflow(self, authenticated_page: Page):
        """Test compliance monitoring workflow"""
        # Navigate to compliance dashboard
        await authenticated_page.goto("http://localhost:3000/compliance")
        
        # Wait for compliance dashboard to load
        await authenticated_page.wait_for_selector('[data-testid="compliance-dashboard"]')
        
        # Check compliance overview metrics
        overall_score = await authenticated_page.query_selector('[data-testid="overall-compliance-score"]')
        assert overall_score is not None
        
        health_claims_status = await authenticated_page.query_selector('[data-testid="health-claims-status"]')
        assert health_claims_status is not None
        
        brand_alignment = await authenticated_page.query_selector('[data-testid="brand-alignment-score"]')
        assert brand_alignment is not None
        
        # Test compliance alerts
        alerts_section = await authenticated_page.query_selector('[data-testid="compliance-alerts"]')
        assert alerts_section is not None
        
        # Test compliance report generation
        await authenticated_page.click('[data-testid="generate-compliance-report"]')
        
        # Select report parameters
        await authenticated_page.select_option('[data-testid="report-timeframe"]', 'last_month')
        await authenticated_page.check('[data-testid="include-health-claims"]')
        await authenticated_page.check('[data-testid="include-brand-analysis"]')
        
        await authenticated_page.click('[data-testid="generate-report"]')
        
        # Wait for report generation
        await authenticated_page.wait_for_selector('[data-testid="report-generated"]', timeout=15000)
        
        # Verify report download link
        download_link = await authenticated_page.query_selector('[data-testid="download-report"]')
        assert download_link is not None
    
    @pytest.mark.asyncio
    async def test_user_management_workflow(self, authenticated_page: Page):
        """Test user management workflow (admin only)"""
        # Mock admin role
        await authenticated_page.evaluate("""
            localStorage.setItem('user_role', 'admin');
        """)
        
        # Navigate to user management
        await authenticated_page.goto("http://localhost:3000/admin/users")
        
        # Wait for user management page to load
        await authenticated_page.wait_for_selector('[data-testid="user-management"]')
        
        # Test user creation
        await authenticated_page.click('[data-testid="add-new-user"]')
        
        # Fill in new user form
        await authenticated_page.fill('[data-testid="new-user-email"]', 'newuser@eesystem.com')
        await authenticated_page.fill('[data-testid="new-user-name"]', 'New User')
        await authenticated_page.select_option('[data-testid="new-user-role"]', 'content_creator')
        
        # Set permissions
        await authenticated_page.check('[data-testid="permission-create-content"]')
        await authenticated_page.check('[data-testid="permission-edit-content"]')
        
        await authenticated_page.click('[data-testid="create-user"]')
        
        # Wait for user creation confirmation
        await authenticated_page.wait_for_selector('[data-testid="user-created-confirmation"]')
        
        # Test user search and filtering
        await authenticated_page.fill('[data-testid="user-search"]', 'newuser@eesystem.com')
        await authenticated_page.wait_for_timeout(1000)
        
        # Verify filtered results
        user_row = await authenticated_page.query_selector('[data-testid="user-row-newuser"]')
        assert user_row is not None
        
        # Test user role modification
        await authenticated_page.click('[data-testid="edit-user-newuser"]')
        await authenticated_page.select_option('[data-testid="edit-user-role"]', 'content_reviewer')
        await authenticated_page.click('[data-testid="save-user-changes"]')
        
        # Wait for confirmation
        await authenticated_page.wait_for_selector('[data-testid="user-updated-confirmation"]')

class TestPerformanceWorkflow:
    """Test performance aspects of complete workflows"""
    
    @pytest.mark.asyncio
    async def test_content_generation_performance(self, test_client: httpx.AsyncClient):
        """Test content generation performance under load"""
        headers = {"Authorization": "Bearer test_token"}
        
        with patch('backend.api.routers.auth.verify_token') as mock_verify:
            mock_verify.return_value = {"user_id": "test_user", "role": "content_creator"}
            
            # Create multiple content generation requests
            tasks = []
            for i in range(10):
                content_brief = {
                    "title": f"Performance Test Content {i}",
                    "brief": f"Generate test content number {i}",
                    "content_type": "blog_post",
                    "platform": "web"
                }
                
                task = test_client.post(
                    "/api/v1/content/brief",
                    json=content_brief,
                    headers=headers
                )
                tasks.append(task)
            
            # Execute all requests concurrently
            import time
            start_time = time.time()
            
            responses = await asyncio.gather(*tasks)
            
            end_time = time.time()
            total_time = end_time - start_time
            
            # Verify all requests succeeded
            for response in responses:
                assert response.status_code == 201
            
            # Performance assertion - should complete within reasonable time
            assert total_time < 30.0  # 30 seconds for 10 requests
            assert total_time / len(responses) < 5.0  # Average < 5 seconds per request
    
    @pytest.mark.asyncio
    async def test_database_performance_under_load(self, test_client: httpx.AsyncClient):
        """Test database performance under concurrent load"""
        headers = {"Authorization": "Bearer test_token"}
        
        with patch('backend.api.routers.auth.verify_token') as mock_verify:
            mock_verify.return_value = {"user_id": "test_user", "role": "content_creator"}
            
            # Create multiple database operations
            tasks = []
            for i in range(50):
                # Mix of read and write operations
                if i % 3 == 0:
                    # Create content
                    task = test_client.post(
                        "/api/v1/content/brief",
                        json={
                            "title": f"Load Test {i}",
                            "brief": f"Brief {i}",
                            "content_type": "social_post"
                        },
                        headers=headers
                    )
                elif i % 3 == 1:
                    # Query analytics
                    task = test_client.get(
                        "/api/v1/analytics/overview",
                        headers=headers
                    )
                else:
                    # Query content list
                    task = test_client.get(
                        "/api/v1/content/list",
                        headers=headers
                    )
                
                tasks.append(task)
            
            # Execute all operations concurrently
            import time
            start_time = time.time()
            
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            end_time = time.time()
            total_time = end_time - start_time
            
            # Count successful responses
            successful_responses = sum(
                1 for response in responses 
                if hasattr(response, 'status_code') and response.status_code < 400
            )
            
            # Performance assertions
            assert successful_responses >= len(responses) * 0.95  # 95% success rate
            assert total_time < 60.0  # Complete within 60 seconds
            
            # Average response time should be reasonable
            avg_response_time = total_time / len(responses)
            assert avg_response_time < 2.0  # Average < 2 seconds per operation

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])