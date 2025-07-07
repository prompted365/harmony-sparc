# EESystem Content Curation Platform - Railway Deployment

## 🚀 Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

This repository contains a production-ready configuration for deploying the EESystem Content Curation Platform to Railway.

## 📋 What's Included

### 🏗️ Infrastructure
- **Backend**: FastAPI Python application with async support
- **Frontend**: React + Vite SPA with optimized builds
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for session and application caching
- **Monitoring**: Prometheus + Grafana for observability
- **Proxy**: Nginx for load balancing and static asset serving

### 🔧 Railway-Specific Features
- **Multi-service deployment** with service dependencies
- **Environment variable management** with templates
- **Health checks** for deployment validation
- **Auto-scaling configuration** based on metrics
- **Custom domains** with SSL termination
- **Database migrations** with rollback support
- **Monitoring dashboards** for system observability

### 📁 File Structure
```
├── railway.json                    # Railway service configuration
├── railway-setup.sh               # Initial setup script
├── railway-deploy.sh              # Deployment script
├── .env.template                  # Environment variables template
├── .env.railway                   # Railway-specific environment config
├── docker-compose.prod.yml        # Production Docker Compose
├── backend/
│   ├── Dockerfile.prod            # Production backend Dockerfile
│   ├── requirements.prod.txt      # Production Python dependencies
│   └── app/api/v1/endpoints/health.py  # Health check endpoints
├── frontend/
│   ├── Dockerfile.prod            # Production frontend Dockerfile
│   └── nginx.prod.conf            # Nginx configuration
├── config/
│   ├── nginx.prod.conf            # Main Nginx configuration
│   ├── prometheus.yml             # Prometheus monitoring config
│   └── grafana/                   # Grafana dashboards
├── scripts/
│   └── health-check.sh            # Health monitoring script
├── .github/workflows/
│   └── deploy.yml                 # CI/CD pipeline
└── docs/
    ├── RAILWAY_DEPLOYMENT_GUIDE.md
    └── PRODUCTION_OPTIMIZATION.md
```

## 🚀 One-Click Deployment

### Prerequisites
- Railway account ([sign up here](https://railway.app))
- GitHub repository with this code

### Deployment Steps

1. **Click the Deploy button** or fork this repository
2. **Connect to Railway**: Link your GitHub account
3. **Configure environment variables**: Use the provided template
4. **Deploy**: Railway will automatically build and deploy all services

### Manual Deployment

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Initialize project
railway init

# 4. Set up environment and deploy
./railway-setup.sh && ./railway-deploy.sh
```

## 🔐 Environment Variables

### Required Variables
Set these in Railway dashboard under Variables:

```bash
# Authentication
JWT_SECRET=your-super-secret-jwt-key

# AstraDB Configuration
ASTRA_DB_APPLICATION_TOKEN=AstraCS:your-token
ASTRA_DB_ID=your-database-id
ASTRA_DB_REGION=us-east-1
ASTRA_DB_KEYSPACE=eesystem_curation

# AI/ML Services
OPENAI_API_KEY=sk-your-openai-key

# Monitoring (Optional)
SENTRY_DSN=your-sentry-dsn
```

### Auto-Generated Variables
Railway automatically provides:
- `DATABASE_URL` (PostgreSQL)
- `REDIS_URL` (Redis)
- `PORT` (Application port)

## 🏗️ Architecture

### Service Dependencies
```
Frontend (React) → Backend (FastAPI) → Database (PostgreSQL)
                 ↘ Cache (Redis)     ↗
```

### Scaling Configuration
- **Backend**: Auto-scales from 1-5 instances based on CPU
- **Frontend**: 2 instances with CDN caching
- **Database**: Managed PostgreSQL with connection pooling
- **Redis**: Single instance with persistence

## 📊 Monitoring

### Health Check Endpoints
- `/health` - Basic service status
- `/health/detailed` - Comprehensive system health
- `/health/ready` - Kubernetes-style readiness probe
- `/health/live` - Kubernetes-style liveness probe
- `/metrics` - Prometheus metrics

### Monitoring Stack
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Sentry**: Error tracking and performance monitoring
- **Railway Metrics**: Built-in system monitoring

### Custom Health Checks
```bash
# Run comprehensive health check
./scripts/health-check.sh

# Continuous monitoring
./scripts/health-check.sh monitor 60

# Quick status check
./scripts/health-check.sh quick
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow
Automated pipeline includes:
- **Testing**: Unit and integration tests
- **Security**: Dependency vulnerability scanning
- **Build**: Docker image creation
- **Deploy**: Automated Railway deployment
- **Verify**: Post-deployment health checks

### Deployment Environments
- **Staging**: Auto-deploy from `main` branch
- **Production**: Manual deploy from `production` branch

## 🛠️ Development Workflow

### Local Development
```bash
# Install dependencies
npm run setup

# Start development servers
npm run dev

# Run tests
npm run test

# Run linting
npm run lint
```

### Docker Development
```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Production testing
docker-compose -f docker-compose.prod.yml up
```

## 🔒 Security Features

### Implemented Security
- **HTTPS**: Automatic SSL certificates
- **CORS**: Configured for production domains
- **Rate Limiting**: API and web traffic protection
- **Input Validation**: Pydantic models and sanitization
- **Authentication**: JWT-based secure sessions
- **Security Headers**: XSS, CSRF, clickjacking protection

### Security Checklist
- [ ] Environment variables properly secured
- [ ] Database credentials rotated
- [ ] API keys have minimal required permissions
- [ ] CORS origins restricted to production domains
- [ ] Rate limits configured appropriately
- [ ] Security headers enabled
- [ ] Dependency vulnerabilities checked

## 📈 Performance Optimization

### Frontend Optimizations
- **Code Splitting**: Route-based lazy loading
- **Asset Optimization**: Minification and compression
- **CDN**: Railway's global edge network
- **Caching**: Aggressive static asset caching

### Backend Optimizations
- **Connection Pooling**: Database and Redis pools
- **Async Operations**: Non-blocking I/O throughout
- **Response Compression**: Gzip for all responses
- **Query Optimization**: Indexed database queries

### Database Optimizations
- **Indexing**: Strategic database indexes
- **Connection Pooling**: SQLAlchemy async pools
- **Query Analysis**: Regular performance monitoring
- **Maintenance**: Automated vacuum and analyze

## 🚨 Alerting and Monitoring

### Critical Alerts
- Service down (immediate notification)
- Database connection failure
- High error rate (>5%)
- Memory usage >90%

### Monitoring Dashboards
- System metrics (CPU, memory, disk)
- Application performance (response times, throughput)
- Error tracking and analysis
- User activity and engagement

## 🆘 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   railway logs --service backend --build
   ```

2. **Runtime Errors**
   ```bash
   railway logs --service backend
   ```

3. **Database Issues**
   ```bash
   railway db status
   railway run --service backend alembic current
   ```

4. **Performance Issues**
   ```bash
   railway metrics --service backend
   ./scripts/health-check.sh verbose
   ```

### Getting Help
- **Railway Docs**: https://docs.railway.app
- **Discord**: https://discord.gg/railway
- **GitHub Issues**: Create issue in this repository

## 📚 Additional Resources

### Documentation
- [Complete Deployment Guide](RAILWAY_DEPLOYMENT_GUIDE.md)
- [Production Optimization](PRODUCTION_OPTIMIZATION.md)
- [API Documentation](https://api.eesystem-curation.railway.app/docs)

### External Services
- [AstraDB Setup Guide](https://docs.datastax.com/en/astra/home/astra.html)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Sentry Setup Guide](https://docs.sentry.io/platforms/python/guides/fastapi/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request
5. Railway will automatically deploy to staging for review

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Ready to deploy?** Click the Railway button above or run `./railway-setup.sh` to get started! 🚀