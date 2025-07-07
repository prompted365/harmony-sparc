import { AuthTokens, AuthUser, UserPreferences } from '../types'

const STORAGE_KEYS = {
  TOKENS: 'eesystem_auth_tokens',
  USER: 'eesystem_user_data',
  PREFERENCES: 'eesystem_user_preferences',
  REMEMBER_ME: 'eesystem_remember_me',
  USER_EMAIL: 'eesystem_user_email',
  THEME: 'eesystem_theme',
  LANGUAGE: 'eesystem_language',
  CSRF_TOKEN: 'eesystem_csrf_token',
  SESSION_DATA: 'eesystem_session_data'
}

export const storageUtils = {
  /**
   * Token management
   */
  getTokens(): AuthTokens | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TOKENS)
      if (!stored) return null
      
      const tokens = JSON.parse(stored) as AuthTokens
      
      // Validate token structure
      if (!tokens.accessToken || !tokens.refreshToken || !tokens.expiresAt) {
        return null
      }
      
      return tokens
    } catch (error) {
      console.error('Error getting tokens from storage:', error)
      return null
    }
  },

  setTokens(tokens: AuthTokens): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens))
    } catch (error) {
      console.error('Error setting tokens in storage:', error)
    }
  },

  clearTokens(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKENS)
      localStorage.removeItem(STORAGE_KEYS.CSRF_TOKEN)
    } catch (error) {
      console.error('Error clearing tokens from storage:', error)
    }
  },

  /**
   * User data management
   */
  getUserData(): AuthUser | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER)
      if (!stored) return null
      
      return JSON.parse(stored) as AuthUser
    } catch (error) {
      console.error('Error getting user data from storage:', error)
      return null
    }
  },

  setUserData(user: AuthUser): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
    } catch (error) {
      console.error('Error setting user data in storage:', error)
    }
  },

  clearUserData(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.USER)
      localStorage.removeItem(STORAGE_KEYS.PREFERENCES)
    } catch (error) {
      console.error('Error clearing user data from storage:', error)
    }
  },

  /**
   * Preferences management
   */
  getPreferences(): UserPreferences | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES)
      if (!stored) return null
      
      return JSON.parse(stored) as UserPreferences
    } catch (error) {
      console.error('Error getting preferences from storage:', error)
      return null
    }
  },

  setPreferences(preferences: UserPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences))
    } catch (error) {
      console.error('Error setting preferences in storage:', error)
    }
  },

  /**
   * Remember me functionality
   */
  getRememberMe(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME)
      return stored === 'true'
    } catch (error) {
      console.error('Error getting remember me from storage:', error)
      return false
    }
  },

  setRememberMe(remember: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, String(remember))
    } catch (error) {
      console.error('Error setting remember me in storage:', error)
    }
  },

  /**
   * User email for remember me
   */
  getUserEmail(): string | null {
    try {
      if (!this.getRememberMe()) return null
      return localStorage.getItem(STORAGE_KEYS.USER_EMAIL)
    } catch (error) {
      console.error('Error getting user email from storage:', error)
      return null
    }
  },

  setUserEmail(email: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_EMAIL, email)
    } catch (error) {
      console.error('Error setting user email in storage:', error)
    }
  },

  /**
   * Theme management
   */
  getTheme(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.THEME)
    } catch (error) {
      console.error('Error getting theme from storage:', error)
      return null
    }
  },

  setTheme(theme: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme)
    } catch (error) {
      console.error('Error setting theme in storage:', error)
    }
  },

  /**
   * Language management
   */
  getLanguage(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.LANGUAGE)
    } catch (error) {
      console.error('Error getting language from storage:', error)
      return null
    }
  },

  setLanguage(language: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LANGUAGE, language)
    } catch (error) {
      console.error('Error setting language in storage:', error)
    }
  },

  /**
   * CSRF token management
   */
  getCsrfToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.CSRF_TOKEN)
    } catch (error) {
      console.error('Error getting CSRF token from storage:', error)
      return null
    }
  },

  setCsrfToken(token: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CSRF_TOKEN, token)
    } catch (error) {
      console.error('Error setting CSRF token in storage:', error)
    }
  },

  /**
   * Session data management
   */
  getSessionData(): any {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEYS.SESSION_DATA)
      if (!stored) return null
      
      return JSON.parse(stored)
    } catch (error) {
      console.error('Error getting session data from storage:', error)
      return null
    }
  },

  setSessionData(data: any): void {
    try {
      sessionStorage.setItem(STORAGE_KEYS.SESSION_DATA, JSON.stringify(data))
    } catch (error) {
      console.error('Error setting session data in storage:', error)
    }
  },

  clearSessionData(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEYS.SESSION_DATA)
    } catch (error) {
      console.error('Error clearing session data from storage:', error)
    }
  },

  /**
   * Clear all auth-related data
   */
  clearAll(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
        sessionStorage.removeItem(key)
      })
    } catch (error) {
      console.error('Error clearing all storage:', error)
    }
  },

  /**
   * Check if storage is available
   */
  isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch (error) {
      return false
    }
  },

  /**
   * Get storage size (approximate)
   */
  getStorageSize(): number {
    try {
      let total = 0
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length
        }
      }
      return total
    } catch (error) {
      console.error('Error calculating storage size:', error)
      return 0
    }
  },

  /**
   * Export user data (for backup/migration)
   */
  exportUserData(): string {
    try {
      const data = {
        tokens: this.getTokens(),
        user: this.getUserData(),
        preferences: this.getPreferences(),
        rememberMe: this.getRememberMe(),
        userEmail: this.getUserEmail(),
        theme: this.getTheme(),
        language: this.getLanguage(),
        timestamp: new Date().toISOString()
      }
      
      return JSON.stringify(data, null, 2)
    } catch (error) {
      console.error('Error exporting user data:', error)
      return ''
    }
  },

  /**
   * Import user data (for backup/migration)
   */
  importUserData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData)
      
      if (data.tokens) this.setTokens(data.tokens)
      if (data.user) this.setUserData(data.user)
      if (data.preferences) this.setPreferences(data.preferences)
      if (data.rememberMe !== undefined) this.setRememberMe(data.rememberMe)
      if (data.userEmail) this.setUserEmail(data.userEmail)
      if (data.theme) this.setTheme(data.theme)
      if (data.language) this.setLanguage(data.language)
      
      return true
    } catch (error) {
      console.error('Error importing user data:', error)
      return false
    }
  },

  /**
   * Secure data handling for sensitive information
   */
  setSecureData(key: string, data: any, ttl?: number): void {
    try {
      const item = {
        data: data,
        timestamp: Date.now(),
        ttl: ttl || 0
      }
      
      localStorage.setItem(`secure_${key}`, JSON.stringify(item))
    } catch (error) {
      console.error('Error setting secure data:', error)
    }
  },

  getSecureData(key: string): any {
    try {
      const stored = localStorage.getItem(`secure_${key}`)
      if (!stored) return null
      
      const item = JSON.parse(stored)
      
      // Check TTL
      if (item.ttl > 0 && Date.now() - item.timestamp > item.ttl) {
        localStorage.removeItem(`secure_${key}`)
        return null
      }
      
      return item.data
    } catch (error) {
      console.error('Error getting secure data:', error)
      return null
    }
  },

  clearSecureData(key: string): void {
    try {
      localStorage.removeItem(`secure_${key}`)
    } catch (error) {
      console.error('Error clearing secure data:', error)
    }
  }
}

export default storageUtils