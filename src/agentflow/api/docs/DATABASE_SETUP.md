# AgentFlow Database Services Setup

This document describes the PostgreSQL and Redis setup for the AgentFlow API.

## Overview

The database services are configured using Docker Compose to provide:
- **PostgreSQL 16**: Primary relational database for storing agents, workflows, tasks, and metrics
- **Redis 7**: In-memory cache and message broker for performance optimization
- **pgAdmin**: Web-based PostgreSQL administration tool (optional)
- **Redis Commander**: Web-based Redis management interface (optional)

## Quick Start

### 1. Start Services

```bash
# Start core services (PostgreSQL and Redis only)
./scripts/start-services.sh

# Start with admin UIs
./scripts/start-services.sh start --with-admin
```

### 2. Check Service Health

```bash
./scripts/check-services.sh
```

### 3. Stop Services

```bash
./scripts/start-services.sh stop
```

## Configuration

### Environment Variables

Copy `.env.production` to `.env` and update the following:

```bash
# PostgreSQL
DB_HOST=localhost
DB_PORT=5433
DB_NAME=agentflow
DB_USER=agentflow_user
DB_PASSWORD=supersecret123  # Change this!

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=redissecret123  # Change this!
```

### Port Assignments

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5433 | Database server (mapped from container port 5432) |
| Redis | 6380 | Cache/message broker (mapped from container port 6379) |
| pgAdmin | 5050 | PostgreSQL admin UI (optional) |
| Redis Commander | 8081 | Redis admin UI (optional) |

## Database Schema

The PostgreSQL database includes the following schemas:

### agentflow schema
- `agents`: Agent definitions and status
- `workflows`: Workflow configurations
- `tasks`: Task queue and execution history
- `financial_metrics`: Financial performance data
- `qudag_operations`: Quantum DAG operations log

### metrics schema
- `performance_metrics`: API performance tracking

### logs schema
- `request_logs`: API request logging

## Data Persistence

- PostgreSQL data: Stored in Docker volume `postgres_data`
- Redis data: Stored in Docker volume `redis_data` with AOF persistence

## Health Checks

Both services include health checks that ensure they're ready before marking as healthy:

- **PostgreSQL**: Uses `pg_isready` command
- **Redis**: Uses `redis-cli ping` command

## Connection Examples

### Node.js with pg

```javascript
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5433,
  database: 'agentflow',
  user: 'agentflow_user',
  password: 'supersecret123'
});

await client.connect();
```

### Node.js with Redis

```javascript
const redis = require('redis');

const client = redis.createClient({
  socket: {
    host: 'localhost',
    port: 6380
  },
  password: 'redissecret123'
});

await client.connect();
```

## Monitoring and Administration

### PostgreSQL Monitoring

Access pgAdmin at http://localhost:5050 (when started with `--with-admin`):
- Email: admin@agentflow.ai
- Password: pgadmin123

### Redis Monitoring

Access Redis Commander at http://localhost:8081 (when started with `--with-admin`)

### Docker Logs

```bash
# View all service logs
./scripts/start-services.sh logs

# View specific service logs
./scripts/start-services.sh logs postgres
./scripts/start-services.sh logs redis
```

## Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

1. Check what's using the port:
   ```bash
   lsof -i :5433  # PostgreSQL
   lsof -i :6380  # Redis
   ```

2. Either stop the conflicting service or change the port in `docker-compose.production.yml`

### Connection Refused

1. Ensure services are running:
   ```bash
   ./scripts/start-services.sh status
   ```

2. Check service logs:
   ```bash
   ./scripts/start-services.sh logs
   ```

3. Verify credentials in `.env` match those in `docker-compose.production.yml`

### Performance Tuning

The default configuration is optimized for development. For production:

1. Increase PostgreSQL connection pool size in `.env`
2. Adjust Redis maxmemory policy based on workload
3. Enable SSL/TLS for both services
4. Configure proper backup strategies

## Security Considerations

Before deploying to production:

1. **Change all default passwords** in `.env`
2. **Enable SSL/TLS** for both PostgreSQL and Redis
3. **Restrict network access** using Docker networks
4. **Enable authentication** for all admin interfaces
5. **Configure proper firewall rules**
6. **Set up regular backups**

## Maintenance

### Backup PostgreSQL

```bash
docker exec agentflow-postgres pg_dump -U agentflow_user agentflow > backup.sql
```

### Backup Redis

```bash
docker exec agentflow-redis redis-cli --auth redissecret123 BGSAVE
```

### Update Services

To update to newer versions:

1. Update image tags in `docker-compose.production.yml`
2. Run `./scripts/start-services.sh restart`