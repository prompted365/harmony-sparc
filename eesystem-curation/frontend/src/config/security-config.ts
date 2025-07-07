export interface SecurityConfig {
  encryption: {
    algorithm: string
    keySize: number
    saltSize: number
    iterations: number
  }
  authentication: {
    tokenExpiry: number
    maxLoginAttempts: number
    lockoutDuration: number
    passwordMinLength: number
    requireMFA: boolean
  }
  authorization: {
    sessionTimeout: number
    refreshTokenExpiry: number
    roleBasedAccess: boolean
    resourcePermissions: boolean
  }
  dataProtection: {
    encryptionAtRest: boolean
    encryptionInTransit: boolean
    dataRetentionDays: number
    automaticBackup: boolean
    backupEncryption: boolean
  }
  compliance: {
    gdprEnabled: boolean
    auditLogging: boolean
    dataSubjectRights: boolean
    consentManagement: boolean
    privacyByDesign: boolean
  }
  monitoring: {
    realTimeAlerts: boolean
    securityDashboard: boolean
    threatDetection: boolean
    anomalyDetection: boolean
    incidentResponse: boolean
  }
  rateLimiting: {
    enabled: boolean
    requests: {
      windowMs: number
      max: number
    }
    login: {
      windowMs: number
      max: number
    }
    api: {
      windowMs: number
      max: number
    }
  }
  headers: {
    contentSecurityPolicy: boolean
    xFrameOptions: boolean
    xContentTypeOptions: boolean
    referrerPolicy: boolean
    xssProtection: boolean
    hstsEnabled: boolean
  }
  validation: {
    inputSanitization: boolean
    sqlInjectionPrevention: boolean
    xssPrevention: boolean
    csrfProtection: boolean
    fileUploadSecurity: boolean
  }
  railway: {
    environmentEncryption: boolean
    secretsManagement: boolean
    networkSecurity: boolean
    accessControls: boolean
    auditTrails: boolean
  }
}

export const defaultSecurityConfig: SecurityConfig = {
  encryption: {
    algorithm: 'AES-256-GCM',
    keySize: 256,
    saltSize: 128,
    iterations: 100000
  },
  authentication: {
    tokenExpiry: 3600000, // 1 hour
    maxLoginAttempts: 5,
    lockoutDuration: 900000, // 15 minutes
    passwordMinLength: 12,
    requireMFA: false
  },
  authorization: {
    sessionTimeout: 1800000, // 30 minutes
    refreshTokenExpiry: 604800000, // 7 days
    roleBasedAccess: true,
    resourcePermissions: true
  },
  dataProtection: {
    encryptionAtRest: true,
    encryptionInTransit: true,
    dataRetentionDays: 365,
    automaticBackup: true,
    backupEncryption: true
  },
  compliance: {
    gdprEnabled: true,
    auditLogging: true,
    dataSubjectRights: true,
    consentManagement: true,
    privacyByDesign: true
  },
  monitoring: {
    realTimeAlerts: true,
    securityDashboard: true,
    threatDetection: true,
    anomalyDetection: true,
    incidentResponse: true
  },
  rateLimiting: {
    enabled: true,
    requests: {
      windowMs: 60000, // 1 minute
      max: 100
    },
    login: {
      windowMs: 900000, // 15 minutes
      max: 5
    },
    api: {
      windowMs: 60000, // 1 minute
      max: 1000
    }
  },
  headers: {
    contentSecurityPolicy: true,
    xFrameOptions: true,
    xContentTypeOptions: true,
    referrerPolicy: true,
    xssProtection: true,
    hstsEnabled: true
  },
  validation: {
    inputSanitization: true,
    sqlInjectionPrevention: true,
    xssPrevention: true,
    csrfProtection: true,
    fileUploadSecurity: true
  },
  railway: {
    environmentEncryption: true,
    secretsManagement: true,
    networkSecurity: true,
    accessControls: true,
    auditTrails: true
  }
}

export class SecurityConfigManager {
  private static instance: SecurityConfigManager
  private config: SecurityConfig = { ...defaultSecurityConfig }

  static getInstance(): SecurityConfigManager {
    if (!SecurityConfigManager.instance) {
      SecurityConfigManager.instance = new SecurityConfigManager()
    }
    return SecurityConfigManager.instance
  }

  getConfig(): SecurityConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  resetToDefaults(): void {
    this.config = { ...defaultSecurityConfig }
  }

  getEnvironmentConfig(): Partial<SecurityConfig> {
    const env = process.env.NODE_ENV || 'development'
    
    switch (env) {
      case 'production':
        return {
          authentication: {
            ...this.config.authentication,
            requireMFA: true,
            passwordMinLength: 14
          },
          headers: {
            ...this.config.headers,
            hstsEnabled: true
          },
          monitoring: {
            ...this.config.monitoring,
            realTimeAlerts: true
          }
        }
      case 'staging':
        return {
          monitoring: {
            ...this.config.monitoring,
            realTimeAlerts: false
          }
        }
      case 'development':
        return {
          authentication: {
            ...this.config.authentication,
            requireMFA: false,
            passwordMinLength: 8
          },
          rateLimiting: {
            ...this.config.rateLimiting,
            enabled: false
          }
        }
      default:
        return {}
    }
  }

  applyEnvironmentConfig(): void {
    const envConfig = this.getEnvironmentConfig()
    this.updateConfig(envConfig)
  }

  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate encryption settings
    if (this.config.encryption.keySize < 128) {
      errors.push('Encryption key size must be at least 128 bits')
    }

    if (this.config.encryption.iterations < 10000) {
      errors.push('Encryption iterations must be at least 10,000')
    }

    // Validate authentication settings
    if (this.config.authentication.tokenExpiry < 300000) { // 5 minutes
      errors.push('Token expiry must be at least 5 minutes')
    }

    if (this.config.authentication.passwordMinLength < 8) {
      errors.push('Password minimum length must be at least 8 characters')
    }

    // Validate rate limiting
    if (this.config.rateLimiting.enabled) {
      if (this.config.rateLimiting.requests.max < 10) {
        errors.push('Request rate limit must allow at least 10 requests')
      }

      if (this.config.rateLimiting.login.max < 3) {
        errors.push('Login rate limit must allow at least 3 attempts')
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2)
  }

  importConfig(configJson: string): void {
    try {
      const importedConfig = JSON.parse(configJson) as SecurityConfig
      const validation = this.validateImportedConfig(importedConfig)
      
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`)
      }

      this.config = importedConfig
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private validateImportedConfig(config: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check required sections
    const requiredSections = [
      'encryption', 'authentication', 'authorization', 'dataProtection',
      'compliance', 'monitoring', 'rateLimiting', 'headers', 'validation', 'railway'
    ]

    for (const section of requiredSections) {
      if (!config[section]) {
        errors.push(`Missing required section: ${section}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

export const securityConfig = SecurityConfigManager.getInstance()