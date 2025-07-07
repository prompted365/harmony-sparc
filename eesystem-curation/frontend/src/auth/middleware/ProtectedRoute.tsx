import React, { ReactNode, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: UserRole
  requiredPermission?: {
    resource: string
    action: string
  }
  redirectTo?: string
  fallback?: ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission,
  redirectTo = '/login',
  fallback = null
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
  const location = useLocation()

  useEffect(() => {
    // Auto-refresh token if expired but user is still authenticated
    if (isAuthenticated && isTokenExpired()) {
      refreshToken().catch(console.error)
    }
  }, [isAuthenticated, isTokenExpired, refreshToken])

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  // Check role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have the required permissions to access this page.
          </p>
          <p className="text-sm text-gray-500">
            Required role: {requiredRole}
            {user && <span className="block mt-2">Your role: {user.role}</span>}
          </p>
          {fallback}
        </div>
      </div>
    )
  }

  // Check permission requirement
  if (requiredPermission && !hasPermission(requiredPermission.resource, requiredPermission.action)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have the required permissions to access this page.
          </p>
          <p className="text-sm text-gray-500">
            Required permission: {requiredPermission.action} on {requiredPermission.resource}
          </p>
          {fallback}
        </div>
      </div>
    )
  }

  // All checks passed
  return <>{children}</>
}

export default ProtectedRoute