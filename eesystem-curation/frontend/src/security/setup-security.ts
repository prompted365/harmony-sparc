/**
 * Security Setup Script for EESystem
 * 
 * This script initializes and validates the complete security framework
 * Run this during application startup or deployment
 */

import { cryptoManager } from './encryption/crypto-manager'
import { envEncryption } from './encryption/env-encryption'
import { credentialManager } from './credentials/credential-manager'
import { securityMiddleware } from './middleware/security-middleware'
import { auditLogger } from './audit/audit-logger'
import { gdprCompliance } from './compliance/gdpr-compliance'
import { securityMonitor } from './monitoring/security-monitor'
import { railwaySecurityManager } from './railway/railway-security'
import { securityTestRunner } from './testing/security-tests'
import { securityConfig } from '../config/security-config'

export interface SecuritySetupResult {
  success: boolean
  components: {
    encryption: boolean
    credentials: boolean
    middleware: boolean
    auditing: boolean
    compliance: boolean
    monitoring: boolean
    railway: boolean
  }
  tests: {
    passed: number
    failed: number
    coverage: number
  }
  warnings: string[]
  errors: string[]
}

export class SecuritySetup {
  private static instance: SecuritySetup
  private setupResult: SecuritySetupResult | null = null

  static getInstance(): SecuritySetup {
    if (!SecuritySetup.instance) {
      SecuritySetup.instance = new SecuritySetup()
    }
    return SecuritySetup.instance
  }

  /**
   * Complete security framework setup
   */
  async setupSecurityFramework(masterPassword: string): Promise<SecuritySetupResult> {
    console.log('🔒 Starting EESystem Security Framework Setup...')
    
    const result: SecuritySetupResult = {
      success: false,
      components: {
        encryption: false,
        credentials: false,
        middleware: false,
        auditing: false,
        compliance: false,
        monitoring: false,
        railway: false
      },
      tests: {
        passed: 0,
        failed: 0,
        coverage: 0
      },
      warnings: [],
      errors: []
    }

    try {
      // 1. Initialize Encryption
      console.log('🔐 Initializing encryption system...')
      await this.setupEncryption(masterPassword, result)

      // 2. Initialize Credentials
      console.log('🔑 Initializing credential management...')
      await this.setupCredentials(masterPassword, result)

      // 3. Initialize Security Middleware
      console.log('🛡️ Initializing security middleware...')
      await this.setupMiddleware(result)

      // 4. Initialize Auditing
      console.log('📊 Initializing audit logging...')
      await this.setupAuditing(result)

      // 5. Initialize GDPR Compliance
      console.log('⚖️ Initializing GDPR compliance...')
      await this.setupCompliance(result)

      // 6. Initialize Security Monitoring
      console.log('📡 Initializing security monitoring...')
      await this.setupMonitoring(result)

      // 7. Initialize Railway Security
      console.log('🚂 Initializing Railway security...')
      await this.setupRailway(result)

      // 8. Run Security Tests
      console.log('🧪 Running security tests...')
      await this.runSecurityTests(result)

      // 9. Validate Overall Setup
      result.success = this.validateSetup(result)

      this.setupResult = result
      
      if (result.success) {
        console.log('✅ Security framework setup completed successfully!')
        await this.logSetupSuccess(result)
      } else {
        console.error('❌ Security framework setup failed!')
        await this.logSetupFailure(result)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Setup failed: ${errorMessage}`)
      console.error('💥 Security setup error:', error)
    }

    return result
  }

  /**
   * Setup encryption system
   */
  private async setupEncryption(masterPassword: string, result: SecuritySetupResult): Promise<void> {
    try {
      await cryptoManager.initializeMasterKey(masterPassword)
      await envEncryption.initialize(masterPassword)
      
      // Test encryption
      const testData = 'security-test-data'
      const encrypted = await cryptoManager.encryptData(testData)
      const decrypted = await cryptoManager.decryptData(encrypted)
      
      if (decrypted !== testData) {
        throw new Error('Encryption test failed')
      }
      
      result.components.encryption = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Encryption setup failed: ${errorMessage}`)
    }
  }

  /**
   * Setup credential management
   */
  private async setupCredentials(masterPassword: string, result: SecuritySetupResult): Promise<void> {
    try {
      await credentialManager.initialize(masterPassword)
      
      // Test credential storage
      const testCredId = await credentialManager.storeCredential(
        'Test Credential',
        'api_key',
        'test-key-value',
        {
          provider: 'test',
          environment: 'development',
          permissions: ['read'],
          tags: ['test'],
          owner: 'system'
        }
      )
      
      const retrievedValue = await credentialManager.getCredentialValue(testCredId, 'system', 'test')
      
      if (retrievedValue !== 'test-key-value') {
        throw new Error('Credential test failed')
      }
      
      // Clean up test credential
      await credentialManager.deleteCredential(testCredId, 'system')
      
      result.components.credentials = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Credential management setup failed: ${errorMessage}`)
    }
  }

  /**
   * Setup security middleware
   */
  private async setupMiddleware(result: SecuritySetupResult): Promise<void> {
    try {
      // Test middleware components
      const headers = securityMiddleware.getSecurityHeaders()
      
      if (!headers['Content-Security-Policy']) {
        throw new Error('Security headers not generated')
      }
      
      // Test XSS detection
      const xssDetected = securityMiddleware.detectXSS('<script>alert("test")</script>')
      if (!xssDetected) {
        throw new Error('XSS detection failed')
      }
      
      // Test SQL injection detection
      const sqlDetected = securityMiddleware.detectSQLInjection("'; DROP TABLE users; --")
      if (!sqlDetected) {
        throw new Error('SQL injection detection failed')
      }
      
      result.components.middleware = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Security middleware setup failed: ${errorMessage}`)
    }
  }

  /**
   * Setup audit logging
   */
  private async setupAuditing(result: SecuritySetupResult): Promise<void> {
    try {
      await auditLogger.initialize()
      
      // Test audit logging
      await auditLogger.log({
        event: 'security_setup_test',
        userId: 'system',
        resourceType: 'security_setup',
        details: { test: true }
      })
      
      result.components.auditing = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Audit logging setup failed: ${errorMessage}`)
    }
  }

  /**
   * Setup GDPR compliance
   */
  private async setupCompliance(result: SecuritySetupResult): Promise<void> {
    try {
      // Test GDPR functionality
      const subjectId = await gdprCompliance.registerDataSubject(
        'test@security-setup.com',
        'Security Test User',
        [{
          purpose: 'testing',
          granted: true,
          grantedAt: new Date(),
          lawfulBasis: 'consent',
          consentType: 'explicit'
        }]
      )
      
      if (!subjectId) {
        throw new Error('GDPR subject registration failed')
      }
      
      // Clean up test data
      await gdprCompliance.handleErasureRequest(subjectId)
      
      result.components.compliance = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`GDPR compliance setup failed: ${errorMessage}`)
    }
  }

  /**
   * Setup security monitoring
   */
  private async setupMonitoring(result: SecuritySetupResult): Promise<void> {
    try {
      await securityMonitor.initialize()
      
      const stats = securityMonitor.getMonitoringStats()
      
      if (!stats.monitoringActive) {
        result.warnings.push('Security monitoring is not active')
      }
      
      result.components.monitoring = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Security monitoring setup failed: ${errorMessage}`)
    }
  }

  /**
   * Setup Railway security
   */
  private async setupRailway(result: SecuritySetupResult): Promise<void> {
    try {
      const environment = process.env.NODE_ENV as 'development' | 'staging' | 'production' || 'development'
      await railwaySecurityManager.initialize('eesystem-project', environment)
      
      const validation = await railwaySecurityManager.validateDeploymentSecurity()
      
      if (!validation.isValid) {
        result.warnings.push(...validation.issues)
        result.warnings.push(...validation.recommendations)
      }
      
      result.components.railway = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Railway security setup failed: ${errorMessage}`)
    }
  }

  /**
   * Run comprehensive security tests
   */
  private async runSecurityTests(result: SecuritySetupResult): Promise<void> {
    try {
      const testResults = await securityTestRunner.runAllTests()
      
      const totalTests = testResults.reduce((sum, suite) => sum + suite.tests.length, 0)
      const totalPassed = testResults.reduce((sum, suite) => sum + suite.passed, 0)
      const totalFailed = testResults.reduce((sum, suite) => sum + suite.failed, 0)
      const coverage = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0
      
      result.tests = {
        passed: totalPassed,
        failed: totalFailed,
        coverage: Math.round(coverage * 100) / 100
      }
      
      if (totalFailed > 0) {
        result.warnings.push(`${totalFailed} security tests failed`)
        
        // Log failed tests
        testResults.forEach(suite => {
          suite.tests.filter(t => !t.passed).forEach(test => {
            result.warnings.push(`Test failed: ${suite.name} - ${test.testName}: ${test.error}`)
          })
        })
      }
      
      if (coverage < 90) {
        result.warnings.push(`Security test coverage is ${coverage}% (recommended: 90%+)`)
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Security testing failed: ${errorMessage}`)
    }
  }

  /**
   * Validate overall setup
   */
  private validateSetup(result: SecuritySetupResult): boolean {
    const requiredComponents = [
      'encryption',
      'credentials',
      'middleware',
      'auditing',
      'compliance'
    ]
    
    const failedComponents = requiredComponents.filter(
      component => !result.components[component as keyof typeof result.components]
    )
    
    if (failedComponents.length > 0) {
      result.errors.push(`Required components failed: ${failedComponents.join(', ')}`)
      return false
    }
    
    if (result.errors.length > 0) {
      return false
    }
    
    if (result.tests.coverage < 80) {
      result.errors.push('Security test coverage below minimum threshold (80%)')
      return false
    }
    
    return true
  }

  /**
   * Log successful setup
   */
  private async logSetupSuccess(result: SecuritySetupResult): Promise<void> {
    await auditLogger.log({
      event: 'security_framework_initialized',
      userId: 'system',
      resourceType: 'security_framework',
      details: {
        success: true,
        components: result.components,
        testsPassed: result.tests.passed,
        testsFailed: result.tests.failed,
        coverage: result.tests.coverage,
        warnings: result.warnings.length,
        timestamp: new Date()
      }
    })
  }

  /**
   * Log setup failure
   */
  private async logSetupFailure(result: SecuritySetupResult): Promise<void> {
    await auditLogger.log({
      event: 'security_framework_setup_failed',
      userId: 'system',
      resourceType: 'security_framework',
      details: {
        success: false,
        components: result.components,
        errors: result.errors,
        warnings: result.warnings,
        timestamp: new Date()
      }
    })
  }

  /**
   * Get setup result
   */
  getSetupResult(): SecuritySetupResult | null {
    return this.setupResult
  }

  /**
   * Quick security health check
   */
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = []
    
    try {
      // Check if components are initialized
      if (!this.setupResult) {
        issues.push('Security framework not initialized')
        return { healthy: false, issues }
      }
      
      // Check critical components
      if (!this.setupResult.components.encryption) {
        issues.push('Encryption system not active')
      }
      
      if (!this.setupResult.components.auditing) {
        issues.push('Audit logging not active')
      }
      
      if (!this.setupResult.components.middleware) {
        issues.push('Security middleware not active')
      }
      
      // Check monitoring
      const monitoringStats = securityMonitor.getMonitoringStats()
      if (!monitoringStats.monitoringActive) {
        issues.push('Security monitoring not active')
      }
      
      // Check configuration
      const configValidation = securityConfig.validateConfig()
      if (!configValidation.isValid) {
        issues.push(...configValidation.errors)
      }
      
    } catch (error) {
      issues.push(`Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    return {
      healthy: issues.length === 0,
      issues
    }
  }
}

export const securitySetup = SecuritySetup.getInstance()