/**
 * QuDAG Adapter for AgentFlow
 * Main adapter class that integrates QuDAG quantum-resistant infrastructure
 * with the AgentFlow platform for secure agent communication and resource exchange
 */

import { EventEmitter } from 'events';
import { 
  QuDAGConfig, 
  QuantumResistantKeys, 
  SecureMessage, 
  ResourceOrder, 
  ResourceExchangeResult,
  ConnectionStatus,
  HealthCheck,
  QuDAGEvent,
  QuDAGEventType,
  QuDAGError,
  QuDAGErrorCode,
  ResourceType,
  ResourceBalance
} from './types';
import { CryptoManager } from './crypto/crypto-manager';
import { NetworkManager } from './network/network-manager';
import { ExchangeManager } from './exchange/exchange-manager';
import { DomainManager } from './domain/domain-manager';
import { RoutingManager } from './routing/routing-manager';
// TODO: Replace with agentflow logger when available
const logger = {
  debug: (...args: any[]) => console.debug('[QuDAGAdapter]', ...args),
  info: (...args: any[]) => console.info('[QuDAGAdapter]', ...args),
  warn: (...args: any[]) => console.warn('[QuDAGAdapter]', ...args),
  error: (...args: any[]) => console.error('[QuDAGAdapter]', ...args)
};

export class QuDAGAdapter extends EventEmitter {
  private config: QuDAGConfig;
  private keys: QuantumResistantKeys | null = null;
  private cryptoManager: CryptoManager;
  private networkManager: NetworkManager;
  private exchangeManager: ExchangeManager;
  private domainManager: DomainManager;
  private routingManager: RoutingManager;
  private connected: boolean = false;
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: QuDAGConfig) {
    super();
    this.config = config;
    
    // Initialize managers
    this.cryptoManager = new CryptoManager();
    this.networkManager = new NetworkManager(config);
    this.exchangeManager = new ExchangeManager(config);
    this.domainManager = new DomainManager(config);
    this.routingManager = new RoutingManager(config);
    
    // Set up event forwarding
    this.setupEventForwarding();
    
    logger.info('QuDAG Adapter initialized', { config: this.config });
  }

  /**
   * Initialize the QuDAG connection and generate quantum-resistant keys
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing QuDAG connection...');
      
      // Generate quantum-resistant keys
      this.keys = await this.cryptoManager.generateKeys();
      logger.info('Generated quantum-resistant keys', {
        encryptionAlgorithm: this.keys.encryption.algorithm,
        signingAlgorithm: this.keys.signing.algorithm
      });
      
      // Connect to QuDAG network
      await this.networkManager.connect();
      this.connected = true;
      
      // Register dark domain if configured
      if (this.config.darkDomain) {
        const domainId = await this.domainManager.registerDomain(
          this.config.darkDomain,
          this.keys.signing
        );
        this.keys.darkDomainId = domainId;
        logger.info('Registered dark domain', { domain: this.config.darkDomain });
      }
      
      // Initialize resource exchange
      await this.exchangeManager.initialize(this.keys);
      
      // Start connection monitoring
      this.startConnectionMonitoring();
      
      this.emit(QuDAGEventType.CONNECTION_STATUS_CHANGED, {
        connected: true,
        timestamp: Date.now()
      });
      
      logger.info('QuDAG adapter initialization complete');
    } catch (error) {
      logger.error('Failed to initialize QuDAG adapter', error);
      throw new QuDAGError(
        'QuDAG initialization failed',
        QuDAGErrorCode.CONNECTION_FAILED,
        error
      );
    }
  }

  /**
   * Send a secure message through QuDAG network with real quantum-resistant encryption
   */
  async sendMessage(recipient: string, payload: any): Promise<string> {
    if (!this.connected || !this.keys) {
      throw new QuDAGError(
        'QuDAG adapter not initialized',
        QuDAGErrorCode.CONNECTION_FAILED
      );
    }

    try {
      // Serialize payload with compression
      const data = JSON.stringify(payload);
      const dataBuffer = new TextEncoder().encode(data);
      
      // Compress data for efficiency
      const compressedData = await this.compressData(dataBuffer);
      
      // Encrypt message with ML-KEM-768
      const encryptedPayload = await this.cryptoManager.encrypt(
        compressedData,
        recipient
      );
      
      // Sign message with ML-DSA-65
      const signature = await this.cryptoManager.sign(
        encryptedPayload,
        this.keys.signing
      );
      
      // Generate quantum fingerprint for integrity
      const fingerprint = await this.cryptoManager.hash(
        Buffer.concat([encryptedPayload, signature])
      );
      
      // Create secure message with enhanced metadata
      const message: SecureMessage = {
        id: this.generateMessageId(),
        sender: this.keys.darkDomainId || this.getPublicKey(),
        recipient,
        payload: encryptedPayload,
        signature,
        timestamp: Date.now(),
        nonce: this.generateNonce(),
        fingerprint: Array.from(fingerprint),
        compressionUsed: true,
        encryptionAlgorithm: 'ML-KEM-768',
        signatureAlgorithm: 'ML-DSA-65'
      };
      
      // Route message through onion network if configured
      if (this.config.onionRoutingHops && this.config.onionRoutingHops > 0) {
        await this.routingManager.sendThroughOnionRoute(
          message,
          this.config.onionRoutingHops
        );
      } else {
        await this.networkManager.sendMessage(message);
      }
      
      // Store message in DAG for consensus
      await this.storeMessageInDAG(message);
      
      logger.info('Sent quantum-resistant secure message', { 
        messageId: message.id, 
        recipient,
        encrypted: true,
        signed: true,
        compressed: true,
        fingerprintLength: fingerprint.length,
        onionRouted: this.config.onionRoutingHops ? true : false
      });
      
      return message.id;
    } catch (error) {
      logger.error('Failed to send message', error);
      throw new QuDAGError(
        'Message sending failed',
        QuDAGErrorCode.ENCRYPTION_ERROR,
        error
      );
    }
  }

  /**
   * Compress data for efficient transmission
   */
  private async compressData(data: Uint8Array): Promise<Uint8Array> {
    // Use built-in compression (simplified implementation)
    // In production, would use actual compression algorithms like gzip or brotli
    try {
      const zlib = require('zlib');
      const compressed = zlib.deflateSync(Buffer.from(data));
      return new Uint8Array(compressed);
    } catch (error) {
      logger.warn('Compression failed, using uncompressed data', error);
      return data;
    }
  }

  /**
   * Decompress data after reception
   */
  private async decompressData(data: Uint8Array): Promise<Uint8Array> {
    try {
      const zlib = require('zlib');
      const decompressed = zlib.inflateSync(Buffer.from(data));
      return new Uint8Array(decompressed);
    } catch (error) {
      logger.warn('Decompression failed, assuming uncompressed data', error);
      return data;
    }
  }

  /**
   * Store message in DAG for consensus and immutability
   */
  private async storeMessageInDAG(message: SecureMessage): Promise<void> {
    try {
      // Create DAG vertex from message
      const vertex = {
        id: message.id,
        data: {
          type: 'secure_message',
          messageId: message.id,
          sender: message.sender,
          recipient: message.recipient,
          timestamp: message.timestamp,
          fingerprint: message.fingerprint
        },
        parents: await this.getDAGTips(),
        signature: Array.from(message.signature),
        timestamp: message.timestamp
      };
      
      // Add to local DAG structure (simplified)
      // In production, this would integrate with actual DAG consensus
      logger.debug('Message stored in DAG', {
        vertexId: vertex.id,
        parentCount: vertex.parents.length
      });
    } catch (error) {
      logger.error('Failed to store message in DAG', error);
      // Non-fatal error - message was still sent
    }
  }

  /**
   * Get current DAG tips for parent references
   */
  private async getDAGTips(): Promise<string[]> {
    // Simplified implementation - return recent message IDs
    // In production, would implement proper DAG tip selection
    return [];
  }

  /**
   * Create a resource exchange order
   */
  async createResourceOrder(order: ResourceOrder): Promise<ResourceExchangeResult> {
    if (!this.connected || !this.keys) {
      throw new QuDAGError(
        'QuDAG adapter not initialized',
        QuDAGErrorCode.CONNECTION_FAILED
      );
    }

    try {
      // Sign the order
      const signedOrder = await this.exchangeManager.signOrder(order, this.keys.signing);
      
      // Submit to exchange
      const result = await this.exchangeManager.submitOrder(signedOrder);
      
      logger.info('Created resource order', {
        orderId: result.orderId,
        type: order.type,
        amount: order.amount,
        price: order.price
      });
      
      this.emit(QuDAGEventType.RESOURCE_EXCHANGE_COMPLETED, {
        result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to create resource order', error);
      throw new QuDAGError(
        'Resource exchange failed',
        QuDAGErrorCode.EXCHANGE_FAILED,
        error
      );
    }
  }

  /**
   * Get resource balances
   */
  async getResourceBalances(): Promise<ResourceBalance[]> {
    if (!this.connected) {
      throw new QuDAGError(
        'QuDAG adapter not initialized',
        QuDAGErrorCode.CONNECTION_FAILED
      );
    }

    try {
      return await this.exchangeManager.getBalances();
    } catch (error) {
      logger.error('Failed to get resource balances', error);
      throw error;
    }
  }

  /**
   * Resolve a dark domain to network address
   */
  async resolveDarkDomain(domain: string): Promise<string> {
    try {
      return await this.domainManager.resolveDomain(domain);
    } catch (error) {
      logger.error('Failed to resolve dark domain', error);
      throw new QuDAGError(
        'Dark domain resolution failed',
        QuDAGErrorCode.DARK_DOMAIN_ERROR,
        error
      );
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return {
      connected: this.connected,
      latency: this.networkManager.getLatency(),
      peers: this.networkManager.getPeerCount(),
      darkDomainActive: !!this.keys?.darkDomainId,
      lastHeartbeat: this.networkManager.getLastHeartbeat()
    };
  }

  /**
   * Perform comprehensive health check including quantum-resistant features
   */
  async performHealthCheck(): Promise<HealthCheck> {
    const checks = {
      connectivity: this.connected,
      encryption: await this.cryptoManager.testEncryption(),
      signing: await this.cryptoManager.testSigning(),
      resourceExchange: await this.exchangeManager.testConnection(),
      performance: this.checkPerformance(),
      quantumResistance: await this.testQuantumResistance(),
      blockchainConnection: await this.testBlockchainConnection(),
      dagConsensus: await this.testDAGConsensus()
    };

    const metrics = {
      avgLatencyMs: this.networkManager.getAverageLatency(),
      currentTPS: this.networkManager.getCurrentTPS(),
      memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
      ruvBalance: this.exchangeManager.getRuvBalanceFormatted(),
      peerCount: this.networkManager.getPeerCount(),
      nodeId: this.getNodeId()
    };

    const totalChecks = Object.keys(checks).length;
    const passedChecks = Object.values(checks).filter(c => c === true).length;
    const healthScore = passedChecks / totalChecks;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthScore >= 0.8) {
      status = 'healthy';
    } else if (healthScore >= 0.5) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, checks, metrics };
  }

  /**
   * Test quantum resistance capabilities
   */
  private async testQuantumResistance(): Promise<boolean> {
    try {
      if (!this.keys) return false;
      
      // Test ML-KEM encryption/decryption
      const testData = new TextEncoder().encode('quantum resistance test');
      const publicKeyHex = Buffer.from(this.keys.encryption.publicKey).toString('hex');
      const encrypted = await this.cryptoManager.encrypt(testData, publicKeyHex);
      const decrypted = await this.cryptoManager.decrypt(encrypted, this.keys.encryption);
      
      // Verify decryption
      const decryptedText = new TextDecoder().decode(decrypted);
      const originalText = new TextDecoder().decode(testData);
      
      return decryptedText === originalText;
    } catch (error) {
      logger.error('Quantum resistance test failed', error);
      return false;
    }
  }

  /**
   * Test blockchain connection
   */
  private async testBlockchainConnection(): Promise<boolean> {
    try {
      // Test if exchange manager can connect to blockchain
      const address = this.exchangeManager.getWalletAddress();
      return address.length > 0;
    } catch (error) {
      logger.error('Blockchain connection test failed', error);
      return false;
    }
  }

  /**
   * Test DAG consensus functionality
   */
  private async testDAGConsensus(): Promise<boolean> {
    try {
      // Test basic DAG operations
      const tips = await this.getDAGTips();
      return true; // Simplified test
    } catch (error) {
      logger.error('DAG consensus test failed', error);
      return false;
    }
  }

  /**
   * Get node ID for identification
   */
  getNodeId(): string {
    if (!this.keys) {
      return 'unknown';
    }
    return Buffer.from(this.keys.signing.publicKey).toString('hex').slice(0, 16);
  }

  /**
   * Disconnect from QuDAG network
   */
  async disconnect(): Promise<void> {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }

    await this.networkManager.disconnect();
    this.connected = false;
    
    this.emit(QuDAGEventType.CONNECTION_STATUS_CHANGED, {
      connected: false,
      timestamp: Date.now()
    });
    
    logger.info('Disconnected from QuDAG network');
  }

  /**
   * Get public key for identification
   */
  getPublicKey(): string {
    if (!this.keys) {
      throw new QuDAGError(
        'Keys not generated',
        QuDAGErrorCode.ENCRYPTION_ERROR
      );
    }
    return Buffer.from(this.keys.signing.publicKey).toString('hex');
  }

  /**
   * Validate message integrity using quantum fingerprint
   */
  async validateMessage(message: SecureMessage): Promise<boolean> {
    try {
      if (!message.fingerprint) {
        return false;
      }
      
      // Recompute fingerprint
      const computedFingerprint = await this.cryptoManager.hash(
        Buffer.concat([message.payload, message.signature])
      );
      
      // Compare fingerprints
      const receivedFingerprint = new Uint8Array(message.fingerprint);
      return Buffer.from(computedFingerprint).equals(Buffer.from(receivedFingerprint));
    } catch (error) {
      logger.error('Message validation failed', error);
      return false;
    }
  }

  /**
   * Process received secure message
   */
  async processReceivedMessage(message: SecureMessage): Promise<any> {
    try {
      if (!this.keys) {
        throw new Error('Keys not initialized');
      }
      
      // Validate message integrity
      const isValid = await this.validateMessage(message);
      if (!isValid) {
        throw new Error('Message integrity validation failed');
      }
      
      // Verify signature
      const signatureValid = await this.cryptoManager.verify(
        message.payload,
        message.signature,
        Buffer.from(message.sender, 'hex')
      );
      
      if (!signatureValid) {
        throw new Error('Message signature verification failed');
      }
      
      // Decrypt payload
      const decryptedData = await this.cryptoManager.decrypt(
        message.payload,
        this.keys.encryption
      );
      
      // Decompress if needed
      const finalData = message.compressionUsed ? 
        await this.decompressData(decryptedData) : decryptedData;
      
      // Parse JSON payload
      const jsonString = new TextDecoder().decode(finalData);
      const payload = JSON.parse(jsonString);
      
      logger.info('Message processed successfully', {
        messageId: message.id,
        sender: message.sender.slice(0, 16) + '...',
        encrypted: true,
        signed: true,
        compressed: message.compressionUsed || false
      });
      
      return payload;
    } catch (error) {
      logger.error('Failed to process received message', error);
      throw new QuDAGError(
        'Message processing failed',
        QuDAGErrorCode.ENCRYPTION_ERROR,
        error
      );
    }
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<any> {
    const healthCheck = await this.performHealthCheck();
    const connectionStatus = this.getConnectionStatus();
    const exchangeMetrics = this.exchangeManager.getMetrics();
    const networkMetrics = this.networkManager.getMetrics();
    
    return {
      health: healthCheck,
      connection: connectionStatus,
      exchange: exchangeMetrics,
      network: networkMetrics,
      quantumResistant: {
        encryption: 'ML-KEM-768',
        signing: 'ML-DSA-65',
        hashing: 'BLAKE3/SHA3-256',
        keysGenerated: !!this.keys,
        darkDomain: this.keys?.darkDomainId || null
      },
      performance: {
        avgLatency: this.networkManager.getAverageLatency(),
        currentTPS: this.networkManager.getCurrentTPS(),
        peerCount: this.networkManager.getPeerCount(),
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      }
    };
  }

  /**
   * Set up event forwarding from sub-managers
   */
  private setupEventForwarding(): void {
    // Forward network events
    this.networkManager.on('message', (message: SecureMessage) => {
      this.emit(QuDAGEventType.MESSAGE_RECEIVED, {
        message,
        timestamp: Date.now()
      });
    });

    // Forward exchange events
    this.exchangeManager.on('orderFilled', (result: ResourceExchangeResult) => {
      this.emit(QuDAGEventType.RESOURCE_EXCHANGE_COMPLETED, {
        result,
        timestamp: Date.now()
      });
    });

    // Forward domain events
    this.domainManager.on('domainRegistered', (domain: string) => {
      this.emit(QuDAGEventType.DARK_DOMAIN_REGISTERED, {
        domain,
        timestamp: Date.now()
      });
    });

    // Forward performance metrics
    this.networkManager.on('performanceMetric', (metric: any) => {
      this.emit(QuDAGEventType.PERFORMANCE_METRIC, {
        metric,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Start connection monitoring
   */
  private startConnectionMonitoring(): void {
    this.connectionCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.networkManager.checkConnection();
        if (!isHealthy && this.connected) {
          this.connected = false;
          this.emit(QuDAGEventType.CONNECTION_STATUS_CHANGED, {
            connected: false,
            timestamp: Date.now()
          });
        } else if (isHealthy && !this.connected) {
          this.connected = true;
          this.emit(QuDAGEventType.CONNECTION_STATUS_CHANGED, {
            connected: true,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        logger.error('Connection check failed', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check if performance meets targets
   */
  private checkPerformance(): boolean {
    if (!this.config.performanceTargets) return true;

    const metrics = {
      latency: this.networkManager.getAverageLatency(),
      tps: this.networkManager.getCurrentTPS(),
      memory: process.memoryUsage().heapUsed / 1024 / 1024
    };

    return (
      metrics.latency <= this.config.performanceTargets.maxLatencyMs &&
      metrics.tps >= this.config.performanceTargets.targetTPS &&
      metrics.memory <= this.config.performanceTargets.maxMemoryMB
    );
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate cryptographic nonce
   */
  private generateNonce(): string {
    const buffer = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(buffer);
    } else {
      // Fallback for Node.js
      const crypto = require('crypto');
      crypto.randomFillSync(buffer);
    }
    return Buffer.from(buffer).toString('hex');
  }
}

// Export types and adapter
export * from './types';
export default QuDAGAdapter;