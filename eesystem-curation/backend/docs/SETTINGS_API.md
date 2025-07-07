# EESystem Settings Backend API Documentation

## Overview

The EESystem Settings Backend API provides comprehensive settings management capabilities for the EESystem Content Curation Platform. It includes environment variable management, database connection configuration, system health monitoring, and security features.

## Features

- **Settings Management**: CRUD operations for application settings with versioning
- **Environment Variables**: Secure management of environment variables with encryption
- **Database Connections**: Configuration and testing of database connections
- **Security**: JWT authentication, role-based access control, encryption, and audit logging
- **Rate Limiting**: Configurable rate limits for different endpoints
- **Railway Integration**: Deployment-ready configuration for Railway platform
- **Real-time Validation**: Input validation and type checking
- **Health Monitoring**: System status and performance monitoring

## Authentication

All API endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Roles and Permissions

- **Admin**: Full access to all settings, environment variables, and database connections
- **Editor**: Can read and modify non-sensitive settings
- **Viewer**: Read-only access to non-sensitive settings

## API Endpoints

### Settings Management

#### Get Settings
```http
GET /api/v1/settings/
```

**Query Parameters:**
- `category` (optional): Filter by category (system, user, database, api, security)
- `scope` (optional): Filter by scope (global, user_specific, brand_specific)
- `user_id` (optional): Filter by user ID
- `brand_id` (optional): Filter by brand ID
- `include_sensitive` (optional): Include sensitive settings (admin only)

**Response:**
```json
[
  {
    "id": "uuid",
    "key": "setting_key",
    "value": "setting_value",
    "data_type": "string",
    "category": "user",
    "scope": "global",
    "description": "Setting description",
    "is_encrypted": false,
    "is_required": false,
    "is_sensitive": false,
    "validation_rules": {
      "type": "string",
      "min_length": 1,
      "max_length": 100
    },
    "default_value": null,
    "version": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "created_by": "user-id",
    "updated_by": "user-id"
  }
]
```

#### Create Setting
```http
POST /api/v1/settings/
```

**Request Body:**
```json
{
  "key": "new_setting",
  "value": "setting_value",
  "data_type": "string",
  "category": "user",
  "scope": "global",
  "description": "New setting description",
  "is_encrypted": false,
  "is_required": false,
  "is_sensitive": false,
  "validation_rules": {
    "type": "string",
    "min_length": 1,
    "max_length": 100
  }
}
```

#### Update Setting
```http
PUT /api/v1/settings/{setting_id}
```

**Request Body:**
```json
{
  "value": "updated_value",
  "description": "Updated description"
}
```

#### Delete Setting
```http
DELETE /api/v1/settings/{setting_id}
```

**Note**: Only non-required settings can be deleted. Admin role required.

#### Get Setting History
```http
GET /api/v1/settings/{setting_id}/history
```

**Response:**
```json
[
  {
    "id": "uuid",
    "setting_id": "setting-uuid",
    "old_value": "old_value",
    "new_value": "new_value",
    "changed_by": "user-id",
    "changed_at": "2024-01-01T00:00:00Z",
    "change_reason": "Updated via API",
    "version": 2
  }
]
```

#### Bulk Create Settings
```http
POST /api/v1/settings/bulk
```

**Request Body:**
```json
{
  "settings": [
    {
      "key": "setting1",
      "value": "value1",
      "data_type": "string",
      "category": "user",
      "scope": "global"
    },
    {
      "key": "setting2",
      "value": "value2",
      "data_type": "string",
      "category": "system",
      "scope": "global"
    }
  ]
}
```

#### Validate Setting
```http
POST /api/v1/settings/validate
```

**Request Body:**
```json
{
  "value": "test_value",
  "validation_rules": {
    "type": "string",
    "min_length": 5,
    "max_length": 20,
    "pattern": "^[a-zA-Z0-9_]+$"
  }
}
```

**Response:**
```json
{
  "is_valid": true,
  "errors": []
}
```

### Environment Variables

#### Get Environment Variables
```http
GET /api/v1/settings/environment
```

**Query Parameters:**
- `category` (optional): Filter by category
- `environment` (optional): Filter by environment (development, staging, production)
- `include_sensitive` (optional): Include sensitive variables

**Note**: Admin role required.

#### Create Environment Variable
```http
POST /api/v1/settings/environment
```

**Request Body:**
```json
{
  "name": "NEW_ENV_VAR",
  "value": "environment_value",
  "description": "Environment variable description",
  "category": "api",
  "environment": "production",
  "is_encrypted": true,
  "is_sensitive": true,
  "is_required": true,
  "validation_pattern": "^[A-Z0-9_]+$",
  "validation_message": "Must be uppercase with underscores"
}
```

#### Update Environment Variable
```http
PUT /api/v1/settings/environment/{env_id}
```

**Request Body:**
```json
{
  "value": "updated_value",
  "description": "Updated description"
}
```

### Database Connections

#### Get Database Connections
```http
GET /api/v1/settings/database
```

**Note**: Admin role required.

#### Create Database Connection
```http
POST /api/v1/settings/database
```

**Request Body:**
```json
{
  "connection_name": "production_db",
  "connection_type": "astradb",
  "connection_string": "connection_string_here",
  "host": "database.host.com",
  "port": 5432,
  "database_name": "eesystem_production",
  "username": "db_user",
  "password": "secure_password",
  "connection_params": {
    "ssl": true,
    "pool_size": 10
  },
  "is_ssl": true,
  "ssl_config": {
    "verify": true
  },
  "is_active": true,
  "is_default": false
}
```

#### Test Database Connection
```http
POST /api/v1/settings/database/test
```

**Request Body:**
```json
{
  "connection_id": "existing-connection-uuid"
}
```

**Or:**
```json
{
  "connection_data": {
    "connection_type": "postgresql",
    "host": "test.host.com",
    "port": 5432,
    "database_name": "test_db",
    "username": "test_user",
    "password": "test_password"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connection successful",
  "response_time": 0.123,
  "tested_at": "2024-01-01T00:00:00Z"
}
```

### System Status

#### Get System Status
```http
GET /api/v1/settings/status
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "database_connections": [
    {
      "name": "main_db",
      "type": "astradb",
      "status": "healthy",
      "last_tested": "2024-01-01T00:00:00Z"
    }
  ],
  "environment_variables": {
    "count": 25
  },
  "system_configurations": [
    {
      "name": "main_config",
      "schema_version": "1.0",
      "priority": 1
    }
  ],
  "health_checks": {
    "database": "healthy",
    "redis": "healthy",
    "storage": "healthy"
  }
}
```

### Health Check

#### Basic Health Check
```http
GET /api/v1/health/
```

**Response:**
```json
{
  "status": "healthy",
  "service": "eesystem-curation"
}
```

#### Detailed Health Check
```http
GET /api/v1/health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "service": "eesystem-curation",
  "database": "healthy",
  "components": {
    "api": "healthy",
    "database": "healthy"
  }
}
```

## Data Types and Validation

### Setting Data Types

- **string**: Text values with optional length and pattern validation
- **number**: Numeric values with range validation
- **boolean**: True/false values
- **json**: JSON objects with optional schema validation
- **encrypted**: Encrypted string values for sensitive data

### Validation Rules

Settings can include validation rules to ensure data integrity:

```json
{
  "validation_rules": {
    "type": "string",
    "min_length": 5,
    "max_length": 50,
    "pattern": "^[a-zA-Z0-9_]+$",
    "enum": ["option1", "option2", "option3"],
    "format": "email"
  }
}
```

**Supported formats:**
- `email`: Email address validation
- `url`: URL validation
- `uuid`: UUID format validation
- `ipv4`: IPv4 address validation
- `ipv6`: IPv6 address validation
- `jwt`: JWT token format validation

### Number Validation

```json
{
  "validation_rules": {
    "type": "number",
    "minimum": 0,
    "maximum": 100,
    "exclusive_minimum": 0,
    "exclusive_maximum": 100,
    "multiple_of": 5,
    "integer_only": true,
    "positive": true
  }
}
```

### JSON Schema Validation

```json
{
  "validation_rules": {
    "type": "json",
    "schema": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "age": {"type": "number"}
      },
      "required": ["name"]
    },
    "required_keys": ["name", "email"]
  }
}
```

## Security Features

### Encryption

Sensitive settings and environment variables are automatically encrypted using Fernet encryption with PBKDF2 key derivation.

### Rate Limiting

API endpoints have configurable rate limits:

- **Settings CRUD**: 10-100 requests per minute
- **Environment Variables**: 3-10 requests per minute
- **Database Connections**: 3-10 requests per minute
- **Connection Testing**: 10 requests per minute
- **Authentication**: 5 requests per 5 minutes

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Window reset timestamp

### Audit Logging

All setting changes are logged with:
- User ID who made the change
- Timestamp of the change
- Old and new values
- Change reason (when provided)
- Version number

## Error Handling

### HTTP Status Codes

- `200`: Success
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid or missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

### Error Response Format

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": {
    "field": "Field-specific error information"
  }
}
```

## Railway Deployment

### Environment Variables

Required environment variables for Railway deployment:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/dbname
ASTRADB_APPLICATION_TOKEN=your_token
ASTRADB_DATABASE_ID=your_database_id

# Redis
REDIS_URL=redis://user:pass@host:port

# Security
SECRET_KEY=your_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Application
DEBUG=false
LOG_LEVEL=INFO
ALLOWED_ORIGINS=https://*.railway.app,https://yourdomain.com
```

### Railway Configuration

The API includes `railway.json` and `railway.toml` files for automatic deployment configuration.

### Health Checks

Railway will automatically perform health checks on `/health` endpoint.

## Development Setup

### Prerequisites

- Python 3.11+
- PostgreSQL or AstraDB
- Redis
- pip

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set up environment variables in `.env` file
4. Run database migrations:
   ```bash
   alembic upgrade head
   ```
5. Start the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Testing

Run the test suite:
```bash
pytest tests/test_settings_api.py -v
```

Run with coverage:
```bash
pytest tests/test_settings_api.py --cov=app --cov-report=html
```

## API Client Examples

### Python Example

```python
import httpx

class SettingsClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {token}"}
    
    async def get_settings(self, **filters):
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/settings/",
                headers=self.headers,
                params=filters
            )
            return response.json()
    
    async def create_setting(self, setting_data):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/settings/",
                headers=self.headers,
                json=setting_data
            )
            return response.json()
```

### JavaScript Example

```javascript
class SettingsAPI {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async getSettings(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(
      `${this.baseUrl}/api/v1/settings/?${params}`,
      { headers: this.headers }
    );
    return response.json();
  }

  async createSetting(settingData) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/settings/`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(settingData)
      }
    );
    return response.json();
  }
}
```

## OpenAPI Documentation

Interactive API documentation is available at:
- Swagger UI: `/api/docs`
- ReDoc: `/api/redoc`
- OpenAPI JSON: `/api/openapi.json`

## Support

For issues, questions, or contributions, please refer to the project repository or contact the development team.