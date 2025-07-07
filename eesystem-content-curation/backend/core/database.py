"""
Database integration for EESystem Content Curation Platform
Integrates AstraDB (long-term storage) and SQLite (short-term memory)
"""
import asyncio
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
import json
import sqlite3
from pathlib import Path
import structlog
from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
from cassandra.policies import DCAwareRoundRobinPolicy
from cassandra.connection import Session as CassandraSession
from cassandra.cqlengine import connection
from cassandra.cqlengine.models import Model
from cassandra.cqlengine.columns import *
import sqlite_utils
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session as SQLAlchemySession
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.pool import StaticPool

from core.config import settings

logger = structlog.get_logger(__name__)

# SQLAlchemy Base
Base = declarative_base()

class DatabaseManager:
    """Manages both AstraDB and SQLite connections"""
    
    def __init__(self):
        self.astra_session: Optional[CassandraSession] = None
        self.sqlite_db: Optional[sqlite_utils.Database] = None
        self.sqlite_engine = None
        self.sqlite_session_factory = None
        
    async def initialize(self):
        """Initialize database connections"""
        try:
            # Initialize AstraDB connection
            await self._init_astra_db()
            
            # Initialize SQLite connection
            await self._init_sqlite_db()
            
            # Create tables if they don't exist
            await self._create_tables()
            
            logger.info("Database connections initialized successfully")
            
        except Exception as e:
            logger.error("Failed to initialize database connections", exc_info=e)
            raise
    
    async def _init_astra_db(self):
        """Initialize AstraDB connection"""
        try:
            # Configure authentication
            auth_provider = PlainTextAuthProvider(
                username="token",
                password=settings.ASTRA_DB_TOKEN
            )
            
            # Create cluster connection
            cluster = Cluster(
                cloud={
                    'secure_connect_bundle': f'secure-connect-{settings.ASTRA_DB_ID}.zip'
                },
                auth_provider=auth_provider,
                load_balancing_policy=DCAwareRoundRobinPolicy(local_dc=settings.ASTRA_DB_REGION)
            )
            
            # Connect to AstraDB
            self.astra_session = cluster.connect()
            
            # Set keyspace
            self.astra_session.set_keyspace(settings.ASTRA_DB_KEYSPACE)
            
            # Configure cqlengine
            connection.setup(
                hosts=[f"{settings.ASTRA_DB_ID}-{settings.ASTRA_DB_REGION}.db.astra.datastax.com"],
                default_keyspace=settings.ASTRA_DB_KEYSPACE,
                auth_provider=auth_provider,
                port=9042,
                protocol_version=4
            )
            
            logger.info("AstraDB connection established", keyspace=settings.ASTRA_DB_KEYSPACE)
            
        except Exception as e:
            logger.error("Failed to initialize AstraDB connection", exc_info=e)
            raise
    
    async def _init_sqlite_db(self):
        """Initialize SQLite connection for short-term memory"""
        try:
            # Create database directory if it doesn't exist
            db_path = Path(settings.SQLITE_DB_PATH)
            db_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Initialize sqlite-utils database
            self.sqlite_db = sqlite_utils.Database(str(db_path))
            
            # Initialize SQLAlchemy engine for complex queries
            self.sqlite_engine = create_engine(
                f"sqlite:///{db_path}",
                poolclass=StaticPool,
                connect_args={
                    "check_same_thread": False,
                    "timeout": 30
                },
                echo=settings.DEBUG
            )
            
            # Create session factory
            self.sqlite_session_factory = sessionmaker(
                bind=self.sqlite_engine,
                autocommit=False,
                autoflush=False
            )
            
            logger.info("SQLite connection established", path=str(db_path))
            
        except Exception as e:
            logger.error("Failed to initialize SQLite connection", exc_info=e)
            raise
    
    async def _create_tables(self):
        """Create database tables"""
        try:
            # Create AstraDB tables
            await self._create_astra_tables()
            
            # Create SQLite tables
            await self._create_sqlite_tables()
            
            logger.info("Database tables created successfully")
            
        except Exception as e:
            logger.error("Failed to create database tables", exc_info=e)
            raise
    
    async def _create_astra_tables(self):
        """Create AstraDB tables"""
        try:
            # Content table
            content_table = '''
            CREATE TABLE IF NOT EXISTS content (
                id UUID PRIMARY KEY,
                title TEXT,
                content TEXT,
                content_type TEXT,
                category TEXT,
                subcategory TEXT,
                author_id UUID,
                status TEXT,
                platform TEXT,
                brand_compliant BOOLEAN,
                health_claims_validated BOOLEAN,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                published_at TIMESTAMP,
                metadata MAP<TEXT, TEXT>,
                tags SET<TEXT>,
                approval_status TEXT,
                approval_notes TEXT
            )
            '''
            
            # Users table
            users_table = '''
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY,
                email TEXT,
                username TEXT,
                full_name TEXT,
                role TEXT,
                permissions SET<TEXT>,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                last_login TIMESTAMP,
                is_active BOOLEAN,
                profile_data MAP<TEXT, TEXT>
            )
            '''
            
            # Content analytics table
            analytics_table = '''
            CREATE TABLE IF NOT EXISTS content_analytics (
                id UUID,
                content_id UUID,
                platform TEXT,
                metric_type TEXT,
                metric_value DOUBLE,
                recorded_at TIMESTAMP,
                metadata MAP<TEXT, TEXT>,
                PRIMARY KEY (id, recorded_at)
            ) WITH CLUSTERING ORDER BY (recorded_at DESC)
            '''
            
            # AI agent results table
            ai_results_table = '''
            CREATE TABLE IF NOT EXISTS ai_agent_results (
                id UUID PRIMARY KEY,
                agent_type TEXT,
                content_id UUID,
                input_data TEXT,
                output_data TEXT,
                confidence_score DOUBLE,
                processing_time DOUBLE,
                created_at TIMESTAMP,
                metadata MAP<TEXT, TEXT>,
                success BOOLEAN,
                error_message TEXT
            )
            '''
            
            # Compliance reports table
            compliance_table = '''
            CREATE TABLE IF NOT EXISTS compliance_reports (
                id UUID PRIMARY KEY,
                content_id UUID,
                report_type TEXT,
                findings TEXT,
                recommendations TEXT,
                compliance_score DOUBLE,
                created_at TIMESTAMP,
                validated_by UUID,
                status TEXT,
                metadata MAP<TEXT, TEXT>
            )
            '''
            
            # Schedule table
            schedule_table = '''
            CREATE TABLE IF NOT EXISTS content_schedule (
                id UUID PRIMARY KEY,
                content_id UUID,
                platform TEXT,
                scheduled_time TIMESTAMP,
                status TEXT,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                retry_count INT,
                last_attempt TIMESTAMP,
                error_message TEXT,
                metadata MAP<TEXT, TEXT>
            )
            '''
            
            # Execute table creation
            tables = [
                content_table,
                users_table,
                analytics_table,
                ai_results_table,
                compliance_table,
                schedule_table
            ]
            
            for table in tables:
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    self.astra_session.execute,
                    table
                )
            
            logger.info("AstraDB tables created successfully")
            
        except Exception as e:
            logger.error("Failed to create AstraDB tables", exc_info=e)
            raise
    
    async def _create_sqlite_tables(self):
        """Create SQLite tables for short-term memory"""
        try:
            # Session data table
            self.sqlite_db.executescript('''
                CREATE TABLE IF NOT EXISTS session_data (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    session_type TEXT,
                    data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    metadata TEXT
                );
                
                CREATE INDEX IF NOT EXISTS idx_session_user ON session_data(user_id);
                CREATE INDEX IF NOT EXISTS idx_session_type ON session_data(session_type);
                CREATE INDEX IF NOT EXISTS idx_session_expires ON session_data(expires_at);
            ''')
            
            # Cache table
            self.sqlite_db.executescript('''
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    size INTEGER,
                    metadata TEXT
                );
                
                CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);
            ''')
            
            # Agent memory table
            self.sqlite_db.executescript('''
                CREATE TABLE IF NOT EXISTS agent_memory (
                    id TEXT PRIMARY KEY,
                    agent_id TEXT,
                    memory_type TEXT,
                    context TEXT,
                    data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_accessed TIMESTAMP,
                    access_count INTEGER DEFAULT 0,
                    importance_score REAL DEFAULT 0.0,
                    metadata TEXT
                );
                
                CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_id);
                CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(memory_type);
                CREATE INDEX IF NOT EXISTS idx_agent_memory_importance ON agent_memory(importance_score);
            ''')
            
            # Processing queue table
            self.sqlite_db.executescript('''
                CREATE TABLE IF NOT EXISTS processing_queue (
                    id TEXT PRIMARY KEY,
                    task_type TEXT,
                    payload TEXT,
                    status TEXT DEFAULT 'pending',
                    priority INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    retry_count INTEGER DEFAULT 0,
                    error_message TEXT,
                    metadata TEXT
                );
                
                CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status);
                CREATE INDEX IF NOT EXISTS idx_queue_priority ON processing_queue(priority);
                CREATE INDEX IF NOT EXISTS idx_queue_type ON processing_queue(task_type);
            ''')
            
            # Content drafts table
            self.sqlite_db.executescript('''
                CREATE TABLE IF NOT EXISTS content_drafts (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    title TEXT,
                    content TEXT,
                    content_type TEXT,
                    platform TEXT,
                    status TEXT DEFAULT 'draft',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    auto_save_data TEXT,
                    metadata TEXT
                );
                
                CREATE INDEX IF NOT EXISTS idx_drafts_user ON content_drafts(user_id);
                CREATE INDEX IF NOT EXISTS idx_drafts_status ON content_drafts(status);
            ''')
            
            logger.info("SQLite tables created successfully")
            
        except Exception as e:
            logger.error("Failed to create SQLite tables", exc_info=e)
            raise
    
    async def close(self):
        """Close database connections"""
        try:
            if self.astra_session:
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    self.astra_session.shutdown
                )
            
            if self.sqlite_db:
                self.sqlite_db.close()
            
            if self.sqlite_engine:
                self.sqlite_engine.dispose()
                
            logger.info("Database connections closed")
            
        except Exception as e:
            logger.error("Error closing database connections", exc_info=e)
    
    def get_sqlite_session(self) -> SQLAlchemySession:
        """Get SQLite session"""
        return self.sqlite_session_factory()
    
    async def health_check(self) -> Dict[str, str]:
        """Check database health"""
        health = {
            "astra_db": "unknown",
            "sqlite": "unknown"
        }
        
        # Check AstraDB
        try:
            if self.astra_session:
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    self.astra_session.execute,
                    "SELECT now() FROM system.local"
                )
                health["astra_db"] = "healthy"
        except Exception as e:
            health["astra_db"] = f"unhealthy: {str(e)}"
        
        # Check SQLite
        try:
            if self.sqlite_db:
                self.sqlite_db.execute("SELECT 1")
                health["sqlite"] = "healthy"
        except Exception as e:
            health["sqlite"] = f"unhealthy: {str(e)}"
        
        return health

# Global database manager instance
db_manager = DatabaseManager()

# Convenience functions
async def init_db():
    """Initialize database connections"""
    await db_manager.initialize()

async def close_db():
    """Close database connections"""
    await db_manager.close()

def get_astra_session() -> CassandraSession:
    """Get AstraDB session"""
    return db_manager.astra_session

def get_sqlite_db() -> sqlite_utils.Database:
    """Get SQLite database"""
    return db_manager.sqlite_db

def get_sqlite_session() -> SQLAlchemySession:
    """Get SQLite SQLAlchemy session"""
    return db_manager.get_sqlite_session()

async def db_health_check() -> Dict[str, str]:
    """Check database health"""
    return await db_manager.health_check()

# AstraDB Models using CQLEngine
class ContentModel(Model):
    """Content model for AstraDB"""
    __table_name__ = 'content'
    
    id = UUID(primary_key=True)
    title = Text()
    content = Text()
    content_type = Text()
    category = Text()
    subcategory = Text()
    author_id = UUID()
    status = Text()
    platform = Text()
    brand_compliant = Boolean()
    health_claims_validated = Boolean()
    created_at = DateTime()
    updated_at = DateTime()
    published_at = DateTime()
    metadata = Map(Text, Text)
    tags = Set(Text)
    approval_status = Text()
    approval_notes = Text()

class UserModel(Model):
    """User model for AstraDB"""
    __table_name__ = 'users'
    
    id = UUID(primary_key=True)
    email = Text()
    username = Text()
    full_name = Text()
    role = Text()
    permissions = Set(Text)
    created_at = DateTime()
    updated_at = DateTime()
    last_login = DateTime()
    is_active = Boolean()
    profile_data = Map(Text, Text)

class ContentAnalyticsModel(Model):
    """Content analytics model for AstraDB"""
    __table_name__ = 'content_analytics'
    
    id = UUID(primary_key=True)
    content_id = UUID()
    platform = Text()
    metric_type = Text()
    metric_value = Float()
    recorded_at = DateTime(primary_key=True)
    metadata = Map(Text, Text)

class AIAgentResultModel(Model):
    """AI agent results model for AstraDB"""
    __table_name__ = 'ai_agent_results'
    
    id = UUID(primary_key=True)
    agent_type = Text()
    content_id = UUID()
    input_data = Text()
    output_data = Text()
    confidence_score = Float()
    processing_time = Float()
    created_at = DateTime()
    metadata = Map(Text, Text)
    success = Boolean()
    error_message = Text()

class ComplianceReportModel(Model):
    """Compliance report model for AstraDB"""
    __table_name__ = 'compliance_reports'
    
    id = UUID(primary_key=True)
    content_id = UUID()
    report_type = Text()
    findings = Text()
    recommendations = Text()
    compliance_score = Float()
    created_at = DateTime()
    validated_by = UUID()
    status = Text()
    metadata = Map(Text, Text)

class ContentScheduleModel(Model):
    """Content schedule model for AstraDB"""
    __table_name__ = 'content_schedule'
    
    id = UUID(primary_key=True)
    content_id = UUID()
    platform = Text()
    scheduled_time = DateTime()
    status = Text()
    created_at = DateTime()
    updated_at = DateTime()
    retry_count = Integer()
    last_attempt = DateTime()
    error_message = Text()
    metadata = Map(Text, Text)