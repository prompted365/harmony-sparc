import { cryptoManager, EncryptedData } from './crypto-manager'

export interface SecureEnvironmentVariable {
  key: string
  encryptedValue: EncryptedData
  category: 'api_key' | 'secret' | 'token' | 'password' | 'connection_string'
  createdAt: Date
  updatedAt: Date
  rotationSchedule?: string
  lastRotated?: Date
}

export class EnvironmentEncryption {
  private static instance: EnvironmentEncryption
  private encryptedVars: Map<string, SecureEnvironmentVariable> = new Map()
  private initialized = false

  static getInstance(): EnvironmentEncryption {
    if (!EnvironmentEncryption.instance) {
      EnvironmentEncryption.instance = new EnvironmentEncryption()
    }
    return EnvironmentEncryption.instance
  }

  async initialize(masterPassword: string): Promise<void> {
    await cryptoManager.initializeMasterKey(masterPassword)
    this.initialized = true
  }

  /**
   * Store an encrypted environment variable
   */
  async setSecureEnv(
    key: string, 
    value: string, 
    category: SecureEnvironmentVariable['category'],
    rotationSchedule?: string
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Environment encryption not initialized')
    }

    const encryptedValue = await cryptoManager.encryptData(value)
    
    const secureVar: SecureEnvironmentVariable = {
      key,
      encryptedValue,
      category,
      createdAt: new Date(),
      updatedAt: new Date(),
      rotationSchedule,
      lastRotated: new Date()
    }

    this.encryptedVars.set(key, secureVar)
  }

  /**
   * Retrieve and decrypt an environment variable
   */
  async getSecureEnv(key: string): Promise<string | null> {
    if (!this.initialized) {
      throw new Error('Environment encryption not initialized')
    }

    const secureVar = this.encryptedVars.get(key)
    if (!secureVar) {
      return null
    }

    try {
      return await cryptoManager.decryptData(secureVar.encryptedValue)
    } catch (error) {
      console.error(`Failed to decrypt environment variable ${key}:`, error)
      return null
    }
  }

  /**
   * Update an encrypted environment variable
   */
  async updateSecureEnv(key: string, newValue: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Environment encryption not initialized')
    }

    const existingVar = this.encryptedVars.get(key)
    if (!existingVar) {
      throw new Error(`Environment variable ${key} not found`)
    }

    const encryptedValue = await cryptoManager.encryptData(newValue)
    
    const updatedVar: SecureEnvironmentVariable = {
      ...existingVar,
      encryptedValue,
      updatedAt: new Date()
    }

    this.encryptedVars.set(key, updatedVar)
  }

  /**
   * Delete an encrypted environment variable
   */
  removeSecureEnv(key: string): boolean {
    return this.encryptedVars.delete(key)
  }

  /**
   * List all encrypted environment variables (without values)
   */
  listSecureEnvs(): Array<Pick<SecureEnvironmentVariable, 'key' | 'category' | 'createdAt' | 'updatedAt'>> {
    return Array.from(this.encryptedVars.values()).map(({ key, category, createdAt, updatedAt }) => ({
      key,
      category,
      createdAt,
      updatedAt
    }))
  }

  /**
   * Check if environment variables need rotation
   */
  getRotationCandidates(): string[] {
    const now = new Date()
    const candidates: string[] = []

    for (const [key, secureVar] of this.encryptedVars) {
      if (secureVar.rotationSchedule && secureVar.lastRotated) {
        const rotationInterval = this.parseRotationSchedule(secureVar.rotationSchedule)
        const nextRotation = new Date(secureVar.lastRotated.getTime() + rotationInterval)
        
        if (now >= nextRotation) {
          candidates.push(key)
        }
      }
    }

    return candidates
  }

  /**
   * Rotate a specific environment variable
   */
  async rotateSecureEnv(key: string, newValue: string): Promise<void> {
    const secureVar = this.encryptedVars.get(key)
    if (!secureVar) {
      throw new Error(`Environment variable ${key} not found`)
    }

    await this.updateSecureEnv(key, newValue)
    
    // Update rotation timestamp
    const updatedVar = this.encryptedVars.get(key)!
    updatedVar.lastRotated = new Date()
    this.encryptedVars.set(key, updatedVar)
  }

  /**
   * Export encrypted environment variables for backup
   */
  async exportSecureEnvs(): Promise<string> {
    const exportData = Array.from(this.encryptedVars.values())
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Import encrypted environment variables from backup
   */
  async importSecureEnvs(exportData: string): Promise<void> {
    const data = JSON.parse(exportData) as SecureEnvironmentVariable[]
    
    for (const secureVar of data) {
      this.encryptedVars.set(secureVar.key, secureVar)
    }
  }

  /**
   * Parse rotation schedule string (e.g., "30d", "1w", "6h")
   */
  private parseRotationSchedule(schedule: string): number {
    const match = schedule.match(/^(\d+)([hdwm])$/)
    if (!match) {
      throw new Error(`Invalid rotation schedule format: ${schedule}`)
    }

    const value = parseInt(match[1], 10)
    const unit = match[2]

    switch (unit) {
      case 'h': return value * 60 * 60 * 1000 // hours
      case 'd': return value * 24 * 60 * 60 * 1000 // days
      case 'w': return value * 7 * 24 * 60 * 60 * 1000 // weeks
      case 'm': return value * 30 * 24 * 60 * 60 * 1000 // months (approximate)
      default: throw new Error(`Unknown rotation unit: ${unit}`)
    }
  }

  /**
   * Generate secure environment variables for Railway deployment
   */
  async generateRailwayEnvs(): Promise<Record<string, string>> {
    const railwayEnvs: Record<string, string> = {}
    
    for (const [key, secureVar] of this.encryptedVars) {
      // For Railway, we store the encrypted data as JSON
      railwayEnvs[`ENCRYPTED_${key}`] = JSON.stringify(secureVar.encryptedValue)
    }

    return railwayEnvs
  }

  /**
   * Load environment variables from Railway encrypted format
   */
  async loadFromRailwayEnvs(railwayEnvs: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(railwayEnvs)) {
      if (key.startsWith('ENCRYPTED_')) {
        const originalKey = key.replace('ENCRYPTED_', '')
        const encryptedValue = JSON.parse(value) as EncryptedData
        
        const secureVar: SecureEnvironmentVariable = {
          key: originalKey,
          encryptedValue,
          category: 'secret',
          createdAt: new Date(),
          updatedAt: new Date()
        }

        this.encryptedVars.set(originalKey, secureVar)
      }
    }
  }
}

export const envEncryption = EnvironmentEncryption.getInstance()