import { auditLogger } from '../audit/audit-logger'

export interface SecurityHeaders {
  'Content-Security-Policy': string
  'X-Frame-Options': string
  'X-Content-Type-Options': string
  'Referrer-Policy': string
  'X-XSS-Protection': string
  'Strict-Transport-Security': string
  'Permissions-Policy': string
}

export interface ValidationRule {
  field: string
  type: 'string' | 'number' | 'email' | 'url' | 'uuid' | 'json'
  required: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  sanitize?: boolean
}

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  skipSuccessfulRequests: boolean
  keyGenerator: (req: any) => string
}

export class SecurityMiddleware {
  private static instance: SecurityMiddleware
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map()
  private blockedIPs: Set<string> = new Set()
  private suspiciousActivity: Map<string, number> = new Map()

  static getInstance(): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware()
    }
    return SecurityMiddleware.instance
  }

  /**
   * Generate security headers
   */
  getSecurityHeaders(nonce?: string): SecurityHeaders {
    return {
      'Content-Security-Policy': this.generateCSP(nonce),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    }
  }

  /**
   * Generate Content Security Policy
   */
  private generateCSP(nonce?: string): string {
    const baseCSP = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.* wss://* https://*.railway.app",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ]

    if (nonce) {
      baseCSP[1] = `script-src 'self' 'nonce-${nonce}'`
    }

    return baseCSP.join('; ')
  }

  /**
   * Input validation and sanitization
   */
  validateInput(data: any, rules: ValidationRule[]): { isValid: boolean; errors: string[]; sanitizedData: any } {
    const errors: string[] = []
    const sanitizedData: any = {}

    for (const rule of rules) {
      const value = data[rule.field]

      // Check required fields
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.field} is required`)
        continue
      }

      // Skip validation for optional empty fields
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue
      }

      // Type validation
      if (!this.validateType(value, rule.type)) {
        errors.push(`${rule.field} must be of type ${rule.type}`)
        continue
      }

      // Length validation
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${rule.field} must be at least ${rule.minLength} characters`)
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${rule.field} must be at most ${rule.maxLength} characters`)
      }

      // Pattern validation
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${rule.field} format is invalid`)
      }

      // Sanitization
      if (rule.sanitize) {
        sanitizedData[rule.field] = this.sanitizeInput(value)
      } else {
        sanitizedData[rule.field] = value
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData
    }
  }

  /**
   * Sanitize input to prevent XSS and injection attacks
   */
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[&]/g, '&amp;') // Escape ampersands
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .replace(/vbscript:/gi, '') // Remove vbscript: protocol
      .trim()
  }

  /**
   * Validate data type
   */
  private validateType(value: any, type: ValidationRule['type']): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      case 'url':
        try {
          new URL(value)
          return true
        } catch {
          return false
        }
      case 'uuid':
        return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      case 'json':
        try {
          JSON.parse(value)
          return true
        } catch {
          return false
        }
      default:
        return false
    }
  }

  /**
   * Rate limiting middleware
   */
  checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const entry = this.rateLimitStore.get(key)

    if (!entry || now > entry.resetTime) {
      // New window or expired window
      const resetTime = now + config.windowMs
      this.rateLimitStore.set(key, { count: 1, resetTime })
      return { allowed: true, remaining: config.maxRequests - 1, resetTime }
    }

    if (entry.count >= config.maxRequests) {
      // Rate limit exceeded
      return { allowed: false, remaining: 0, resetTime: entry.resetTime }
    }

    // Increment counter
    entry.count++
    this.rateLimitStore.set(key, entry)

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime
    }
  }

  /**
   * SQL injection detection
   */
  detectSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(\b(OR|AND)\b.*=.*)/i,
      /(--|#|\/\*|\*\/)/,
      /(\b(SLEEP|BENCHMARK|WAITFOR)\b)/i,
      /(\b(CHAR|ASCII|SUBSTRING|LENGTH|USER|DATABASE|VERSION)\b)/i
    ]

    return sqlPatterns.some(pattern => pattern.test(input))
  }

  /**
   * XSS detection
   */
  detectXSS(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*src[^>]*>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi
    ]

    return xssPatterns.some(pattern => pattern.test(input))
  }

  /**
   * CSRF token validation
   */
  validateCSRFToken(token: string, sessionToken: string): boolean {
    // Use constant-time comparison to prevent timing attacks
    if (token.length !== sessionToken.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ sessionToken.charCodeAt(i)
    }

    return result === 0
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * IP blocking management
   */
  blockIP(ip: string, reason: string): void {
    this.blockedIPs.add(ip)
    auditLogger.log({
      event: 'ip_blocked',
      userId: 'system',
      resourceId: ip,
      details: { reason }
    })
  }

  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip)
    auditLogger.log({
      event: 'ip_unblocked',
      userId: 'system',
      resourceId: ip,
      details: {}
    })
  }

  isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip)
  }

  /**
   * Suspicious activity detection
   */
  reportSuspiciousActivity(ip: string, activity: string): void {
    const current = this.suspiciousActivity.get(ip) || 0
    this.suspiciousActivity.set(ip, current + 1)

    if (current + 1 >= 5) {
      this.blockIP(ip, `Suspicious activity: ${activity}`)
    }

    auditLogger.log({
      event: 'suspicious_activity',
      userId: 'system',
      resourceId: ip,
      details: { activity, count: current + 1 }
    })
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanupRateLimitStore(): void {
    const now = Date.now()
    for (const [key, entry] of this.rateLimitStore) {
      if (now > entry.resetTime) {
        this.rateLimitStore.delete(key)
      }
    }
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    blockedIPs: number
    rateLimitEntries: number
    suspiciousIPs: number
  } {
    return {
      blockedIPs: this.blockedIPs.size,
      rateLimitEntries: this.rateLimitStore.size,
      suspiciousIPs: this.suspiciousActivity.size
    }
  }
}

export const securityMiddleware = SecurityMiddleware.getInstance()