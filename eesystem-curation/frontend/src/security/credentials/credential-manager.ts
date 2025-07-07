import { cryptoManager, EncryptedData } from '../encryption/crypto-manager'
import { auditLogger } from '../audit/audit-logger'

export interface Credential {
  id: string
  name: string
  type: 'api_key' | 'token' | 'password' | 'certificate' | 'ssh_key'
  description?: string
  encryptedValue: EncryptedData
  metadata: CredentialMetadata
  createdAt: Date
  updatedAt: Date
  expiresAt?: Date
  lastUsed?: Date
  rotationSchedule?: string
}

export interface CredentialMetadata {
  provider: string
  environment: 'development' | 'staging' | 'production'
  permissions: string[]
  tags: string[]
  owner: string
}

export interface CredentialAccess {
  credentialId: string
  userId: string
  accessType: 'read' | 'use' | 'rotate'
  timestamp: Date
  ip: string
  userAgent: string
  success: boolean
  errorMessage?: string
}

export class CredentialManager {
  private static instance: CredentialManager
  private credentials: Map<string, Credential> = new Map()
  private accessLog: CredentialAccess[] = []
  private initialized = false

  static getInstance(): CredentialManager {
    if (!CredentialManager.instance) {
      CredentialManager.instance = new CredentialManager()
    }
    return CredentialManager.instance
  }

  async initialize(masterPassword: string): Promise<void> {
    await cryptoManager.initializeMasterKey(masterPassword)
    this.initialized = true
  }

  /**
   * Store a new credential
   */
  async storeCredential(
    name: string,
    type: Credential['type'],
    value: string,
    metadata: CredentialMetadata,
    expiresAt?: Date,
    rotationSchedule?: string
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('Credential manager not initialized')
    }

    const id = this.generateCredentialId()
    const encryptedValue = await cryptoManager.encryptData(value)

    const credential: Credential = {
      id,
      name,
      type,
      encryptedValue,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt,
      rotationSchedule
    }

    this.credentials.set(id, credential)

    await auditLogger.log({
      event: 'credential_created',
      userId: metadata.owner,
      resourceId: id,
      details: {
        name,
        type,
        provider: metadata.provider,
        environment: metadata.environment
      }
    })

    return id
  }

  /**
   * Retrieve a credential (returns masked value for display)
   */
  async getCredential(id: string, userId: string): Promise<Credential | null> {
    const credential = this.credentials.get(id)
    if (!credential) {
      return null
    }

    // Check if user has access
    if (!this.hasAccess(credential, userId)) {
      await this.logAccess(id, userId, 'read', false, 'Access denied')
      throw new Error('Access denied')
    }

    // Return credential without decrypted value
    return {
      ...credential,
      encryptedValue: { ...credential.encryptedValue, ciphertext: this.maskValue(credential.type) }
    }
  }

  /**
   * Retrieve and decrypt credential value for use
   */
  async getCredentialValue(id: string, userId: string, context: string): Promise<string> {
    const credential = this.credentials.get(id)
    if (!credential) {
      throw new Error('Credential not found')
    }

    // Check if user has access
    if (!this.hasAccess(credential, userId)) {
      await this.logAccess(id, userId, 'use', false, 'Access denied')
      throw new Error('Access denied')
    }

    // Check if credential is expired
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      await this.logAccess(id, userId, 'use', false, 'Credential expired')
      throw new Error('Credential expired')
    }

    try {
      const decryptedValue = await cryptoManager.decryptData(credential.encryptedValue)
      
      // Update last used timestamp
      credential.lastUsed = new Date()
      this.credentials.set(id, credential)

      await this.logAccess(id, userId, 'use', true)

      await auditLogger.log({
        event: 'credential_used',
        userId,
        resourceId: id,
        details: {
          context,
          name: credential.name,
          type: credential.type
        }
      })

      return decryptedValue
    } catch (error) {
      await this.logAccess(id, userId, 'use', false, error instanceof Error ? error.message : 'Decryption failed')
      throw new Error('Failed to decrypt credential')
    }
  }

  /**
   * Update a credential
   */
  async updateCredential(id: string, newValue: string, userId: string): Promise<void> {
    const credential = this.credentials.get(id)
    if (!credential) {
      throw new Error('Credential not found')
    }

    // Check if user has access
    if (!this.hasAccess(credential, userId)) {
      throw new Error('Access denied')
    }

    const encryptedValue = await cryptoManager.encryptData(newValue)
    
    const updatedCredential: Credential = {
      ...credential,
      encryptedValue,
      updatedAt: new Date()
    }

    this.credentials.set(id, updatedCredential)

    await auditLogger.log({
      event: 'credential_updated',
      userId,
      resourceId: id,
      details: {
        name: credential.name,
        type: credential.type
      }
    })
  }

  /**
   * Delete a credential
   */
  async deleteCredential(id: string, userId: string): Promise<void> {
    const credential = this.credentials.get(id)
    if (!credential) {
      throw new Error('Credential not found')
    }

    // Check if user has access
    if (!this.hasAccess(credential, userId)) {
      throw new Error('Access denied')
    }

    this.credentials.delete(id)

    await auditLogger.log({
      event: 'credential_deleted',
      userId,
      resourceId: id,
      details: {
        name: credential.name,
        type: credential.type
      }
    })
  }

  /**
   * List credentials for a user
   */
  listCredentials(userId: string): Array<Pick<Credential, 'id' | 'name' | 'type' | 'createdAt' | 'updatedAt' | 'expiresAt'>> {
    return Array.from(this.credentials.values())
      .filter(credential => this.hasAccess(credential, userId))
      .map(({ id, name, type, createdAt, updatedAt, expiresAt }) => ({
        id,
        name,
        type,
        createdAt,
        updatedAt,
        expiresAt
      }))
  }

  /**
   * Get credentials that need rotation
   */
  getRotationCandidates(): string[] {
    const now = new Date()
    const candidates: string[] = []

    for (const [id, credential] of this.credentials) {
      // Check expiration
      if (credential.expiresAt && credential.expiresAt <= now) {
        candidates.push(id)
        continue
      }

      // Check rotation schedule
      if (credential.rotationSchedule && credential.lastUsed) {
        const rotationInterval = this.parseRotationSchedule(credential.rotationSchedule)
        const nextRotation = new Date(credential.lastUsed.getTime() + rotationInterval)
        
        if (now >= nextRotation) {
          candidates.push(id)
        }
      }
    }

    return candidates
  }

  /**
   * Rotate a credential
   */
  async rotateCredential(id: string, newValue: string, userId: string): Promise<void> {
    await this.updateCredential(id, newValue, userId)
    
    await auditLogger.log({
      event: 'credential_rotated',
      userId,
      resourceId: id,
      details: {
        timestamp: new Date()
      }
    })
  }

  /**
   * Validate credential access
   */
  async validateCredential(id: string, userId: string): Promise<boolean> {
    const credential = this.credentials.get(id)
    if (!credential) {
      return false
    }

    // Check access permissions
    if (!this.hasAccess(credential, userId)) {
      return false
    }

    // Check expiration
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      return false
    }

    return true
  }

  /**
   * Get credential access history
   */
  getAccessHistory(credentialId: string, userId: string): CredentialAccess[] {
    const credential = this.credentials.get(credentialId)
    if (!credential || !this.hasAccess(credential, userId)) {
      return []
    }

    return this.accessLog.filter(access => access.credentialId === credentialId)
  }

  /**
   * Generate masked value for display
   */
  private maskValue(type: Credential['type']): string {
    switch (type) {
      case 'api_key':
        return 'sk-****************************'
      case 'token':
        return '****************************'
      case 'password':
        return '••••••••••••••••'
      case 'certificate':
        return '-----BEGIN CERTIFICATE-----\n****\n-----END CERTIFICATE-----'
      case 'ssh_key':
        return 'ssh-rsa ****************************'
      default:
        return '****************************'
    }
  }

  /**
   * Check if user has access to credential
   */
  private hasAccess(credential: Credential, userId: string): boolean {
    // Owner always has access
    if (credential.metadata.owner === userId) {
      return true
    }

    // Add role-based access control logic here
    // For now, only owner has access
    return false
  }

  /**
   * Log credential access
   */
  private async logAccess(
    credentialId: string,
    userId: string,
    accessType: CredentialAccess['accessType'],
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const accessRecord: CredentialAccess = {
      credentialId,
      userId,
      accessType,
      timestamp: new Date(),
      ip: 'unknown', // Would be populated from request context
      userAgent: 'unknown', // Would be populated from request context
      success,
      errorMessage
    }

    this.accessLog.push(accessRecord)

    // Keep only last 1000 access records
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-1000)
    }
  }

  /**
   * Generate unique credential ID
   */
  private generateCredentialId(): string {
    return `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Parse rotation schedule string
   */
  private parseRotationSchedule(schedule: string): number {
    const match = schedule.match(/^(\d+)([hdwm])$/)
    if (!match) {
      throw new Error(`Invalid rotation schedule format: ${schedule}`)
    }

    const value = parseInt(match[1], 10)
    const unit = match[2]

    switch (unit) {
      case 'h': return value * 60 * 60 * 1000
      case 'd': return value * 24 * 60 * 60 * 1000
      case 'w': return value * 7 * 24 * 60 * 60 * 1000
      case 'm': return value * 30 * 24 * 60 * 60 * 1000
      default: throw new Error(`Unknown rotation unit: ${unit}`)
    }
  }
}

export const credentialManager = CredentialManager.getInstance()