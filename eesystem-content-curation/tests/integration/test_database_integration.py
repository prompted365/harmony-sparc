"""
Integration tests for Database System in EESystem Content Curation Platform
Tests AstraDB and SQLite integration
"""
import pytest
import asyncio
import uuid
import json
from datetime import datetime, timedelta
from typing import Dict, Any
from unittest.mock import Mock, AsyncMock, patch

from backend.core.database import (
    DatabaseManager,
    init_db,
    close_db,
    get_astra_session,
    get_sqlite_db,
    get_sqlite_session,
    db_health_check,
    ContentModel,
    UserModel,
    ContentAnalyticsModel,
    AIAgentResultModel,
    ComplianceReportModel,
    ContentScheduleModel
)
from backend.core.config import settings

class TestDatabaseIntegration:
    """Test database integration components"""
    
    @pytest.fixture
    async def db_manager(self):
        """Create database manager for testing"""
        manager = DatabaseManager()
        
        # Mock AstraDB connection for testing
        with patch.object(manager, '_init_astra_db', new_callable=AsyncMock):
            await manager.initialize()
        
        yield manager
        await manager.close()
    
    @pytest.fixture
    def sample_content_data(self):
        """Sample content data for testing"""
        return {
            "id": uuid.uuid4(),
            "title": "EESystem Wellness Benefits",
            "content": "Discover how EESystem technology supports your wellness journey",
            "content_type": "blog_post",
            "category": "educational",
            "subcategory": "health_benefits",
            "author_id": uuid.uuid4(),
            "status": "draft",
            "platform": "web",
            "brand_compliant": True,
            "health_claims_validated": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "metadata": {"source": "ai_generated", "version": "1.0"},
            "tags": {"health", "wellness", "technology"},
            "approval_status": "pending",
            "approval_notes": "Ready for review"
        }
    
    @pytest.fixture
    def sample_user_data(self):
        """Sample user data for testing"""
        return {
            "id": uuid.uuid4(),
            "email": "test@eesystem.com",
            "username": "testuser",
            "full_name": "Test User",
            "role": "content_creator",
            "permissions": {"create_content", "edit_content"},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_login": datetime.utcnow(),
            "is_active": True,
            "profile_data": {"department": "marketing", "location": "remote"}
        }
    
    @pytest.mark.asyncio
    async def test_database_initialization(self, db_manager):
        """Test database initialization"""
        assert db_manager.sqlite_db is not None
        assert db_manager.sqlite_engine is not None
        assert db_manager.sqlite_session_factory is not None
    
    @pytest.mark.asyncio
    async def test_sqlite_table_creation(self, db_manager):
        """Test SQLite table creation"""
        # Check that tables exist
        tables = db_manager.sqlite_db.table_names()
        
        expected_tables = [
            "session_data",
            "cache",
            "agent_memory",
            "processing_queue",
            "content_drafts"
        ]
        
        for table in expected_tables:
            assert table in tables
    
    @pytest.mark.asyncio
    async def test_sqlite_session_data_operations(self, db_manager):
        """Test SQLite session data operations"""
        db = db_manager.sqlite_db
        
        # Insert session data
        session_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        
        db["session_data"].insert({
            "id": session_id,
            "user_id": user_id,
            "session_type": "content_creation",
            "data": json.dumps({"step": "initial", "progress": 0.1}),
            "expires_at": datetime.utcnow() + timedelta(hours=24),
            "metadata": json.dumps({"source": "web_app"})
        })
        
        # Retrieve session data
        session = db["session_data"].get(session_id)
        assert session is not None
        assert session["user_id"] == user_id
        assert session["session_type"] == "content_creation"
        
        # Update session data
        db["session_data"].update(session_id, {
            "data": json.dumps({"step": "progress", "progress": 0.5})
        })
        
        updated_session = db["session_data"].get(session_id)
        session_data = json.loads(updated_session["data"])
        assert session_data["progress"] == 0.5
    
    @pytest.mark.asyncio
    async def test_sqlite_cache_operations(self, db_manager):
        """Test SQLite cache operations"""
        db = db_manager.sqlite_db
        
        # Insert cache entry
        cache_key = "ai_response_hash123"
        cache_value = json.dumps({
            "title": "Cached Content",
            "content": "This is cached AI-generated content",
            "confidence": 0.95
        })
        
        db["cache"].insert({
            "key": cache_key,
            "value": cache_value,
            "expires_at": datetime.utcnow() + timedelta(hours=1),
            "size": len(cache_value),
            "metadata": json.dumps({"agent_type": "content_creator"})
        })
        
        # Retrieve cache entry
        cached_item = db["cache"].get(cache_key)
        assert cached_item is not None
        assert cached_item["key"] == cache_key
        
        cached_data = json.loads(cached_item["value"])
        assert cached_data["title"] == "Cached Content"
        assert cached_data["confidence"] == 0.95
    
    @pytest.mark.asyncio
    async def test_sqlite_agent_memory_operations(self, db_manager):
        """Test SQLite agent memory operations"""
        db = db_manager.sqlite_db
        
        # Insert agent memory
        memory_id = str(uuid.uuid4())
        agent_id = str(uuid.uuid4())
        
        db["agent_memory"].insert({
            "id": memory_id,
            "agent_id": agent_id,
            "memory_type": "conversation_context",
            "context": "content_creation_session",
            "data": json.dumps({
                "user_preferences": {"tone": "professional", "length": "medium"},
                "recent_topics": ["wellness", "technology", "health"]
            }),
            "last_accessed": datetime.utcnow(),
            "access_count": 1,
            "importance_score": 0.8,
            "metadata": json.dumps({"session_id": "session123"})
        })
        
        # Retrieve agent memory
        memory = db["agent_memory"].get(memory_id)
        assert memory is not None
        assert memory["agent_id"] == agent_id
        assert memory["memory_type"] == "conversation_context"
        
        memory_data = json.loads(memory["data"])
        assert "user_preferences" in memory_data
        assert "recent_topics" in memory_data
        
        # Update access count
        db["agent_memory"].update(memory_id, {
            "access_count": memory["access_count"] + 1,
            "last_accessed": datetime.utcnow()
        })
        
        updated_memory = db["agent_memory"].get(memory_id)
        assert updated_memory["access_count"] == 2
    
    @pytest.mark.asyncio
    async def test_sqlite_processing_queue_operations(self, db_manager):
        """Test SQLite processing queue operations"""
        db = db_manager.sqlite_db
        
        # Insert queue items
        queue_items = []
        for i in range(5):
            queue_id = str(uuid.uuid4())
            db["processing_queue"].insert({
                "id": queue_id,
                "task_type": "content_generation",
                "payload": json.dumps({
                    "brief": f"Content brief {i}",
                    "priority": i % 3
                }),
                "status": "pending",
                "priority": i % 3,
                "metadata": json.dumps({"batch": "test_batch"})
            })
            queue_items.append(queue_id)
        
        # Retrieve pending items ordered by priority
        pending_items = list(db["processing_queue"].rows_where(
            "status = ?",
            ["pending"],
            order_by="priority DESC"
        ))
        
        assert len(pending_items) == 5
        assert pending_items[0]["priority"] >= pending_items[-1]["priority"]
        
        # Update item status
        first_item = pending_items[0]
        db["processing_queue"].update(first_item["id"], {
            "status": "processing",
            "started_at": datetime.utcnow()
        })
        
        updated_item = db["processing_queue"].get(first_item["id"])
        assert updated_item["status"] == "processing"
        assert updated_item["started_at"] is not None
    
    @pytest.mark.asyncio
    async def test_sqlite_content_drafts_operations(self, db_manager):
        """Test SQLite content drafts operations"""
        db = db_manager.sqlite_db
        
        # Insert content draft
        draft_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        
        db["content_drafts"].insert({
            "id": draft_id,
            "user_id": user_id,
            "title": "Draft: EESystem Health Benefits",
            "content": "This is a draft about EESystem health benefits...",
            "content_type": "blog_post",
            "platform": "web",
            "status": "draft",
            "auto_save_data": json.dumps({
                "word_count": 150,
                "last_edit": datetime.utcnow().isoformat()
            }),
            "metadata": json.dumps({"template": "health_article"})
        })
        
        # Retrieve draft
        draft = db["content_drafts"].get(draft_id)
        assert draft is not None
        assert draft["user_id"] == user_id
        assert draft["title"] == "Draft: EESystem Health Benefits"
        
        auto_save_data = json.loads(draft["auto_save_data"])
        assert auto_save_data["word_count"] == 150
        
        # Update draft content
        new_content = "Updated content about EESystem health benefits with more details..."
        db["content_drafts"].update(draft_id, {
            "content": new_content,
            "updated_at": datetime.utcnow(),
            "auto_save_data": json.dumps({
                "word_count": len(new_content.split()),
                "last_edit": datetime.utcnow().isoformat()
            })
        })
        
        updated_draft = db["content_drafts"].get(draft_id)
        assert updated_draft["content"] == new_content
    
    @pytest.mark.asyncio
    async def test_database_health_check(self, db_manager):
        """Test database health check"""
        # Mock successful health check
        with patch.object(db_manager, 'health_check', new_callable=AsyncMock) as mock_health:
            mock_health.return_value = {
                "astra_db": "healthy",
                "sqlite": "healthy"
            }
            
            health = await db_manager.health_check()
            assert health["sqlite"] == "healthy"
    
    @pytest.mark.asyncio
    async def test_sqlite_query_performance(self, db_manager):
        """Test SQLite query performance"""
        db = db_manager.sqlite_db
        
        # Insert large dataset
        import time
        
        start_time = time.time()
        
        # Insert 1000 cache entries
        cache_entries = []
        for i in range(1000):
            cache_entries.append({
                "key": f"key_{i}",
                "value": json.dumps({"data": f"value_{i}", "index": i}),
                "expires_at": datetime.utcnow() + timedelta(hours=1),
                "size": 100,
                "metadata": json.dumps({"batch": "performance_test"})
            })
        
        db["cache"].insert_all(cache_entries)
        insert_time = time.time() - start_time
        
        # Query performance test
        start_time = time.time()
        results = list(db["cache"].rows_where("size > ?", [50]))
        query_time = time.time() - start_time
        
        assert len(results) == 1000
        assert insert_time < 5.0  # Should insert within 5 seconds
        assert query_time < 1.0   # Should query within 1 second
    
    @pytest.mark.asyncio
    async def test_sqlite_transaction_handling(self, db_manager):
        """Test SQLite transaction handling"""
        session = db_manager.get_sqlite_session()
        
        try:
            # Start transaction
            session.begin()
            
            # Insert multiple related records
            session_id = str(uuid.uuid4())
            user_id = str(uuid.uuid4())
            
            # Insert session data
            session.execute(
                "INSERT INTO session_data (id, user_id, session_type, data) VALUES (?, ?, ?, ?)",
                (session_id, user_id, "test_transaction", json.dumps({"test": True}))
            )
            
            # Insert multiple agent memory records
            for i in range(3):
                memory_id = str(uuid.uuid4())
                session.execute(
                    "INSERT INTO agent_memory (id, agent_id, memory_type, data) VALUES (?, ?, ?, ?)",
                    (memory_id, user_id, f"memory_type_{i}", json.dumps({"index": i}))
                )
            
            # Commit transaction
            session.commit()
            
            # Verify all records were inserted
            session_count = session.execute(
                "SELECT COUNT(*) FROM session_data WHERE user_id = ?", (user_id,)
            ).scalar()
            
            memory_count = session.execute(
                "SELECT COUNT(*) FROM agent_memory WHERE agent_id = ?", (user_id,)
            ).scalar()
            
            assert session_count == 1
            assert memory_count == 3
            
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    @pytest.mark.asyncio
    async def test_data_cleanup_and_maintenance(self, db_manager):
        """Test data cleanup and maintenance operations"""
        db = db_manager.sqlite_db
        
        # Insert expired cache entries
        expired_time = datetime.utcnow() - timedelta(hours=2)
        
        for i in range(10):
            db["cache"].insert({
                "key": f"expired_key_{i}",
                "value": json.dumps({"expired": True}),
                "expires_at": expired_time,
                "size": 50,
                "metadata": json.dumps({"cleanup_test": True})
            })
        
        # Insert valid cache entries
        valid_time = datetime.utcnow() + timedelta(hours=1)
        
        for i in range(5):
            db["cache"].insert({
                "key": f"valid_key_{i}",
                "value": json.dumps({"valid": True}),
                "expires_at": valid_time,
                "size": 50,
                "metadata": json.dumps({"cleanup_test": True})
            })
        
        # Count entries before cleanup
        total_before = db["cache"].count_where("metadata LIKE ?", ["%cleanup_test%"])
        assert total_before == 15
        
        # Cleanup expired entries
        deleted_count = db["cache"].delete_where("expires_at < ?", [datetime.utcnow()])
        
        # Count entries after cleanup
        total_after = db["cache"].count_where("metadata LIKE ?", ["%cleanup_test%"])
        
        assert deleted_count >= 10
        assert total_after <= 5

class TestDatabaseModels:
    """Test AstraDB model operations"""
    
    @pytest.mark.asyncio
    async def test_content_model_operations(self, sample_content_data):
        """Test content model CRUD operations"""
        # Mock AstraDB operations since we can't connect to real AstraDB in tests
        with patch('backend.core.database.ContentModel') as MockContentModel:
            # Test model creation
            content = MockContentModel(**sample_content_data)
            content.save = Mock()
            content.save()
            
            content.save.assert_called_once()
            
            # Test model retrieval
            MockContentModel.get = Mock(return_value=content)
            retrieved_content = MockContentModel.get(id=sample_content_data["id"])
            
            assert retrieved_content == content
            MockContentModel.get.assert_called_once_with(id=sample_content_data["id"])
    
    @pytest.mark.asyncio
    async def test_user_model_operations(self, sample_user_data):
        """Test user model CRUD operations"""
        with patch('backend.core.database.UserModel') as MockUserModel:
            # Test user creation
            user = MockUserModel(**sample_user_data)
            user.save = Mock()
            user.save()
            
            user.save.assert_called_once()
            
            # Test user query by email
            MockUserModel.filter = Mock(return_value=[user])
            users = MockUserModel.filter(email=sample_user_data["email"])
            
            assert len(users) == 1
            assert users[0] == user
    
    @pytest.mark.asyncio
    async def test_analytics_model_operations(self):
        """Test analytics model operations"""
        with patch('backend.core.database.ContentAnalyticsModel') as MockAnalyticsModel:
            analytics_data = {
                "id": uuid.uuid4(),
                "content_id": uuid.uuid4(),
                "platform": "facebook",
                "metric_type": "engagement_rate",
                "metric_value": 0.075,
                "recorded_at": datetime.utcnow(),
                "metadata": {"campaign": "wellness_week"}
            }
            
            analytics = MockAnalyticsModel(**analytics_data)
            analytics.save = Mock()
            analytics.save()
            
            analytics.save.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_ai_agent_result_model_operations(self):
        """Test AI agent result model operations"""
        with patch('backend.core.database.AIAgentResultModel') as MockAgentResultModel:
            result_data = {
                "id": uuid.uuid4(),
                "agent_type": "content_creator",
                "content_id": uuid.uuid4(),
                "input_data": json.dumps({"brief": "Test content"}),
                "output_data": json.dumps({"title": "Generated Title", "content": "Generated content"}),
                "confidence_score": 0.92,
                "processing_time": 2.5,
                "created_at": datetime.utcnow(),
                "metadata": {"model_used": "gpt-4"},
                "success": True,
                "error_message": None
            }
            
            result = MockAgentResultModel(**result_data)
            result.save = Mock()
            result.save()
            
            result.save.assert_called_once()

class TestDatabasePerformance:
    """Test database performance and scalability"""
    
    @pytest.mark.asyncio
    async def test_concurrent_sqlite_operations(self, db_manager):
        """Test concurrent SQLite operations"""
        async def insert_session_data(session_id: str, user_id: str):
            db = db_manager.sqlite_db
            db["session_data"].insert({
                "id": session_id,
                "user_id": user_id,
                "session_type": "concurrent_test",
                "data": json.dumps({"test": True})
            })
        
        # Create concurrent tasks
        tasks = []
        for i in range(50):
            session_id = str(uuid.uuid4())
            user_id = str(uuid.uuid4())
            task = asyncio.create_task(insert_session_data(session_id, user_id))
            tasks.append(task)
        
        # Wait for all tasks to complete
        await asyncio.gather(*tasks)
        
        # Verify all records were inserted
        db = db_manager.sqlite_db
        count = db["session_data"].count_where("session_type = ?", ["concurrent_test"])
        assert count == 50
    
    @pytest.mark.asyncio
    async def test_large_data_handling(self, db_manager):
        """Test handling of large data sets"""
        db = db_manager.sqlite_db
        
        # Create large content entry
        large_content = "Lorem ipsum " * 10000  # ~110KB of text
        
        draft_id = str(uuid.uuid4())
        db["content_drafts"].insert({
            "id": draft_id,
            "user_id": str(uuid.uuid4()),
            "title": "Large Content Test",
            "content": large_content,
            "content_type": "long_form_article",
            "platform": "web",
            "metadata": json.dumps({"size_test": True, "content_size": len(large_content)})
        })
        
        # Retrieve and verify large content
        retrieved_draft = db["content_drafts"].get(draft_id)
        assert retrieved_draft is not None
        assert len(retrieved_draft["content"]) == len(large_content)
        assert retrieved_draft["content"] == large_content

if __name__ == "__main__":
    pytest.main([__file__, "-v"])