# Railway Deployment Guide for EESystem Content Curation Platform

## 🚀 Quick Start

### Prerequisites
- Railway account (https://railway.app)
- Railway CLI installed (`npm install -g @railway/cli`)
- GitHub repository with your code

### One-Command Setup
```bash
# Complete setup and deployment
./railway-setup.sh && ./railway-deploy.sh
```

## 📋 Step-by-Step Deployment

### 1. Initial Setup

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init
```

### 2. Environment Configuration

```bash
# Run setup script
./railway-setup.sh

# Or manually set environment variables
railway variables set JWT_SECRET="your-jwt-secret"
railway variables set ASTRA_DB_APPLICATION_TOKEN="your-token"
railway variables set ASTRA_DB_ID="your-db-id"
railway variables set OPENAI_API_KEY="your-openai-key"
```

### 3. Database & Cache Setup

```bash
# Add PostgreSQL plugin
railway plugin add postgresql

# Add Redis plugin
railway plugin add redis
```

### 4. Deploy Services

```bash
# Deploy all services
./railway-deploy.sh

# Or deploy individually
./railway-deploy.sh backend
./railway-deploy.sh frontend
```

## 🔧 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-key` |
| `ASTRA_DB_APPLICATION_TOKEN` | AstraDB access token | `AstraCS:xxx` |
| `ASTRA_DB_ID` | AstraDB database ID | `12345678-1234-1234-1234-123456789012` |
| `ASTRA_DB_REGION` | AstraDB region | `us-east-1` |
| `ASTRA_DB_KEYSPACE` | AstraDB keyspace | `eesystem_curation` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-xxx` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTRY_DSN` | Sentry error tracking | None |
| `REDIS_PASSWORD` | Redis password | Auto-generated |
| `LOG_LEVEL` | Logging level | `info` |
| `RATE_LIMIT_REQUESTS` | Rate limit per window | `100` |
| `MAX_FILE_SIZE` | Max upload file size | `10485760` (10MB) |

## 🏗️ Architecture Overview

### Services
- **Backend**: FastAPI application (Python)
- **Frontend**: React application (Vite)
- **Database**: PostgreSQL (Railway managed)
- **Cache**: Redis (Railway managed)

### Domains
- Frontend: `https://eesystem-curation.railway.app`
- Backend API: `https://api.eesystem-curation.railway.app`

## 📊 Monitoring & Health Checks

### Health Check Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/health` | Basic health check | Service status |
| `/health/detailed` | Detailed system health | Dependencies, metrics |
| `/health/ready` | Readiness probe | Ready for traffic |
| `/health/live` | Liveness probe | Service alive |
| `/metrics` | Prometheus metrics | System metrics |

### Example Health Check
```bash
curl https://api.eesystem-curation.railway.app/health
```

Response:
```json
{
  "status": "healthy",
  "service": "eesystem-curation-backend",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production"
}
```

## 🔒 Security Features

### Implemented Security
- **CORS**: Configured for production domains
- **Rate Limiting**: API and web traffic limits
- **Security Headers**: XSS, CSRF, clickjacking protection
- **Input Validation**: Pydantic models and sanitization
- **JWT Authentication**: Secure token-based auth
- **Environment Isolation**: Separate staging/production configs

### SSL/TLS
Railway automatically provides SSL certificates for custom domains.

## 🚀 Performance Optimization

### Backend Optimizations
- **Multi-worker deployment**: 4 Uvicorn workers
- **Connection pooling**: Database and Redis connections
- **Async operations**: Non-blocking I/O
- **Response compression**: Gzip enabled
- **Caching**: Redis-based application cache

### Frontend Optimizations
- **Static asset caching**: 1-year cache headers
- **Gzip compression**: Text and asset compression
- **CDN delivery**: Railway's global CDN
- **Code splitting**: Vite bundle optimization

### Database Optimizations
- **Connection pooling**: SQLAlchemy async pool
- **Query optimization**: Indexed queries
- **Read replicas**: (Available with Railway Pro)

## 📈 Scaling

### Horizontal Scaling
```bash
# Scale backend service
railway scale --service backend --replicas 3

# Scale frontend service  
railway scale --service frontend --replicas 2
```

### Vertical Scaling
```bash
# Upgrade service plan
railway service upgrade --plan pro
```

### Auto-scaling
Railway provides auto-scaling based on:
- CPU utilization
- Memory usage
- Request queue depth

## 🔄 CI/CD Pipeline

### GitHub Actions Setup

1. **Add Railway token to GitHub secrets**:
   ```bash
   # Generate token
   railway token create
   
   # Add to GitHub repository secrets as RAILWAY_TOKEN
   ```

2. **Workflow file** (`.github/workflows/deploy.yml`):
   ```yaml
   name: Deploy to Railway
   on:
     push:
       branches: [main]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Deploy to Railway
           run: railway deploy --detach
           env:
             RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
   ```

### Manual Deployment
```bash
# Deploy current branch
railway deploy

# Deploy specific service
railway deploy --service backend

# Deploy with custom Dockerfile
railway deploy --dockerfile ./backend/Dockerfile.prod
```

## 🗄️ Database Management

### Migrations
```bash
# Run migrations
railway run --service backend alembic upgrade head

# Create new migration
railway run --service backend alembic revision --autogenerate -m "description"

# Reset database (⚠️ destructive)
railway run --service backend alembic downgrade base
railway run --service backend alembic upgrade head
```

### Database Access
```bash
# Connect to database
railway db connect

# Run SQL commands
railway run --service backend psql $DATABASE_URL
```

### Backups
Railway automatically backs up PostgreSQL databases. Additional backup configuration:

```bash
# Enable automated backups
railway variables set BACKUP_ENABLED=true
railway variables set BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM
railway variables set BACKUP_RETENTION_DAYS=30
```

## 🐛 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   railway logs --service backend --build
   
   # Debug locally
   docker build -f backend/Dockerfile.prod .
   ```

2. **Runtime Errors**
   ```bash
   # Check application logs
   railway logs --service backend
   
   # Connect to service shell
   railway shell --service backend
   ```

3. **Database Connection Issues**
   ```bash
   # Check database status
   railway db status
   
   # Test connection
   railway run --service backend python -c "import psycopg2; print('DB OK')"
   ```

4. **Environment Variables**
   ```bash
   # List all variables
   railway variables
   
   # Check specific variable
   railway variables get JWT_SECRET
   ```

### Performance Issues

1. **High CPU Usage**
   ```bash
   # Check metrics
   railway metrics --service backend
   
   # Scale up
   railway scale --service backend --replicas 2
   ```

2. **Memory Leaks**
   ```bash
   # Monitor memory usage
   curl https://api.eesystem-curation.railway.app/health/detailed
   
   # Restart service
   railway service restart backend
   ```

3. **Database Performance**
   ```bash
   # Check slow queries
   railway db logs
   
   # Monitor database metrics
   railway db metrics
   ```

## 📝 Maintenance

### Regular Tasks

1. **Update Dependencies**
   ```bash
   # Update Python packages
   cd backend && pip list --outdated
   
   # Update Node packages
   cd frontend && npm outdated
   ```

2. **Security Updates**
   ```bash
   # Check for security vulnerabilities
   railway security scan
   
   # Update base images
   docker pull python:3.11-slim
   docker pull node:20-alpine
   ```

3. **Database Maintenance**
   ```bash
   # Analyze database performance
   railway db analyze
   
   # Clean up old data
   railway run --service backend python scripts/cleanup.py
   ```

### Monitoring Checklist

- [ ] Check health endpoints daily
- [ ] Monitor error rates in Sentry
- [ ] Review performance metrics
- [ ] Check disk usage and cleanup logs
- [ ] Verify backup integrity
- [ ] Test disaster recovery procedures

## 🆘 Support

### Railway Support
- **Documentation**: https://docs.railway.app
- **Discord**: https://discord.gg/railway
- **Support**: help@railway.app

### Application Support
- **GitHub Issues**: Create issue in repository
- **Health Checks**: Monitor `/health/detailed` endpoint
- **Logs**: `railway logs --service [backend|frontend]`

## 🔗 Useful Commands

```bash
# Project management
railway status                    # Show project status
railway open                     # Open project in browser
railway metrics                  # Show performance metrics
railway logs                     # Show application logs

# Service management
railway service list             # List all services
railway service logs backend     # Show service logs
railway service restart backend  # Restart service
railway scale --replicas 3       # Scale service

# Database management
railway db connect               # Connect to database
railway db dump                  # Create database dump
railway db restore               # Restore from dump

# Environment management
railway variables                # List all variables
railway variables set KEY=value  # Set variable
railway variables delete KEY     # Delete variable

# Deployment
railway deploy                   # Deploy current branch
railway deploy --detach          # Deploy without watching logs
railway rollback                 # Rollback to previous deployment
```

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [React Documentation](https://react.dev)
- [AstraDB Documentation](https://docs.datastax.com/en/astra/home/astra.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)