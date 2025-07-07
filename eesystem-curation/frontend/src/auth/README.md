# EESystem Authentication System

A comprehensive authentication system with JWT token management, role-based access control (RBAC), and security features.

## Features

### 🔐 Core Authentication
- **JWT Token Management**: Access and refresh token rotation
- **Secure Password Hashing**: bcrypt with configurable rounds
- **Email Verification**: Optional email verification workflow
- **Password Reset**: Secure password reset with time-limited tokens
- **Session Management**: Multiple session support with device tracking

### 🛡️ Security Features
- **CSRF Protection**: Built-in CSRF token validation
- **XSS Prevention**: Input sanitization and content security policy
- **Rate Limiting**: Configurable rate limiting for auth endpoints
- **Brute Force Protection**: Account locking after failed attempts
- **Audit Logging**: Comprehensive audit trail for security events

### 🎭 Role-Based Access Control (RBAC)
- **User Roles**: Admin, Editor, Viewer with configurable permissions
- **Permission System**: Fine-grained resource and action-based permissions
- **Route Protection**: Frontend route protection with role/permission checks
- **API Middleware**: Backend middleware for endpoint protection

### 🔄 Real-time Features
- **WebSocket Authentication**: Secure WebSocket connections with JWT
- **Session Synchronization**: Real-time session state across tabs
- **Token Refresh**: Automatic token refresh before expiration
- **Connection Recovery**: Automatic WebSocket reconnection with exponential backoff

## Quick Start

### Frontend Setup

```tsx
import { AuthProvider } from './auth'
import App from './App'

function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}
```

### Using Authentication

```tsx
import { useAuth } from './auth'

function LoginComponent() {
  const { login, isLoading, error } = useAuth()

  const handleLogin = async (email: string, password: string) => {
    try {
      await login({ email, password })
      // User is now authenticated
    } catch (error) {
      // Handle login error
    }
  }

  return (
    // Your login form
  )
}
```

### Protected Routes

```tsx
import { ProtectedRoute } from './auth'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route path="/register" element={<RegisterForm />} />
      
      {/* Protected routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      {/* Role-based protection */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <AdminPanel />
        </ProtectedRoute>
      } />
      
      {/* Permission-based protection */}
      <Route path="/content/create" element={
        <ProtectedRoute requiredPermission={{ resource: 'content', action: 'create' }}>
          <CreateContent />
        </ProtectedRoute>
      } />
    </Routes>
  )
}
```

### Conditional Rendering

```tsx
import { AuthGuard } from './auth'

function Toolbar() {
  return (
    <div>
      <AuthGuard>
        <UserMenu />
      </AuthGuard>
      
      <AuthGuard requiredRole="admin">
        <AdminButton />
      </AuthGuard>
      
      <AuthGuard 
        requiredPermission={{ resource: 'content', action: 'create' }}
        fallback={<DisabledButton />}
      >
        <CreateButton />
      </AuthGuard>
    </div>
  )
}
```

## Backend Setup

### Environment Variables

```env
JWT_SECRET_KEY=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Security Settings
REQUIRE_EMAIL_VERIFICATION=true
ENFORCE_STRONG_PASSWORDS=true
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=900  # 15 minutes in seconds
SESSION_TIMEOUT=86400  # 24 hours in seconds

# Email Settings (for verification and password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### FastAPI Integration

```python
from fastapi import FastAPI, Depends
from app.auth.middleware.auth_middleware import require_user, require_admin, require_permission
from app.auth.models.user import UserResponse

app = FastAPI()

@app.get("/protected")
async def protected_endpoint(user: UserResponse = Depends(require_user)):
    return {"message": f"Hello {user.name}"}

@app.get("/admin-only")
async def admin_endpoint(user: UserResponse = Depends(require_admin())):
    return {"message": "Admin access granted"}

@app.post("/content")
async def create_content(
    user: UserResponse = Depends(require_permission("content", "create"))
):
    return {"message": "Content creation access granted"}
```

## API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login with email/password |
| POST | `/auth/register` | User registration |
| POST | `/auth/logout` | User logout |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user info |

### Password Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/auth/password` | Change password |
| POST | `/auth/password-reset` | Request password reset |
| POST | `/auth/password-reset/confirm` | Confirm password reset |

### Email Verification

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/verify-email` | Verify email with token |
| POST | `/auth/resend-verification` | Resend verification email |

### Session Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/sessions` | Get user sessions |
| DELETE | `/auth/sessions/{id}` | Revoke specific session |
| DELETE | `/auth/sessions` | Revoke all sessions |

### Audit & Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/audit-logs` | Get audit logs (admin only) |
| GET | `/auth/permissions/check` | Check user permissions |
| GET | `/auth/health` | Authentication service health |

## Security Configuration

### Password Policy

```typescript
const passwordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventReuse: true,
  expiryDays: 90
}
```

### Rate Limiting

```typescript
const rateLimits = {
  auth: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000 // 15 minutes
  },
  api: {
    maxRequests: 1000,
    windowMs: 60 * 60 * 1000 // 1 hour
  }
}
```

### Session Configuration

```typescript
const sessionConfig = {
  timeout: 24 * 60 * 60 * 1000, // 24 hours
  maxSessions: 5,
  enableDeviceTracking: true,
  enableLocationTracking: false
}
```

## WebSocket Authentication

```typescript
import { getWebSocketAuthManager } from './auth'

const wsManager = getWebSocketAuthManager(
  'ws://localhost:3000/ws',
  (message) => {
    // Handle WebSocket messages
    console.log('Received:', message)
  },
  (state) => {
    // Handle connection state changes
    console.log('WebSocket state:', state)
  }
)

// Connect with authentication
await wsManager.connect()

// Send authenticated message
if (wsManager.isConnected()) {
  wsManager.send({ type: 'chat', message: 'Hello!' })
}

// Reauthenticate when tokens refresh
await wsManager.reauthenticate(newTokens)

// Cleanup
wsManager.disconnect()
```

## Testing

### Running Tests

```bash
# Frontend tests
npm test auth

# Backend tests
pytest app/auth/tests/

# Integration tests
npm run test:integration
```

### Test Coverage

The authentication system includes comprehensive tests:

- **Unit Tests**: Individual component and service testing
- **Integration Tests**: End-to-end authentication flows
- **Security Tests**: Vulnerability and penetration testing
- **Performance Tests**: Load testing for auth endpoints

### Example Test

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from './auth'

test('user can login successfully', async () => {
  const user = userEvent.setup()
  
  render(
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  )
  
  await user.type(screen.getByLabelText(/email/i), 'test@example.com')
  await user.type(screen.getByLabelText(/password/i), 'password123')
  await user.click(screen.getByRole('button', { name: /sign in/i }))
  
  await waitFor(() => {
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
  })
})
```

## Deployment Considerations

### Railway Deployment

1. **Environment Variables**: Set all required environment variables in Railway dashboard
2. **Database**: Ensure AstraDB connection is properly configured
3. **SSL/TLS**: Enable HTTPS for secure token transmission
4. **CORS**: Configure CORS settings for your frontend domain

### Security Checklist

- [ ] Change default JWT secret in production
- [ ] Enable HTTPS/SSL in production
- [ ] Configure proper CORS settings
- [ ] Set up proper CSP headers
- [ ] Enable rate limiting
- [ ] Configure audit logging
- [ ] Set up monitoring and alerting
- [ ] Regular security updates

## Troubleshooting

### Common Issues

**Token Refresh Fails**
- Check if refresh token is valid and not expired
- Verify JWT secret matches between frontend and backend
- Ensure system clocks are synchronized

**CORS Errors**
- Add your frontend domain to CORS allowed origins
- Include credentials in CORS configuration
- Check preflight request handling

**Rate Limiting Triggered**
- Check if rate limits are too restrictive
- Implement exponential backoff in frontend
- Consider IP whitelisting for admin users

**WebSocket Connection Issues**
- Verify WebSocket endpoint is accessible
- Check if authentication token is valid
- Ensure proper error handling for connection drops

### Debug Mode

Enable debug logging:

```typescript
// Frontend
localStorage.setItem('auth:debug', 'true')

// Backend
import logging
logging.getLogger('app.auth').setLevel(logging.DEBUG)
```

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new features
3. Update documentation for API changes
4. Run security checks before submitting
5. Include proper error handling

## License

This authentication system is part of the EESystem Content Curation Platform and follows the project's licensing terms.