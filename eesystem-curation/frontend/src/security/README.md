# EESystem Security Framework

A comprehensive security framework implementing enterprise-grade security controls for the EESystem Content Curation Platform.

## 🔒 Overview

This security framework provides:

- **AES-256 Encryption** for sensitive data
- **Credential Management** with secure storage and rotation
- **Security Middleware** with XSS/SQL injection protection
- **Audit Logging** for compliance and monitoring
- **GDPR Compliance** tools and data subject rights
- **Real-time Security Monitoring** with threat detection
- **Railway Integration** with secure deployment configurations

## 🏗️ Architecture

```
src/security/
├── encryption/
│   ├── crypto-manager.ts      # AES-256 encryption core
│   └── env-encryption.ts      # Environment variable encryption
├── credentials/
│   └── credential-manager.ts  # Secure credential storage
├── middleware/
│   └── security-middleware.ts # Input validation & security headers
├── audit/
│   └── audit-logger.ts        # Compliance audit logging
├── compliance/
│   └── gdpr-compliance.ts     # GDPR tools and reporting
├── monitoring/
│   └── security-monitor.ts    # Real-time threat monitoring
├── railway/
│   └── railway-security.ts    # Railway deployment security
├── testing/
│   └── security-tests.ts      # Automated security testing
├── security-context.tsx      # React security context
├── secure-api-service.ts     # Security-enhanced API client
└── README.md                 # This documentation
```

## 🚀 Quick Start

### 1. Initialize Security Framework

```typescript
import { SecurityProvider } from './security/security-context'

// Wrap your app with security context
function App() {
  return (
    <SecurityProvider>
      <YourAppComponents />
    </SecurityProvider>
  )
}
```

### 2. Initialize Security Components

```typescript
import { useSecurity } from './security/security-context'

function SecurityInit() {
  const { initializeSecurity } = useSecurity()
  
  useEffect(() => {
    // Initialize with master password (from secure input)
    initializeSecurity('your-secure-master-password')
  }, [])
}
```

### 3. Use Secure API Service

```typescript
import { secureApiService } from './security/secure-api-service'

// All requests are automatically secured
const userData = await secureApiService.get('/api/user/profile')
const result = await secureApiService.post('/api/data', sensitiveData)
```

## 🔐 Core Security Features

### Encryption System

**AES-256-GCM encryption** with key derivation and secure storage:

```typescript
import { cryptoManager } from './security/encryption/crypto-manager'

// Initialize encryption
await cryptoManager.initializeMasterKey('secure-password')

// Encrypt sensitive data
const encrypted = await cryptoManager.encryptData('sensitive-information')

// Decrypt when needed
const decrypted = await cryptoManager.decryptData(encrypted)
```

**Environment Variable Encryption:**

```typescript
import { envEncryption } from './security/encryption/env-encryption'

// Store encrypted environment variables
await envEncryption.setSecureEnv('API_KEY', 'sk-real-key', 'api_key')

// Retrieve at runtime
const apiKey = await envEncryption.getSecureEnv('API_KEY')
```

### Credential Management

**Secure credential storage** with access controls and audit trails:

```typescript
import { credentialManager } from './security/credentials/credential-manager'

// Store credentials securely
const credentialId = await credentialManager.storeCredential(
  'OpenAI API Key',
  'api_key',
  'sk-actual-key-value',
  {
    provider: 'openai',
    environment: 'production',
    permissions: ['read', 'use'],
    tags: ['ai', 'api'],
    owner: 'system'
  }
)

// Retrieve for use (with audit logging)
const apiKey = await credentialManager.getCredentialValue(
  credentialId, 
  'user-id', 
  'ai-content-generation'
)
```

### Security Middleware

**Comprehensive input validation** and attack prevention:

```typescript
import { securityMiddleware } from './security/middleware/security-middleware'

// Validate and sanitize input
const validation = securityMiddleware.validateInput(userData, [
  { field: 'email', type: 'email', required: true, sanitize: true },
  { field: 'content', type: 'string', required: true, maxLength: 1000, sanitize: true }
])

if (!validation.isValid) {
  throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
}

// Use sanitized data
const safeData = validation.sanitizedData
```

**Rate limiting:**

```typescript
const rateLimitResult = securityMiddleware.checkRateLimit('user-id', {
  windowMs: 60000,  // 1 minute
  maxRequests: 100,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.user.id
})

if (!rateLimitResult.allowed) {
  throw new Error('Rate limit exceeded')
}
```

### Audit Logging

**Comprehensive audit trails** for compliance:

```typescript
import { auditLogger } from './security/audit/audit-logger'

// Log security events
await auditLogger.log({
  event: 'user_login',
  userId: 'user-123',
  resourceType: 'authentication',
  details: {
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    success: true
  }
})

// Query audit logs
const logs = await auditLogger.queryLogs({
  userId: 'user-123',
  startDate: new Date('2023-01-01'),
  event: 'user_login'
})

// Generate compliance report
const report = await auditLogger.generateComplianceReport(
  new Date('2023-01-01'),
  new Date('2023-12-31')
)
```

### GDPR Compliance

**Data subject rights** and privacy controls:

```typescript
import { gdprCompliance } from './security/compliance/gdpr-compliance'

// Register data subject with consents
const subjectId = await gdprCompliance.registerDataSubject(
  'user@example.com',
  'John Doe',
  [{
    purpose: 'marketing',
    granted: true,
    grantedAt: new Date(),
    lawfulBasis: 'consent',
    consentType: 'explicit'
  }]
)

// Handle data access request
const requestId = await gdprCompliance.handleAccessRequest(
  subjectId,
  'access',
  'email'
)

// Report data breach
const incidentId = await gdprCompliance.reportDataBreach(
  'Unauthorized access to user data',
  'high',
  ['personal_data', 'contact_info'],
  150
)
```

### Security Monitoring

**Real-time threat detection** and alerting:

```typescript
import { securityMonitor } from './security/monitoring/security-monitor'

// Initialize monitoring
await securityMonitor.initialize()

// Get security dashboard
const dashboard = await securityMonitor.getSecurityDashboard()

// Custom monitoring rules
const ruleId = await securityMonitor.addMonitoringRule({
  name: 'Suspicious Login Activity',
  conditions: [
    { metric: 'authenticationFailures', operator: '>', value: 5, timeWindow: 300000 }
  ],
  actions: [
    { type: 'alert', parameters: { severity: 'high' } },
    { type: 'block', parameters: { duration: 3600000 } }
  ]
})
```

## 🚀 Railway Deployment Security

### Secure Configuration

```typescript
import { railwaySecurityManager } from './security/railway/railway-security'

// Initialize Railway security
await railwaySecurityManager.initialize('project-id', 'production')

// Generate secure deployment configuration
const deploymentSecrets = await railwaySecurityManager.generateDeploymentSecrets()
const railwayConfig = railwaySecurityManager.generateRailwayConfig()
```

### Environment Variables

For Railway deployment, set these environment variables:

```bash
# Security Configuration
SECURITY_ENCRYPTION_ENABLED=true
SECURITY_AUDIT_ENABLED=true
SECURITY_GDPR_ENABLED=true

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Authentication
AUTH_TOKEN_EXPIRY=3600000
AUTH_MAX_LOGIN_ATTEMPTS=5
AUTH_MFA_REQUIRED=true

# Encrypted secrets (generated by security framework)
ENCRYPTED_OPENAI_API_KEY={"ciphertext":"...","salt":"...","iv":"..."}
ENCRYPTED_DATABASE_URL={"ciphertext":"...","salt":"...","iv":"..."}
```

### Dockerfile Security

The framework generates a security-hardened Dockerfile:

```dockerfile
# Multi-stage build for security
FROM node:18-alpine AS builder

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S eesystem -u 1001

# Security: Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Security: Switch to non-root user
USER eesystem

# Security: Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js
```

## 🧪 Security Testing

### Automated Security Tests

```typescript
import { securityTestRunner } from './security/testing/security-tests'

// Run all security tests
const testResults = await securityTestRunner.runAllTests()

// Run specific test suite
const encryptionTests = await securityTestRunner.runTestSuite('encryption')

// Check test coverage
const coverage = testResults.reduce((sum, suite) => sum + suite.coverage, 0) / testResults.length
```

### Test Suites

The framework includes comprehensive test suites:

- **Encryption Tests**: AES-256, key derivation, HMAC
- **Authentication Tests**: Token validation, rate limiting
- **Input Validation Tests**: XSS detection, SQL injection, sanitization
- **Rate Limiting Tests**: Brute force protection
- **Audit Tests**: Log creation, filtering, compliance
- **Credential Tests**: Secure storage, retrieval
- **GDPR Tests**: Data subject rights, consent management
- **Monitoring Tests**: Real-time alerts, threat detection
- **Penetration Tests**: Security violation scenarios

## 🔧 Configuration

### Security Configuration

```typescript
import { securityConfig } from './config/security-config'

// Update security settings
securityConfig.updateConfig({
  authentication: {
    tokenExpiry: 7200000, // 2 hours
    requireMFA: true,
    passwordMinLength: 14
  },
  rateLimiting: {
    enabled: true,
    requests: { windowMs: 60000, max: 200 }
  }
})

// Environment-specific configuration
securityConfig.applyEnvironmentConfig()
```

### Environment-Specific Settings

**Production:**
- MFA required
- Strict rate limiting
- Full audit logging
- Real-time monitoring
- HTTPS enforcement

**Staging:**
- Reduced rate limiting
- Full audit logging
- Monitoring alerts disabled

**Development:**
- MFA optional
- Rate limiting disabled
- Minimal audit logging
- Debug mode enabled

## 📊 Security Metrics

### Key Performance Indicators

- **Encryption Coverage**: 100% of sensitive data
- **Audit Coverage**: All security events logged
- **Compliance Score**: GDPR compliance rating
- **Threat Detection**: Real-time monitoring active
- **Test Coverage**: 95%+ security test coverage

### Monitoring Dashboard

Access security metrics through the dashboard:

```typescript
const dashboard = await securityMonitor.getSecurityDashboard()

console.log({
  activeThreats: dashboard.criticalAlerts,
  systemStatus: dashboard.systemStatus,
  complianceScore: dashboard.complianceScore,
  encryptionStatus: dashboard.encryptionActive
})
```

## 🚨 Incident Response

### Security Incident Workflow

1. **Detection**: Automated monitoring alerts
2. **Assessment**: Analyze threat severity
3. **Containment**: Automatic IP blocking, rate limiting
4. **Investigation**: Detailed audit trail analysis
5. **Recovery**: System restoration procedures
6. **Lessons Learned**: Update security policies

### Breach Notification

```typescript
// Report security incident
const incidentId = await gdprCompliance.reportDataBreach(
  'Unauthorized API access detected',
  'high',
  ['user_data', 'api_keys'],
  75 // affected subjects
)

// Automatic authority notification for high-severity incidents
// Automatic user notification if required
```

## 🔗 Integration Examples

### With Existing Auth System

```typescript
// Enhanced auth context with security
import { useAuth } from './contexts/AuthContext'
import { useSecurity } from './security/security-context'

function useSecureAuth() {
  const auth = useAuth()
  const security = useSecurity()
  
  const secureLogin = async (email: string, password: string) => {
    // Validate input
    const validation = security.validateInput({ email, password }, [
      { field: 'email', type: 'email', required: true },
      { field: 'password', type: 'string', required: true, minLength: 8 }
    ])
    
    if (!validation.isValid) {
      throw new Error('Invalid input')
    }
    
    // Check rate limiting
    const rateLimit = security.checkRateLimit(`login:${email}`, {
      windowMs: 900000, // 15 minutes
      maxRequests: 5
    })
    
    if (!rateLimit.allowed) {
      throw new Error('Too many login attempts')
    }
    
    // Proceed with login
    await auth.login(email, password)
    
    // Log successful login
    await security.logSecurityEvent({
      event: 'user_login_success',
      userId: auth.user?.id,
      details: { email, timestamp: new Date() }
    })
  }
  
  return { ...auth, secureLogin }
}
```

### With API Service

```typescript
// Replace existing API service
import { secureApiService } from './security/secure-api-service'

// All existing API calls automatically get:
// - Request encryption for sensitive endpoints
// - Input validation and sanitization  
// - Rate limiting
// - Audit logging
// - Error handling with security context

class EnhancedApiService {
  async getBrands() {
    return await secureApiService.get('/brands')
  }
  
  async createContent(content: any) {
    // Automatically validated, sanitized, and encrypted
    return await secureApiService.post('/content', content)
  }
}
```

## 📋 Compliance Checklist

### GDPR Compliance

- ✅ Data subject registration
- ✅ Consent management
- ✅ Right to access (data export)
- ✅ Right to rectification
- ✅ Right to erasure (right to be forgotten)
- ✅ Data breach notification
- ✅ Privacy by design
- ✅ Audit trails

### Security Standards

- ✅ AES-256 encryption
- ✅ Secure key management
- ✅ Input validation & sanitization
- ✅ Rate limiting & DDoS protection
- ✅ Security headers (CSP, HSTS, etc.)
- ✅ Audit logging
- ✅ Real-time monitoring
- ✅ Penetration testing
- ✅ Incident response procedures

### Railway Security

- ✅ Multi-stage Docker builds
- ✅ Non-root container users
- ✅ Environment variable encryption
- ✅ Network security policies
- ✅ Health checks
- ✅ Resource limits
- ✅ Graceful shutdowns

## 🆘 Support

### Common Issues

**Q: Encryption initialization fails**
A: Ensure master password is properly set and crypto-js is installed

**Q: Rate limiting too strict**
A: Adjust rate limit configuration in security config

**Q: GDPR compliance setup**
A: Follow the data subject registration and consent workflow

### Security Contact

For security vulnerabilities or questions:
- Email: security@eesystem.app
- Response time: 24-48 hours
- PGP key available for sensitive reports

## 🔄 Updates

Keep the security framework updated:

```bash
npm update crypto-js @types/crypto-js
```

Regular security reviews and updates are recommended quarterly.

---

## 📜 License

This security framework is part of the EESystem Content Curation Platform and follows the same licensing terms.