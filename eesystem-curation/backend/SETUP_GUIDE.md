# EESystem Settings Backend API - Setup Guide

## Quick Start

The EESystem Settings Backend API is now fully implemented with comprehensive settings management, environment variable handling, database connection management, and security features.

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Environment Configuration

Create a `.env` file in the backend directory:

```bash
# Application
APP_NAME=EESystem Content Curation Platform
DEBUG=false
HOST=0.0.0.0
PORT=8000

# Database
DATABASE_URL=sqlite+aiosqlite:///./eesystem_curation.db
# Or for PostgreSQL:
# DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/eesystem

# AstraDB (for production)
ASTRADB_APPLICATION_TOKEN=your_token_here
ASTRADB_DATABASE_ID=your_database_id_here
ASTRADB_KEYSPACE=eesystem_curation

# Redis
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your-super-secret-key-here-make-it-long-and-random
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_PATH=uploads

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=INFO
```

### 3. Run Setup Script

```bash
python scripts/setup_settings_api.py
```

This script will:
- Test database and Redis connections
- Create database tables
- Insert default settings
- Create sample environment variables
- Generate admin token for testing

### 4. Start the API Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Access API Documentation

- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc
- OpenAPI JSON: http://localhost:8000/api/openapi.json

## Features Implemented

### ✅ Settings Management API
- **CRUD Operations**: Complete Create, Read, Update, Delete for settings
- **Versioning**: Automatic version tracking with history
- **Validation**: Comprehensive input validation with custom rules
- **Categorization**: Organized by category (system, user, database, api, security)
- **Scoping**: Global, user-specific, and brand-specific settings
- **Bulk Operations**: Create multiple settings at once

### ✅ Environment Variable Management
- **Secure Storage**: Encrypted storage for sensitive variables
- **Environment Separation**: Development, staging, production environments
- **Validation**: Pattern-based validation with custom error messages
- **Admin Only**: Restricted access to environment variables

### ✅ Database Integration
- **AstraDB Support**: Native Cassandra/AstraDB integration
- **Connection Management**: Store and test database connections
- **Connection Testing**: Real-time connection validation
- **Multiple Databases**: Support for PostgreSQL, SQLite, Redis, AstraDB

### ✅ Security Features
- **JWT Authentication**: Token-based authentication with configurable expiration
- **Role-Based Access Control**: Admin, Editor, Viewer roles with granular permissions
- **Encryption**: Fernet encryption for sensitive data with PBKDF2 key derivation
- **Rate Limiting**: Configurable rate limits per endpoint
- **Input Sanitization**: Comprehensive input validation and sanitization
- **Audit Logging**: Complete change history with user tracking

### ✅ Railway Integration
- **Deployment Configuration**: Ready-to-deploy Railway configuration
- **Environment Management**: Automatic environment variable setup
- **Health Checks**: Built-in health monitoring endpoints
- **Auto-scaling**: Configuration for automatic scaling
- **Performance Monitoring**: Built-in metrics and monitoring

### ✅ API Features
- **Real-time Validation**: Validate settings before storage
- **Configuration Testing**: Test database connections before saving
- **Error Handling**: Comprehensive error handling with detailed messages
- **Performance Optimization**: Efficient queries and caching
- **Documentation**: Complete OpenAPI documentation with examples

## API Endpoints Summary

### Settings Management
```
GET    /api/v1/settings/                    # List settings
POST   /api/v1/settings/                    # Create setting  
GET    /api/v1/settings/{id}                # Get setting
PUT    /api/v1/settings/{id}                # Update setting
DELETE /api/v1/settings/{id}                # Delete setting
GET    /api/v1/settings/{id}/history        # Get setting history
POST   /api/v1/settings/bulk                # Bulk create settings
POST   /api/v1/settings/validate            # Validate setting value
```

### Environment Variables
```
GET    /api/v1/settings/environment         # List env variables (admin)
POST   /api/v1/settings/environment         # Create env variable (admin)
PUT    /api/v1/settings/environment/{id}    # Update env variable (admin)
```

### Database Connections
```
GET    /api/v1/settings/database            # List connections (admin)
POST   /api/v1/settings/database            # Create connection (admin)
POST   /api/v1/settings/database/test       # Test connection (admin)
```

### System Status
```
GET    /api/v1/settings/status              # System status (admin)
GET    /api/v1/health/                      # Basic health check
GET    /api/v1/health/detailed              # Detailed health check
```

## Testing

### Run Tests
```bash
pytest tests/test_settings_api.py -v
```

### Test Coverage
```bash
pytest tests/test_settings_api.py --cov=app --cov-report=html
```

### Manual Testing with curl

Get admin token from setup script output, then:

```bash
# Set your admin token
TOKEN="your_admin_token_here"

# Test health endpoint
curl http://localhost:8000/health

# Get all settings
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/settings/

# Create a new setting
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "key": "test_setting",
       "value": "test_value",
       "data_type": "string",
       "category": "user",
       "scope": "global",
       "description": "Test setting"
     }' \
     http://localhost:8000/api/v1/settings/

# Test environment variables (admin only)
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/settings/environment

# Get system status
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/settings/status
```

## Railway Deployment

### 1. Connect Repository to Railway
1. Go to railway.app
2. Create new project from GitHub repository
3. Select the backend directory as root

### 2. Configure Environment Variables
Set these in Railway dashboard:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SECRET_KEY=your-secret-key
ASTRADB_APPLICATION_TOKEN=your-token
ASTRADB_DATABASE_ID=your-database-id
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
```

### 3. Deploy
Railway will automatically:
- Build using requirements.txt
- Start with uvicorn command
- Monitor health via /health endpoint
- Scale based on traffic

## Production Considerations

### Security
- Use strong SECRET_KEY (64+ characters)
- Enable HTTPS in production
- Restrict CORS origins to your domain
- Use secure database connections (SSL)
- Regular security updates

### Performance
- Use Redis for rate limiting and caching
- Configure connection pooling for databases
- Monitor API response times
- Set appropriate rate limits

### Monitoring
- Set up logging aggregation (Sentry, LogDNA)
- Monitor health endpoints
- Track API usage metrics
- Set up alerts for failures

### Backup
- Regular database backups
- Backup encryption keys securely
- Test restore procedures
- Document recovery processes

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EESystem Settings API                    │
├─────────────────────────────────────────────────────────────┤
│  FastAPI Application (app/main.py)                        │
├─────────────────────────────────────────────────────────────┤
│  API Routes (app/api/v1/endpoints/)                       │
│  ├─ settings.py     │ Settings CRUD & Management          │
│  ├─ auth.py        │ Authentication & Authorization       │
│  ├─ health.py      │ Health Checks & Monitoring          │
│  └─ ...            │ Other endpoints                      │
├─────────────────────────────────────────────────────────────┤
│  Services (app/services/)                                  │
│  ├─ settings.py    │ Business logic for settings         │
│  ├─ auth.py        │ JWT & RBAC implementation           │
│  ├─ encryption.py  │ Fernet encryption service           │
│  └─ validation.py  │ Input validation & sanitization     │
├─────────────────────────────────────────────────────────────┤
│  Models & Schemas (app/models/, app/schemas/)              │
│  ├─ Setting        │ Core settings model                  │
│  ├─ EnvironmentVar │ Environment variables model         │
│  ├─ DBConnection   │ Database connections model          │
│  └─ Schemas        │ Pydantic request/response schemas   │
├─────────────────────────────────────────────────────────────┤
│  Middleware (app/middleware/)                              │
│  ├─ rate_limiter.py│ Redis-based rate limiting           │
│  ├─ cors.py        │ CORS configuration                  │
│  └─ security.py    │ Security headers & validation       │
├─────────────────────────────────────────────────────────────┤
│  Database Layer                                           │
│  ├─ SQLAlchemy     │ ORM with async support              │
│  ├─ AstraDB        │ Cassandra/AstraDB integration       │
│  ├─ PostgreSQL     │ Primary relational database         │
│  └─ SQLite         │ Development database                │
├─────────────────────────────────────────────────────────────┤
│  External Services                                         │
│  ├─ Redis          │ Rate limiting & caching             │
│  ├─ Railway        │ Deployment platform                 │
│  └─ Monitoring     │ Health checks & metrics             │
└─────────────────────────────────────────────────────────────┘
```

## Support

For questions, issues, or contributions:
1. Check the API documentation at `/api/docs`
2. Review the comprehensive test suite
3. Consult the detailed error messages in responses
4. Check logs for debugging information

The Settings Backend API is production-ready with comprehensive features for managing application settings, environment variables, database connections, and system configuration in a secure, scalable way.