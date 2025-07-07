# EESystem Content Curation Platform - Settings System Architecture

## Overview
Comprehensive settings system architecture for the EESystem Content Curation Platform, designed to provide secure environment management, authentication enhancement, and seamless Railway deployment integration.

## Current Structure Analysis

### Frontend (React TypeScript)
- **Framework**: React 19.1.0 with TypeScript
- **State Management**: Context API (AuthContext, WebSocketContext)
- **UI Components**: Radix UI primitives with Tailwind CSS
- **Authentication**: Basic JWT token storage in localStorage
- **API Layer**: Axios-based service with interceptors
- **Router**: React Router DOM v7

### Backend (FastAPI)
- **Framework**: FastAPI with async/await
- **Database**: SQLite (development) → AstraDB (production)
- **Authentication**: Placeholder OAuth2 implementation
- **Configuration**: Pydantic Settings with environment variables
- **API Structure**: Versioned endpoints (/api/v1)

### Current Limitations
1. **Security**: Basic auth implementation without proper JWT handling
2. **Environment Management**: No UI for environment variable management
3. **Database**: No AstraDB integration implementation
4. **Role-Based Access**: No RBAC system
5. **Settings UI**: Empty settings component folder

## 1. Settings Page Architecture

### 1.1 Component Structure
```
src/components/settings/
├── SettingsLayout.tsx          # Main settings layout with navigation
├── GeneralSettings.tsx         # General app preferences
├── SecuritySettings.tsx        # Security and authentication
├── EnvironmentSettings.tsx     # Environment variables management
├── DatabaseSettings.tsx        # AstraDB configuration
├── DeploymentSettings.tsx      # Railway deployment configuration
├── UserManagement.tsx          # User and role management
├── APISettings.tsx             # API keys and external integrations
├── NotificationSettings.tsx    # Notification preferences
└── SettingsProvider.tsx        # Settings context provider
```

### 1.2 Settings Data Model
```typescript
interface SettingsState {
  general: GeneralSettings
  security: SecuritySettings
  environment: EnvironmentSettings
  database: DatabaseSettings
  deployment: DeploymentSettings
  notifications: NotificationSettings
  api: APISettings
}

interface GeneralSettings {
  appName: string
  theme: 'light' | 'dark' | 'system'
  language: string
  timezone: string
  dateFormat: string
  autoSave: boolean
  sessionTimeout: number
}

interface SecuritySettings {
  jwtSettings: JWTSettings
  passwordPolicy: PasswordPolicy
  twoFactorAuth: TwoFactorSettings
  sessionManagement: SessionSettings
  auditLog: AuditLogSettings
}

interface EnvironmentSettings {
  variables: EnvironmentVariable[]
  secretKeys: SecretKey[]
  configValidation: ValidationRule[]
}

interface DatabaseSettings {
  provider: 'sqlite' | 'astradb'
  astraDb: AstraDBConfig
  connectionTest: ConnectionStatus
  performanceMonitoring: PerformanceConfig
}

interface DeploymentSettings {
  railway: RailwayConfig
  buildSettings: BuildConfig
  healthChecks: HealthCheckConfig
  scaling: ScalingConfig
}
```

### 1.3 Settings Context Implementation
```typescript
const SettingsContext = createContext<{
  settings: SettingsState
  updateSettings: (section: keyof SettingsState, updates: Partial<any>) => Promise<void>
  validateSettings: (settings: Partial<SettingsState>) => ValidationResult
  resetSettings: (section?: keyof SettingsState) => Promise<void>
  exportSettings: () => Promise<string>
  importSettings: (data: string) => Promise<void>
}>()
```

## 2. Authentication System Enhancement

### 2.1 JWT-Based Authentication
```typescript
interface JWTPayload {
  sub: string // User ID
  email: string
  role: UserRole
  permissions: Permission[]
  exp: number
  iat: number
  jti: string // JWT ID for revocation
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresIn: number
  refreshExpiresIn: number
}
```

### 2.2 Role-Based Access Control (RBAC)
```typescript
enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  MODERATOR = 'moderator'
}

interface Permission {
  resource: string
  actions: string[]
  conditions?: PermissionCondition[]
}

interface PermissionCondition {
  field: string
  operator: 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'lt'
  value: any
}
```

### 2.3 Enhanced Auth Context
```typescript
interface AuthContextType {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
  permissions: Permission[]
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  checkPermission: (resource: string, action: string) => boolean
  updateProfile: (updates: Partial<User>) => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  enableTwoFactor: (method: '2fa' | 'sms' | 'email') => Promise<void>
  verifyTwoFactor: (token: string) => Promise<void>
}
```

### 2.4 Session Management
```typescript
interface SessionManager {
  createSession: (user: User) => Promise<Session>
  validateSession: (sessionId: string) => Promise<Session | null>
  refreshSession: (sessionId: string) => Promise<Session>
  revokeSession: (sessionId: string) => Promise<void>
  revokeAllSessions: (userId: string) => Promise<void>
  getActiveSessions: (userId: string) => Promise<Session[]>
}
```

## 3. Environment Management System

### 3.1 Environment Variable Management
```typescript
interface EnvironmentVariable {
  key: string
  value: string
  encrypted: boolean
  required: boolean
  description: string
  category: 'app' | 'database' | 'api' | 'deployment'
  validation?: ValidationRule
  lastUpdated: Date
  updatedBy: string
}

interface SecretKey {
  key: string
  value: string // Always encrypted
  description: string
  rotation: RotationConfig
  accessLog: AccessLogEntry[]
}

interface RotationConfig {
  enabled: boolean
  interval: number // days
  lastRotated: Date
  nextRotation: Date
}
```

### 3.2 Configuration Validation
```typescript
interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'json'
  required: boolean
  pattern?: RegExp
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  enum?: string[]
  customValidator?: (value: any) => boolean
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}
```

### 3.3 Environment Sync Service
```typescript
interface EnvironmentSyncService {
  syncWithRailway: () => Promise<SyncResult>
  validateConfiguration: () => Promise<ValidationResult>
  backupConfiguration: () => Promise<string>
  restoreConfiguration: (backup: string) => Promise<void>
  compareEnvironments: (env1: string, env2: string) => Promise<ComparisonResult>
}
```

## 4. AstraDB Data API Integration

### 4.1 AstraDB Configuration
```typescript
interface AstraDBConfig {
  applicationToken: string
  databaseId: string
  keyspace: string
  region: string
  endpoint: string
  connectionTimeout: number
  retryConfig: RetryConfig
  monitoring: MonitoringConfig
}

interface RetryConfig {
  maxRetries: number
  backoffStrategy: 'exponential' | 'linear'
  baseDelay: number
  maxDelay: number
}

interface MonitoringConfig {
  enabled: boolean
  metricsInterval: number
  alertThresholds: AlertThreshold[]
}
```

### 4.2 Data API Client
```typescript
interface AstraDBClient {
  connect: (config: AstraDBConfig) => Promise<void>
  testConnection: () => Promise<ConnectionStatus>
  executeQuery: (query: string, params?: any[]) => Promise<QueryResult>
  getSchema: () => Promise<DatabaseSchema>
  validateSchema: (schema: DatabaseSchema) => Promise<ValidationResult>
  getPerformanceMetrics: () => Promise<PerformanceMetrics>
}
```

### 4.3 Migration System
```typescript
interface MigrationManager {
  createMigration: (name: string, up: string, down: string) => Promise<Migration>
  runMigrations: () => Promise<MigrationResult[]>
  rollbackMigration: (migrationId: string) => Promise<void>
  getMigrationStatus: () => Promise<MigrationStatus[]>
  generateMigrationFromDiff: (current: Schema, target: Schema) => Promise<Migration>
}
```

## 5. Railway Deployment Configuration

### 5.1 Railway Integration
```typescript
interface RailwayConfig {
  projectId: string
  serviceId: string
  apiKey: string
  deploymentSettings: DeploymentSettings
  environmentVariables: RailwayEnvironmentVariable[]
  buildSettings: BuildSettings
  healthChecks: HealthCheckConfig[]
}

interface DeploymentSettings {
  autoDeployment: boolean
  branch: string
  buildCommand: string
  startCommand: string
  dockerfile: string
  rootDirectory: string
  watchPaths: string[]
}

interface BuildSettings {
  nodeVersion: string
  pythonVersion: string
  buildTimeoutMinutes: number
  maxBuildMemory: string
  buildEnvironment: Record<string, string>
}
```

### 5.2 Deployment Pipeline
```typescript
interface DeploymentPipeline {
  createDeployment: (config: DeploymentConfig) => Promise<Deployment>
  monitorDeployment: (deploymentId: string) => Promise<DeploymentStatus>
  rollbackDeployment: (deploymentId: string) => Promise<void>
  getDeploymentLogs: (deploymentId: string) => Promise<string[]>
  updateEnvironmentVariables: (variables: EnvironmentVariable[]) => Promise<void>
  scaleService: (instances: number) => Promise<void>
}
```

### 5.3 Health Monitoring
```typescript
interface HealthMonitor {
  configureHealthChecks: (checks: HealthCheck[]) => Promise<void>
  getHealthStatus: () => Promise<HealthStatus>
  getMetrics: (timeRange: TimeRange) => Promise<Metrics>
  setupAlerts: (alerts: Alert[]) => Promise<void>
  getAlertHistory: () => Promise<AlertHistory[]>
}
```

## 6. Security Architecture

### 6.1 Encryption Service
```typescript
interface EncryptionService {
  encrypt: (data: string, key?: string) => Promise<string>
  decrypt: (encryptedData: string, key?: string) => Promise<string>
  generateKey: () => Promise<string>
  rotateKeys: () => Promise<void>
  hashPassword: (password: string) => Promise<string>
  verifyPassword: (password: string, hash: string) => Promise<boolean>
}
```

### 6.2 Audit Logging
```typescript
interface AuditLogger {
  logAction: (action: AuditAction) => Promise<void>
  getAuditLogs: (filters: AuditFilter) => Promise<AuditLog[]>
  exportAuditLogs: (format: 'json' | 'csv' | 'pdf') => Promise<string>
  setupAuditAlerts: (rules: AuditRule[]) => Promise<void>
}

interface AuditAction {
  userId: string
  action: string
  resource: string
  timestamp: Date
  ipAddress: string
  userAgent: string
  details: Record<string, any>
  success: boolean
}
```

### 6.3 Security Middleware
```typescript
interface SecurityMiddleware {
  rateLimiting: RateLimitConfig
  corsSettings: CORSConfig
  contentSecurityPolicy: CSPConfig
  httpSecurityHeaders: SecurityHeadersConfig
  inputValidation: ValidationConfig
  sqlInjectionProtection: SQLProtectionConfig
}
```

## 7. API Architecture

### 7.1 Settings API Endpoints
```
POST   /api/v1/settings/general          # Update general settings
GET    /api/v1/settings/general          # Get general settings
POST   /api/v1/settings/security         # Update security settings
GET    /api/v1/settings/security         # Get security settings
POST   /api/v1/settings/environment      # Update environment variables
GET    /api/v1/settings/environment      # Get environment variables
POST   /api/v1/settings/database         # Update database configuration
GET    /api/v1/settings/database         # Get database configuration
POST   /api/v1/settings/deployment       # Update deployment settings
GET    /api/v1/settings/deployment       # Get deployment settings
POST   /api/v1/settings/validate         # Validate configuration
POST   /api/v1/settings/export           # Export settings
POST   /api/v1/settings/import           # Import settings
```

### 7.2 Authentication API Enhancement
```
POST   /api/v1/auth/login               # User login
POST   /api/v1/auth/refresh             # Refresh token
POST   /api/v1/auth/logout              # User logout
POST   /api/v1/auth/register            # User registration
GET    /api/v1/auth/me                  # Get current user
PUT    /api/v1/auth/profile             # Update profile
POST   /api/v1/auth/change-password     # Change password
POST   /api/v1/auth/enable-2fa          # Enable 2FA
POST   /api/v1/auth/verify-2fa          # Verify 2FA token
GET    /api/v1/auth/sessions            # Get active sessions
DELETE /api/v1/auth/sessions/:id        # Revoke session
```

### 7.3 Environment Management API
```
GET    /api/v1/env/variables            # Get environment variables
POST   /api/v1/env/variables            # Create/update environment variable
DELETE /api/v1/env/variables/:key       # Delete environment variable
POST   /api/v1/env/sync                 # Sync with Railway
POST   /api/v1/env/validate             # Validate configuration
GET    /api/v1/env/backup               # Backup configuration
POST   /api/v1/env/restore              # Restore configuration
```

## 8. Database Schema Design

### 8.1 Users and Authentication
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'viewer',
    avatar_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE user_permissions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resource VARCHAR(255) NOT NULL,
    actions TEXT[] NOT NULL,
    conditions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 8.2 Settings and Configuration
```sql
CREATE TABLE application_settings (
    id UUID PRIMARY KEY,
    category VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    encrypted BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

CREATE TABLE environment_variables (
    id UUID PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    encrypted BOOLEAN DEFAULT false,
    required BOOLEAN DEFAULT false,
    description TEXT,
    category VARCHAR(255) NOT NULL,
    validation_rules JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

CREATE TABLE secret_keys (
    id UUID PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL, -- Always encrypted
    description TEXT,
    rotation_enabled BOOLEAN DEFAULT false,
    rotation_interval INTEGER, -- days
    last_rotated TIMESTAMP,
    next_rotation TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);
```

### 8.3 Audit and Monitoring
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

CREATE TABLE deployment_logs (
    id UUID PRIMARY KEY,
    deployment_id VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    stage VARCHAR(255) NOT NULL,
    message TEXT,
    details JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Enhanced authentication system with JWT
- [ ] RBAC implementation
- [ ] Settings layout and navigation
- [ ] Environment variable management UI
- [ ] Basic security enhancements

### Phase 2: Database Integration (Week 3-4)
- [ ] AstraDB client implementation
- [ ] Migration system
- [ ] Connection testing and validation
- [ ] Performance monitoring setup
- [ ] Database settings UI

### Phase 3: Deployment Integration (Week 5-6)
- [ ] Railway API integration
- [ ] Deployment pipeline setup
- [ ] Environment sync functionality
- [ ] Health monitoring implementation
- [ ] Deployment settings UI

### Phase 4: Advanced Features (Week 7-8)
- [ ] Audit logging system
- [ ] Advanced security features
- [ ] Settings import/export
- [ ] Monitoring and alerts
- [ ] Documentation and testing

## 10. Testing Strategy

### 10.1 Unit Testing
- Component testing for all settings components
- Service testing for API clients
- Utility function testing
- Validation logic testing

### 10.2 Integration Testing
- Authentication flow testing
- Database connection testing
- Railway deployment testing
- Environment sync testing

### 10.3 Security Testing
- JWT token validation
- RBAC permission testing
- Input validation testing
- Encryption/decryption testing

### 10.4 Performance Testing
- Database query optimization
- API response time testing
- Memory usage monitoring
- Load testing for critical paths

## 11. Deployment Considerations

### 11.1 Railway Configuration
```yaml
# railway.json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build",
    "watchPatterns": ["src/**/*.ts", "src/**/*.tsx"]
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

### 11.2 Environment Variables
```bash
# Production environment variables
NODE_ENV=production
VITE_API_URL=https://api.eesystem.com
DATABASE_URL=astradb://...
ASTRADB_APPLICATION_TOKEN=...
ASTRADB_DATABASE_ID=...
JWT_SECRET=...
ENCRYPTION_KEY=...
RAILWAY_API_KEY=...
```

### 11.3 Security Headers
```javascript
// Security headers configuration
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
}
```

## 12. Monitoring and Observability

### 12.1 Metrics Collection
- Application performance metrics
- Database query performance
- API response times
- User authentication events
- Environment variable changes

### 12.2 Alerting System
- Failed authentication attempts
- Database connection issues
- Deployment failures
- Security violations
- Performance degradation

### 12.3 Logging Strategy
- Structured logging with JSON format
- Log levels: ERROR, WARN, INFO, DEBUG
- Sensitive data redaction
- Centralized log aggregation
- Log retention policies

This comprehensive architecture provides a solid foundation for implementing a secure, scalable, and maintainable settings system for the EESystem Content Curation Platform.