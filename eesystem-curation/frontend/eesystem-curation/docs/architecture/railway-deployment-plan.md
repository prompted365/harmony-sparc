# Railway Deployment Plan for EESystem Content Curation Platform

## Overview
Comprehensive deployment strategy for the EESystem Content Curation Platform using Railway, focusing on automated deployment, environment management, and production optimization.

## 1. Project Structure for Railway

### 1.1 Monorepo Configuration
```
eesystem-curation/
├── railway.json                 # Railway configuration
├── Dockerfile                   # Production Dockerfile
├── docker-compose.yml          # Local development
├── .railway/                   # Railway-specific files
│   ├── templates/              # Deployment templates
│   └── hooks/                  # Deployment hooks
├── frontend/                   # React frontend
│   ├── Dockerfile.prod         # Frontend production build
│   ├── package.json
│   └── src/
├── backend/                    # FastAPI backend
│   ├── Dockerfile.prod         # Backend production build
│   ├── requirements.txt
│   └── app/
└── scripts/                    # Deployment scripts
    ├── deploy.sh
    ├── health-check.sh
    └── migration.sh
```

### 1.2 Railway Configuration (railway.json)
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "npm run start:production",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  },
  "environments": {
    "production": {
      "variables": {
        "NODE_ENV": "production",
        "PYTHON_ENV": "production"
      }
    },
    "staging": {
      "variables": {
        "NODE_ENV": "staging",
        "PYTHON_ENV": "staging"
      }
    }
  }
}
```

## 2. Dockerization Strategy

### 2.1 Multi-Stage Production Dockerfile
```dockerfile
# Frontend Build Stage
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ .
RUN npm run build

# Backend Build Stage
FROM python:3.11-slim AS backend-build
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .

# Production Stage
FROM python:3.11-slim AS production
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Copy backend
COPY --from=backend-build /app/backend /app/backend
COPY --from=backend-build /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Copy configuration files
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisor/supervisord.conf

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Start application
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
```

### 2.2 Nginx Configuration
```nginx
# docker/nginx.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    upstream backend {
        server 127.0.0.1:8000;
    }

    server {
        listen 8080;
        server_name _;

        # Security headers
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;" always;

        # Frontend static files
        location / {
            root /app/frontend/dist;
            try_files $uri $uri/ /index.html;
        }

        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Authentication routes with stricter rate limiting
        location /api/auth/login {
            limit_req zone=login burst=3 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### 2.3 Supervisor Configuration
```ini
# docker/supervisord.conf
[supervisord]
nodaemon=true
user=appuser
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid

[program:backend]
command=uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
directory=/app/backend
user=appuser
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/supervisor/backend.log
environment=PATH="/usr/local/bin:/usr/bin:/bin"

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/supervisor/nginx.log
user=root
```

## 3. Environment Management

### 3.1 Environment Variables Structure
```typescript
interface RailwayEnvironment {
  // Application
  NODE_ENV: 'production' | 'staging' | 'development'
  PYTHON_ENV: 'production' | 'staging' | 'development'
  APP_NAME: string
  VERSION: string
  PORT: number

  // Database
  DATABASE_URL: string
  ASTRADB_APPLICATION_TOKEN: string
  ASTRADB_DATABASE_ID: string
  ASTRADB_KEYSPACE: string

  // Authentication
  JWT_SECRET: string
  JWT_REFRESH_SECRET: string
  JWT_ALGORITHM: string
  TOKEN_EXPIRE_MINUTES: number

  // External APIs
  OPENAI_API_KEY: string
  ANTHROPIC_API_KEY: string

  // Railway specific
  RAILWAY_ENVIRONMENT: string
  RAILWAY_PROJECT_ID: string
  RAILWAY_SERVICE_ID: string

  // Monitoring
  SENTRY_DSN?: string
  LOG_LEVEL: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'

  // Security
  ALLOWED_ORIGINS: string
  ENCRYPTION_KEY: string
  RATE_LIMIT_REQUESTS: number
  RATE_LIMIT_WINDOW: number
}
```

### 3.2 Environment Configuration Service
```typescript
class RailwayEnvironmentService {
  private railwayApiKey: string
  private projectId: string

  constructor(apiKey: string, projectId: string) {
    this.railwayApiKey = apiKey
    this.projectId = projectId
  }

  async getEnvironmentVariables(environment: 'production' | 'staging'): Promise<EnvironmentVariable[]> {
    const response = await fetch(`https://backboard.railway.app/graphql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.railwayApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query GetEnvironmentVariables($projectId: String!, $environment: String!) {
            project(id: $projectId) {
              environments(first: 10) {
                edges {
                  node {
                    name
                    variables(first: 100) {
                      edges {
                        node {
                          name
                          value
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        variables: { projectId: this.projectId, environment }
      })
    })

    return response.json()
  }

  async updateEnvironmentVariable(
    environment: string,
    key: string,
    value: string
  ): Promise<void> {
    const response = await fetch(`https://backboard.railway.app/graphql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.railwayApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          mutation UpdateEnvironmentVariable($projectId: String!, $environment: String!, $key: String!, $value: String!) {
            variableUpsert(input: {
              projectId: $projectId,
              environmentName: $environment,
              name: $key,
              value: $value
            }) {
              id
            }
          }
        `,
        variables: {
          projectId: this.projectId,
          environment,
          key,
          value
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to update environment variable: ${response.statusText}`)
    }
  }

  async syncEnvironmentVariables(
    source: 'production' | 'staging',
    target: 'production' | 'staging',
    excludeKeys: string[] = []
  ): Promise<void> {
    const sourceVars = await this.getEnvironmentVariables(source)
    const filteredVars = sourceVars.filter(v => !excludeKeys.includes(v.key))

    await Promise.all(
      filteredVars.map(variable =>
        this.updateEnvironmentVariable(target, variable.key, variable.value)
      )
    )
  }
}
```

## 4. Deployment Pipeline

### 4.1 GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Railway

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  PYTHON_VERSION: '3.11'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      
      - name: Install frontend dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Install backend dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      
      - name: Run frontend tests
        run: |
          cd frontend
          npm test
      
      - name: Run backend tests
        run: |
          cd backend
          python -m pytest
      
      - name: Build frontend
        run: |
          cd frontend
          npm run build
      
      - name: Run security scan
        run: |
          cd frontend
          npm audit --audit-level high
          cd ../backend
          safety check

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway (Staging)
        run: |
          npx @railway/cli deploy --service=${{ secrets.RAILWAY_STAGING_SERVICE_ID }}
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway (Production)
        run: |
          npx @railway/cli deploy --service=${{ secrets.RAILWAY_PRODUCTION_SERVICE_ID }}
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
      
      - name: Run post-deployment health check
        run: |
          ./scripts/health-check.sh ${{ secrets.PRODUCTION_URL }}
      
      - name: Notify deployment success
        if: success()
        run: |
          curl -X POST -H 'Content-type: application/json' \
            --data '{"text":"✅ Production deployment successful"}' \
            ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 4.2 Deployment Scripts
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=${1:-staging}
RAILWAY_SERVICE_ID=${2}

echo "🚀 Deploying to $ENVIRONMENT..."

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."
./scripts/pre-deploy-check.sh

# Deploy to Railway
echo "📦 Deploying to Railway..."
npx @railway/cli deploy --service=$RAILWAY_SERVICE_ID

# Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
sleep 30

# Health check
echo "🔍 Running health check..."
./scripts/health-check.sh

# Post-deployment tasks
echo "🔧 Running post-deployment tasks..."
./scripts/post-deploy.sh

echo "✅ Deployment completed successfully!"
```

```bash
#!/bin/bash
# scripts/health-check.sh

set -e

URL=${1:-"http://localhost:8080"}
MAX_RETRIES=10
RETRY_DELAY=5

echo "🏥 Health checking $URL..."

for i in $(seq 1 $MAX_RETRIES); do
    echo "Attempt $i/$MAX_RETRIES..."
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/health")
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "✅ Health check passed!"
        
        # Additional API checks
        API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/api/health")
        if [ "$API_CODE" -eq 200 ]; then
            echo "✅ API health check passed!"
            exit 0
        else
            echo "❌ API health check failed with code $API_CODE"
            exit 1
        fi
    else
        echo "❌ Health check failed with code $HTTP_CODE"
        if [ $i -eq $MAX_RETRIES ]; then
            echo "❌ Health check failed after $MAX_RETRIES attempts"
            exit 1
        fi
        sleep $RETRY_DELAY
    fi
done
```

## 5. Monitoring and Observability

### 5.1 Application Monitoring
```typescript
class MonitoringService {
  private metricsCollector: MetricsCollector
  private logger: Logger

  constructor() {
    this.metricsCollector = new MetricsCollector()
    this.logger = new Logger()
  }

  collectMetrics(): void {
    // System metrics
    this.metricsCollector.gauge('system.cpu.usage', process.cpuUsage())
    this.metricsCollector.gauge('system.memory.usage', process.memoryUsage())
    
    // Application metrics
    this.metricsCollector.gauge('app.active_connections', this.getActiveConnections())
    this.metricsCollector.gauge('app.response_time', this.getAverageResponseTime())
    
    // Database metrics
    this.metricsCollector.gauge('db.connections', this.getDatabaseConnections())
    this.metricsCollector.gauge('db.query_time', this.getAverageQueryTime())
  }

  setupHealthChecks(): void {
    // Database health
    this.registerHealthCheck('database', async () => {
      try {
        await this.testDatabaseConnection()
        return { status: 'healthy', timestamp: new Date() }
      } catch (error) {
        return { status: 'unhealthy', error: error.message, timestamp: new Date() }
      }
    })

    // External API health
    this.registerHealthCheck('external_apis', async () => {
      const apiChecks = await Promise.allSettled([
        this.checkOpenAIAPI(),
        this.checkAnthropicAPI()
      ])
      
      const failedChecks = apiChecks.filter(check => check.status === 'rejected')
      
      if (failedChecks.length > 0) {
        return { status: 'degraded', failures: failedChecks.length, timestamp: new Date() }
      }
      
      return { status: 'healthy', timestamp: new Date() }
    })
  }
}
```

### 5.2 Logging Configuration
```typescript
interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  format: 'json' | 'text'
  destinations: LogDestination[]
  sampling: {
    enabled: boolean
    rate: number
  }
  sensitiveFields: string[]
}

class Logger {
  private config: LoggingConfig
  
  constructor(config: LoggingConfig) {
    this.config = config
  }

  log(level: string, message: string, metadata?: any): void {
    if (this.shouldSample()) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        metadata: this.sanitizeMetadata(metadata),
        service: 'eesystem-curation',
        environment: process.env.NODE_ENV
      }

      this.writeToDestinations(logEntry)
    }
  }

  private sanitizeMetadata(metadata: any): any {
    if (!metadata) return metadata
    
    const sanitized = { ...metadata }
    
    this.config.sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]'
      }
    })
    
    return sanitized
  }
}
```

## 6. Security Configuration

### 6.1 Security Headers
```typescript
class SecurityConfig {
  static getSecurityHeaders(): Record<string, string> {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://api.openai.com https://api.anthropic.com",
        "worker-src 'self' blob:"
      ].join('; ')
    }
  }
}
```

### 6.2 Rate Limiting
```typescript
interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  skipSuccessfulRequests: boolean
  keyGenerator: (req: Request) => string
}

class RateLimiter {
  private configs: Map<string, RateLimitConfig> = new Map()
  private requestCounts: Map<string, Map<string, number>> = new Map()

  constructor() {
    // API rate limiting
    this.configs.set('api', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      skipSuccessfulRequests: false,
      keyGenerator: (req) => req.ip
    })

    // Auth rate limiting
    this.configs.set('auth', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => req.ip
    })
  }

  checkLimit(configName: string, req: Request): boolean {
    const config = this.configs.get(configName)
    if (!config) return true

    const key = config.keyGenerator(req)
    const now = Date.now()
    const windowStart = now - config.windowMs

    if (!this.requestCounts.has(configName)) {
      this.requestCounts.set(configName, new Map())
    }

    const configCounts = this.requestCounts.get(configName)!
    const userCounts = configCounts.get(key) || 0

    // Clean up old entries
    this.cleanup(configName, windowStart)

    if (userCounts >= config.maxRequests) {
      return false
    }

    configCounts.set(key, userCounts + 1)
    return true
  }

  private cleanup(configName: string, cutoff: number): void {
    // Implementation for cleaning up old rate limit entries
  }
}
```

## 7. Backup and Recovery

### 7.1 Database Backup Strategy
```typescript
class BackupService {
  private astraDbClient: AstraDBClient
  private railwayService: RailwayService

  async createBackup(): Promise<BackupResult> {
    const backupId = `backup-${Date.now()}`
    
    try {
      // Create database backup
      const dbBackup = await this.astraDbClient.createBackup(backupId)
      
      // Backup environment variables
      const envBackup = await this.railwayService.exportEnvironmentVariables()
      
      // Backup application files
      const appBackup = await this.createApplicationBackup()
      
      const backup: BackupResult = {
        id: backupId,
        timestamp: new Date(),
        database: dbBackup,
        environment: envBackup,
        application: appBackup,
        size: this.calculateBackupSize(dbBackup, envBackup, appBackup)
      }
      
      await this.storeBackupMetadata(backup)
      return backup
      
    } catch (error) {
      throw new Error(`Backup failed: ${error.message}`)
    }
  }

  async restoreBackup(backupId: string): Promise<void> {
    const backup = await this.getBackupMetadata(backupId)
    
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`)
    }
    
    // Restore database
    await this.astraDbClient.restoreBackup(backup.database)
    
    // Restore environment variables
    await this.railwayService.importEnvironmentVariables(backup.environment)
    
    // Restore application files
    await this.restoreApplicationFiles(backup.application)
  }

  async scheduleBackups(): void {
    // Daily backups
    cron.schedule('0 2 * * *', async () => {
      try {
        await this.createBackup()
      } catch (error) {
        console.error('Scheduled backup failed:', error)
      }
    })

    // Weekly cleanup of old backups
    cron.schedule('0 3 * * 0', async () => {
      await this.cleanupOldBackups(30) // Keep backups for 30 days
    })
  }
}
```

## 8. Performance Optimization

### 8.1 Caching Strategy
```typescript
class CacheService {
  private redisClient: RedisClient
  private localCache: Map<string, CacheEntry> = new Map()

  constructor(redisClient: RedisClient) {
    this.redisClient = redisClient
  }

  async get<T>(key: string): Promise<T | null> {
    // Try local cache first
    const localEntry = this.localCache.get(key)
    if (localEntry && !this.isExpired(localEntry)) {
      return localEntry.value
    }

    // Try Redis cache
    const redisValue = await this.redisClient.get(key)
    if (redisValue) {
      const parsed = JSON.parse(redisValue)
      this.localCache.set(key, { value: parsed, timestamp: Date.now() })
      return parsed
    }

    return null
  }

  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    // Store in local cache
    this.localCache.set(key, { value, timestamp: Date.now(), ttl })
    
    // Store in Redis
    await this.redisClient.setex(key, ttl, JSON.stringify(value))
  }

  async invalidate(pattern: string): Promise<void> {
    // Clear local cache
    for (const key of this.localCache.keys()) {
      if (key.includes(pattern)) {
        this.localCache.delete(key)
      }
    }

    // Clear Redis cache
    const keys = await this.redisClient.keys(pattern)
    if (keys.length > 0) {
      await this.redisClient.del(...keys)
    }
  }
}
```

### 8.2 Database Optimization
```typescript
class DatabaseOptimizer {
  private connectionPool: ConnectionPool
  private queryAnalyzer: QueryAnalyzer

  constructor() {
    this.connectionPool = new ConnectionPool({
      max: 20,
      min: 5,
      idle: 10000,
      acquire: 60000,
      evict: 1000
    })
    
    this.queryAnalyzer = new QueryAnalyzer()
  }

  async optimizeQueries(): Promise<void> {
    const slowQueries = await this.queryAnalyzer.getSlowQueries()
    
    for (const query of slowQueries) {
      const optimized = await this.queryAnalyzer.optimizeQuery(query)
      if (optimized.improvementFactor > 1.5) {
        console.log(`Query optimization found: ${optimized.improvementFactor}x faster`)
      }
    }
  }

  async createIndexes(): Promise<void> {
    const recommendedIndexes = await this.queryAnalyzer.getRecommendedIndexes()
    
    for (const index of recommendedIndexes) {
      await this.createIndex(index)
    }
  }
}
```

This comprehensive Railway deployment plan provides:
- Multi-stage Docker builds for optimization
- Automated CI/CD pipeline with GitHub Actions
- Environment management with Railway API integration
- Comprehensive monitoring and health checks
- Security hardening with rate limiting and security headers
- Backup and recovery strategies
- Performance optimization with caching and database optimization
- Production-ready configuration for scalable deployment