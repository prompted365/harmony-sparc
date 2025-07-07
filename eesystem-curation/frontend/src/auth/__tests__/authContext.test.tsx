import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { authService } from '../services/authService'
import { storageUtils } from '../utils/storageUtils'

// Mock dependencies
jest.mock('../services/authService')
jest.mock('../utils/storageUtils')

const mockAuthService = authService as jest.Mocked<typeof authService>
const mockStorageUtils = storageUtils as jest.Mocked<typeof storageUtils>

// Test component that uses auth context
const TestComponent = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    register,
    hasPermission,
    hasRole
  } = useAuth()

  return (
    <div>
      <div data-testid="loading">{isLoading.toString()}</div>
      <div data-testid="authenticated">{isAuthenticated.toString()}</div>
      <div data-testid="user">{user ? user.name : 'null'}</div>
      <div data-testid="error">{error ? error.message : 'null'}</div>
      
      <button
        data-testid="login-btn"
        onClick={() => login({ email: 'test@example.com', password: 'password' })}
      >
        Login
      </button>
      
      <button data-testid="logout-btn" onClick={logout}>
        Logout
      </button>
      
      <button
        data-testid="register-btn"
        onClick={() => register({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password',
          confirmPassword: 'password',
          acceptTerms: true
        })}
      >
        Register
      </button>
      
      <div data-testid="has-admin-role">
        {hasRole('admin').toString()}
      </div>
      
      <div data-testid="has-content-create-permission">
        {hasPermission('content', 'create').toString()}
      </div>
    </div>
  )
}

const renderWithAuthProvider = (component: React.ReactElement) => {
  return render(
    <AuthProvider>
      {component}
    </AuthProvider>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStorageUtils.getTokens.mockReturnValue(null)
    mockStorageUtils.clearTokens.mockImplementation(() => {})
    mockStorageUtils.setTokens.mockImplementation(() => {})
  })

  describe('Initial State', () => {
    it('should start with loading state', () => {
      renderWithAuthProvider(<TestComponent />)
      
      expect(screen.getByTestId('loading')).toHaveTextContent('true')
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
      expect(screen.getByTestId('user')).toHaveTextContent('null')
    })

    it('should initialize with no stored tokens', async () => {
      mockStorageUtils.getTokens.mockReturnValue(null)
      
      renderWithAuthProvider(<TestComponent />)
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false')
      })
      
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
      expect(screen.getByTestId('user')).toHaveTextContent('null')
    })

    it('should restore user from valid stored tokens', async () => {
      const mockTokens = {
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000, // 1 hour from now
        tokenType: 'Bearer' as const
      }

      const mockUser = {
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'editor' as const,
        preferences: {
          theme: 'light' as const,
          notifications: true,
          autoSave: true,
          defaultContentType: 'article',
          timezone: 'UTC',
          language: 'en'
        },
        permissions: [],
        isEmailVerified: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockStorageUtils.getTokens.mockReturnValue(mockTokens)
      mockAuthService.getCurrentUser.mockResolvedValue({
        success: true,
        data: mockUser
      })

      renderWithAuthProvider(<TestComponent />)

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false')
      })

      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
      expect(screen.getByTestId('user')).toHaveTextContent('Test User')
    })
  })

  describe('Login', () => {
    it('should login successfully', async () => {
      const user = userEvent.setup()
      
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer' as const
      }

      const mockUser = {
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'editor' as const,
        preferences: {
          theme: 'light' as const,
          notifications: true,
          autoSave: true,
          defaultContentType: 'article',
          timezone: 'UTC',
          language: 'en'
        },
        permissions: [
          { id: '1', name: 'Create Content', resource: 'content', action: 'create' }
        ],
        isEmailVerified: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockAuthService.login.mockResolvedValue({
        success: true,
        data: { user: mockUser, tokens: mockTokens }
      })

      mockAuthService.logAuditEvent.mockResolvedValue()

      renderWithAuthProvider(<TestComponent />)

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false')
      })

      await user.click(screen.getByTestId('login-btn'))

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
      })

      expect(screen.getByTestId('user')).toHaveTextContent('Test User')
      expect(mockStorageUtils.setTokens).toHaveBeenCalledWith(mockTokens)
    })

    it('should handle login error', async () => {
      const user = userEvent.setup()
      
      mockAuthService.login.mockResolvedValue({
        success: false,
        error: { code: 'LOGIN_ERROR', message: 'Invalid credentials' }
      })

      renderWithAuthProvider(<TestComponent />)

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false')
      })

      await user.click(screen.getByTestId('login-btn'))

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials')
      })

      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
    })
  })

  describe('Logout', () => {
    it('should logout successfully', async () => {
      const user = userEvent.setup()
      
      // Set initial authenticated state
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer' as const
      }

      mockStorageUtils.getTokens.mockReturnValue(mockTokens)
      mockAuthService.getCurrentUser.mockResolvedValue({
        success: true,
        data: {
          id: '123',
          name: 'Test User',
          email: 'test@example.com',
          role: 'editor' as const,
          preferences: {
            theme: 'light' as const,
            notifications: true,
            autoSave: true,
            defaultContentType: 'article',
            timezone: 'UTC',
            language: 'en'
          },
          permissions: [],
          isEmailVerified: true,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      mockAuthService.logout.mockResolvedValue({ success: true })
      mockAuthService.logAuditEvent.mockResolvedValue()

      renderWithAuthProvider(<TestComponent />)

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
      })

      await user.click(screen.getByTestId('logout-btn'))

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
      })

      expect(screen.getByTestId('user')).toHaveTextContent('null')
      expect(mockStorageUtils.clearTokens).toHaveBeenCalled()
    })
  })

  describe('Permissions and Roles', () => {
    it('should check user roles correctly', async () => {
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer' as const
      }

      const mockUser = {
        id: '123',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin' as const,
        preferences: {
          theme: 'light' as const,
          notifications: true,
          autoSave: true,
          defaultContentType: 'article',
          timezone: 'UTC',
          language: 'en'
        },
        permissions: [],
        isEmailVerified: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockStorageUtils.getTokens.mockReturnValue(mockTokens)
      mockAuthService.getCurrentUser.mockResolvedValue({
        success: true,
        data: mockUser
      })

      renderWithAuthProvider(<TestComponent />)

      await waitFor(() => {
        expect(screen.getByTestId('has-admin-role')).toHaveTextContent('true')
      })
    })

    it('should check user permissions correctly', async () => {
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer' as const
      }

      const mockUser = {
        id: '123',
        name: 'Editor User',
        email: 'editor@example.com',
        role: 'editor' as const,
        preferences: {
          theme: 'light' as const,
          notifications: true,
          autoSave: true,
          defaultContentType: 'article',
          timezone: 'UTC',
          language: 'en'
        },
        permissions: [
          { id: '1', name: 'Create Content', resource: 'content', action: 'create' }
        ],
        isEmailVerified: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockStorageUtils.getTokens.mockReturnValue(mockTokens)
      mockAuthService.getCurrentUser.mockResolvedValue({
        success: true,
        data: mockUser
      })

      renderWithAuthProvider(<TestComponent />)

      await waitFor(() => {
        expect(screen.getByTestId('has-content-create-permission')).toHaveTextContent('true')
      })
    })
  })

  describe('Token Refresh', () => {
    it('should refresh token automatically when expired', async () => {
      const expiredTokens = {
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000, // Expired
        tokenType: 'Bearer' as const
      }

      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer' as const
      }

      mockStorageUtils.getTokens.mockReturnValue(expiredTokens)
      mockAuthService.refreshToken.mockResolvedValue({
        success: true,
        data: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresAt: newTokens.expiresAt
        }
      })

      renderWithAuthProvider(<TestComponent />)

      await waitFor(() => {
        expect(mockAuthService.refreshToken).toHaveBeenCalledWith('refresh-token')
      })

      expect(mockStorageUtils.setTokens).toHaveBeenCalledWith(newTokens)
    })
  })
})