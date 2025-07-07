# EESystem Content Curation Platform - API Specifications

## API Architecture Overview

The EESystem Content Curation Platform API is built using FastAPI with a RESTful design pattern. The API provides comprehensive endpoints for content management, AI agent coordination, publication scheduling, and compliance management.

### API Design Principles
- **RESTful Architecture**: Standard HTTP methods and status codes
- **OpenAPI 3.0**: Comprehensive API documentation
- **Pydantic Models**: Type-safe request/response validation
- **Async/Await**: High-performance asynchronous operations
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevent API abuse and ensure fair usage

## Base Configuration

### Base URL
```
Development: http://localhost:8000/api/v1
Production: https://api.eesystem-curation.com/api/v1
```

### Authentication
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
X-API-Key: <API_KEY> (for service-to-service)
```

### Common Response Format
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2025-07-06T12:00:00Z",
  "request_id": "req_123456789"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "content_type",
      "issue": "Invalid content type specified"
    }
  },
  "timestamp": "2025-07-06T12:00:00Z",
  "request_id": "req_123456789"
}
```

## Authentication & Authorization

### POST /auth/login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "secure_password"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "role": "content_manager"
    }
  }
}
```

### POST /auth/refresh
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### GET /auth/me
```http
GET /api/v1/auth/me
Authorization: Bearer <JWT_TOKEN>
```

## Content Management API

### POST /content/generate
Generate new content using AI agents.

```http
POST /api/v1/content/generate
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "content_type": "reel",
  "platform": "instagram",
  "theme": "Clear the Deck—Your Body's First",
  "requirements": {
    "duration": 15,
    "style": "motivational",
    "brand_voice": "wellness_expert"
  },
  "compliance_level": "strict",
  "priority": "high"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "content_id": "content_123456",
    "content_type": "reel",
    "platform": "instagram",
    "generated_content": {
      "script": "FULL VIDEO SCRIPT & PRODUCTION GUIDE...",
      "media_prompts": "Create a dynamic 15-second Instagram Reel...",
      "hashtags": ["#ClearTheNoise", "#ScalarWellness"],
      "cta": "Comment: What's your body holding onto?"
    },
    "compliance_score": 0.95,
    "estimated_engagement": 0.78,
    "generation_time": 2.34,
    "status": "ready"
  }
}
```

### GET /content/library
Retrieve content library with filtering and pagination.

```http
GET /api/v1/content/library?content_type=reel&platform=instagram&status=approved&page=1&limit=20
Authorization: Bearer <JWT_TOKEN>
```

Response:
```json
{
  "success": true,
  "data": {
    "contents": [
      {
        "id": "content_123456",
        "title": "Clear the Deck—Your Body's First",
        "content_type": "reel",
        "platform": "instagram",
        "status": "approved",
        "compliance_score": 0.95,
        "performance_metrics": {
          "estimated_reach": 10000,
          "engagement_rate": 0.078
        },
        "created_at": "2025-07-06T10:00:00Z",
        "updated_at": "2025-07-06T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "pages": 8
    }
  }
}
```

### GET /content/{content_id}
Get specific content details.

```http
GET /api/v1/content/content_123456
Authorization: Bearer <JWT_TOKEN>
```

### PUT /content/{content_id}
Update existing content.

```http
PUT /api/v1/content/content_123456
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "title": "Updated Title",
  "script": "Updated script content...",
  "compliance_notes": "Reviewed and approved"
}
```

### DELETE /content/{content_id}
Delete content from library.

```http
DELETE /api/v1/content/content_123456
Authorization: Bearer <JWT_TOKEN>
```

## Content Templates API

### GET /content/templates
```http
GET /api/v1/content/templates?content_type=reel&platform=instagram
Authorization: Bearer <JWT_TOKEN>
```

### POST /content/templates
```http
POST /api/v1/content/templates
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "template_name": "Wellness Reel Template",
  "content_type": "reel",
  "platform": "instagram",
  "template_structure": {
    "intro": "Hook template with {theme}",
    "body": "Main content with {key_points}",
    "outro": "CTA with {action_request}"
  },
  "script_template": "0-3s: {opening_scene}. VO: {opening_message}...",
  "media_template": "Create a dynamic {duration}-second {platform} {content_type}...",
  "compliance_requirements": ["medical_claim_check", "brand_voice_validation"]
}
```

## Publishing & Scheduling API

### POST /schedule/create
Create a new publication schedule.

```http
POST /api/v1/schedule/create
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "content_id": "content_123456",
  "platform": "instagram",
  "scheduled_at": "2025-07-07T10:00:00Z",
  "cycle_info": {
    "week": 1,
    "day": 1,
    "theme": "Clear the Deck"
  },
  "auto_publish": true
}
```

Response:
```json
{
  "success": true,
  "data": {
    "schedule_id": "schedule_789",
    "content_id": "content_123456",
    "platform": "instagram",
    "scheduled_at": "2025-07-07T10:00:00Z",
    "status": "scheduled",
    "estimated_optimal_time": "2025-07-07T14:30:00Z",
    "audience_timezone": "America/New_York"
  }
}
```

### GET /schedule/calendar
Get publication calendar.

```http
GET /api/v1/schedule/calendar?start_date=2025-07-01&end_date=2025-07-31&platform=instagram
Authorization: Bearer <JWT_TOKEN>
```

Response:
```json
{
  "success": true,
  "data": {
    "calendar": [
      {
        "date": "2025-07-07",
        "publications": [
          {
            "schedule_id": "schedule_789",
            "content_id": "content_123456",
            "platform": "instagram",
            "content_type": "reel",
            "title": "Clear the Deck—Your Body's First",
            "scheduled_at": "2025-07-07T10:00:00Z",
            "status": "scheduled"
          }
        ]
      }
    ],
    "summary": {
      "total_scheduled": 89,
      "by_platform": {
        "instagram": 25,
        "tiktok": 20,
        "youtube": 15,
        "facebook": 15,
        "twitter": 14
      }
    }
  }
}
```

### GET /schedule/cycles
Get 7-day themed cycles.

```http
GET /api/v1/schedule/cycles?cycle_number=1
Authorization: Bearer <JWT_TOKEN>
```

### PUT /schedule/{schedule_id}
Update scheduled publication.

```http
PUT /api/v1/schedule/schedule_789
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "scheduled_at": "2025-07-07T14:30:00Z",
  "auto_publish": true
}
```

### DELETE /schedule/{schedule_id}
Cancel scheduled publication.

```http
DELETE /api/v1/schedule/schedule_789
Authorization: Bearer <JWT_TOKEN>
```

## Compliance & Brand Management API

### POST /compliance/check
Run compliance check on content.

```http
POST /api/v1/compliance/check
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "content_id": "content_123456",
  "check_types": ["medical_claim", "brand_voice", "legal_review"],
  "compliance_level": "strict"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "compliance_id": "compliance_456",
    "content_id": "content_123456",
    "overall_score": 0.95,
    "checks": [
      {
        "check_type": "medical_claim",
        "result": "passed",
        "confidence": 0.98,
        "issues": [],
        "recommendations": []
      },
      {
        "check_type": "brand_voice",
        "result": "passed",
        "confidence": 0.92,
        "issues": [],
        "recommendations": ["Consider using more active voice"]
      },
      {
        "check_type": "legal_review",
        "result": "warning",
        "confidence": 0.85,
        "issues": ["Potential therapeutic claim"],
        "recommendations": ["Consider rewording to avoid implied medical benefit"]
      }
    ],
    "approval_status": "conditional",
    "requires_human_review": false
  }
}
```

### GET /compliance/report
Get compliance report.

```http
GET /api/v1/compliance/report?date_range=7d&content_type=reel
Authorization: Bearer <JWT_TOKEN>
```

### POST /compliance/approve
Approve content for publication.

```http
POST /api/v1/compliance/approve
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "content_id": "content_123456",
  "reviewer_notes": "Approved with minor modifications",
  "conditions": ["Update CTA to be less prescriptive"]
}
```

### GET /brand/guidelines
Get brand guidelines.

```http
GET /api/v1/brand/guidelines?category=medical&type=claims
Authorization: Bearer <JWT_TOKEN>
```

### POST /brand/guidelines
Create or update brand guidelines.

```http
POST /api/v1/brand/guidelines
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "guideline_type": "voice",
  "category": "wellness",
  "title": "EESystem Wellness Voice Guidelines",
  "description": "Guidelines for wellness-focused content",
  "requirements": [
    "Use empowering language",
    "Focus on user experience",
    "Avoid medical claims"
  ],
  "restrictions": [
    "No therapeutic claims",
    "No medical advice",
    "No cure/treatment language"
  ],
  "severity_level": "critical"
}
```

## AI Agent Coordination API

### POST /agents/orchestrate
Orchestrate AI agents for content creation.

```http
POST /api/v1/agents/orchestrate
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "task_type": "content_generation",
  "content_requirements": {
    "content_type": "reel",
    "platform": "instagram",
    "theme": "Clear the Deck",
    "target_audience": "wellness_seekers"
  },
  "agents": [
    {
      "type": "research",
      "priority": 1,
      "parameters": {
        "research_depth": "comprehensive",
        "brand_focus": true
      }
    },
    {
      "type": "creation",
      "priority": 2,
      "parameters": {
        "creativity_level": "high",
        "brand_compliance": "strict"
      }
    },
    {
      "type": "compliance",
      "priority": 3,
      "parameters": {
        "check_level": "thorough",
        "auto_approve": false
      }
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "data": {
    "orchestration_id": "orch_789",
    "session_id": "session_456",
    "status": "running",
    "agents": [
      {
        "agent_id": "agent_research_123",
        "type": "research",
        "status": "active",
        "progress": 0.65,
        "estimated_completion": "2025-07-06T12:05:00Z"
      },
      {
        "agent_id": "agent_creation_456",
        "type": "creation",
        "status": "waiting",
        "progress": 0.0,
        "dependencies": ["agent_research_123"]
      },
      {
        "agent_id": "agent_compliance_789",
        "type": "compliance",
        "status": "waiting",
        "progress": 0.0,
        "dependencies": ["agent_creation_456"]
      }
    ],
    "estimated_completion": "2025-07-06T12:15:00Z"
  }
}
```

### GET /agents/status
Get agent coordination status.

```http
GET /api/v1/agents/status?session_id=session_456
Authorization: Bearer <JWT_TOKEN>
```

### PUT /agents/coordinate
Send coordination message between agents.

```http
PUT /api/v1/agents/coordinate
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "session_id": "session_456",
  "from_agent": "agent_research_123",
  "to_agent": "agent_creation_456",
  "message_type": "research_complete",
  "data": {
    "research_findings": "Key insights about wellness trends...",
    "brand_alignment": 0.92,
    "recommendations": ["Focus on body-mind connection"]
  }
}
```

### GET /agents/memory
Retrieve agent memory.

```http
GET /api/v1/agents/memory?agent_type=research&memory_type=long_term&limit=50
Authorization: Bearer <JWT_TOKEN>
```

### POST /agents/memory
Store agent memory.

```http
POST /api/v1/agents/memory
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "agent_type": "research",
  "memory_type": "long_term",
  "memory_key": "wellness_trends_2025",
  "memory_content": "Comprehensive analysis of wellness trends...",
  "relevance_score": 0.95,
  "context_data": {
    "source": "trend_analysis",
    "confidence": 0.92,
    "last_updated": "2025-07-06T12:00:00Z"
  }
}
```

## Analytics & Reporting API

### GET /analytics/performance
Get content performance analytics.

```http
GET /api/v1/analytics/performance?date_range=30d&platform=instagram&content_type=reel
Authorization: Bearer <JWT_TOKEN>
```

Response:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_content": 45,
      "avg_engagement_rate": 0.078,
      "total_reach": 450000,
      "top_performing_theme": "Clear the Deck"
    },
    "performance_by_content": [
      {
        "content_id": "content_123456",
        "title": "Clear the Deck—Your Body's First",
        "engagement_rate": 0.095,
        "reach": 12000,
        "impressions": 18000,
        "saves": 340,
        "shares": 89,
        "comments": 67
      }
    ],
    "trends": {
      "engagement_trend": "increasing",
      "optimal_posting_times": ["14:00", "18:00", "20:00"],
      "best_performing_hashtags": ["#ClearTheNoise", "#ScalarWellness"]
    }
  }
}
```

### GET /analytics/compliance
Get compliance analytics.

```http
GET /api/v1/analytics/compliance?date_range=30d
Authorization: Bearer <JWT_TOKEN>
```

### GET /analytics/agents
Get AI agent performance metrics.

```http
GET /api/v1/analytics/agents?date_range=7d&agent_type=research
Authorization: Bearer <JWT_TOKEN>
```

## Document Management API

### POST /documents/upload
Upload brand documents for processing.

```http
POST /api/v1/documents/upload
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data

{
  "file": <FILE_DATA>,
  "document_type": "brand_guidelines",
  "category": "compliance",
  "processing_options": {
    "extract_embeddings": true,
    "chunk_size": 1000,
    "overlap": 200
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "document_id": "doc_123456",
    "filename": "brand_guidelines.pdf",
    "document_type": "brand_guidelines",
    "processing_status": "processing",
    "estimated_completion": "2025-07-06T12:10:00Z",
    "extracted_chunks": 0,
    "total_pages": 45
  }
}
```

### GET /documents/status/{document_id}
Check document processing status.

```http
GET /api/v1/documents/status/doc_123456
Authorization: Bearer <JWT_TOKEN>
```

### GET /documents/search
Search processed documents.

```http
GET /api/v1/documents/search?query=medical claims&document_type=brand_guidelines&limit=10
Authorization: Bearer <JWT_TOKEN>
```

## Webhook API

### POST /webhooks/social-platforms
Handle webhooks from social media platforms.

```http
POST /api/v1/webhooks/social-platforms
X-Platform-Signature: sha256=<SIGNATURE>
Content-Type: application/json

{
  "platform": "instagram",
  "event_type": "post_published",
  "data": {
    "post_id": "instagram_post_123",
    "content_id": "content_123456",
    "published_at": "2025-07-06T12:00:00Z",
    "performance_data": {
      "initial_reach": 1000,
      "initial_engagement": 50
    }
  }
}
```

### GET /webhooks/configure
Configure webhook endpoints.

```http
GET /api/v1/webhooks/configure
Authorization: Bearer <JWT_TOKEN>
```

### POST /webhooks/test
Test webhook connectivity.

```http
POST /api/v1/webhooks/test
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "webhook_url": "https://example.com/webhook",
  "event_type": "content_approved"
}
```

## Health & Monitoring API

### GET /health
System health check.

```http
GET /api/v1/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-07-06T12:00:00Z",
    "version": "1.0.0",
    "services": {
      "database": "healthy",
      "redis": "healthy",
      "ai_services": "healthy",
      "social_apis": "healthy"
    },
    "metrics": {
      "uptime": "99.9%",
      "avg_response_time": 150,
      "active_sessions": 45,
      "queue_depth": 12
    }
  }
}
```

### GET /metrics
System metrics for monitoring.

```http
GET /api/v1/metrics
Authorization: Bearer <JWT_TOKEN>
```

## Rate Limiting

### Rate Limits by Endpoint Category

- **Authentication**: 5 requests/minute
- **Content Generation**: 10 requests/minute
- **Content Management**: 100 requests/minute
- **Scheduling**: 50 requests/minute
- **Compliance**: 20 requests/minute
- **Analytics**: 30 requests/minute

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1625587200
```

## Error Codes

### Standard HTTP Status Codes
- **200**: Success
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **422**: Validation Error
- **429**: Rate Limited
- **500**: Internal Server Error

### Custom Error Codes
- **CONTENT_GENERATION_FAILED**: AI content generation failed
- **COMPLIANCE_CHECK_FAILED**: Compliance validation failed
- **SCHEDULE_CONFLICT**: Publication scheduling conflict
- **AGENT_COORDINATION_ERROR**: AI agent coordination failed
- **BRAND_GUIDELINE_VIOLATION**: Content violates brand guidelines

This comprehensive API specification provides all the necessary endpoints for the EESystem Content Curation Platform, supporting content generation, scheduling, compliance, and AI agent coordination with proper authentication, validation, and error handling.