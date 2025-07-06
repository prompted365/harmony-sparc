# AgentFlow API Documentation

## Overview

The AgentFlow API is a high-performance Express.js REST API built with TypeScript, designed to handle >1000 TPS with <100ms response times for health checks.

## Base URL

```
http://localhost:3000
```

## Authentication

*Authentication endpoints will be implemented in Phase 2*

## Health Check Endpoints

### GET /health

Basic health check endpoint that must respond in <100ms.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "responseTime": "5ms"
}
```

### GET /health/live

Kubernetes liveness probe endpoint.

**Response:**
```json
{
  "status": "alive"
}
```

### GET /health/ready

Kubernetes readiness probe endpoint with comprehensive checks.

**Response:**
```json
{
  "status": "ready",
  "checks": {
    "api": "ready",
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "responseTime": "15ms"
}
```

### GET /health/detailed

Detailed system health information for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": {
    "process": 123.45,
    "system": 12345.67
  },
  "memory": {
    "rss": "50.25 MB",
    "heapTotal": "30.15 MB",
    "heapUsed": "25.80 MB",
    "external": "5.20 MB"
  },
  "system": {
    "platform": "darwin",
    "cpus": 8,
    "loadAverage": [1.5, 1.2, 1.0],
    "totalMemory": "16.00 GB",
    "freeMemory": "8.50 GB"
  },
  "config": {
    "env": "development",
    "port": 3000,
    "targetTPS": 1000
  },
  "responseTime": "25ms"
}
```

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "error": {
    "message": "Error description",
    "statusCode": 400,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "path": "/api/endpoint"
  }
}
```

## Rate Limiting

- Default: 100 requests per minute per IP
- Authentication endpoints: 5 requests per 15 minutes
- Health checks: Unlimited

## Performance Targets

- Target TPS: >1000
- Health check response time: <100ms
- Average response time: <200ms
- Memory usage: <512MB

## Monitoring

Metrics are available on port 9090 when enabled:

```bash
METRICS_ENABLED=true
METRICS_PORT=9090
```

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables

See `.env.example` for all configuration options.

## API Endpoints (Coming Soon)

### Phase 1
- Authentication endpoints
- User management
- Agent management
- Basic workflow operations

### Phase 2
- Advanced workflow features
- Real-time updates via WebSockets
- Advanced analytics
- Integration endpoints