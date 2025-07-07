/**
 * Security utilities for XSS prevention, CSRF protection, and input sanitization
 */

// Content Security Policy configuration
export const CSP_CONFIG = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'connect-src': ["'self'", process.env.VITE_API_URL || 'http://localhost:3000'],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"]
}

export const securityUtils = {
  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  sanitizeHTML(input: string): string {
    // Basic HTML sanitization - replace with proper library like DOMPurify in production
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  },

  /**
   * Validate and sanitize user input
   */
  sanitizeInput(input: string, type: 'text' | 'email' | 'url' | 'filename' = 'text'): string {
    if (!input || typeof input !== 'string') return ''

    let sanitized = input.trim()

    switch (type) {
      case 'email':
        // Remove any characters that aren't valid in email addresses
        sanitized = sanitized.replace(/[^a-zA-Z0-9@._-]/g, '')
        break
      case 'url':
        // Basic URL sanitization
        try {
          const url = new URL(sanitized)
          if (!['http:', 'https:'].includes(url.protocol)) {
            return ''
          }
          sanitized = url.toString()
        } catch {
          return ''
        }
        break
      case 'filename':
        // Remove dangerous characters from filenames
        sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '')
        break
      case 'text':
      default:
        // Basic text sanitization
        sanitized = this.sanitizeHTML(sanitized)
        break
    }

    return sanitized
  },

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  },

  /**
   * Validate CSRF token format
   */
  isValidCSRFToken(token: string): boolean {
    return /^[a-f0-9]{64}$/.test(token)
  },

  /**
   * Set secure headers for requests
   */
  getSecureHeaders(csrfToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }

    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }

    return headers
  },

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {
    isValid: boolean
    score: number
    feedback: string[]
  } {
    const feedback: string[] = []
    let score = 0

    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters long')
    } else {
      score++
    }

    if (!/[a-z]/.test(password)) {
      feedback.push('Password must contain at least one lowercase letter')
    } else {
      score++
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push('Password must contain at least one uppercase letter')
    } else {
      score++
    }

    if (!/[0-9]/.test(password)) {
      feedback.push('Password must contain at least one number')
    } else {
      score++
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
      feedback.push('Password must contain at least one special character')
    } else {
      score++
    }

    // Check for common patterns
    if (/(.)\1{2,}/.test(password)) {
      feedback.push('Password should not contain repeated characters')
      score = Math.max(0, score - 1)
    }

    if (/123456|password|qwerty|abc123|admin|root/i.test(password)) {
      feedback.push('Password should not contain common words or patterns')
      score = Math.max(0, score - 2)
    }

    return {
      isValid: score >= 4,
      score,
      feedback
    }
  },

  /**
   * Check if email is potentially suspicious
   */
  validateEmail(email: string): {
    isValid: boolean
    isSuspicious: boolean
    reason?: string
  } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    if (!emailRegex.test(email)) {
      return { isValid: false, isSuspicious: false, reason: 'Invalid email format' }
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /[0-9]{10,}/, // Too many consecutive numbers
      /[a-z]{20,}/i, // Too many consecutive letters
      /test|temp|fake|dummy|example/i, // Common test words
      /(.)\1{3,}/, // Repeated characters
    ]

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(email)) {
        return { 
          isValid: true, 
          isSuspicious: true, 
          reason: 'Email appears to be temporary or fake' 
        }
      }
    }

    return { isValid: true, isSuspicious: false }
  },

  /**
   * Rate limiting helper
   */
  createRateLimiter(maxRequests: number, windowMs: number) {
    const requests = new Map<string, number[]>()

    return (identifier: string): boolean => {
      const now = Date.now()
      const windowStart = now - windowMs
      
      if (!requests.has(identifier)) {
        requests.set(identifier, [])
      }

      const userRequests = requests.get(identifier)!
      
      // Remove old requests outside the window
      const recentRequests = userRequests.filter(time => time > windowStart)
      requests.set(identifier, recentRequests)

      // Check if limit exceeded
      if (recentRequests.length >= maxRequests) {
        return false
      }

      // Add current request
      recentRequests.push(now)
      requests.set(identifier, recentRequests)

      return true
    }
  },

  /**
   * Secure random string generation
   */
  generateSecureRandom(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    let result = ''
    
    if (crypto && crypto.getRandomValues) {
      const randomValues = new Uint8Array(length)
      crypto.getRandomValues(randomValues)
      
      for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length]
      }
    } else {
      // Fallback for environments without crypto.getRandomValues
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)]
      }
    }
    
    return result
  },

  /**
   * Check if running in secure context
   */
  isSecureContext(): boolean {
    return window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost'
  },

  /**
   * Detect potential security threats in user agent
   */
  analyzeThreatIndicators(userAgent: string, ip?: string): {
    threatLevel: 'low' | 'medium' | 'high'
    indicators: string[]
  } {
    const indicators: string[] = []
    let threatLevel: 'low' | 'medium' | 'high' = 'low'

    // Check for automated tools
    const botPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|python|perl|java/i,
      /postman|insomnia|httpie/i
    ]

    for (const pattern of botPatterns) {
      if (pattern.test(userAgent)) {
        indicators.push('Automated tool detected')
        threatLevel = 'medium'
        break
      }
    }

    // Check for unusual user agents
    if (userAgent.length < 10 || userAgent.length > 500) {
      indicators.push('Unusual user agent length')
      threatLevel = 'medium'
    }

    // Check for missing common browser indicators
    if (!/Mozilla|Chrome|Firefox|Safari|Edge|Opera/i.test(userAgent)) {
      indicators.push('Non-standard browser')
      threatLevel = 'medium'
    }

    // Check IP if provided
    if (ip) {
      // Check for localhost or private IPs in production
      if (process.env.NODE_ENV === 'production') {
        if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(ip)) {
          indicators.push('Private/localhost IP in production')
          threatLevel = 'high'
        }
      }
    }

    return { threatLevel, indicators }
  },

  /**
   * Escape string for use in regex
   */
  escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  },

  /**
   * Check content for potential injection attempts
   */
  detectInjectionAttempts(content: string): {
    hasThreat: boolean
    type?: 'sql' | 'xss' | 'ldap' | 'command'
    pattern?: string
  } {
    const injectionPatterns = {
      sql: [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
        /('|(--)|;|\||(\*|\%)|(\$\$))/,
        /(\bOR\b.*=.*|AND\b.*=.*)/i
      ],
      xss: [
        /<script[^>]*>.*?<\/script>/is,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe[^>]*>/i,
        /eval\s*\(/i
      ],
      ldap: [
        /(\*|\|\||\&\&|\!)/,
        /(\(\||\(\&|\(\!)/
      ],
      command: [
        /(\||;|&|`|\$\(|\${)/,
        /(rm|cat|ls|ps|kill|sudo|chmod)/i
      ]
    }

    for (const [type, patterns] of Object.entries(injectionPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return {
            hasThreat: true,
            type: type as 'sql' | 'xss' | 'ldap' | 'command',
            pattern: pattern.toString()
          }
        }
      }
    }

    return { hasThreat: false }
  }
}

export default securityUtils