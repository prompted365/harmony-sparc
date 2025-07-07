"""
Tests for Settings API endpoints
"""
import pytest
import asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import get_db
from app.models.settings import Setting, EnvironmentVariable, DatabaseConnection
from app.services.auth import auth_service
import json
from datetime import datetime

# Test database setup
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_settings.db"

engine = create_async_engine(TEST_DATABASE_URL, echo=True)
TestingSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
async def async_client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def admin_token():
    """Generate admin token for testing"""
    return auth_service.create_user_token(
        user_id="admin-user-id",
        email="admin@test.com",
        role="admin"
    )


@pytest.fixture
def editor_token():
    """Generate editor token for testing"""
    return auth_service.create_user_token(
        user_id="editor-user-id", 
        email="editor@test.com",
        role="editor"
    )


@pytest.fixture
def viewer_token():
    """Generate viewer token for testing"""
    return auth_service.create_user_token(
        user_id="viewer-user-id",
        email="viewer@test.com", 
        role="viewer"
    )


@pytest.fixture
async def test_setting_data():
    """Test setting data"""
    return {
        "key": "test_setting",
        "value": "test_value",
        "data_type": "string",
        "category": "user",
        "scope": "global",
        "description": "Test setting for API testing",
        "is_encrypted": False,
        "is_required": False,
        "is_sensitive": False,
        "validation_rules": {
            "type": "string",
            "min_length": 1,
            "max_length": 100
        }
    }


class TestSettingsAPI:
    """Test Settings API endpoints"""
    
    async def test_create_setting_success(self, async_client: AsyncClient, admin_token: str, test_setting_data: dict):
        """Test successful setting creation"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.post(
            "/api/v1/settings/",
            json=test_setting_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == test_setting_data["key"]
        assert data["value"] == test_setting_data["value"]
        assert data["category"] == test_setting_data["category"]
    
    async def test_create_setting_unauthorized(self, async_client: AsyncClient, test_setting_data: dict):
        """Test setting creation without authentication"""
        response = await async_client.post(
            "/api/v1/settings/",
            json=test_setting_data
        )
        
        assert response.status_code == 401
    
    async def test_create_setting_insufficient_permissions(
        self, async_client: AsyncClient, viewer_token: str, test_setting_data: dict
    ):
        """Test setting creation with insufficient permissions"""
        headers = {"Authorization": f"Bearer {viewer_token}"}
        
        response = await async_client.post(
            "/api/v1/settings/",
            json=test_setting_data,
            headers=headers
        )
        
        assert response.status_code == 403
    
    async def test_create_sensitive_setting_admin_only(
        self, async_client: AsyncClient, editor_token: str, admin_token: str
    ):
        """Test that only admins can create sensitive settings"""
        sensitive_setting = {
            "key": "sensitive_setting",
            "value": "secret_value",
            "data_type": "encrypted",
            "category": "security",
            "scope": "global",
            "is_sensitive": True,
            "is_encrypted": True
        }
        
        # Editor should fail
        editor_headers = {"Authorization": f"Bearer {editor_token}"}
        response = await async_client.post(
            "/api/v1/settings/",
            json=sensitive_setting,
            headers=editor_headers
        )
        assert response.status_code == 403
        
        # Admin should succeed
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        response = await async_client.post(
            "/api/v1/settings/",
            json=sensitive_setting,
            headers=admin_headers
        )
        assert response.status_code == 200
    
    async def test_get_settings(self, async_client: AsyncClient, admin_token: str):
        """Test getting settings list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.get("/api/v1/settings/", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    async def test_get_settings_with_filters(self, async_client: AsyncClient, admin_token: str):
        """Test getting settings with filters"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test category filter
        response = await async_client.get(
            "/api/v1/settings/?category=user",
            headers=headers
        )
        assert response.status_code == 200
        
        # Test scope filter
        response = await async_client.get(
            "/api/v1/settings/?scope=global",
            headers=headers
        )
        assert response.status_code == 200
    
    async def test_update_setting(self, async_client: AsyncClient, admin_token: str, test_setting_data: dict):
        """Test updating a setting"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a setting
        create_response = await async_client.post(
            "/api/v1/settings/",
            json=test_setting_data,
            headers=headers
        )
        setting_id = create_response.json()["id"]
        
        # Then update it
        update_data = {"value": "updated_value", "description": "Updated description"}
        response = await async_client.put(
            f"/api/v1/settings/{setting_id}",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["value"] == "updated_value"
        assert data["description"] == "Updated description"
        assert data["version"] == 2  # Version should increment
    
    async def test_delete_setting(self, async_client: AsyncClient, admin_token: str, test_setting_data: dict):
        """Test deleting a setting"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a setting
        create_response = await async_client.post(
            "/api/v1/settings/",
            json=test_setting_data,
            headers=headers
        )
        setting_id = create_response.json()["id"]
        
        # Then delete it
        response = await async_client.delete(
            f"/api/v1/settings/{setting_id}",
            headers=headers
        )
        
        assert response.status_code == 200
        
        # Verify it's deleted
        get_response = await async_client.get(
            f"/api/v1/settings/{setting_id}",
            headers=headers
        )
        assert get_response.status_code == 404
    
    async def test_get_setting_history(self, async_client: AsyncClient, admin_token: str, test_setting_data: dict):
        """Test getting setting history"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create and update a setting to generate history
        create_response = await async_client.post(
            "/api/v1/settings/",
            json=test_setting_data,
            headers=headers
        )
        setting_id = create_response.json()["id"]
        
        # Update it
        update_data = {"value": "updated_value"}
        await async_client.put(
            f"/api/v1/settings/{setting_id}",
            json=update_data,
            headers=headers
        )
        
        # Get history
        response = await async_client.get(
            f"/api/v1/settings/{setting_id}/history",
            headers=headers
        )
        
        assert response.status_code == 200
        history = response.json()
        assert isinstance(history, list)
        assert len(history) > 0
    
    async def test_validate_setting(self, async_client: AsyncClient, admin_token: str):
        """Test setting validation endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        validation_data = {
            "value": "test_value",
            "validation_rules": {
                "type": "string",
                "min_length": 5,
                "max_length": 20
            }
        }
        
        response = await async_client.post(
            "/api/v1/settings/validate",
            json=validation_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] == True
        assert data["errors"] == []
    
    async def test_validate_setting_failure(self, async_client: AsyncClient, admin_token: str):
        """Test setting validation with invalid data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        validation_data = {
            "value": "abc",  # Too short
            "validation_rules": {
                "type": "string",
                "min_length": 5,
                "max_length": 20
            }
        }
        
        response = await async_client.post(
            "/api/v1/settings/validate",
            json=validation_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] == False
        assert len(data["errors"]) > 0


class TestEnvironmentVariablesAPI:
    """Test Environment Variables API endpoints"""
    
    async def test_create_env_variable(self, async_client: AsyncClient, admin_token: str):
        """Test creating environment variable"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        env_data = {
            "name": "TEST_ENV_VAR",
            "value": "test_value",
            "description": "Test environment variable",
            "category": "api",
            "environment": "development",
            "is_encrypted": False,
            "is_sensitive": False,
            "is_required": True
        }
        
        response = await async_client.post(
            "/api/v1/settings/environment",
            json=env_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == env_data["name"]
        assert data["value"] == env_data["value"]
    
    async def test_get_env_variables(self, async_client: AsyncClient, admin_token: str):
        """Test getting environment variables"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.get(
            "/api/v1/settings/environment",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    async def test_env_variables_admin_only(self, async_client: AsyncClient, editor_token: str):
        """Test that environment variables are admin-only"""
        headers = {"Authorization": f"Bearer {editor_token}"}
        
        response = await async_client.get(
            "/api/v1/settings/environment",
            headers=headers
        )
        
        assert response.status_code == 403


class TestDatabaseConnectionsAPI:
    """Test Database Connections API endpoints"""
    
    async def test_create_database_connection(self, async_client: AsyncClient, admin_token: str):
        """Test creating database connection"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        connection_data = {
            "connection_name": "test_db",
            "connection_type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database_name": "test_database",
            "username": "test_user",
            "password": "test_password",
            "is_ssl": True,
            "is_active": True
        }
        
        response = await async_client.post(
            "/api/v1/settings/database",
            json=connection_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["connection_name"] == connection_data["connection_name"]
        assert data["connection_type"] == connection_data["connection_type"]
    
    async def test_test_database_connection(self, async_client: AsyncClient, admin_token: str):
        """Test database connection testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        test_data = {
            "connection_data": {
                "connection_name": "test_connection",
                "connection_type": "postgresql",
                "host": "invalid_host",  # This should fail
                "port": 5432,
                "database_name": "test_db",
                "username": "test_user",
                "password": "test_password"
            }
        }
        
        response = await async_client.post(
            "/api/v1/settings/database/test",
            json=test_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "message" in data
        assert "tested_at" in data


class TestSystemStatus:
    """Test System Status endpoints"""
    
    async def test_get_system_status(self, async_client: AsyncClient, admin_token: str):
        """Test getting system status"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.get(
            "/api/v1/settings/status",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "timestamp" in data
        assert "database_connections" in data
        assert "environment_variables" in data
        assert "health_checks" in data


class TestRateLimiting:
    """Test rate limiting functionality"""
    
    async def test_rate_limiting_create_settings(self, async_client: AsyncClient, admin_token: str):
        """Test rate limiting on setting creation"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Make multiple requests quickly
        responses = []
        for i in range(15):  # Limit is 10 per minute
            setting_data = {
                "key": f"rate_test_setting_{i}",
                "value": f"value_{i}",
                "data_type": "string",
                "category": "test",
                "scope": "global"
            }
            
            response = await async_client.post(
                "/api/v1/settings/",
                json=setting_data,
                headers=headers
            )
            responses.append(response.status_code)
        
        # Should have some 429 responses (rate limited)
        assert 429 in responses
    
    async def test_rate_limiting_headers(self, async_client: AsyncClient, admin_token: str):
        """Test rate limiting headers are present"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.get("/api/v1/settings/", headers=headers)
        
        assert response.status_code == 200
        assert "x-ratelimit-limit" in response.headers
        assert "x-ratelimit-remaining" in response.headers
        assert "x-ratelimit-reset" in response.headers


class TestEncryption:
    """Test encryption functionality"""
    
    async def test_encrypted_setting_storage(self, async_client: AsyncClient, admin_token: str):
        """Test that encrypted settings are properly stored and retrieved"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        encrypted_setting = {
            "key": "encrypted_test",
            "value": "secret_value",
            "data_type": "encrypted",
            "category": "security",
            "scope": "global",
            "is_encrypted": True,
            "is_sensitive": True
        }
        
        # Create encrypted setting
        response = await async_client.post(
            "/api/v1/settings/",
            json=encrypted_setting,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # The value should be returned decrypted in the API response
        assert data["value"] == "secret_value"
        assert data["is_encrypted"] == True
    
    async def test_encrypted_env_variable(self, async_client: AsyncClient, admin_token: str):
        """Test encrypted environment variable"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        env_data = {
            "name": "SECRET_API_KEY",
            "value": "super_secret_key",
            "description": "Secret API key",
            "category": "api",
            "environment": "production",
            "is_encrypted": True,
            "is_sensitive": True
        }
        
        response = await async_client.post(
            "/api/v1/settings/environment",
            json=env_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["value"] == "super_secret_key"  # Should be decrypted in response
        assert data["is_encrypted"] == True


# Pytest configuration
pytest_plugins = ['pytest_asyncio']

if __name__ == "__main__":
    pytest.main([__file__])