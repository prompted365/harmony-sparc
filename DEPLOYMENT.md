# Harmony SPARC Production Deployment Guide

This guide provides comprehensive instructions for deploying the Harmony SPARC platform in a production environment using Docker containers.

## 🏗️ Architecture Overview

The production deployment consists of the following components:

### Core Services
- **harmony-api**: Main API server (Node.js/Express)
- **postgres**: PostgreSQL database
- **redis**: Redis cache and session store
- **blockchain-node**: Blockchain node (Ganache for development)

### Infrastructure Services
- **nginx**: Reverse proxy with SSL termination
- **prometheus**: Metrics collection
- **grafana**: Monitoring dashboards
- **elasticsearch**: Log aggregation
- **logstash**: Log processing
- **kibana**: Log visualization

## 📋 Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended) or macOS
- **Memory**: Minimum 8GB RAM, 16GB+ recommended
- **Storage**: Minimum 50GB free space
- **CPU**: 4+ cores recommended

### Required Software
- Docker 24.0+
- Docker Compose 2.0+
- Node.js 18.0+
- npm 9.0+
- OpenSSL (for SSL certificate generation)

### Network Requirements
- Ports 80, 443 (HTTP/HTTPS)
- Port 3000-3003 (API services)
- Port 5432 (PostgreSQL)
- Port 6379 (Redis)
- Port 8545 (Blockchain)
- Port 9090 (Prometheus)
- Port 5601 (Kibana)

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone <repository-url>
cd harmony-sparc
cp .env.example .env.production
```

### 2. Configure Environment
Edit `.env.production` with your production values:
```bash
# Required - Replace with secure values
POSTGRES_PASSWORD=your_secure_postgres_password
REDIS_PASSWORD=your_secure_redis_password
JWT_SECRET=your_jwt_secret_key_at_least_32_characters_long
BLOCKCHAIN_RPC_URL=https://your-blockchain-rpc-url.com
GRAFANA_PASSWORD=your_grafana_admin_password
```

### 3. Deploy
```bash
./deploy.sh
```

### 4. Verify Deployment
```bash
# Check service status
docker-compose -f docker-compose.production.yml ps

# Run health checks
docker-compose -f docker-compose.production.yml exec harmony-api node healthcheck.js

# Access services
curl https://localhost/health
```

## 🔧 Detailed Setup

### Environment Configuration

#### Security Settings
```env
# Authentication
JWT_SECRET=your_jwt_secret_key_here_at_least_32_characters_long
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGINS=https://app.harmony-sparc.com,https://dashboard.harmony-sparc.com
```

#### Database Configuration
```env
POSTGRES_PASSWORD=your_secure_postgres_password
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/harmony_db
DATABASE_POOL_SIZE=20
```

#### Blockchain Configuration
```env
BLOCKCHAIN_RPC_URL=https://your-blockchain-rpc-url.com
BLOCKCHAIN_NETWORK_ID=1337
BLOCKCHAIN_PRIVATE_KEY=your_private_key_for_contract_deployment
```

### SSL/TLS Setup

#### Self-Signed Certificates (Development)
The deployment script automatically generates self-signed certificates:
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/harmony-sparc.key \
    -out ssl/harmony-sparc.crt
```

#### Production Certificates
For production, replace with real certificates:
```bash
# Copy your certificates
cp your-certificate.crt ssl/harmony-sparc.crt
cp your-private-key.key ssl/harmony-sparc.key
chmod 644 ssl/harmony-sparc.crt
chmod 600 ssl/harmony-sparc.key
```

### Advanced Deployment Options

#### Custom Build
```bash
# Build specific components
docker build -f Dockerfile.production -t harmony-sparc:custom .

# Skip build step if using pre-built images
./deploy.sh --skip-build
```

#### Cleanup and Rebuild
```bash
# Clean up old deployments
./deploy.sh --cleanup

# Remove old images
CLEANUP_IMAGES=true ./deploy.sh --cleanup
```

#### Custom Environment File
```bash
./deploy.sh --env-file .env.staging
```

## 📊 Monitoring and Observability

### Grafana Dashboards
Access: `http://localhost:3003`
- Username: `admin`
- Password: From `GRAFANA_PASSWORD` env var

#### Pre-configured Dashboards
- System Metrics (CPU, Memory, Disk)
- API Performance (Response times, Throughput)
- Database Metrics (Connections, Queries)
- Blockchain Metrics (Transactions, Gas usage)

### Prometheus Metrics
Access: `http://localhost:9090`

#### Available Metrics
- `http_requests_total`: Total HTTP requests
- `http_request_duration_seconds`: Request latency
- `nodejs_heap_size_total_bytes`: Node.js heap usage
- `postgres_connections_active`: Active database connections

### ELK Stack (Logging)
Access Kibana: `http://localhost:5601`

#### Log Sources
- Application logs (`/app/logs/*.log`)
- NGINX access/error logs
- Database logs
- Container logs

## 🔒 Security Considerations

### Network Security
- All services run in isolated Docker network
- Only necessary ports exposed to host
- NGINX handles SSL termination
- Rate limiting configured

### Application Security
- JWT authentication enabled
- CORS properly configured
- Security headers (Helmet.js)
- Input validation on all endpoints

### Database Security
- Dedicated database user with limited privileges
- Connection pooling configured
- Prepared statements prevent SQL injection

### Container Security
- Non-root user in containers
- Read-only root filesystem where possible
- Resource limits configured
- Health checks implemented

## 🛠️ Maintenance

### Backup Procedures
```bash
# Database backup
docker-compose -f docker-compose.production.yml exec postgres \
    pg_dump -U postgres harmony_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Volume backup
docker run --rm -v harmony-sparc_postgres_data:/data -v $(pwd):/backup \
    ubuntu tar czf /backup/postgres_backup_$(date +%Y%m%d_%H%M%S).tar.gz /data
```

### Updates and Upgrades
```bash
# Update application
git pull origin main
docker build -f Dockerfile.production -t harmony-sparc:production .
docker-compose -f docker-compose.production.yml up -d harmony-api

# Update all services
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d
```

### Log Rotation
Logs are automatically rotated by Docker. Configure additional rotation:
```bash
# Add to /etc/logrotate.d/harmony-sparc
/var/lib/docker/containers/*/*-json.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
    postrotate
        docker kill --signal=USR1 $(docker ps -q) 2>/dev/null || true
    endscript
}
```

## 🚨 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs harmony-api

# Check system resources
docker stats

# Check network connectivity
docker network ls
docker network inspect harmony-sparc_harmony-network
```

#### Database Connection Issues
```bash
# Check database status
docker-compose -f docker-compose.production.yml exec postgres pg_isready

# Test connection
docker-compose -f docker-compose.production.yml exec harmony-api \
    node -e "console.log(process.env.DATABASE_URL)"
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in ssl/harmony-sparc.crt -text -noout

# Test SSL connection
openssl s_client -connect localhost:443 -servername harmony-sparc.local
```

### Performance Tuning

#### Database Optimization
```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- Optimize indexes
ANALYZE;
REINDEX DATABASE harmony_db;
```

#### Memory Optimization
```bash
# Adjust container memory limits in docker-compose.production.yml
deploy:
  resources:
    limits:
      memory: 2G
    reservations:
      memory: 1G
```

## 📈 Scaling

### Horizontal Scaling
```yaml
# In docker-compose.production.yml
harmony-api:
  deploy:
    replicas: 3
  # Add load balancer configuration
```

### Database Scaling
- Configure read replicas
- Implement connection pooling
- Consider database sharding

### Cache Optimization
- Increase Redis memory
- Implement Redis clustering
- Add application-level caching

## 🔍 Monitoring Alerts

### Critical Alerts
- API response time > 5s
- Database connections > 80%
- Memory usage > 90%
- Disk space < 10%

### Warning Alerts
- API response time > 1s
- Error rate > 5%
- Database slow queries
- High CPU usage

## 📞 Support

### Health Check Endpoints
- `GET /health` - Overall system health
- `GET /health/detailed` - Detailed component status
- `GET /metrics` - Prometheus metrics

### Debug Information
```bash
# Container resource usage
docker stats

# Application logs
docker-compose -f docker-compose.production.yml logs -f harmony-api

# System information
docker-compose -f docker-compose.production.yml exec harmony-api node healthcheck.js
```

### Emergency Procedures
```bash
# Emergency stop
docker-compose -f docker-compose.production.yml down

# Emergency restart
docker-compose -f docker-compose.production.yml restart

# Rollback to previous version
docker tag harmony-sparc:previous harmony-sparc:production
docker-compose -f docker-compose.production.yml up -d harmony-api
```

---

For additional support, please refer to the project documentation or contact the development team.