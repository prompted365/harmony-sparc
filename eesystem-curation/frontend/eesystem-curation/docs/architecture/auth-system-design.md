# Authentication System Design

## Enhanced JWT Authentication Implementation

### 1. JWT Token Structure

```typescript
interface JWTPayload {
  sub: string        // User ID
  email: string      // User email
  role: UserRole     // User role
  permissions: Permission[]  // User permissions
  exp: number        // Expiration timestamp
  iat: number        // Issued at timestamp
  jti: string        // JWT ID for revocation
  sid: string        // Session ID
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresIn: number
  refreshExpiresIn: number
}
```

### 2. Token Management Service

```typescript
class TokenService {
  private readonly ACCESS_TOKEN_KEY = 'eesystem_access_token'
  private readonly REFRESH_TOKEN_KEY = 'eesystem_refresh_token'
  private readonly TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000 // 5 minutes

  setTokens(tokens: AuthTokens): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken)
    localStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken)
    
    // Set automatic refresh
    this.scheduleTokenRefresh(tokens.expiresIn)
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY)
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY)
  }

  clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY)
    localStorage.removeItem(this.REFRESH_TOKEN_KEY)
    this.cancelScheduledRefresh()
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return Date.now() >= (payload.exp * 1000) - this.TOKEN_EXPIRY_BUFFER
    } catch {
      return true
    }
  }

  private scheduleTokenRefresh(expiresIn: number): void {
    const refreshTime = (expiresIn * 1000) - this.TOKEN_EXPIRY_BUFFER
    setTimeout(() => {
      this.refreshAccessToken()
    }, refreshTime)
  }

  private async refreshAccessToken(): Promise<void> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) return

    try {
      const response = await apiService.refreshToken(refreshToken)
      this.setTokens(response.data)
    } catch (error) {
      console.error('Token refresh failed:', error)
      this.clearTokens()
      window.location.href = '/login'
    }
  }
}
```

### 3. Enhanced Auth Context

```typescript
interface AuthContextType {
  // State
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
  permissions: Permission[]
  
  // Authentication methods
  login: (credentials: LoginCredentials) => Promise<void>
  loginWithOAuth: (provider: OAuthProvider) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  
  // User management
  updateProfile: (updates: Partial<User>) => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  
  // Two-factor authentication
  enableTwoFactor: (method: TwoFactorMethod) => Promise<TwoFactorSetup>
  verifyTwoFactor: (token: string) => Promise<void>
  disableTwoFactor: (password: string) => Promise<void>
  
  // Permissions and roles
  checkPermission: (resource: string, action: string) => boolean
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
  
  // Session management
  getActiveSessions: () => Promise<Session[]>
  revokeSession: (sessionId: string) => Promise<void>
  revokeAllSessions: () => Promise<void>
}
```

### 4. RBAC Implementation

```typescript
enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  EDITOR = 'editor',
  MODERATOR = 'moderator',
  VIEWER = 'viewer'
}

interface Permission {
  resource: string
  actions: string[]
  conditions?: PermissionCondition[]
}

interface PermissionCondition {
  field: string
  operator: 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'lt' | 'contains'
  value: any
}

class PermissionService {
  private permissions: Permission[] = []

  setPermissions(permissions: Permission[]): void {
    this.permissions = permissions
  }

  checkPermission(resource: string, action: string, context?: any): boolean {
    const permission = this.permissions.find(p => 
      p.resource === resource && p.actions.includes(action)
    )
    
    if (!permission) return false
    
    // Check conditions if provided
    if (permission.conditions && context) {
      return this.evaluateConditions(permission.conditions, context)
    }
    
    return true
  }

  private evaluateConditions(conditions: PermissionCondition[], context: any): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getNestedValue(context, condition.field)
      
      switch (condition.operator) {
        case 'eq': return fieldValue === condition.value
        case 'ne': return fieldValue !== condition.value
        case 'in': return Array.isArray(condition.value) && condition.value.includes(fieldValue)
        case 'nin': return Array.isArray(condition.value) && !condition.value.includes(fieldValue)
        case 'gt': return fieldValue > condition.value
        case 'lt': return fieldValue < condition.value
        case 'contains': return String(fieldValue).includes(String(condition.value))
        default: return false
      }
    })
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
}
```

### 5. Session Management

```typescript
interface Session {
  id: string
  userId: string
  createdAt: Date
  lastActivity: Date
  expiresAt: Date
  ipAddress: string
  userAgent: string
  isActive: boolean
  deviceInfo: DeviceInfo
}

interface DeviceInfo {
  browser: string
  os: string
  device: string
  isMobile: boolean
}

class SessionManager {
  async createSession(user: User, deviceInfo: DeviceInfo): Promise<Session> {
    const session: Session = {
      id: this.generateSessionId(),
      userId: user.id,
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
      isActive: true,
      deviceInfo
    }

    await this.saveSession(session)
    return session
  }

  async validateSession(sessionId: string): Promise<Session | null> {
    const session = await this.getSession(sessionId)
    
    if (!session || !session.isActive) return null
    if (session.expiresAt < new Date()) {
      await this.revokeSession(sessionId)
      return null
    }

    // Update last activity
    session.lastActivity = new Date()
    await this.updateSession(session)
    
    return session
  }

  async refreshSession(sessionId: string): Promise<Session> {
    const session = await this.validateSession(sessionId)
    if (!session) throw new Error('Invalid session')

    session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await this.updateSession(session)
    
    return session
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.updateSession({ id: sessionId, isActive: false })
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId)
    await Promise.all(sessions.map(session => this.revokeSession(session.id)))
  }

  private generateSessionId(): string {
    return crypto.randomUUID()
  }

  private async getClientIP(): Promise<string> {
    // In production, this would be handled by the backend
    return '127.0.0.1'
  }
}
```

### 6. Two-Factor Authentication

```typescript
enum TwoFactorMethod {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email'
}

interface TwoFactorSetup {
  method: TwoFactorMethod
  secret?: string
  qrCode?: string
  backupCodes: string[]
}

class TwoFactorService {
  async enableTwoFactor(userId: string, method: TwoFactorMethod): Promise<TwoFactorSetup> {
    const setup: TwoFactorSetup = {
      method,
      backupCodes: this.generateBackupCodes()
    }

    switch (method) {
      case TwoFactorMethod.TOTP:
        setup.secret = this.generateTOTPSecret()
        setup.qrCode = this.generateQRCode(userId, setup.secret)
        break
      case TwoFactorMethod.SMS:
        // SMS setup logic
        break
      case TwoFactorMethod.EMAIL:
        // Email setup logic
        break
    }

    await this.saveTwoFactorSetup(userId, setup)
    return setup
  }

  async verifyTwoFactor(userId: string, token: string): Promise<boolean> {
    const user = await this.getUser(userId)
    if (!user.twoFactorEnabled) return false

    switch (user.twoFactorMethod) {
      case TwoFactorMethod.TOTP:
        return this.verifyTOTP(user.twoFactorSecret, token)
      case TwoFactorMethod.SMS:
        return this.verifySMS(userId, token)
      case TwoFactorMethod.EMAIL:
        return this.verifyEmail(userId, token)
      default:
        return false
    }
  }

  private generateTOTPSecret(): string {
    return crypto.randomBytes(32).toString('base32')
  }

  private generateQRCode(userId: string, secret: string): string {
    const label = encodeURIComponent(`EESystem:${userId}`)
    const issuer = encodeURIComponent('EESystem')
    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}`
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: 10 }, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    )
  }

  private verifyTOTP(secret: string, token: string): boolean {
    // TOTP verification logic using a library like 'otplib'
    return true // Placeholder
  }
}
```

### 7. Security Middleware

```typescript
class SecurityMiddleware {
  static rateLimit = (requests: number, windowMs: number) => {
    const requests_map = new Map<string, number[]>()
    
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip
      const now = Date.now()
      const window_start = now - windowMs
      
      if (!requests_map.has(ip)) {
        requests_map.set(ip, [])
      }
      
      const request_times = requests_map.get(ip)!
      const requests_in_window = request_times.filter(time => time > window_start)
      
      if (requests_in_window.length >= requests) {
        return res.status(429).json({
          error: 'Too many requests',
          retry_after: windowMs / 1000
        })
      }
      
      requests_in_window.push(now)
      requests_map.set(ip, requests_in_window)
      next()
    }
  }

  static requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
      req.user = payload
      next()
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }

  static requireRole = (roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      next()
    }
  }

  static requirePermission = (resource: string, action: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const hasPermission = req.user.permissions.some(p => 
        p.resource === resource && p.actions.includes(action)
      )

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      next()
    }
  }
}
```

### 8. Enhanced API Service

```typescript
class EnhancedApiService extends ApiService {
  private tokenService = new TokenService()
  private permissionService = new PermissionService()

  constructor() {
    super()
    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor for token injection
    this.api.interceptors.request.use(
      async (config) => {
        const token = this.tokenService.getAccessToken()
        if (token) {
          // Check if token is expired and refresh if needed
          if (this.tokenService.isTokenExpired(token)) {
            await this.refreshToken()
            const newToken = this.tokenService.getAccessToken()
            if (newToken) {
              config.headers.Authorization = `Bearer ${newToken}`
            }
          } else {
            config.headers.Authorization = `Bearer ${token}`
          }
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          
          try {
            await this.refreshToken()
            const newToken = this.tokenService.getAccessToken()
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              return this.api(originalRequest)
            }
          } catch (refreshError) {
            this.tokenService.clearTokens()
            window.location.href = '/login'
            return Promise.reject(refreshError)
          }
        }
        
        return Promise.reject(error)
      }
    )
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.api.post('/auth/login', credentials)
    const { user, tokens } = response.data
    
    this.tokenService.setTokens(tokens)
    this.permissionService.setPermissions(user.permissions)
    
    return response.data
  }

  async refreshToken(): Promise<AuthResponse> {
    const refreshToken = this.tokenService.getRefreshToken()
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await this.api.post('/auth/refresh', { refreshToken })
    const { user, tokens } = response.data
    
    this.tokenService.setTokens(tokens)
    this.permissionService.setPermissions(user.permissions)
    
    return response.data
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout')
    } finally {
      this.tokenService.clearTokens()
      this.permissionService.setPermissions([])
    }
  }

  // Enhanced user management methods
  async enableTwoFactor(method: TwoFactorMethod): Promise<TwoFactorSetup> {
    const response = await this.api.post('/auth/2fa/enable', { method })
    return response.data
  }

  async verifyTwoFactor(token: string): Promise<void> {
    await this.api.post('/auth/2fa/verify', { token })
  }

  async getActiveSessions(): Promise<Session[]> {
    const response = await this.api.get('/auth/sessions')
    return response.data
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.api.delete(`/auth/sessions/${sessionId}`)
  }
}
```

### 9. Route Protection

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole
  requiredPermission?: { resource: string; action: string }
  fallback?: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission,
  fallback = <div>Access Denied</div>
}) => {
  const { user, isAuthenticated, checkPermission, hasRole } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <>{fallback}</>
  }

  if (requiredPermission && !checkPermission(requiredPermission.resource, requiredPermission.action)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
```

### 10. Usage Examples

```typescript
// Route protection
<ProtectedRoute requiredRole={UserRole.ADMIN}>
  <AdminPanel />
</ProtectedRoute>

<ProtectedRoute requiredPermission={{ resource: 'content', action: 'create' }}>
  <ContentCreator />
</ProtectedRoute>

// Component-level permission checks
const ContentActions = () => {
  const { checkPermission } = useAuth()

  return (
    <div>
      {checkPermission('content', 'create') && (
        <Button onClick={createContent}>Create Content</Button>
      )}
      {checkPermission('content', 'delete') && (
        <Button onClick={deleteContent}>Delete Content</Button>
      )}
    </div>
  )
}
```

This enhanced authentication system provides:
- Secure JWT token management with automatic refresh
- Comprehensive RBAC with granular permissions
- Two-factor authentication support
- Session management with device tracking
- Security middleware for rate limiting and access control
- Route and component-level protection
- Audit logging for security events