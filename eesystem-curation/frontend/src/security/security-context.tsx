import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { cryptoManager } from './encryption/crypto-manager'
import { envEncryption } from './encryption/env-encryption'
import { credentialManager } from './credentials/credential-manager'
import { securityMiddleware } from './middleware/security-middleware'
import { auditLogger } from './audit/audit-logger'
import { gdprCompliance } from './compliance/gdpr-compliance'
import { securityMonitor } from './monitoring/security-monitor'
import { securityConfig, SecurityConfig } from '../config/security-config'

interface SecurityContextType {
  isInitialized: boolean
  config: SecurityConfig
  initializeSecurity: (masterPassword: string) => Promise<void>
  encryptData: (data: string) => Promise<any>
  decryptData: (encryptedData: any) => Promise<string>
  validateInput: (data: any, rules: any[]) => any
  checkRateLimit: (key: string, config: any) => any
  logSecurityEvent: (event: any) => Promise<void>
  getSecurityDashboard: () => Promise<any>
  reportSecurityIncident: (incident: any) => Promise<string>
  updateSecurityConfig: (updates: Partial<SecurityConfig>) => void
  exportSecurityLogs: (filter: any) => Promise<string>
  loading: boolean
  error: string | null
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined)

export const useSecurity = () => {
  const context = useContext(SecurityContext)
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider')
  }
  return context
}

interface SecurityProviderProps {
  children: ReactNode
}

export const SecurityProvider: React.FC<SecurityProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<SecurityConfig>(securityConfig.getConfig())

  useEffect(() => {
    // Apply environment-specific configuration
    securityConfig.applyEnvironmentConfig()
    setConfig(securityConfig.getConfig())
  }, [])

  const initializeSecurity = async (masterPassword: string) => {
    setLoading(true)
    setError(null)

    try {
      // Initialize all security components
      await cryptoManager.initializeMasterKey(masterPassword)
      await envEncryption.initialize(masterPassword)
      await credentialManager.initialize(masterPassword)
      await auditLogger.initialize()
      await securityMonitor.initialize()

      // Validate configuration
      const validation = securityConfig.validateConfig()
      if (!validation.isValid) {
        throw new Error(`Security configuration invalid: ${validation.errors.join(', ')}`)
      }

      // Log security initialization
      await auditLogger.log({
        event: 'security_system_initialized',
        userId: 'system',
        resourceType: 'security_system',
        details: {
          timestamp: new Date(),
          components: [
            'crypto_manager',
            'env_encryption',
            'credential_manager',
            'audit_logger',
            'security_monitor',
            'gdpr_compliance'
          ]
        }
      })

      setIsInitialized(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Security initialization failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const encryptData = async (data: string) => {
    if (!isInitialized) {
      throw new Error('Security system not initialized')
    }
    return await cryptoManager.encryptData(data)
  }

  const decryptData = async (encryptedData: any) => {
    if (!isInitialized) {
      throw new Error('Security system not initialized')
    }
    return await cryptoManager.decryptData(encryptedData)
  }

  const validateInput = (data: any, rules: any[]) => {
    return securityMiddleware.validateInput(data, rules)
  }

  const checkRateLimit = (key: string, rateLimitConfig: any) => {
    return securityMiddleware.checkRateLimit(key, rateLimitConfig)
  }

  const logSecurityEvent = async (event: any) => {
    await auditLogger.log(event)
  }

  const getSecurityDashboard = async () => {
    if (!isInitialized) {
      throw new Error('Security system not initialized')
    }
    return await securityMonitor.getSecurityDashboard()
  }

  const reportSecurityIncident = async (incident: {
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    affectedDataTypes: string[]
    affectedSubjects: number
  }) => {
    if (!isInitialized) {
      throw new Error('Security system not initialized')
    }
    
    return await gdprCompliance.reportDataBreach(
      incident.description,
      incident.severity,
      incident.affectedDataTypes,
      incident.affectedSubjects
    )
  }

  const updateSecurityConfig = (updates: Partial<SecurityConfig>) => {
    securityConfig.updateConfig(updates)
    setConfig(securityConfig.getConfig())

    // Log configuration change
    auditLogger.log({
      event: 'security_config_updated',
      userId: 'system',
      resourceType: 'security_config',
      details: {
        updates,
        timestamp: new Date()
      }
    })
  }

  const exportSecurityLogs = async (filter: any) => {
    if (!isInitialized) {
      throw new Error('Security system not initialized')
    }
    return await auditLogger.exportLogs(filter)
  }

  const value: SecurityContextType = {
    isInitialized,
    config,
    initializeSecurity,
    encryptData,
    decryptData,
    validateInput,
    checkRateLimit,
    logSecurityEvent,
    getSecurityDashboard,
    reportSecurityIncident,
    updateSecurityConfig,
    exportSecurityLogs,
    loading,
    error
  }

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  )
}

export default SecurityProvider