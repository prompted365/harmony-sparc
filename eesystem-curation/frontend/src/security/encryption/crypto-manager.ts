import CryptoJS from 'crypto-js'

export interface EncryptionConfig {
  algorithm: string
  keySize: number
  saltSize: number
  iterations: number
}

export interface EncryptedData {
  ciphertext: string
  salt: string
  iv: string
  tag?: string
}

export class CryptoManager {
  private static instance: CryptoManager
  private config: EncryptionConfig
  private masterKey: string | null = null

  constructor(config?: Partial<EncryptionConfig>) {
    this.config = {
      algorithm: 'AES-256-GCM',
      keySize: 256,
      saltSize: 128,
      iterations: 100000,
      ...config
    }
  }

  static getInstance(config?: Partial<EncryptionConfig>): CryptoManager {
    if (!CryptoManager.instance) {
      CryptoManager.instance = new CryptoManager(config)
    }
    return CryptoManager.instance
  }

  /**
   * Initialize master key for encryption operations
   */
  async initializeMasterKey(password: string): Promise<void> {
    const salt = CryptoJS.lib.WordArray.random(this.config.saltSize / 8)
    this.masterKey = CryptoJS.PBKDF2(password, salt, {
      keySize: this.config.keySize / 32,
      iterations: this.config.iterations
    }).toString()
  }

  /**
   * Generate a secure random key
   */
  generateSecureKey(): string {
    return CryptoJS.lib.WordArray.random(256 / 8).toString()
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  async encryptData(plaintext: string, customKey?: string): Promise<EncryptedData> {
    try {
      const key = customKey || this.masterKey
      if (!key) {
        throw new Error('Encryption key not initialized')
      }

      const salt = CryptoJS.lib.WordArray.random(this.config.saltSize / 8)
      const iv = CryptoJS.lib.WordArray.random(128 / 8)
      
      const derivedKey = CryptoJS.PBKDF2(key, salt, {
        keySize: this.config.keySize / 32,
        iterations: this.config.iterations
      })

      const encrypted = CryptoJS.AES.encrypt(plaintext, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.NoPadding
      })

      return {
        ciphertext: encrypted.ciphertext.toString(),
        salt: salt.toString(),
        iv: iv.toString(),
        tag: encrypted.tag?.toString()
      }
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  async decryptData(encryptedData: EncryptedData, customKey?: string): Promise<string> {
    try {
      const key = customKey || this.masterKey
      if (!key) {
        throw new Error('Decryption key not initialized')
      }

      const salt = CryptoJS.enc.Hex.parse(encryptedData.salt)
      const iv = CryptoJS.enc.Hex.parse(encryptedData.iv)
      
      const derivedKey = CryptoJS.PBKDF2(key, salt, {
        keySize: this.config.keySize / 32,
        iterations: this.config.iterations
      })

      const decrypted = CryptoJS.AES.decrypt(
        {
          ciphertext: CryptoJS.enc.Hex.parse(encryptedData.ciphertext),
          tag: encryptedData.tag ? CryptoJS.enc.Hex.parse(encryptedData.tag) : undefined
        } as any,
        derivedKey,
        {
          iv: iv,
          mode: CryptoJS.mode.GCM,
          padding: CryptoJS.pad.NoPadding
        }
      )

      return decrypted.toString(CryptoJS.enc.Utf8)
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Hash sensitive data using SHA-256
   */
  hashData(data: string): string {
    return CryptoJS.SHA256(data).toString()
  }

  /**
   * Generate HMAC signature for data integrity
   */
  generateHMAC(data: string, key: string): string {
    return CryptoJS.HmacSHA256(data, key).toString()
  }

  /**
   * Verify HMAC signature
   */
  verifyHMAC(data: string, signature: string, key: string): boolean {
    const expectedSignature = this.generateHMAC(data, key)
    return CryptoJS.enc.Hex.stringify(CryptoJS.enc.Hex.parse(signature)) === expectedSignature
  }

  /**
   * Secure key derivation for different purposes
   */
  deriveKey(masterKey: string, purpose: string, salt?: string): string {
    const keySalt = salt || CryptoJS.SHA256(purpose).toString()
    return CryptoJS.PBKDF2(masterKey, keySalt, {
      keySize: this.config.keySize / 32,
      iterations: this.config.iterations
    }).toString()
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(oldKey: string, newKey: string): Promise<void> {
    // This would typically re-encrypt all data with the new key
    // For now, we'll just update the master key
    this.masterKey = newKey
  }

  /**
   * Secure memory cleanup
   */
  clearSecrets(): void {
    this.masterKey = null
  }
}

export const cryptoManager = CryptoManager.getInstance()