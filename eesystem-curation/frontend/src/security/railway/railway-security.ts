import { envEncryption } from '../encryption/env-encryption'
import { auditLogger } from '../audit/audit-logger'
import { securityConfig } from '../../config/security-config'

export interface RailwaySecurityConfig {
  projectId: string
  environment: 'development' | 'staging' | 'production'
  networkSecurity: {
    privateNetworking: boolean
    httpsSecurity: boolean
    customDomains: string[]
  }
  deploymentSecurity: {
    healthchecks: boolean
    gracefulShutdown: boolean
    resourceLimits: {
      memory: string
      cpu: string
    }
  }
  secretsManagement: {
    encrypted: boolean
    rotationEnabled: boolean
    accessControls: boolean
  }
}

export interface RailwayDeploymentSecurity {
  buildSecrets: Record<string, string>
  runtimeSecrets: Record<string, string>
  networkPolicies: string[]
  accessControls: {
    allowedIPs: string[]
    restrictedEndpoints: string[]
  }
}

export class RailwaySecurityManager {
  private static instance: RailwaySecurityManager
  private config: RailwaySecurityConfig | null = null

  static getInstance(): RailwaySecurityManager {
    if (!RailwaySecurityManager.instance) {
      RailwaySecurityManager.instance = new RailwaySecurityManager()
    }
    return RailwaySecurityManager.instance
  }

  /**
   * Initialize Railway security configuration
   */
  async initialize(projectId: string, environment: RailwaySecurityConfig['environment']): Promise<void> {
    this.config = {
      projectId,
      environment,
      networkSecurity: {
        privateNetworking: environment === 'production',
        httpsSecurity: true,
        customDomains: []
      },
      deploymentSecurity: {
        healthchecks: true,
        gracefulShutdown: true,
        resourceLimits: {
          memory: environment === 'production' ? '2GB' : '1GB',
          cpu: environment === 'production' ? '2' : '1'
        }
      },
      secretsManagement: {
        encrypted: true,
        rotationEnabled: environment === 'production',
        accessControls: true
      }
    }

    await auditLogger.log({
      event: 'railway_security_initialized',
      userId: 'system',
      resourceType: 'railway_security',
      details: {
        projectId,
        environment,
        timestamp: new Date()
      }
    })
  }

  /**
   * Generate secure environment variables for Railway deployment
   */
  async generateDeploymentSecrets(): Promise<RailwayDeploymentSecurity> {
    if (!this.config) {
      throw new Error('Railway security not initialized')
    }

    const secureConfig = securityConfig.getConfig()
    
    // Build secrets (available during build time)
    const buildSecrets: Record<string, string> = {
      NODE_ENV: this.config.environment,
      RAILWAY_ENVIRONMENT: this.config.environment,
      BUILD_TIMESTAMP: new Date().toISOString()
    }

    // Runtime secrets (available during runtime)
    const runtimeSecrets: Record<string, string> = {
      // Security configuration
      SECURITY_ENCRYPTION_ENABLED: secureConfig.dataProtection.encryptionAtRest.toString(),
      SECURITY_AUDIT_ENABLED: secureConfig.compliance.auditLogging.toString(),
      SECURITY_GDPR_ENABLED: secureConfig.compliance.gdprEnabled.toString(),
      
      // Rate limiting
      RATE_LIMIT_ENABLED: secureConfig.rateLimiting.enabled.toString(),
      RATE_LIMIT_REQUESTS_MAX: secureConfig.rateLimiting.requests.max.toString(),
      RATE_LIMIT_WINDOW_MS: secureConfig.rateLimiting.requests.windowMs.toString(),
      
      // Security headers
      CSP_ENABLED: secureConfig.headers.contentSecurityPolicy.toString(),
      HSTS_ENABLED: secureConfig.headers.hstsEnabled.toString(),
      
      // Authentication
      AUTH_TOKEN_EXPIRY: secureConfig.authentication.tokenExpiry.toString(),
      AUTH_MAX_LOGIN_ATTEMPTS: secureConfig.authentication.maxLoginAttempts.toString(),
      AUTH_MFA_REQUIRED: secureConfig.authentication.requireMFA.toString()
    }

    // Add encrypted environment variables
    const encryptedEnvs = await envEncryption.generateRailwayEnvs()
    Object.assign(runtimeSecrets, encryptedEnvs)

    // Network policies for Railway
    const networkPolicies = [
      'allow-https-only',
      'block-direct-ip-access',
      'enable-cors-security'
    ]

    // Access controls
    const accessControls = {
      allowedIPs: this.config.environment === 'production' ? [] : ['0.0.0.0/0'],
      restrictedEndpoints: [
        '/admin/*',
        '/api/system/*',
        '/api/security/*',
        '/.well-known/security.txt'
      ]
    }

    return {
      buildSecrets,
      runtimeSecrets,
      networkPolicies,
      accessControls
    }
  }

  /**
   * Generate Railway Dockerfile with security
   */
  generateSecureDockerfile(): string {
    return `# Multi-stage build for security
FROM node:18-alpine AS builder

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S eesystem -u 1001

# Security: Set working directory
WORKDIR /app

# Security: Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Security: Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Security: Copy source code
COPY . .

# Security: Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

# Security: Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S eesystem -u 1001

# Security: Set working directory
WORKDIR /app

# Security: Copy built application
COPY --from=builder --chown=eesystem:nodejs /app/dist ./dist
COPY --from=builder --chown=eesystem:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=eesystem:nodejs /app/package.json ./package.json

# Security: Switch to non-root user
USER eesystem

# Security: Expose port
EXPOSE 3000

# Security: Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node healthcheck.js

# Security: Use dumb-init and run application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]`
  }

  /**
   * Generate Railway configuration file
   */
  generateRailwayConfig(): any {
    if (!this.config) {
      throw new Error('Railway security not initialized')
    }

    return {
      $schema: 'https://railway.app/railway.schema.json',
      build: {
        builder: 'nixpacks',
        buildCommand: 'npm run build',
      },
      deploy: {
        startCommand: 'npm start',
        healthcheckPath: '/health',
        healthcheckTimeout: 30,
        restartPolicyType: 'on_failure',
        restartPolicyMaxRetries: 3,
      },
      environments: {
        [this.config.environment]: {
          variables: this.getEnvironmentVariables(),
          domains: this.config.networkSecurity.customDomains,
        }
      },
      networking: {
        internalUrl: this.config.networkSecurity.privateNetworking,
        externalUrl: this.config.networkSecurity.httpsSecurity,
      },
      resources: {
        memory: this.config.deploymentSecurity.resourceLimits.memory,
        cpu: this.config.deploymentSecurity.resourceLimits.cpu,
      },
      security: {
        allowedIPs: [],
        blockedIPs: [],
        rateLimiting: {
          enabled: true,
          requestsPerMinute: 100,
        },
        headers: {
          contentSecurityPolicy: true,
          xFrameOptions: 'DENY',
          xContentTypeOptions: 'nosniff',
          referrerPolicy: 'strict-origin-when-cross-origin',
          hstsMaxAge: 31536000,
        }
      }
    }
  }

  /**
   * Get environment-specific variables
   */
  private getEnvironmentVariables(): Record<string, string> {
    const baseVars = {
      NODE_ENV: this.config!.environment,
      PORT: '3000',
      RAILWAY_ENVIRONMENT: this.config!.environment,
    }

    switch (this.config!.environment) {
      case 'production':
        return {
          ...baseVars,
          LOG_LEVEL: 'info',
          SECURITY_STRICT_MODE: 'true',
          AUDIT_ENABLED: 'true',
          RATE_LIMITING_ENABLED: 'true',
        }
      case 'staging':
        return {
          ...baseVars,
          LOG_LEVEL: 'debug',
          SECURITY_STRICT_MODE: 'true',
          AUDIT_ENABLED: 'true',
          RATE_LIMITING_ENABLED: 'false',
        }
      case 'development':
        return {
          ...baseVars,
          LOG_LEVEL: 'debug',
          SECURITY_STRICT_MODE: 'false',
          AUDIT_ENABLED: 'false',
          RATE_LIMITING_ENABLED: 'false',
        }
      default:
        return baseVars
    }
  }

  /**
   * Generate security.txt file for responsible disclosure
   */
  generateSecurityTxt(): string {
    return `# Security Policy
Contact: security@eesystem.app
Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}
Encryption: https://keys.openpgp.org/search?q=security@eesystem.app
Acknowledgments: https://eesystem.app/security/acknowledgments
Policy: https://eesystem.app/security/policy
Hiring: https://eesystem.app/careers

# Vulnerability Disclosure
Please report security vulnerabilities to security@eesystem.app
Use PGP encryption for sensitive reports
Expected response time: 24-48 hours
Coordinated disclosure timeframe: 90 days

# Scope
This policy applies to:
- https://eesystem.app
- https://api.eesystem.app
- https://admin.eesystem.app

Out of scope:
- Third-party integrations
- Physical security
- Social engineering

# Safe Harbor
We support safe harbor for security researchers acting in good faith
No legal action will be taken for vulnerability research conducted within policy guidelines`
  }

  /**
   * Generate nginx configuration for Railway
   */
  generateNginxConfig(): string {
    return `# Security-hardened nginx configuration for Railway
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
    
    # Hide nginx version
    server_tokens off;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_req_zone $binary_remote_addr zone=general:10m rate=200r/m;
    
    # Client body size limit
    client_max_body_size 10M;
    
    # Timeout configurations
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;
    
    # Buffer size limitations
    client_body_buffer_size 1K;
    client_header_buffer_size 1k;
    large_client_header_buffers 2 1k;
    
    # Static file security
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff";
    }
    
    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Auth endpoints with stricter rate limiting
    location /api/auth/ {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Security endpoints (restricted)
    location /api/security/ {
        deny all;
        return 404;
    }
    
    # Admin endpoints (restricted to specific IPs)
    location /admin/ {
        # allow 10.0.0.0/8;    # Replace with actual admin IPs
        # deny all;
        limit_req zone=general burst=10 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check
    location /health {
        access_log off;
        proxy_pass http://localhost:3000;
    }
    
    # Security.txt
    location = /.well-known/security.txt {
        return 200 "${this.generateSecurityTxt()}";
        add_header Content-Type "text/plain";
    }
    
    # Block access to sensitive files
    location ~ /\\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ \\.(env|log|conf)$ {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Default location
    location / {
        limit_req zone=general burst=50 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`
  }

  /**
   * Validate Railway deployment security
   */
  async validateDeploymentSecurity(): Promise<{ isValid: boolean; issues: string[]; recommendations: string[] }> {
    const issues: string[] = []
    const recommendations: string[] = []

    if (!this.config) {
      issues.push('Railway security configuration not initialized')
      return { isValid: false, issues, recommendations }
    }

    // Check HTTPS enforcement
    if (!this.config.networkSecurity.httpsSecurity) {
      issues.push('HTTPS security is not enabled')
      recommendations.push('Enable HTTPS-only access in production')
    }

    // Check resource limits
    if (this.config.environment === 'production') {
      if (this.config.deploymentSecurity.resourceLimits.memory === '1GB') {
        recommendations.push('Consider increasing memory allocation for production')
      }
    }

    // Check secrets management
    if (!this.config.secretsManagement.encrypted) {
      issues.push('Secrets encryption is not enabled')
      recommendations.push('Enable encryption for all sensitive configuration')
    }

    // Check health checks
    if (!this.config.deploymentSecurity.healthchecks) {
      issues.push('Health checks are not configured')
      recommendations.push('Configure health checks for better reliability')
    }

    await auditLogger.log({
      event: 'railway_security_validation',
      userId: 'system',
      resourceType: 'railway_security',
      details: {
        isValid: issues.length === 0,
        issuesCount: issues.length,
        recommendationsCount: recommendations.length
      }
    })

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    }
  }

  /**
   * Get Railway security status
   */
  getSecurityStatus(): any {
    return {
      initialized: !!this.config,
      environment: this.config?.environment,
      networkSecurity: this.config?.networkSecurity,
      secretsManagement: this.config?.secretsManagement,
      lastValidation: new Date()
    }
  }
}

export const railwaySecurityManager = RailwaySecurityManager.getInstance()