// Security Framework Main Exports
export { SecurityProvider, useSecurity } from './security-context'
export { secureApiService } from './secure-api-service'

// Encryption
export { cryptoManager } from './encryption/crypto-manager'
export { envEncryption } from './encryption/env-encryption'

// Credentials
export { credentialManager } from './credentials/credential-manager'

// Middleware
export { securityMiddleware } from './middleware/security-middleware'

// Audit & Compliance
export { auditLogger } from './audit/audit-logger'
export { gdprCompliance } from './compliance/gdpr-compliance'

// Monitoring
export { securityMonitor } from './monitoring/security-monitor'

// Railway Integration
export { railwaySecurityManager } from './railway/railway-security'

// Testing
export { securityTestRunner } from './testing/security-tests'

// Configuration
export { securityConfig } from '../config/security-config'

// Types
export type { SecurityConfig } from '../config/security-config'
export type { AuditEvent, AuditFilter } from './audit/audit-logger'
export type { Credential, CredentialMetadata } from './credentials/credential-manager'
export type { SecurityAlert, SecurityMetrics } from './monitoring/security-monitor'
export type { SecurityTestResult, SecurityTestSuite } from './testing/security-tests'