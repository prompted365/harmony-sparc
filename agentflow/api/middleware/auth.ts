/**
 * Authentication Middleware
 * JWT and API key authentication for AgentFlow API
 */

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ethers, verifyMessage } from 'ethers';
import { ApiRequest, AuthUser, ApiResponse, ApiErrorCode } from '../types';

interface JWTPayload {
  sub: string; // user ID
  address: string; // wallet address
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
}

interface ApiKeyData {
  id: string;
  key: string;
  userId: string;
  address: string;
  roles: string[];
  permissions: string[];
  createdAt: Date;
  lastUsed?: Date;
  rateLimit?: number;
  enabled: boolean;
}

class AuthManager {
  private apiKeys: Map<string, ApiKeyData> = new Map();
  private jwtSecret: string;
  private jwtExpiry: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
    this.jwtExpiry = process.env.JWT_EXPIRY || '1h';
    this.initializeDefaultApiKeys();
  }

  private initializeDefaultApiKeys(): void {
    // Create some default API keys for testing
    const defaultKeys: Omit<ApiKeyData, 'id' | 'createdAt'>[] = [
      {
        key: 'ak_dev_1234567890abcdef',
        userId: 'user_dev_admin',
        address: '0x742d35Cc6634C0532925a3b8D598C4F7d2A0d7F0',
        roles: ['admin', 'developer'],
        permissions: ['*'],
        enabled: true,
        rateLimit: 1000
      },
      {
        key: 'ak_test_abcdef1234567890',
        userId: 'user_test_basic',
        address: '0x8ba1f109551bD432803012645Hac136c34502d9c',
        roles: ['user'],
        permissions: ['read:workflows', 'write:workflows', 'read:agents', 'read:financial'],
        enabled: true,
        rateLimit: 100
      }
    ];

    defaultKeys.forEach(keyData => {
      const id = this.generateApiKeyId();
      this.apiKeys.set(keyData.key, {
        ...keyData,
        id,
        createdAt: new Date()
      });
    });
  }

  private generateApiKeyId(): string {
    return `ak_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateApiKey(userId: string, address: string, roles: string[], permissions: string[]): ApiKeyData {
    const key = `ak_${crypto.randomBytes(16).toString('hex')}`;
    const apiKeyData: ApiKeyData = {
      id: this.generateApiKeyId(),
      key,
      userId,
      address,
      roles,
      permissions,
      createdAt: new Date(),
      enabled: true,
      rateLimit: 100
    };

    this.apiKeys.set(key, apiKeyData);
    return apiKeyData;
  }

  validateApiKey(key: string): ApiKeyData | null {
    const apiKeyData = this.apiKeys.get(key);
    if (!apiKeyData || !apiKeyData.enabled) {
      return null;
    }

    // Update last used timestamp
    apiKeyData.lastUsed = new Date();
    return apiKeyData;
  }

  generateJWT(user: AuthUser): string {
    const payload: JWTPayload = {
      sub: user.id,
      address: user.address,
      roles: user.roles,
      permissions: user.permissions,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };

    return jwt.sign(payload, this.jwtSecret);
  }

  verifyJWT(token: string): JWTPayload | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;
      return payload;
    } catch (error) {
      return null;
    }
  }

  verifySignature(message: string, signature: string, address: string): boolean {
    try {
      const recoveredAddress = verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  hasPermission(user: AuthUser, permission: string): boolean {
    // Admin role has all permissions
    if (user.roles.includes('admin')) {
      return true;
    }

    // Check for wildcard permission
    if (user.permissions.includes('*')) {
      return true;
    }

    // Check for exact permission
    if (user.permissions.includes(permission)) {
      return true;
    }

    // Check for prefix permission (e.g., 'read:*' matches 'read:workflows')
    const permissionParts = permission.split(':');
    if (permissionParts.length === 2) {
      const prefix = `${permissionParts[0]}:*`;
      if (user.permissions.includes(prefix)) {
        return true;
      }
    }

    return false;
  }

  revokeApiKey(key: string): boolean {
    const apiKeyData = this.apiKeys.get(key);
    if (!apiKeyData) {
      return false;
    }

    apiKeyData.enabled = false;
    return true;
  }

  getAllApiKeys(userId?: string): ApiKeyData[] {
    const keys = Array.from(this.apiKeys.values());
    if (userId) {
      return keys.filter(key => key.userId === userId);
    }
    return keys;
  }

  updateApiKey(key: string, updates: Partial<ApiKeyData>): ApiKeyData | null {
    const apiKeyData = this.apiKeys.get(key);
    if (!apiKeyData) {
      return null;
    }

    Object.assign(apiKeyData, updates);
    return apiKeyData;
  }
}

// Initialize auth manager
const authManager = new AuthManager();

// Auth middleware factory
export function authMiddleware(options: {
  required?: boolean;
  permissions?: string[];
  roles?: string[];
} = {}) {
  return async (req: ApiRequest, res: Response, next: NextFunction) => {
    const { required = true, permissions = [], roles = [] } = options;

    try {
      let user: AuthUser | null = null;

      // Check for API key in header
      const apiKey = req.headers['x-api-key'] as string;
      if (apiKey) {
        const apiKeyData = authManager.validateApiKey(apiKey);
        if (apiKeyData) {
          user = {
            id: apiKeyData.userId,
            address: apiKeyData.address,
            roles: apiKeyData.roles,
            permissions: apiKeyData.permissions,
            apiKey: apiKey
          };
        }
      }

      // Check for JWT token in Authorization header
      if (!user) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const payload = authManager.verifyJWT(token);
          if (payload) {
            user = {
              id: payload.sub,
              address: payload.address,
              roles: payload.roles,
              permissions: payload.permissions
            };
          }
        }
      }

      // Check if authentication is required
      if (required && !user) {
        return res.status(401).json({
          success: false,
          error: {
            code: ApiErrorCode.UNAUTHORIZED,
            message: 'Authentication required. Please provide a valid API key or JWT token.'
          }
        } as ApiResponse);
      }

      // Check role requirements
      if (user && roles.length > 0) {
        const hasRequiredRole = roles.some(role => user!.roles.includes(role));
        if (!hasRequiredRole) {
          return res.status(403).json({
            success: false,
            error: {
              code: ApiErrorCode.FORBIDDEN,
              message: `Access denied. Required roles: ${roles.join(', ')}`
            }
          } as ApiResponse);
        }
      }

      // Check permission requirements
      if (user && permissions.length > 0) {
        const hasRequiredPermission = permissions.some(permission => 
          authManager.hasPermission(user!, permission)
        );
        if (!hasRequiredPermission) {
          return res.status(403).json({
            success: false,
            error: {
              code: ApiErrorCode.FORBIDDEN,
              message: `Access denied. Required permissions: ${permissions.join(', ')}`
            }
          } as ApiResponse);
        }
      }

      // Attach user to request
      req.user = user || undefined;
      next();

    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Authentication error',
          details: (error as Error).message
        }
      } as ApiResponse);
    }
  };
}

// Permission check middleware
export function requirePermission(permission: string) {
  return (req: ApiRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: ApiErrorCode.UNAUTHORIZED,
          message: 'Authentication required'
        }
      } as ApiResponse);
    }

    if (!authManager.hasPermission(req.user, permission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: ApiErrorCode.FORBIDDEN,
          message: `Access denied. Required permission: ${permission}`
        }
      } as ApiResponse);
    }

    next();
  };
}

// Role check middleware
export function requireRole(role: string) {
  return (req: ApiRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: ApiErrorCode.UNAUTHORIZED,
          message: 'Authentication required'
        }
      } as ApiResponse);
    }

    if (!req.user.roles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: ApiErrorCode.FORBIDDEN,
          message: `Access denied. Required role: ${role}`
        }
      } as ApiResponse);
    }

    next();
  };
}

// Signature verification middleware
export function verifySignature() {
  return (req: ApiRequest, res: Response, next: NextFunction) => {
    const { message, signature, address } = req.body;

    if (!message || !signature || !address) {
      return res.status(400).json({
        success: false,
        error: {
          code: ApiErrorCode.INVALID_REQUEST,
          message: 'Missing required fields: message, signature, address'
        }
      } as ApiResponse);
    }

    if (!authManager.verifySignature(message, signature, address)) {
      return res.status(401).json({
        success: false,
        error: {
          code: ApiErrorCode.UNAUTHORIZED,
          message: 'Invalid signature'
        }
      } as ApiResponse);
    }

    next();
  };
}

// Admin only middleware
export const requireAdmin = requireRole('admin');

// Export auth manager for use in other parts of the application
export { authManager, AuthManager };