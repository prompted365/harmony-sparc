import axios, { AxiosInstance } from 'axios'
import { 
  AuthApiResponse, 
  LoginCredentials, 
  RegisterData, 
  AuthUser, 
  AuthTokens, 
  ChangePasswordData, 
  PasswordResetConfirm, 
  UserPreferences, 
  TokenRefreshResponse,
  UserSession,
  AuditLog
} from '../types'
import { tokenUtils } from '../utils/tokenUtils'

class AuthService {
  private api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor for auth headers
    this.api.interceptors.request.use(
      (config) => {
        const token = tokenUtils.getAccessToken()
        if (token && !tokenUtils.isTokenExpired()) {
          config.headers.Authorization = `Bearer ${token}`
        }
        
        // Add CSRF token if available
        const csrfToken = tokenUtils.getCsrfToken()
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken
        }
        
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          
          try {
            const refreshToken = tokenUtils.getRefreshToken()
            if (refreshToken) {
              const response = await this.refreshToken(refreshToken)
              if (response.success && response.data) {
                tokenUtils.setTokens({
                  accessToken: response.data.accessToken,
                  refreshToken: response.data.refreshToken,
                  expiresAt: response.data.expiresAt,
                  tokenType: 'Bearer'
                })
                
                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`
                return this.api(originalRequest)
              }
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError)
          }
          
          // Refresh failed, clear tokens and redirect to login
          tokenUtils.clearTokens()
          window.location.href = '/login'
        }
        
        return Promise.reject(error)
      }
    )
  }

  async login(credentials: LoginCredentials): Promise<AuthApiResponse<{ user: AuthUser; tokens: AuthTokens }>> {
    try {
      const response = await this.api.post('/auth/login', credentials)
      
      return {
        success: true,
        data: {
          user: response.data.user,
          tokens: {
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            expiresAt: response.data.expiresAt,
            tokenType: 'Bearer'
          }
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'LOGIN_ERROR',
          message: error.response?.data?.message || 'Login failed'
        }
      }
    }
  }

  async register(data: RegisterData): Promise<AuthApiResponse<{ user: AuthUser; tokens: AuthTokens }>> {
    try {
      const response = await this.api.post('/auth/register', data)
      
      return {
        success: true,
        data: {
          user: response.data.user,
          tokens: {
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            expiresAt: response.data.expiresAt,
            tokenType: 'Bearer'
          }
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'REGISTER_ERROR',
          message: error.response?.data?.message || 'Registration failed'
        }
      }
    }
  }

  async logout(): Promise<AuthApiResponse> {
    try {
      await this.api.post('/auth/logout')
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'LOGOUT_ERROR',
          message: error.response?.data?.message || 'Logout failed'
        }
      }
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthApiResponse<TokenRefreshResponse>> {
    try {
      const response = await this.api.post('/auth/refresh', { refreshToken })
      
      return {
        success: true,
        data: {
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
          expiresAt: response.data.expiresAt
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'TOKEN_REFRESH_ERROR',
          message: error.response?.data?.message || 'Token refresh failed'
        }
      }
    }
  }

  async getCurrentUser(): Promise<AuthApiResponse<AuthUser>> {
    try {
      const response = await this.api.get('/auth/me')
      
      return {
        success: true,
        data: response.data
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'GET_USER_ERROR',
          message: error.response?.data?.message || 'Failed to get user data'
        }
      }
    }
  }

  async updatePreferences(preferences: Partial<UserPreferences>): Promise<AuthApiResponse<UserPreferences>> {
    try {
      const response = await this.api.put('/auth/preferences', preferences)
      
      return {
        success: true,
        data: response.data
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'UPDATE_PREFERENCES_ERROR',
          message: error.response?.data?.message || 'Failed to update preferences'
        }
      }
    }
  }

  async changePassword(data: ChangePasswordData): Promise<AuthApiResponse> {
    try {
      await this.api.put('/auth/password', data)
      
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'CHANGE_PASSWORD_ERROR',
          message: error.response?.data?.message || 'Failed to change password'
        }
      }
    }
  }

  async requestPasswordReset(email: string): Promise<AuthApiResponse> {
    try {
      await this.api.post('/auth/password-reset', { email })
      
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'PASSWORD_RESET_REQUEST_ERROR',
          message: error.response?.data?.message || 'Failed to request password reset'
        }
      }
    }
  }

  async confirmPasswordReset(data: PasswordResetConfirm): Promise<AuthApiResponse> {
    try {
      await this.api.post('/auth/password-reset/confirm', data)
      
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'PASSWORD_RESET_CONFIRM_ERROR',
          message: error.response?.data?.message || 'Failed to reset password'
        }
      }
    }
  }

  async verifyEmail(token: string): Promise<AuthApiResponse> {
    try {
      await this.api.post('/auth/verify-email', { token })
      
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'EMAIL_VERIFICATION_ERROR',
          message: error.response?.data?.message || 'Email verification failed'
        }
      }
    }
  }

  async resendEmailVerification(): Promise<AuthApiResponse> {
    try {
      await this.api.post('/auth/resend-verification')
      
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'RESEND_VERIFICATION_ERROR',
          message: error.response?.data?.message || 'Failed to resend verification email'
        }
      }
    }
  }

  async getSessions(): Promise<AuthApiResponse<UserSession[]>> {
    try {
      const response = await this.api.get('/auth/sessions')
      
      return {
        success: true,
        data: response.data
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'GET_SESSIONS_ERROR',
          message: error.response?.data?.message || 'Failed to get sessions'
        }
      }
    }
  }

  async revokeSession(sessionId: string): Promise<AuthApiResponse> {
    try {
      await this.api.delete(`/auth/sessions/${sessionId}`)
      
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'REVOKE_SESSION_ERROR',
          message: error.response?.data?.message || 'Failed to revoke session'
        }
      }
    }
  }

  async revokeAllSessions(): Promise<AuthApiResponse> {
    try {
      await this.api.delete('/auth/sessions')
      
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'REVOKE_ALL_SESSIONS_ERROR',
          message: error.response?.data?.message || 'Failed to revoke all sessions'
        }
      }
    }
  }

  async getAuditLogs(params?: { 
    limit?: number 
    offset?: number 
    startDate?: string 
    endDate?: string 
  }): Promise<AuthApiResponse<{ logs: AuditLog[]; total: number }>> {
    try {
      const response = await this.api.get('/auth/audit-logs', { params })
      
      return {
        success: true,
        data: response.data
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'GET_AUDIT_LOGS_ERROR',
          message: error.response?.data?.message || 'Failed to get audit logs'
        }
      }
    }
  }

  async logAuditEvent(action: string, resource: string, details?: Record<string, any>): Promise<void> {
    try {
      await this.api.post('/auth/audit-logs', {
        action,
        resource,
        details: details || {}
      })
    } catch (error) {
      console.error('Failed to log audit event:', error)
    }
  }

  async checkPermission(resource: string, action: string): Promise<boolean> {
    try {
      const response = await this.api.get('/auth/permissions/check', {
        params: { resource, action }
      })
      
      return response.data.allowed
    } catch (error) {
      console.error('Permission check failed:', error)
      return false
    }
  }

  async healthCheck(): Promise<AuthApiResponse<{ status: string; timestamp: Date }>> {
    try {
      const response = await this.api.get('/auth/health')
      
      return {
        success: true,
        data: response.data
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: 'Health check failed'
        }
      }
    }
  }
}

export const authService = new AuthService()
export default authService