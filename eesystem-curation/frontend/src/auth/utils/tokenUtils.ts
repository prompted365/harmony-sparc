import { AuthTokens } from '../types'

const TOKEN_STORAGE_KEY = 'eesystem_auth_tokens'
const CSRF_TOKEN_KEY = 'eesystem_csrf_token'

export const tokenUtils = {
  /**
   * Get stored tokens
   */
  getTokens(): AuthTokens | null {
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
      if (!stored) return null
      
      const tokens = JSON.parse(stored) as AuthTokens
      
      // Validate token structure
      if (!tokens.accessToken || !tokens.refreshToken || !tokens.expiresAt) {
        return null
      }
      
      return tokens
    } catch (error) {
      console.error('Error getting tokens:', error)
      return null
    }
  },

  /**
   * Set tokens in storage
   */
  setTokens(tokens: AuthTokens): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
    } catch (error) {
      console.error('Error setting tokens:', error)
    }
  },

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      localStorage.removeItem(CSRF_TOKEN_KEY)
    } catch (error) {
      console.error('Error clearing tokens:', error)
    }
  },

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    const tokens = this.getTokens()
    return tokens?.accessToken || null
  },

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    const tokens = this.getTokens()
    return tokens?.refreshToken || null
  },

  /**
   * Check if token is expired
   */
  isTokenExpired(): boolean {
    const tokens = this.getTokens()
    if (!tokens) return true
    
    // Add 30 second buffer
    return Date.now() >= (tokens.expiresAt - 30000)
  },

  /**
   * Get time until token expires (in milliseconds)
   */
  getTimeUntilExpiry(): number {
    const tokens = this.getTokens()
    if (!tokens) return 0
    
    return Math.max(0, tokens.expiresAt - Date.now())
  },

  /**
   * Check if token expires soon (within 5 minutes)
   */
  isTokenExpiringSoon(): boolean {
    const timeUntilExpiry = this.getTimeUntilExpiry()
    return timeUntilExpiry <= 5 * 60 * 1000 // 5 minutes
  },

  /**
   * Get formatted auth header
   */
  getAuthHeader(): string | null {
    const tokens = this.getTokens()
    if (!tokens || this.isTokenExpired()) return null
    
    return `${tokens.tokenType} ${tokens.accessToken}`
  },

  /**
   * Decode JWT token (basic decode without verification)
   */
  decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      
      return JSON.parse(jsonPayload)
    } catch (error) {
      console.error('Error decoding token:', error)
      return null
    }
  },

  /**
   * Get user info from token
   */
  getUserFromToken(): any {
    const accessToken = this.getAccessToken()
    if (!accessToken) return null
    
    return this.decodeToken(accessToken)
  },

  /**
   * Get CSRF token
   */
  getCsrfToken(): string | null {
    try {
      return localStorage.getItem(CSRF_TOKEN_KEY)
    } catch (error) {
      console.error('Error getting CSRF token:', error)
      return null
    }
  },

  /**
   * Set CSRF token
   */
  setCsrfToken(token: string): void {
    try {
      localStorage.setItem(CSRF_TOKEN_KEY, token)
    } catch (error) {
      console.error('Error setting CSRF token:', error)
    }
  },

  /**
   * Clear CSRF token
   */
  clearCsrfToken(): void {
    try {
      localStorage.removeItem(CSRF_TOKEN_KEY)
    } catch (error) {
      console.error('Error clearing CSRF token:', error)
    }
  },

  /**
   * Validate token format
   */
  isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') return false
    
    // Basic JWT format check (3 parts separated by dots)
    const parts = token.split('.')
    if (parts.length !== 3) return false
    
    try {
      // Try to decode each part
      atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'))
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
      
      return true
    } catch (error) {
      return false
    }
  },

  /**
   * Generate secure random string for state/nonce
   */
  generateSecureRandom(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    let result = ''
    const randomValues = new Uint8Array(length)
    
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(randomValues)
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
  }
}

export default tokenUtils