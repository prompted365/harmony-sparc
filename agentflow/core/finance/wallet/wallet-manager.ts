// Multi-asset wallet manager - Main orchestrator

import { ethers, Provider, Wallet } from 'ethers';
import { EventEmitter } from 'events';
import {
  WalletConfig,
  EncryptedWallet,
  WalletRecovery,
  TransactionRequest,
  Transaction,
  AssetBalance,
  WalletStats,
  TokenType,
  WalletEvent,
  SecurityConfig
} from './types';
import { KeyManager } from './key-manager';
import { TransactionManager } from './transaction-manager';
import { BalanceTracker } from './balance-tracker';

export class WalletManager extends EventEmitter {
  private wallets: Map<string, EncryptedWallet> = new Map();
  private keyManager: KeyManager;
  private transactionManager: TransactionManager;
  private balanceTracker: BalanceTracker;
  private provider: Provider;
  private securityConfig: SecurityConfig;
  private eventHistory: WalletEvent[] = [];

  constructor(
    provider: Provider,
    securityConfig: Partial<SecurityConfig> = {}
  ) {
    super();
    this.provider = provider;
    this.securityConfig = {
      requireBiometric: false,
      require2FA: false,
      sessionTimeout: 1800000, // 30 minutes
      maxFailedAttempts: 3,
      quantumResistant: false,
      ...securityConfig
    };

    this.keyManager = new KeyManager(this.securityConfig);
    this.transactionManager = new TransactionManager(provider, this.keyManager);
    this.balanceTracker = new BalanceTracker(provider);

    this.setupEventHandlers();
  }

  /**
   * Create a new wallet
   */
  async createWallet(
    config: WalletConfig,
    password: string,
    mnemonic?: string
  ): Promise<EncryptedWallet> {
    try {
      const wallet = mnemonic
        ? await this.keyManager.createEncryptedWallet(mnemonic, password, config.id)
        : await this.keyManager.createEncryptedWallet('', password, config.id);

      this.wallets.set(config.id, wallet);
      
      // Start balance tracking
      await this.setupBalanceTracking(config.id);
      
      const event: WalletEvent = {
        type: 'created',
        walletId: config.id,
        timestamp: new Date(),
        data: { config }
      };
      
      this.addEvent(event);
      this.emit('wallet:created', wallet);
      
      return wallet;
    } catch (error) {
      this.emit('error', { type: 'wallet:creation', error });
      throw error;
    }
  }

  /**
   * Import an existing wallet
   */
  async importWallet(
    config: WalletConfig,
    password: string,
    recovery: WalletRecovery
  ): Promise<EncryptedWallet> {
    try {
      const wallet = await this.keyManager.importWallet(recovery, password);
      wallet.id = config.id;
      
      this.wallets.set(config.id, wallet);
      
      // Start balance tracking
      await this.setupBalanceTracking(config.id);
      
      const event: WalletEvent = {
        type: 'imported',
        walletId: config.id,
        timestamp: new Date(),
        data: { config, recoveryMethod: Object.keys(recovery)[0] }
      };
      
      this.addEvent(event);
      this.emit('wallet:imported', wallet);
      
      return wallet;
    } catch (error) {
      this.emit('error', { type: 'wallet:import', error });
      throw error;
    }
  }

  /**
   * Get wallet by ID
   */
  getWallet(walletId: string): EncryptedWallet | undefined {
    return this.wallets.get(walletId);
  }

  /**
   * List all wallets
   */
  listWallets(): EncryptedWallet[] {
    return Array.from(this.wallets.values());
  }

  /**
   * Get wallet address (requires decryption)
   */
  async getWalletAddress(
    walletId: string,
    password: string
  ): Promise<string> {
    const wallet = this.getWallet(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const privateKey = await this.keyManager.decryptKey(
      wallet.encryptedSeed,
      password,
      wallet.salt,
      wallet.iv,
      wallet.authTag
    );

    const ethersWallet = new Wallet(privateKey);
    return ethersWallet.address;
  }

  /**
   * Get wallet balances
   */
  async getWalletBalances(walletId: string): Promise<AssetBalance[]> {
    const wallet = this.getWallet(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Get address first (this would require caching in production)
    const address = await this.getWalletAddress(walletId, 'temp'); // Need password management
    return this.balanceTracker.getBalances(address);
  }

  /**
   * Send transaction
   */
  async sendTransaction(
    walletId: string,
    password: string,
    request: TransactionRequest
  ): Promise<Transaction> {
    const wallet = this.getWallet(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    try {
      // Sign transaction
      const signedTx = await this.transactionManager.prepareTransaction(
        request,
        wallet,
        password
      );

      // Broadcast transaction
      const transaction = await this.transactionManager.broadcastTransaction(
        signedTx,
        { walletId, tokenType: request.tokenType, contractAddress: request.contractAddress }
      );

      const event: WalletEvent = {
        type: 'transaction',
        walletId,
        timestamp: new Date(),
        data: { transaction }
      };

      this.addEvent(event);
      this.emit('transaction:sent', transaction);

      return transaction;
    } catch (error) {
      this.emit('error', { type: 'transaction:send', error });
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    walletId: string,
    password: string,
    tokenType?: TokenType
  ): Promise<Transaction[]> {
    const address = await this.getWalletAddress(walletId, password);
    return this.transactionManager.getTransactionHistory(address, tokenType);
  }

  /**
   * Get wallet statistics
   */
  async getWalletStats(
    walletId: string,
    password: string
  ): Promise<WalletStats> {
    const address = await this.getWalletAddress(walletId, password);
    const transactions = await this.transactionManager.getTransactionHistory(address);
    return this.balanceTracker.calculateStats(address, transactions);
  }

  /**
   * Export wallet
   */
  async exportWallet(
    walletId: string,
    password: string,
    format: 'mnemonic' | 'privateKey' | 'keystore'
  ): Promise<string> {
    const wallet = this.getWallet(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const exported = await this.keyManager.exportWallet(wallet, password, format);
    
    const event: WalletEvent = {
      type: 'exported',
      walletId,
      timestamp: new Date(),
      data: { format }
    };

    this.addEvent(event);
    this.emit('wallet:exported', { walletId, format });

    return exported;
  }

  /**
   * Remove wallet
   */
  async removeWallet(walletId: string, password: string): Promise<void> {
    const wallet = this.getWallet(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Verify password before deletion
    try {
      await this.keyManager.decryptKey(
        wallet.encryptedSeed,
        password,
        wallet.salt,
        wallet.iv,
        wallet.authTag
      );
    } catch {
      throw new Error('Invalid password');
    }

    // Stop balance tracking
    const address = await this.getWalletAddress(walletId, password);
    this.balanceTracker.stopTracking(address);

    // Remove from storage
    this.wallets.delete(walletId);

    this.emit('wallet:removed', { walletId });
  }

  /**
   * Setup balance tracking for a wallet
   */
  private async setupBalanceTracking(walletId: string): Promise<void> {
    // Default tokens to track
    const defaultTokens = [
      { type: TokenType.ETH, symbol: 'ETH', decimals: 18 },
      { type: TokenType.AGC, symbol: 'AGC', decimals: 18, contractAddress: '0x...' },
      { type: TokenType.RUV, symbol: 'RUV', decimals: 18, contractAddress: '0x...' },
      { type: TokenType.TASK_NFT, symbol: 'TASK', decimals: 0, contractAddress: '0x...' }
    ];

    // In production, get address without password (use session management)
    // For now, this is a placeholder
    const address = `0x${walletId.substring(0, 40)}`; // Placeholder
    
    await this.balanceTracker.trackAddress(address, defaultTokens);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Key manager events
    this.keyManager.on('wallet:generated', (data) => {
      this.emit('wallet:generated', data);
    });

    this.keyManager.on('error', (error) => {
      this.emit('error', error);
    });

    // Transaction manager events
    this.transactionManager.on('transaction:signed', (data) => {
      this.emit('transaction:signed', data);
    });

    this.transactionManager.on('transaction:broadcasted', (data) => {
      this.emit('transaction:broadcasted', data);
    });

    this.transactionManager.on('transaction:confirmed', (data) => {
      this.emit('transaction:confirmed', data);
    });

    this.transactionManager.on('transaction:failed', (data) => {
      this.emit('transaction:failed', data);
    });

    // Balance tracker events
    this.balanceTracker.on('balances:updated', (data) => {
      this.emit('balances:updated', data);
    });

    this.balanceTracker.on('tracking:started', (data) => {
      this.emit('tracking:started', data);
    });
  }

  /**
   * Add event to history
   */
  private addEvent(event: WalletEvent): void {
    this.eventHistory.push(event);
    
    // Keep only last 1000 events
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-1000);
    }
  }

  /**
   * Get event history
   */
  getEventHistory(walletId?: string): WalletEvent[] {
    if (walletId) {
      return this.eventHistory.filter(e => e.walletId === walletId);
    }
    return this.eventHistory;
  }

  /**
   * Batch operations for multiple wallets
   */
  async batchOperation<T>(
    operation: (walletId: string) => Promise<T>,
    walletIds: string[]
  ): Promise<Array<{ walletId: string; result?: T; error?: Error }>> {
    const results = await Promise.allSettled(
      walletIds.map(async (walletId) => ({ walletId, result: await operation(walletId) }))
    );

    return results.map((result, index) => {
      const walletId = walletIds[index];
      if (result.status === 'fulfilled') {
        return { walletId, result: result.value.result };
      } else {
        return { walletId, error: result.reason };
      }
    });
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    walletsCount: number;
    activeTracking: number;
    lastError?: Error;
    uptime: number;
  } {
    return {
      walletsCount: this.wallets.size,
      activeTracking: this.balanceTracker['trackedAddresses'].size,
      uptime: process.uptime()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Stop all balance tracking
    for (const address of this.balanceTracker['trackedAddresses']) {
      this.balanceTracker.stopTracking(address);
    }

    // Clear event history
    this.eventHistory = [];

    // Remove all listeners
    this.removeAllListeners();
    
    this.emit('manager:cleanup');
  }
}