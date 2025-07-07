import React, { ReactNode, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'

interface AuthGuardProps {
  children: ReactNode
  requiredRole?: UserRole
  requiredPermission?: {
    resource: string
    action: string
  }
  fallback?: ReactNode
  loadingComponent?: ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requiredRole,
  requiredPermission,
  fallback = null,
  loadingComponent = <div className="animate-pulse">Loading...</div>
}) => {
  const { 
    isAuthenticated, 
    isLoading, 
    user, 
    hasRole, 
    hasPermission,
    isTokenExpired,
    refreshToken 
  } = useAuth()

  useEffect(() => {
    // Auto-refresh token if expired but user is still authenticated
    if (isAuthenticated && isTokenExpired()) {
      refreshToken().catch(console.error)
    }
  }, [isAuthenticated, isTokenExpired, refreshToken])

  // Show loading state
  if (isLoading) {
    return <>{loadingComponent}</>
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <>{fallback}</>
  }

  // Check role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return <>{fallback}</>
  }

  // Check permission requirement
  if (requiredPermission && !hasPermission(requiredPermission.resource, requiredPermission.action)) {
    return <>{fallback}</>
  }

  // All checks passed
  return <>{children}</>
}

export default AuthGuard