#!/usr/bin/env python3
"""
Setup script for EESystem Settings API
"""
import asyncio
import asyncpg
import redis.asyncio as redis
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.settings import Base, Setting, EnvironmentVariable, DatabaseConnection
from app.services.auth import auth_service
from app.config.settings import settings
import logging
import json
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_database_tables():
    """Create database tables"""
    try:
        engine = create_async_engine(settings.DATABASE_URL, echo=True)
        
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("✅ Database tables created successfully")
        await engine.dispose()
        
    except Exception as e:
        logger.error(f"❌ Failed to create database tables: {e}")
        raise


async def test_database_connection():
    """Test database connectivity"""
    try:
        if settings.DATABASE_URL.startswith("postgresql"):
            # Test PostgreSQL connection
            conn = await asyncpg.connect(settings.DATABASE_URL)
            await conn.execute("SELECT 1")
            await conn.close()
            logger.info("✅ PostgreSQL connection successful")
            
        elif settings.DATABASE_URL.startswith("sqlite"):
            # Test SQLite connection
            engine = create_async_engine(settings.DATABASE_URL)
            async with engine.begin() as conn:
                await conn.execute("SELECT 1")
            await engine.dispose()
            logger.info("✅ SQLite connection successful")
            
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        raise


async def test_redis_connection():
    """Test Redis connectivity"""
    try:
        redis_client = redis.from_url(settings.REDIS_URL)
        await redis_client.ping()
        await redis_client.close()
        logger.info("✅ Redis connection successful")
        
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
        logger.warning("⚠️  Redis is optional but recommended for rate limiting")


async def create_default_settings():
    """Create default system settings"""
    try:
        engine = create_async_engine(settings.DATABASE_URL)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with SessionLocal() as db:
            # Check if default settings already exist
            existing_settings = await db.execute(
                "SELECT COUNT(*) FROM settings WHERE category = 'system'"
            )
            count = existing_settings.scalar()
            
            if count > 0:
                logger.info("✅ Default settings already exist")
                return
            
            # Create default settings
            default_settings = [
                {
                    "key": "app_name",
                    "value": "EESystem Content Curation Platform",
                    "data_type": "string",
                    "category": "system",
                    "scope": "global",
                    "description": "Application name",
                    "is_required": True
                },
                {
                    "key": "app_version", 
                    "value": "1.0.0",
                    "data_type": "string",
                    "category": "system",
                    "scope": "global",
                    "description": "Application version",
                    "is_required": True
                },
                {
                    "key": "max_file_upload_size",
                    "value": 10485760,  # 10MB
                    "data_type": "number",
                    "category": "system",
                    "scope": "global",
                    "description": "Maximum file upload size in bytes",
                    "validation_rules": {
                        "type": "number",
                        "minimum": 1024,  # 1KB minimum
                        "maximum": 104857600  # 100MB maximum
                    },
                    "is_required": True
                },
                {
                    "key": "enable_debug_mode",
                    "value": False,
                    "data_type": "boolean",
                    "category": "system",
                    "scope": "global",
                    "description": "Enable debug mode for development",
                    "is_required": False
                },
                {
                    "key": "api_rate_limit_per_minute",
                    "value": 60,
                    "data_type": "number",
                    "category": "api",
                    "scope": "global",
                    "description": "Default API rate limit per minute",
                    "validation_rules": {
                        "type": "number",
                        "minimum": 1,
                        "maximum": 1000
                    },
                    "is_required": True
                },
                {
                    "key": "session_timeout_minutes",
                    "value": 30,
                    "data_type": "number",
                    "category": "security",
                    "scope": "global",
                    "description": "User session timeout in minutes",
                    "validation_rules": {
                        "type": "number",
                        "minimum": 5,
                        "maximum": 1440
                    },
                    "is_required": True
                },
                {
                    "key": "default_user_theme",
                    "value": "light",
                    "data_type": "string",
                    "category": "user",
                    "scope": "global",
                    "description": "Default theme for new users",
                    "validation_rules": {
                        "type": "string",
                        "enum": ["light", "dark", "auto"]
                    },
                    "is_required": False
                }
            ]
            
            for setting_data in default_settings:
                setting = Setting(**setting_data)
                db.add(setting)
            
            await db.commit()
            logger.info(f"✅ Created {len(default_settings)} default settings")
            
    except Exception as e:
        logger.error(f"❌ Failed to create default settings: {e}")
        raise


async def create_sample_environment_variables():
    """Create sample environment variables for development"""
    try:
        engine = create_async_engine(settings.DATABASE_URL)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with SessionLocal() as db:
            # Check if env vars already exist
            existing_vars = await db.execute(
                "SELECT COUNT(*) FROM environment_variables"
            )
            count = existing_vars.scalar()
            
            if count > 0:
                logger.info("✅ Environment variables already exist")
                return
            
            # Create sample environment variables
            sample_env_vars = [
                {
                    "name": "LOG_LEVEL",
                    "value": "INFO",
                    "description": "Application logging level",
                    "category": "system",
                    "environment": "development",
                    "is_required": True,
                    "validation_pattern": "^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$"
                },
                {
                    "name": "MAX_WORKERS",
                    "value": "4",
                    "description": "Maximum number of worker processes",
                    "category": "system",
                    "environment": "development",
                    "is_required": False,
                    "validation_pattern": "^[1-9][0-9]*$"
                },
                {
                    "name": "CORS_ORIGINS",
                    "value": "http://localhost:3000,http://localhost:5173",
                    "description": "Allowed CORS origins",
                    "category": "api",
                    "environment": "development",
                    "is_required": True
                }
            ]
            
            for env_data in sample_env_vars:
                env_var = EnvironmentVariable(**env_data)
                db.add(env_var)
            
            await db.commit()
            logger.info(f"✅ Created {len(sample_env_vars)} sample environment variables")
            
    except Exception as e:
        logger.error(f"❌ Failed to create sample environment variables: {e}")
        raise


async def create_sample_database_connection():
    """Create sample database connection"""
    try:
        engine = create_async_engine(settings.DATABASE_URL)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with SessionLocal() as db:
            # Check if connections already exist
            existing_connections = await db.execute(
                "SELECT COUNT(*) FROM database_connections"
            )
            count = existing_connections.scalar()
            
            if count > 0:
                logger.info("✅ Database connections already exist")
                return
            
            # Create sample database connection
            sample_connection = DatabaseConnection(
                connection_name="default_sqlite",
                connection_type="sqlite",
                connection_string="sqlite:///./eesystem_curation.db",
                description="Default SQLite database connection",
                is_active=True,
                is_default=True,
                test_status="success",
                test_message="Connection successful",
                last_tested=datetime.utcnow()
            )
            
            db.add(sample_connection)
            await db.commit()
            logger.info("✅ Created sample database connection")
            
    except Exception as e:
        logger.error(f"❌ Failed to create sample database connection: {e}")
        raise


def generate_admin_token():
    """Generate admin token for testing"""
    try:
        admin_token = auth_service.create_user_token(
            user_id="admin-setup-user",
            email="admin@eesystem.com",
            role="admin"
        )
        
        logger.info("✅ Generated admin token for testing:")
        logger.info(f"   Token: {admin_token}")
        logger.info("   Use this token for API testing and initial setup")
        
        return admin_token
        
    except Exception as e:
        logger.error(f"❌ Failed to generate admin token: {e}")
        raise


async def verify_api_endpoints():
    """Verify that API endpoints are responding"""
    try:
        import httpx
        
        base_url = f"http://{settings.HOST}:{settings.PORT}"
        
        async with httpx.AsyncClient() as client:
            # Test health endpoint
            response = await client.get(f"{base_url}/health")
            if response.status_code == 200:
                logger.info("✅ Health endpoint responding")
            else:
                logger.error(f"❌ Health endpoint failed: {response.status_code}")
            
            # Test API docs
            response = await client.get(f"{base_url}/api/docs")
            if response.status_code == 200:
                logger.info("✅ API documentation available at /api/docs")
            else:
                logger.warning("⚠️  API documentation not available")
                
    except Exception as e:
        logger.warning(f"⚠️  Could not verify API endpoints: {e}")
        logger.info("   This is normal if the server is not running yet")


async def main():
    """Main setup function"""
    logger.info("🚀 Starting EESystem Settings API Setup")
    logger.info("=" * 50)
    
    try:
        # Test database connection
        logger.info("1. Testing database connection...")
        await test_database_connection()
        
        # Test Redis connection (optional)
        logger.info("2. Testing Redis connection...")
        await test_redis_connection()
        
        # Create database tables
        logger.info("3. Creating database tables...")
        await create_database_tables()
        
        # Create default settings
        logger.info("4. Creating default settings...")
        await create_default_settings()
        
        # Create sample environment variables
        logger.info("5. Creating sample environment variables...")
        await create_sample_environment_variables()
        
        # Create sample database connection
        logger.info("6. Creating sample database connection...")
        await create_sample_database_connection()
        
        # Generate admin token
        logger.info("7. Generating admin token...")
        admin_token = generate_admin_token()
        
        # Verify API endpoints (optional)
        logger.info("8. Verifying API endpoints...")
        await verify_api_endpoints()
        
        logger.info("=" * 50)
        logger.info("✅ Setup completed successfully!")
        logger.info("")
        logger.info("Next steps:")
        logger.info("1. Start the API server:")
        logger.info(f"   uvicorn app.main:app --host {settings.HOST} --port {settings.PORT}")
        logger.info("")
        logger.info("2. Access API documentation:")
        logger.info(f"   http://{settings.HOST}:{settings.PORT}/api/docs")
        logger.info("")
        logger.info("3. Test the API with the admin token:")
        logger.info(f"   Authorization: Bearer {admin_token}")
        logger.info("")
        logger.info("4. Configure your environment variables in .env file")
        logger.info("")
        
    except Exception as e:
        logger.error("=" * 50)
        logger.error(f"❌ Setup failed: {e}")
        logger.error("Please check the error messages above and fix any issues")
        return 1
    
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))