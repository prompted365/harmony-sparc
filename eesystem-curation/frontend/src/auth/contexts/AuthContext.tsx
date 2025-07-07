import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react'
import { AuthContextType, AuthState, AuthUser, AuthTokens, LoginCredentials, RegisterData, ChangePasswordData, PasswordResetConfirm, UserPreferences, AuthError, UserRole } from '../types'
import { authService } from '../services/authService'
import { tokenUtils } from '../utils/tokenUtils'
import { storageUtils } from '../utils/storageUtils'

// Auth reducer
type AuthAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: AuthError | null }
  | { type: 'SET_USER'; payload: AuthUser | null }
  | { type: 'SET_TOKENS'; payload: AuthTokens | null }
  | { type: 'UPDATE_USER'; payload: Partial<AuthUser> }
  | { type: 'SET_SESSION_EXPIRY'; payload: number | null }
  | { type: 'CLEAR_AUTH' }

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  sessionExpiry: null,
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }
    case 'SET_USER':
      return { 
        ...state, 
        user: action.payload, 
        isAuthenticated: !!action.payload,
        isLoading: false 
      }
    case 'SET_TOKENS':
      return { 
        ...state, 
        tokens: action.payload,
        sessionExpiry: action.payload?.expiresAt || null
      }
    case 'UPDATE_USER':
      return { 
        ...state, 
        user: state.user ? { ...state.user, ...action.payload } : null 
      }
    case 'SET_SESSION_EXPIRY':
      return { ...state, sessionExpiry: action.payload }
    case 'CLEAR_AUTH':
      return { 
        ...initialState, 
        isLoading: false 
      }
    default:
      return state
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Auto-refresh timer
  const refreshTimer = React.useRef<NodeJS.Timeout | null>(null)

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null })
  }, [])

  // Check if token is expired
  const isTokenExpired = useCallback(() => {
    if (!state.tokens) return true
    return Date.now() >= state.tokens.expiresAt
  }, [state.tokens])

  // Get auth header
  const getAuthHeader = useCallback(() => {
    if (!state.tokens || isTokenExpired()) return null
    return `${state.tokens.tokenType} ${state.tokens.accessToken}`
  }, [state.tokens, isTokenExpired])

  // Permission checking
  const hasPermission = useCallback((resource: string, action: string) => {
    if (!state.user) return false
    return state.user.permissions.some(
      p => p.resource === resource && p.action === action
    )
  }, [state.user])

  // Role checking
  const hasRole = useCallback((role: UserRole) => {
    if (!state.user) return false
    return state.user.role === role
  }, [state.user])

  // Refresh token
  const refreshToken = useCallback(async () => {
    try {
      if (!state.tokens?.refreshToken) {
        throw new Error('No refresh token available')
      }

      const response = await authService.refreshToken(state.tokens.refreshToken)
      
      if (response.success && response.data) {
        const newTokens: AuthTokens = {
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
          expiresAt: response.data.expiresAt,
          tokenType: 'Bearer'
        }
        
        dispatch({ type: 'SET_TOKENS', payload: newTokens })
        storageUtils.setTokens(newTokens)
        
        // Schedule next refresh
        scheduleTokenRefresh(newTokens.expiresAt)
      } else {
        throw new Error(response.error?.message || 'Token refresh failed')
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      dispatch({ type: 'SET_ERROR', payload: { 
        code: 'TOKEN_REFRESH_ERROR', 
        message: 'Session expired. Please login again.' 
      }})
      await logout()
    }
  }, [state.tokens])

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback((expiresAt: number) => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current)
    }

    // Refresh 5 minutes before expiry
    const refreshTime = expiresAt - Date.now() - (5 * 60 * 1000)
    
    if (refreshTime > 0) {
      refreshTimer.current = setTimeout(() => {
        refreshToken()
      }, refreshTime)
    }
  }, [refreshToken])

  // Login
  const login = useCallback(async (credentials: LoginCredentials) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const response = await authService.login(credentials)
      
      if (response.success && response.data) {
        const { user, tokens } = response.data
        
        dispatch({ type: 'SET_USER', payload: user })
        dispatch({ type: 'SET_TOKENS', payload: tokens })
        
        // Store tokens
        storageUtils.setTokens(tokens)
        
        // Store user preferences
        if (credentials.rememberMe) {
          storageUtils.setRememberMe(true)
          storageUtils.setUserEmail(credentials.email)
        }
        
        // Schedule token refresh
        scheduleTokenRefresh(tokens.expiresAt)
        
        // Log successful login
        await authService.logAuditEvent('LOGIN', 'USER', { 
          userId: user.id, 
          email: user.email 
        })
      } else {
        throw new Error(response.error?.message || 'Login failed')
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: { 
        code: 'LOGIN_ERROR', 
        message: error.message || 'Login failed' 
      }})
      throw error
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [scheduleTokenRefresh])

  // Register
  const register = useCallback(async (data: RegisterData) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const response = await authService.register(data)
      
      if (response.success && response.data) {
        const { user, tokens } = response.data
        
        dispatch({ type: 'SET_USER', payload: user })
        dispatch({ type: 'SET_TOKENS', payload: tokens })
        
        // Store tokens
        storageUtils.setTokens(tokens)
        
        // Schedule token refresh
        scheduleTokenRefresh(tokens.expiresAt)
        
        // Log successful registration
        await authService.logAuditEvent('REGISTER', 'USER', { 
          userId: user.id, 
          email: user.email 
        })
      } else {
        throw new Error(response.error?.message || 'Registration failed')
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: { 
        code: 'REGISTER_ERROR', 
        message: error.message || 'Registration failed' 
      }})
      throw error
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [scheduleTokenRefresh])

  // Logout
  const logout = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true })

    try {
      if (state.tokens) {
        await authService.logout()
        await authService.logAuditEvent('LOGOUT', 'USER', { 
          userId: state.user?.id 
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear auth state
      dispatch({ type: 'CLEAR_AUTH' })
      
      // Clear storage
      storageUtils.clearTokens()
      storageUtils.clearUserData()
      
      // Clear refresh timer
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
        refreshTimer.current = null
      }
    }
  }, [state.tokens, state.user])

  // Update user
  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    dispatch({ type: 'UPDATE_USER', payload: updates })
  }, [])

  // Update preferences
  const updatePreferences = useCallback(async (preferences: Partial<UserPreferences>) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const response = await authService.updatePreferences(preferences)
      
      if (response.success && response.data) {
        dispatch({ type: 'UPDATE_USER', payload: { preferences: response.data } })
        await authService.logAuditEvent('UPDATE_PREFERENCES', 'USER', { 
          userId: state.user?.id, 
          preferences 
        })
      } else {
        throw new Error(response.error?.message || 'Failed to update preferences')
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: { 
        code: 'UPDATE_PREFERENCES_ERROR', 
        message: error.message || 'Failed to update preferences' 
      }})
      throw error
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [state.user])

  // Change password
  const changePassword = useCallback(async (data: ChangePasswordData) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const response = await authService.changePassword(data)
      
      if (response.success) {
        await authService.logAuditEvent('CHANGE_PASSWORD', 'USER', { 
          userId: state.user?.id 
        })
      } else {
        throw new Error(response.error?.message || 'Failed to change password')
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: { 
        code: 'CHANGE_PASSWORD_ERROR', 
        message: error.message || 'Failed to change password' 
      }})
      throw error
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [state.user])

  // Request password reset
  const requestPasswordReset = useCallback(async (email: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const response = await authService.requestPasswordReset(email)
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to request password reset')
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: { 
        code: 'PASSWORD_RESET_REQUEST_ERROR', 
        message: error.message || 'Failed to request password reset' 
      }})
      throw error
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  // Confirm password reset
  const confirmPasswordReset = useCallback(async (data: PasswordResetConfirm) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const response = await authService.confirmPasswordReset(data)
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to reset password')
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: { 
        code: 'PASSWORD_RESET_CONFIRM_ERROR', 
        message: error.message || 'Failed to reset password' 
      }})
      throw error
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const tokens = storageUtils.getTokens()
        
        if (tokens) {
          if (Date.now() >= tokens.expiresAt) {
            // Token expired, try to refresh
            if (tokens.refreshToken) {
              await refreshToken()
            } else {
              storageUtils.clearTokens()
            }
          } else {
            // Valid token, get user data
            dispatch({ type: 'SET_TOKENS', payload: tokens })
            
            const userResponse = await authService.getCurrentUser()
            if (userResponse.success && userResponse.data) {
              dispatch({ type: 'SET_USER', payload: userResponse.data })
              scheduleTokenRefresh(tokens.expiresAt)
            } else {
              storageUtils.clearTokens()
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        storageUtils.clearTokens()
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    initAuth()
  }, [refreshToken, scheduleTokenRefresh])

  // Session expiry warning
  useEffect(() => {
    if (state.sessionExpiry && state.isAuthenticated) {
      const checkExpiry = () => {
        const timeUntilExpiry = state.sessionExpiry! - Date.now()
        
        // Show warning 10 minutes before expiry
        if (timeUntilExpiry <= 10 * 60 * 1000 && timeUntilExpiry > 0) {
          dispatch({ type: 'SET_ERROR', payload: { 
            code: 'SESSION_EXPIRY_WARNING', 
            message: 'Your session will expire soon. Please save your work.' 
          }})
        }
      }

      const interval = setInterval(checkExpiry, 60000) // Check every minute
      return () => clearInterval(interval)
    }
  }, [state.sessionExpiry, state.isAuthenticated])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
      }
    }
  }, [])

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshToken,
    updateUser,
    updatePreferences,
    changePassword,
    requestPasswordReset,
    confirmPasswordReset,
    clearError,
    hasPermission,
    hasRole,
    isTokenExpired,
    getAuthHeader,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider