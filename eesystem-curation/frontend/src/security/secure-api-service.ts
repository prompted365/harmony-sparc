import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { securityMiddleware } from './middleware/security-middleware'
import { auditLogger } from './audit/audit-logger'
import { cryptoManager } from './encryption/crypto-manager'
import { credentialManager } from './credentials/credential-manager'
import { securityConfig } from '../config/security-config'

export interface SecureApiConfig {
  baseURL: string
  timeout: number
  retryAttempts: number
  rateLimitConfig: {
    windowMs: number
    maxRequests: number
  }
  encryptPayloads: boolean
  validateResponses: boolean
  auditRequests: boolean
}

export interface RequestMetadata {
  userId?: string
  sessionId?: string
  clientInfo: {
    ip: string
    userAgent: string
    timestamp: Date
  }
  security: {
    encrypted: boolean
    validated: boolean
    rateLimited: boolean
  }
}

export class SecureApiService {
  private api: AxiosInstance
  private config: SecureApiConfig
  private csrfToken: string | null = null
  private requestCounter: Map<string, number> = new Map()

  constructor(config: Partial<SecureApiConfig> = {}) {
    this.config = {
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
      timeout: 30000,
      retryAttempts: 3,
      rateLimitConfig: {
        windowMs: 60000,
        maxRequests: 100
      },
      encryptPayloads: true,
      validateResponses: true,
      auditRequests: true,
      ...config
    }

    this.api = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: this.getSecurityHeaders(),
    })

    this.setupInterceptors()
  }

  /**
   * Get security headers
   */
  private getSecurityHeaders(): Record<string, string> {
    const securityHeaders = securityMiddleware.getSecurityHeaders()
    const csrfToken = this.getCSRFToken()

    return {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      ...securityHeaders
    }
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.api.interceptors.request.use(
      async (config) => {
        const metadata = await this.prepareRequest(config)
        config.metadata = metadata

        // Add authentication token
        const token = await this.getAuthToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // Rate limiting check
        const rateLimitKey = this.generateRateLimitKey(config)
        const rateLimitResult = securityMiddleware.checkRateLimit(rateLimitKey, this.config.rateLimitConfig)
        
        if (!rateLimitResult.allowed) {
          throw new Error('Rate limit exceeded')
        }

        // Input validation and sanitization
        if (config.data) {
          const validation = this.validateRequestData(config.data)
          if (!validation.isValid) {
            throw new Error(`Request validation failed: ${validation.errors.join(', ')}`)
          }
          config.data = validation.sanitizedData
        }

        // Encrypt sensitive payloads
        if (this.config.encryptPayloads && config.data && this.isSensitiveEndpoint(config.url || '')) {
          config.data = await this.encryptPayload(config.data)
          config.headers['X-Payload-Encrypted'] = 'true'
        }

        // Audit logging
        if (this.config.auditRequests) {
          await this.auditRequest(config, metadata)
        }

        return config
      },
      (error) => {
        this.handleRequestError(error)
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.api.interceptors.response.use(
      async (response) => {
        await this.handleSuccessResponse(response)
        return response
      },
      async (error) => {
        await this.handleErrorResponse(error)
        return Promise.reject(error)
      }
    )
  }

  /**
   * Prepare request metadata
   */
  private async prepareRequest(config: AxiosRequestConfig): Promise<RequestMetadata> {
    return {
      clientInfo: {
        ip: 'unknown', // Would be populated from request context
        userAgent: navigator.userAgent,
        timestamp: new Date()
      },
      security: {
        encrypted: false,
        validated: false,
        rateLimited: false
      }
    }
  }

  /**
   * Validate request data
   */
  private validateRequestData(data: any): { isValid: boolean; errors: string[]; sanitizedData: any } {
    // Define validation rules based on endpoint
    const rules = [
      { field: 'email', type: 'email' as const, required: false, sanitize: true },
      { field: 'password', type: 'string' as const, required: false, minLength: 8 },
      { field: 'content', type: 'string' as const, required: false, sanitize: true, maxLength: 10000 }
    ]

    return securityMiddleware.validateInput(data, rules)
  }

  /**
   * Encrypt sensitive payload
   */
  private async encryptPayload(data: any): Promise<any> {
    const jsonData = JSON.stringify(data)
    const encryptedData = await cryptoManager.encryptData(jsonData)
    return { encrypted: true, data: encryptedData }
  }

  /**
   * Decrypt response payload
   */
  private async decryptPayload(encryptedData: any): Promise<any> {
    if (!encryptedData.encrypted || !encryptedData.data) {
      return encryptedData
    }

    const decryptedJson = await cryptoManager.decryptData(encryptedData.data)
    return JSON.parse(decryptedJson)
  }

  /**
   * Check if endpoint handles sensitive data
   */
  private isSensitiveEndpoint(url: string): boolean {
    const sensitiveEndpoints = [
      '/auth/login',
      '/auth/register',
      '/users',
      '/settings',
      '/credentials',
      '/api-keys'
    ]

    return sensitiveEndpoints.some(endpoint => url.includes(endpoint))
  }

  /**
   * Generate rate limit key
   */
  private generateRateLimitKey(config: AxiosRequestConfig): string {
    const ip = 'unknown' // Would be populated from request context
    const endpoint = config.url || ''
    return `${ip}:${endpoint}`
  }

  /**
   * Get authentication token
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      // Try to get from credential manager first
      const tokenId = localStorage.getItem('auth-token-id')
      if (tokenId) {
        return await credentialManager.getCredentialValue(tokenId, 'system', 'authentication')
      }

      // Fall back to localStorage
      return localStorage.getItem('auth-token')
    } catch (error) {
      console.warn('Failed to retrieve auth token:', error)
      return localStorage.getItem('auth-token')
    }
  }

  /**
   * Get or generate CSRF token
   */
  private getCSRFToken(): string {
    if (!this.csrfToken) {
      this.csrfToken = securityMiddleware.generateCSRFToken()
    }
    return this.csrfToken
  }

  /**
   * Audit request
   */
  private async auditRequest(config: AxiosRequestConfig, metadata: RequestMetadata): Promise<void> {
    await auditLogger.log({
      event: 'api_request',
      userId: metadata.userId || 'anonymous',
      resourceType: 'api_endpoint',
      resourceId: config.url,
      details: {
        method: config.method?.toUpperCase(),
        url: config.url,
        encrypted: metadata.security.encrypted,
        timestamp: metadata.clientInfo.timestamp,
        userAgent: metadata.clientInfo.userAgent
      }
    })
  }

  /**
   * Handle successful response
   */
  private async handleSuccessResponse(response: AxiosResponse): Promise<void> {
    const config = response.config as any
    const isEncrypted = response.headers['x-payload-encrypted'] === 'true'

    // Decrypt response if needed
    if (isEncrypted && this.config.encryptPayloads) {
      response.data = await this.decryptPayload(response.data)
    }

    // Validate response if enabled
    if (this.config.validateResponses) {
      this.validateResponse(response.data)
    }

    // Audit successful response
    if (this.config.auditRequests) {
      await auditLogger.log({
        event: 'api_response_success',
        userId: config.metadata?.userId || 'anonymous',
        resourceType: 'api_endpoint',
        resourceId: config.url,
        details: {
          status: response.status,
          responseSize: JSON.stringify(response.data).length,
          encrypted: isEncrypted
        }
      })
    }
  }

  /**
   * Handle error response
   */
  private async handleErrorResponse(error: any): Promise<void> {
    const config = error.config as any
    const response = error.response

    // Handle authentication errors
    if (response?.status === 401) {
      this.handleAuthenticationError()
    }

    // Handle rate limiting
    if (response?.status === 429) {
      this.handleRateLimitError(error)
    }

    // Audit error response
    if (this.config.auditRequests) {
      await auditLogger.log({
        event: 'api_response_error',
        userId: config?.metadata?.userId || 'anonymous',
        resourceType: 'api_endpoint',
        resourceId: config?.url,
        details: {
          status: response?.status,
          error: error.message,
          stack: error.stack
        }
      })
    }

    // Detect and report security violations
    if (this.isSecurityViolation(error)) {
      await this.reportSecurityViolation(error)
    }
  }

  /**
   * Handle request error
   */
  private handleRequestError(error: any): void {
    console.error('Request preparation error:', error)
  }

  /**
   * Handle authentication error
   */
  private handleAuthenticationError(): void {
    // Clear stored tokens
    localStorage.removeItem('auth-token')
    localStorage.removeItem('auth-token-id')
    
    // Redirect to login
    window.location.href = '/login'
  }

  /**
   * Handle rate limit error
   */
  private handleRateLimitError(error: any): void {
    const retryAfter = error.response?.headers['retry-after']
    console.warn(`Rate limit exceeded. Retry after: ${retryAfter}`)
  }

  /**
   * Validate response data
   */
  private validateResponse(data: any): void {
    // Basic response validation
    if (typeof data === 'string') {
      // Check for potential XSS in response
      if (securityMiddleware.detectXSS(data)) {
        throw new Error('Potential XSS detected in response')
      }
    }
  }

  /**
   * Check if error indicates security violation
   */
  private isSecurityViolation(error: any): boolean {
    const securityStatuses = [400, 401, 403, 429]
    return securityStatuses.includes(error.response?.status)
  }

  /**
   * Report security violation
   */
  private async reportSecurityViolation(error: any): Promise<void> {
    await auditLogger.log({
      event: 'security_violation_detected',
      userId: 'system',
      resourceType: 'api_security',
      details: {
        error: error.message,
        status: error.response?.status,
        url: error.config?.url,
        timestamp: new Date()
      }
    })
  }

  /**
   * Secure API methods
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.get(url, config)
    return response.data
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.post(url, data, config)
    return response.data
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.put(url, data, config)
    return response.data
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.delete(url, config)
    return response.data
  }

  /**
   * Secure credential operations
   */
  async storeCredential(name: string, value: string, type: string): Promise<string> {
    return await credentialManager.storeCredential(
      name,
      type as any,
      value,
      {
        provider: 'api',
        environment: process.env.NODE_ENV as any || 'development',
        permissions: ['read', 'use'],
        tags: ['api'],
        owner: 'system'
      }
    )
  }

  async getCredential(id: string): Promise<string> {
    return await credentialManager.getCredentialValue(id, 'system', 'api_request')
  }

  /**
   * Security utilities
   */
  generateSecureToken(): string {
    return securityMiddleware.generateCSRFToken()
  }

  validateCSRF(token: string): boolean {
    return securityMiddleware.validateCSRFToken(token, this.csrfToken || '')
  }

  getSecurityMetrics(): any {
    return {
      requestCount: this.requestCounter.size,
      csrfToken: !!this.csrfToken,
      encryptionEnabled: this.config.encryptPayloads,
      auditingEnabled: this.config.auditRequests
    }
  }
}

// Create and export singleton instance
export const secureApiService = new SecureApiService()
export default secureApiService