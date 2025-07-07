"""
Configuration settings for the EESystem Content Curation Platform
"""
import os
from typing import List, Optional
from pydantic import BaseSettings, Field, validator


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "EESystem Content Curation Platform"
    DEBUG: bool = Field(default=False, env="DEBUG")
    HOST: str = Field(default="0.0.0.0", env="HOST")
    PORT: int = Field(default=8000, env="PORT")
    
    # Security
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ALGORITHM: str = Field(default="HS256", env="ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60 * 24 * 7, env="ACCESS_TOKEN_EXPIRE_MINUTES")  # 7 days
    
    # Database
    SQLITE_DATABASE_URL: str = Field(default="sqlite:///./eesystem.db", env="SQLITE_DATABASE_URL")
    
    # AstraDB
    ASTRA_DB_ID: str = Field(..., env="ASTRA_DB_ID")
    ASTRA_DB_REGION: str = Field(..., env="ASTRA_DB_REGION")
    ASTRA_DB_TOKEN: str = Field(..., env="ASTRA_DB_TOKEN")
    ASTRA_DB_KEYSPACE: str = Field(default="eesystem", env="ASTRA_DB_KEYSPACE")
    
    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379", env="REDIS_URL")
    REDIS_PASSWORD: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    
    # Celery
    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/0", env="CELERY_BROKER_URL")
    CELERY_RESULT_BACKEND: str = Field(default="redis://localhost:6379/0", env="CELERY_RESULT_BACKEND")
    
    # CORS
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8080"],
        env="ALLOWED_ORIGINS"
    )
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = Field(default=100, env="RATE_LIMIT_REQUESTS")
    RATE_LIMIT_WINDOW: int = Field(default=60, env="RATE_LIMIT_WINDOW")  # seconds
    
    # File Upload
    MAX_FILE_SIZE: int = Field(default=10 * 1024 * 1024, env="MAX_FILE_SIZE")  # 10MB
    UPLOAD_DIR: str = Field(default="uploads", env="UPLOAD_DIR")
    ALLOWED_FILE_TYPES: List[str] = Field(
        default=["pdf", "docx", "txt", "md", "html", "json"],
        env="ALLOWED_FILE_TYPES"
    )
    
    # AI/LLM Settings
    OPENAI_API_KEY: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, env="ANTHROPIC_API_KEY")
    REQUESTY_API_KEY: Optional[str] = Field(default=None, env="REQUESTY_API_KEY")
    REQUESTY_BASE_URL: str = Field(default="https://api.requesty.ai", env="REQUESTY_BASE_URL")
    
    # Default LLM Settings
    DEFAULT_MODEL: str = Field(default="gpt-3.5-turbo", env="DEFAULT_MODEL")
    MAX_TOKENS: int = Field(default=2048, env="MAX_TOKENS")
    TEMPERATURE: float = Field(default=0.7, env="TEMPERATURE")
    
    # Vector Search
    VECTOR_DIMENSION: int = Field(default=1536, env="VECTOR_DIMENSION")  # OpenAI embeddings
    SIMILARITY_THRESHOLD: float = Field(default=0.8, env="SIMILARITY_THRESHOLD")
    
    # Publishing
    PUBLISH_WEBHOOK_URL: Optional[str] = Field(default=None, env="PUBLISH_WEBHOOK_URL")
    PUBLISH_WEBHOOK_SECRET: Optional[str] = Field(default=None, env="PUBLISH_WEBHOOK_SECRET")
    
    # Monitoring
    PROMETHEUS_ENABLED: bool = Field(default=True, env="PROMETHEUS_ENABLED")
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    
    @validator("ALLOWED_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @validator("ALLOWED_FILE_TYPES", pre=True)
    def parse_file_types(cls, v):
        """Parse allowed file types from string or list"""
        if isinstance(v, str):
            return [file_type.strip() for file_type in v.split(",")]
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()