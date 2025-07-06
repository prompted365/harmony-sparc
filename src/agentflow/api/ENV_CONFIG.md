# AgentFlow API Environment Configuration

## Overview

The AgentFlow API uses environment variables for configuration across different deployment environments. This document describes the configuration structure and setup process.

## Environment Files

### Development
- `.env` - Default development configuration
- `.env.local` - Local overrides (not committed to git)

### Production
- `.env.production` - Production configuration with sensitive values (not committed to git)
- `.env.production.example` - Template for production configuration (safe to commit)

### Staging
- `.env.staging` - Staging environment configuration

## Setup Instructions

### 1. Create Environment File

For production deployment:
```bash
cp .env.production.example .env.production
```

### 2. Configure Required Variables

#### Critical Variables (Must Configure)

1. **API Keys**
   - `API_KEY_OPENAI` - OpenAI API key for AI operations
   - `API_KEY_ANTHROPIC` - Anthropic API key (if using Claude)

2. **Database Connections**
   - `DATABASE_URL` - PostgreSQL connection string
   - `REDIS_URL` - Redis connection string

3. **Security Keys**
   - `JWT_SECRET` - JWT signing secret (minimum 32 characters)
   - `ENCRYPTION_KEY` - AES-256 encryption key (32 bytes)
   - `SESSION_SECRET` - Session cookie secret

4. **Blockchain Configuration**
   - `INFURA_PROJECT_ID` - Infura project ID for Web3
   - `ALCHEMY_API_KEY` - Alchemy API key (backup provider)

## Configuration Categories

### Server Configuration
- Basic server settings (port, host, environment)
- Performance tuning (TPS, timeouts, limits)
- Worker/cluster configuration

### Database Configuration
- PostgreSQL settings with connection pooling
- Redis configuration with cluster/sentinel support
- SSL/TLS settings for secure connections

### Authentication & Security
- JWT configuration with expiry settings
- API key management with prefixes
- Session security settings
- Encryption configuration

### Blockchain Integration
- Multiple RPC endpoints for redundancy
- Contract addresses for tokens
- Gas price and limit settings
- Network selection (mainnet/testnet)

### Monitoring & Logging
- Metrics endpoints (Prometheus, Grafana)
- Log aggregation settings
- APM integration (Datadog, Elastic)
- Performance monitoring

### External Services
- Microservice URLs
- Third-party API endpoints
- Service discovery configuration

### Feature Flags
- Module enable/disable switches
- Feature rollout controls

## Security Best Practices

1. **Never commit production .env files**
   - Use `.env.production.example` as a template
   - Store actual values in secure secret management

2. **Use strong secrets**
   - JWT_SECRET: minimum 32 characters
   - ENCRYPTION_KEY: exactly 32 bytes
   - Generate using: `openssl rand -hex 32`

3. **Rotate keys regularly**
   - API keys should be rotated monthly
   - JWT secrets should be rotated quarterly
   - Keep previous keys for grace period

4. **Environment isolation**
   - Use different databases for each environment
   - Separate Redis instances per environment
   - Unique secrets per environment

## Validation

The application validates configuration on startup:
- Port numbers must be valid (1-65535)
- Required variables must be present
- Connection strings must be valid
- Rate limits must be positive

## Kubernetes/Docker

For containerized deployments:
1. Use ConfigMaps for non-sensitive values
2. Use Secrets for sensitive values
3. Mount as environment variables
4. Use sealed-secrets for GitOps

Example:
```yaml
envFrom:
  - configMapRef:
      name: agentflow-config
  - secretRef:
      name: agentflow-secrets
```

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check DATABASE_URL format
   - Verify network connectivity
   - Ensure SSL certificates are valid

2. **Redis connection error**
   - Verify REDIS_URL format
   - Check authentication settings
   - Confirm cluster/sentinel configuration

3. **JWT errors**
   - Ensure JWT_SECRET is consistent
   - Check token expiry settings
   - Verify algorithm matches

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug
LOG_PRETTY_PRINT=true
```

## References

- [12-Factor App Configuration](https://12factor.net/config)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Environment Variable Security](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_environment_variables)