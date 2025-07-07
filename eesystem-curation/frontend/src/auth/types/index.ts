export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tokenType: 'Bearer'
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  preferences: UserPreferences
  permissions: Permission[]
  isEmailVerified: boolean
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  notifications: boolean
  autoSave: boolean
  defaultContentType: string
  timezone: string
  language: string
}

export interface Permission {
  id: string
  name: string
  resource: string
  action: 'create' | 'read' | 'update' | 'delete' | 'execute'
  condition?: string
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterData {
  name: string
  email: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordResetConfirm {
  token: string
  newPassword: string
  confirmPassword: string
}

export interface ChangePasswordData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface AuthError {
  code: string
  message: string
  details?: Record<string, any>
}

export interface AuthState {
  user: AuthUser | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
  error: AuthError | null
  sessionExpiry: number | null
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  updateUser: (updates: Partial<AuthUser>) => void
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>
  changePassword: (data: ChangePasswordData) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  confirmPasswordReset: (data: PasswordResetConfirm) => Promise<void>
  clearError: () => void
  hasPermission: (resource: string, action: string) => boolean
  hasRole: (role: UserRole) => boolean
  isTokenExpired: () => boolean
  getAuthHeader: () => string | null
}

export interface AuthApiResponse<T = any> {
  success: boolean
  data?: T
  error?: AuthError
  message?: string
}

export interface TokenRefreshResponse {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface UserSession {
  id: string
  userId: string
  deviceInfo: string
  ipAddress: string
  userAgent: string
  isActive: boolean
  lastActivity: Date
  expiresAt: Date
  createdAt: Date
}

export interface AuditLog {
  id: string
  userId: string
  action: string
  resource: string
  details: Record<string, any>
  ipAddress: string
  userAgent: string
  timestamp: Date
}

export interface SecuritySettings {
  requireEmailVerification: boolean
  enforceStrongPasswords: boolean
  enableTwoFactorAuth: boolean
  sessionTimeout: number
  maxLoginAttempts: number
  lockoutDuration: number
  passwordExpiryDays: number
  allowPasswordReuse: boolean
}