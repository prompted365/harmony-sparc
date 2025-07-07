import { cryptoManager } from '../encryption/crypto-manager'
import { securityMiddleware } from '../middleware/security-middleware'
import { auditLogger } from '../audit/audit-logger'
import { credentialManager } from '../credentials/credential-manager'
import { gdprCompliance } from '../compliance/gdpr-compliance'
import { securityMonitor } from '../monitoring/security-monitor'

export interface SecurityTestResult {
  testName: string
  passed: boolean
  duration: number
  error?: string
  details?: any
}

export interface SecurityTestSuite {
  name: string
  tests: SecurityTestResult[]
  passed: number
  failed: number
  duration: number
  coverage: number
}

export class SecurityTestRunner {
  private static instance: SecurityTestRunner
  private testResults: SecurityTestSuite[] = []

  static getInstance(): SecurityTestRunner {
    if (!SecurityTestRunner.instance) {
      SecurityTestRunner.instance = new SecurityTestRunner()
    }
    return SecurityTestRunner.instance
  }

  /**
   * Run all security tests
   */
  async runAllTests(): Promise<SecurityTestSuite[]> {
    console.log('🔒 Starting comprehensive security test suite...')
    
    const testSuites = [
      await this.runEncryptionTests(),
      await this.runAuthenticationTests(),
      await this.runInputValidationTests(),
      await this.runRateLimitingTests(),
      await this.runAuditingTests(),
      await this.runCredentialTests(),
      await this.runGDPRTests(),
      await this.runMonitoringTests(),
      await this.runSecurityHeaderTests(),
      await this.runPenetrationTests()
    ]

    this.testResults = testSuites
    await this.generateTestReport()
    
    return testSuites
  }

  /**
   * Test encryption functionality
   */
  private async runEncryptionTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = []
    const startTime = Date.now()

    // Test 1: Basic encryption/decryption
    tests.push(await this.runTest('Basic Encryption/Decryption', async () => {
      await cryptoManager.initializeMasterKey('test-password-123')
      const testData = 'sensitive-data-123'
      const encrypted = await cryptoManager.encryptData(testData)
      const decrypted = await cryptoManager.decryptData(encrypted)
      
      if (decrypted !== testData) {
        throw new Error('Decrypted data does not match original')
      }
      
      return { encrypted: !!encrypted.ciphertext, decrypted: decrypted === testData }
    }))

    // Test 2: Key derivation
    tests.push(await this.runTest('Key Derivation', async () => {
      const masterKey = 'master-key-123'
      const key1 = cryptoManager.deriveKey(masterKey, 'purpose1')
      const key2 = cryptoManager.deriveKey(masterKey, 'purpose2')
      const key3 = cryptoManager.deriveKey(masterKey, 'purpose1') // Same purpose
      
      if (key1 === key2) {
        throw new Error('Different purposes generated same key')
      }
      
      if (key1 !== key3) {
        throw new Error('Same purpose generated different keys')
      }
      
      return { key1, key2, key3, deterministicDerivation: key1 === key3 }
    }))

    // Test 3: HMAC verification
    tests.push(await this.runTest('HMAC Signature', async () => {
      const data = 'test-data'
      const key = 'test-key'
      const signature = cryptoManager.generateHMAC(data, key)
      const isValid = cryptoManager.verifyHMAC(data, signature, key)
      const isInvalid = cryptoManager.verifyHMAC('tampered-data', signature, key)
      
      if (!isValid || isInvalid) {
        throw new Error('HMAC verification failed')
      }
      
      return { signature, validSignature: isValid, invalidSignature: !isInvalid }
    }))

    // Test 4: Secure random key generation
    tests.push(await this.runTest('Secure Key Generation', async () => {
      const keys = Array.from({ length: 10 }, () => cryptoManager.generateSecureKey())
      const uniqueKeys = new Set(keys)
      
      if (uniqueKeys.size !== keys.length) {
        throw new Error('Duplicate keys generated')
      }
      
      return { keysGenerated: keys.length, uniqueKeys: uniqueKeys.size }
    }))

    const duration = Date.now() - startTime
    return this.createTestSuite('Encryption Tests', tests, duration)
  }

  /**
   * Test authentication security
   */
  private async runAuthenticationTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = []
    const startTime = Date.now()

    // Test 1: Token validation
    tests.push(await this.runTest('Token Validation', async () => {
      const validToken = securityMiddleware.generateCSRFToken()
      const isValid = securityMiddleware.validateCSRFToken(validToken, validToken)
      const isInvalid = securityMiddleware.validateCSRFToken('invalid-token', validToken)
      
      if (!isValid || isInvalid) {
        throw new Error('Token validation failed')
      }
      
      return { tokenGenerated: !!validToken, validToken: isValid, invalidToken: !isInvalid }
    }))

    // Test 2: Rate limiting for authentication
    tests.push(await this.runTest('Authentication Rate Limiting', async () => {
      const config = { windowMs: 60000, maxRequests: 3, skipSuccessfulRequests: false, keyGenerator: () => 'test-user' }
      
      const results = []
      for (let i = 0; i < 5; i++) {
        const result = securityMiddleware.checkRateLimit('test-auth', config)
        results.push(result)
      }
      
      const allowedRequests = results.filter(r => r.allowed).length
      if (allowedRequests !== 3) {
        throw new Error(`Expected 3 allowed requests, got ${allowedRequests}`)
      }
      
      return { totalRequests: results.length, allowedRequests, blockedRequests: results.length - allowedRequests }
    }))

    const duration = Date.now() - startTime
    return this.createTestSuite('Authentication Tests', tests, duration)
  }

  /**
   * Test input validation
   */
  private async runInputValidationTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = []
    const startTime = Date.now()

    // Test 1: XSS detection
    tests.push(await this.runTest('XSS Detection', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>'
      ]
      
      const detectionResults = xssPayloads.map(payload => securityMiddleware.detectXSS(payload))
      const allDetected = detectionResults.every(result => result === true)
      
      if (!allDetected) {
        throw new Error('Some XSS payloads were not detected')
      }
      
      return { payloadsTested: xssPayloads.length, allDetected }
    }))

    // Test 2: SQL injection detection
    tests.push(await this.runTest('SQL Injection Detection', async () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "UNION SELECT * FROM users",
        "'; EXEC xp_cmdshell('dir'); --"
      ]
      
      const detectionResults = sqlPayloads.map(payload => securityMiddleware.detectSQLInjection(payload))
      const allDetected = detectionResults.every(result => result === true)
      
      if (!allDetected) {
        throw new Error('Some SQL injection payloads were not detected')
      }
      
      return { payloadsTested: sqlPayloads.length, allDetected }
    }))

    // Test 3: Input sanitization
    tests.push(await this.runTest('Input Sanitization', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>normal text',
        'javascript:alert("test")',
        '"malicious"&<>test'
      ]
      
      const sanitizedInputs = maliciousInputs.map(input => securityMiddleware.sanitizeInput(input))
      const containsScript = sanitizedInputs.some(input => input.includes('<script>'))
      const containsJavascript = sanitizedInputs.some(input => input.includes('javascript:'))
      
      if (containsScript || containsJavascript) {
        throw new Error('Sanitization failed to remove malicious content')
      }
      
      return { inputsSanitized: sanitizedInputs.length, scriptsRemoved: !containsScript, javascriptRemoved: !containsJavascript }
    }))

    // Test 4: Data validation
    tests.push(await this.runTest('Data Validation', async () => {
      const testData = {
        email: 'test@example.com',
        invalidEmail: 'not-an-email',
        password: 'secure-password-123',
        shortPassword: '123',
        url: 'https://example.com',
        invalidUrl: 'not-a-url'
      }
      
      const rules = [
        { field: 'email', type: 'email' as const, required: true },
        { field: 'password', type: 'string' as const, required: true, minLength: 8 },
        { field: 'url', type: 'url' as const, required: true }
      ]
      
      const validationResult = securityMiddleware.validateInput(testData, rules)
      
      if (!validationResult.isValid) {
        throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`)
      }
      
      return { isValid: validationResult.isValid, errorsCount: validationResult.errors.length }
    }))

    const duration = Date.now() - startTime
    return this.createTestSuite('Input Validation Tests', tests, duration)
  }

  /**
   * Test rate limiting
   */
  private async runRateLimitingTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = []
    const startTime = Date.now()

    // Test 1: Basic rate limiting
    tests.push(await this.runTest('Basic Rate Limiting', async () => {
      const config = { windowMs: 60000, maxRequests: 5, skipSuccessfulRequests: false, keyGenerator: () => 'test-ip' }
      
      let allowedCount = 0
      let blockedCount = 0
      
      for (let i = 0; i < 10; i++) {
        const result = securityMiddleware.checkRateLimit(`test-${Date.now()}-${i}`, config)
        if (result.allowed) {
          allowedCount++
        } else {
          blockedCount++
        }
      }
      
      return { allowedCount, blockedCount, totalRequests: 10 }
    }))

    const duration = Date.now() - startTime
    return this.createTestSuite('Rate Limiting Tests', tests, duration)
  }

  /**
   * Test audit logging
   */
  private async runAuditingTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = []
    const startTime = Date.now()

    // Test 1: Basic audit logging
    tests.push(await this.runTest('Basic Audit Logging', async () => {
      const testEvent = {
        event: 'test_event',
        userId: 'test-user',
        resourceType: 'test_resource',
        details: { test: true }
      }
      
      await auditLogger.log(testEvent)
      
      const logs = await auditLogger.queryLogs({
        userId: 'test-user',
        limit: 1
      })
      
      if (logs.length === 0) {
        throw new Error('Audit log was not created')
      }
      
      return { eventLogged: true, logRetrieved: logs.length > 0 }
    }))

    // Test 2: Log filtering
    tests.push(await this.runTest('Log Filtering', async () => {
      // Log multiple events
      await auditLogger.log({ event: 'login', userId: 'user1', details: {} })
      await auditLogger.log({ event: 'logout', userId: 'user1', details: {} })
      await auditLogger.log({ event: 'login', userId: 'user2', details: {} })
      
      const loginLogs = await auditLogger.queryLogs({ event: 'login', limit: 10 })
      const user1Logs = await auditLogger.queryLogs({ userId: 'user1', limit: 10 })
      
      return { loginLogsCount: loginLogs.length, user1LogsCount: user1Logs.length }
    }))

    const duration = Date.now() - startTime
    return this.createTestSuite('Auditing Tests', tests, duration)
  }

  /**
   * Test credential management
   */
  private async runCredentialTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = []
    const startTime = Date.now()

    // Test 1: Credential storage and retrieval
    tests.push(await this.runTest('Credential Storage', async () => {
      await credentialManager.initialize('test-password-123')
      
      const credentialId = await credentialManager.storeCredential(
        'test-api-key',
        'api_key',
        'sk-test-key-123',
        {
          provider: 'test',
          environment: 'development',
          permissions: ['read'],
          tags: ['test'],
          owner: 'test-user'
        }
      )
      
      const retrievedValue = await credentialManager.getCredentialValue(credentialId, 'test-user', 'test')
      
      if (retrievedValue !== 'sk-test-key-123') {
        throw new Error('Retrieved credential does not match stored value')
      }
      
      return { credentialStored: !!credentialId, valueRetrieved: retrievedValue === 'sk-test-key-123' }
    }))

    const duration = Date.now() - startTime
    return this.createTestSuite('Credential Tests', tests, duration)
  }

  /**
   * Test GDPR compliance
   */
  private async runGDPRTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = []
    const startTime = Date.now()

    // Test 1: Data subject registration
    tests.push(await this.runTest('Data Subject Registration', async () => {
      const subjectId = await gdprCompliance.registerDataSubject(
        'test@example.com',
        'Test User',
        [{
          purpose: 'marketing',
          granted: true,
          grantedAt: new Date(),
          lawfulBasis: 'consent',
          consentType: 'explicit'
        }]
      )
      
      return { subjectRegistered: !!subjectId }
    }))

    // Test 2: Consent management
    tests.push(await this.runTest('Consent Management', async () => {
      const subjectId = await gdprCompliance.registerDataSubject(
        'consent-test@example.com',
        'Consent Test User',
        []
      )
      
      const consentId = await gdprCompliance.recordConsent(
        subjectId,
        'analytics',
        true,
        'consent',
        'explicit'
      )
      
      await gdprCompliance.revokeConsent(consentId)
      
      return { consentRecorded: !!consentId, consentRevoked: true }
    }))

    const duration = Date.now() - startTime
    return this.createTestSuite('GDPR Tests', tests, duration)
  }

  /**
   * Test security monitoring
   */
  private async runMonitoringTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = []
    const startTime = Date.now()

    // Test 1: Security monitoring initialization
    tests.push(await this.runTest('Security Monitoring', async () => {
      await securityMonitor.initialize()
      const stats = securityMonitor.getMonitoringStats()
      
      return { monitoringActive: stats.monitoringActive, activeThresholds: stats.activeThresholds }
    }))

    const duration = Date.now() - startTime
    return this.createTestSuite('Monitoring Tests', tests, duration)
  }

  /**
   * Test security headers
   */
  private async runSecurityHeaderTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = []
    const startTime = Date.now()

    // Test 1: Security headers generation
    tests.push(await this.runTest('Security Headers', async () => {
      const headers = securityMiddleware.getSecurityHeaders()
      
      const requiredHeaders = [
        'Content-Security-Policy',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'X-XSS-Protection',
        'Strict-Transport-Security'
      ]
      
      const missingHeaders = requiredHeaders.filter(header => !headers[header as keyof typeof headers])
      
      if (missingHeaders.length > 0) {
        throw new Error(`Missing security headers: ${missingHeaders.join(', ')}`)
      }
      
      return { headersGenerated: Object.keys(headers).length, requiredHeaders: requiredHeaders.length }
    }))

    const duration = Date.now() - startTime
    return this.createTestSuite('Security Headers Tests', tests, duration)
  }

  /**
   * Test penetration scenarios
   */
  private async runPenetrationTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = []
    const startTime = Date.now()

    // Test 1: Brute force protection
    tests.push(await this.runTest('Brute Force Protection', async () => {
      const config = { windowMs: 60000, maxRequests: 3, skipSuccessfulRequests: false, keyGenerator: () => 'attacker-ip' }
      
      let attempts = 0
      let blocked = false
      
      for (let i = 0; i < 10; i++) {
        const result = securityMiddleware.checkRateLimit('bruteforce-test', config)
        attempts++
        
        if (!result.allowed) {
          blocked = true
          break
        }
      }
      
      if (!blocked) {
        throw new Error('Brute force protection did not trigger')
      }
      
      return { attemptsBeforeBlock: attempts, protectionTriggered: blocked }
    }))

    // Test 2: Payload injection resistance
    tests.push(await this.runTest('Payload Injection Resistance', async () => {
      const maliciousPayloads = [
        '<script>document.location="http://evil.com"</script>',
        '"; DROP TABLE users; --',
        '${7*7}',
        '{{7*7}}',
        'javascript:void(0)',
        'data:text/html,<script>alert(1)</script>'
      ]
      
      let detectedCount = 0
      
      for (const payload of maliciousPayloads) {
        const xssDetected = securityMiddleware.detectXSS(payload)
        const sqlDetected = securityMiddleware.detectSQLInjection(payload)
        
        if (xssDetected || sqlDetected) {
          detectedCount++
        }
      }
      
      return { payloadsTested: maliciousPayloads.length, payloadsDetected: detectedCount }
    }))

    const duration = Date.now() - startTime
    return this.createTestSuite('Penetration Tests', tests, duration)
  }

  /**
   * Run individual test with error handling
   */
  private async runTest(name: string, testFunction: () => Promise<any>): Promise<SecurityTestResult> {
    const startTime = Date.now()
    
    try {
      const details = await testFunction()
      const duration = Date.now() - startTime
      
      return {
        testName: name,
        passed: true,
        duration,
        details
      }
    } catch (error) {
      const duration = Date.now() - startTime
      
      return {
        testName: name,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Create test suite summary
   */
  private createTestSuite(name: string, tests: SecurityTestResult[], duration: number): SecurityTestSuite {
    const passed = tests.filter(t => t.passed).length
    const failed = tests.filter(t => !t.passed).length
    const coverage = tests.length > 0 ? (passed / tests.length) * 100 : 0
    
    return {
      name,
      tests,
      passed,
      failed,
      duration,
      coverage
    }
  }

  /**
   * Generate comprehensive test report
   */
  private async generateTestReport(): Promise<void> {
    const totalTests = this.testResults.reduce((sum, suite) => sum + suite.tests.length, 0)
    const totalPassed = this.testResults.reduce((sum, suite) => sum + suite.passed, 0)
    const totalFailed = this.testResults.reduce((sum, suite) => sum + suite.failed, 0)
    const totalDuration = this.testResults.reduce((sum, suite) => sum + suite.duration, 0)
    const overallCoverage = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSuites: this.testResults.length,
        totalTests,
        totalPassed,
        totalFailed,
        totalDuration,
        overallCoverage: Math.round(overallCoverage * 100) / 100
      },
      suites: this.testResults.map(suite => ({
        name: suite.name,
        passed: suite.passed,
        failed: suite.failed,
        coverage: Math.round(suite.coverage * 100) / 100,
        duration: suite.duration,
        failedTests: suite.tests.filter(t => !t.passed).map(t => ({
          name: t.testName,
          error: t.error
        }))
      }))
    }
    
    console.log('🔒 Security Test Report:', report)
    
    // Log test results to audit system
    await auditLogger.log({
      event: 'security_tests_completed',
      userId: 'system',
      resourceType: 'security_testing',
      details: report
    })
  }

  /**
   * Get test results
   */
  getTestResults(): SecurityTestSuite[] {
    return this.testResults
  }

  /**
   * Run specific test suite
   */
  async runTestSuite(suiteName: string): Promise<SecurityTestSuite | null> {
    switch (suiteName.toLowerCase()) {
      case 'encryption':
        return await this.runEncryptionTests()
      case 'authentication':
        return await this.runAuthenticationTests()
      case 'validation':
        return await this.runInputValidationTests()
      case 'ratelimiting':
        return await this.runRateLimitingTests()
      case 'auditing':
        return await this.runAuditingTests()
      case 'credentials':
        return await this.runCredentialTests()
      case 'gdpr':
        return await this.runGDPRTests()
      case 'monitoring':
        return await this.runMonitoringTests()
      case 'headers':
        return await this.runSecurityHeaderTests()
      case 'penetration':
        return await this.runPenetrationTests()
      default:
        return null
    }
  }
}

export const securityTestRunner = SecurityTestRunner.getInstance()