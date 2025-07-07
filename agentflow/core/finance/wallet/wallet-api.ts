// Wallet API endpoints and REST interface

import { Request, Response } from 'express';
import { WalletManager } from './wallet-manager';
import { ethers, Provider } from 'ethers';
import {
  WalletConfig,
  WalletRecovery,
  TransactionRequest,
  TokenType,
  SecurityConfig
} from './types';

export class WalletAPI {
  private walletManager: WalletManager;
  private sessions: Map<string, { walletId: string; expires: Date }> = new Map();

  constructor(provider: Provider, securityConfig?: Partial<SecurityConfig>) {
    this.walletManager = new WalletManager(provider, securityConfig);
    this.setupEventHandlers();
  }

  /**
   * Create a new wallet
   * POST /api/wallet/create
   */
  async createWallet(req: Request, res: Response): Promise<void> {
    try {
      const { config, password, mnemonic } = req.body;
      
      if (!config || !password) {
        res.status(400).json({ error: 'Config and password are required' });
        return;
      }

      const walletConfig: WalletConfig = {
        id: config.id || crypto.randomUUID(),
        name: config.name || 'My Wallet',
        type: config.type || 'hot',
        encryptionMethod: config.encryptionMethod || 'aes-256-gcm',
        networkId: config.networkId || 1,
        rpcUrl: config.rpcUrl || 'https://mainnet.infura.io/v3/your-key',
        ...config
      };

      const wallet = await this.walletManager.createWallet(
        walletConfig,
        password,
        mnemonic
      );

      // Don't return sensitive data
      const response = {
        id: wallet.id,
        created: true,
        address: await this.walletManager.getWalletAddress(wallet.id, password)
      };

      res.status(201).json(response);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Import an existing wallet
   * POST /api/wallet/import
   */
  async importWallet(req: Request, res: Response): Promise<void> {
    try {
      const { config, password, recovery } = req.body;
      
      if (!config || !password || !recovery) {
        res.status(400).json({ error: 'Config, password, and recovery data are required' });
        return;
      }

      const walletConfig: WalletConfig = {
        id: config.id || crypto.randomUUID(),
        name: config.name || 'Imported Wallet',
        type: config.type || 'hot',
        encryptionMethod: config.encryptionMethod || 'aes-256-gcm',
        networkId: config.networkId || 1,
        rpcUrl: config.rpcUrl || 'https://mainnet.infura.io/v3/your-key',
        ...config
      };

      const wallet = await this.walletManager.importWallet(
        walletConfig,
        password,
        recovery as WalletRecovery
      );

      const response = {
        id: wallet.id,
        imported: true,
        address: await this.walletManager.getWalletAddress(wallet.id, password)
      };

      res.status(201).json(response);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * List all wallets
   * GET /api/wallet/list
   */
  async listWallets(req: Request, res: Response): Promise<void> {
    try {
      const wallets = this.walletManager.listWallets();
      
      const response = wallets.map(w => ({
        id: w.id,
        algorithm: w.algorithm,
        keyDerivationFunction: w.keyDerivationFunction,
        created: true
      }));

      res.json(response);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get wallet balances
   * GET /api/wallet/:id/balances
   */
  async getBalances(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sessionId = req.headers['x-session-id'] as string;
      
      if (!this.validateSession(sessionId, id)) {
        res.status(401).json({ error: 'Invalid session' });
        return;
      }

      const balances = await this.walletManager.getWalletBalances(id);
      res.json(balances);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Send transaction
   * POST /api/wallet/:id/send
   */
  async sendTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { password, transaction } = req.body;
      
      if (!password || !transaction) {
        res.status(400).json({ error: 'Password and transaction data are required' });
        return;
      }

      const txRequest: TransactionRequest = {
        from: transaction.from,
        to: transaction.to,
        value: transaction.value,
        tokenType: transaction.tokenType || TokenType.ETH,
        contractAddress: transaction.contractAddress,
        tokenId: transaction.tokenId,
        gasPrice: transaction.gasPrice,
        gasLimit: transaction.gasLimit,
        nonce: transaction.nonce,
        chainId: transaction.chainId
      };

      const result = await this.walletManager.sendTransaction(id, password, txRequest);
      
      res.json({
        hash: result.hash,
        status: result.status,
        timestamp: result.timestamp
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get transaction history
   * GET /api/wallet/:id/transactions
   */
  async getTransactionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { password, tokenType } = req.query;
      
      if (!password) {
        res.status(400).json({ error: 'Password is required' });
        return;
      }

      const transactions = await this.walletManager.getTransactionHistory(
        id,
        password as string,
        tokenType as TokenType
      );

      res.json(transactions);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get wallet statistics
   * GET /api/wallet/:id/stats
   */
  async getWalletStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { password } = req.query;
      
      if (!password) {
        res.status(400).json({ error: 'Password is required' });
        return;
      }

      const stats = await this.walletManager.getWalletStats(id, password as string);
      res.json(stats);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Export wallet
   * POST /api/wallet/:id/export
   */
  async exportWallet(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { password, format } = req.body;
      
      if (!password || !format) {
        res.status(400).json({ error: 'Password and format are required' });
        return;
      }

      const exported = await this.walletManager.exportWallet(id, password, format);
      
      res.json({
        format,
        data: exported,
        exported: true
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Remove wallet
   * DELETE /api/wallet/:id
   */
  async removeWallet(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      if (!password) {
        res.status(400).json({ error: 'Password is required' });
        return;
      }

      await this.walletManager.removeWallet(id, password);
      
      res.json({ removed: true });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get wallet address
   * POST /api/wallet/:id/address
   */
  async getWalletAddress(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      if (!password) {
        res.status(400).json({ error: 'Password is required' });
        return;
      }

      const address = await this.walletManager.getWalletAddress(id, password);
      
      res.json({ address });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Create session
   * POST /api/wallet/:id/session
   */
  async createSession(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      if (!password) {
        res.status(400).json({ error: 'Password is required' });
        return;
      }

      // Verify password by trying to get address
      await this.walletManager.getWalletAddress(id, password);
      
      const sessionId = crypto.randomUUID();
      const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      
      this.sessions.set(sessionId, { walletId: id, expires });
      
      res.json({ sessionId, expires });
    } catch (error) {
      res.status(401).json({ error: 'Invalid password' });
    }
  }

  /**
   * Destroy session
   * DELETE /api/wallet/:id/session
   */
  async destroySession(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      
      if (sessionId) {
        this.sessions.delete(sessionId);
      }
      
      res.json({ destroyed: true });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get system health
   * GET /api/wallet/health
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = this.walletManager.getHealthStatus();
      res.json(health);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Estimate gas for transaction
   * POST /api/wallet/estimate-gas
   */
  async estimateGas(req: Request, res: Response): Promise<void> {
    try {
      const { transaction } = req.body;
      
      if (!transaction) {
        res.status(400).json({ error: 'Transaction data is required' });
        return;
      }

      // This would estimate gas using the provider
      // Placeholder implementation
      const gasEstimate = {
        gasLimit: '21000',
        gasPrice: '20000000000', // 20 gwei
        estimatedCost: '0.00042' // ETH
      };

      res.json(gasEstimate);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get supported tokens
   * GET /api/wallet/tokens
   */
  async getSupportedTokens(req: Request, res: Response): Promise<void> {
    try {
      const tokens = [
        {
          type: TokenType.ETH,
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          native: true
        },
        {
          type: TokenType.AGC,
          symbol: 'AGC',
          name: 'Agent Coordination Token',
          decimals: 18,
          contractAddress: '0x...', // Replace with actual address
          native: false
        },
        {
          type: TokenType.RUV,
          symbol: 'RUV',
          name: 'rUv Token',
          decimals: 18,
          contractAddress: '0x...', // Replace with actual address
          native: false
        },
        {
          type: TokenType.TASK_NFT,
          symbol: 'TASK',
          name: 'Task Completion NFT',
          decimals: 0,
          contractAddress: '0x...', // Replace with actual address
          native: false
        }
      ];

      res.json(tokens);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Validate session
   */
  private validateSession(sessionId: string, walletId: string): boolean {
    if (!sessionId) return false;
    
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    if (session.expires < new Date()) {
      this.sessions.delete(sessionId);
      return false;
    }
    
    return session.walletId === walletId;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.walletManager.on('transaction:confirmed', (transaction) => {
      // Could implement WebSocket notifications here
      console.log('Transaction confirmed:', transaction.hash);
    });

    this.walletManager.on('balances:updated', (data) => {
      // Could implement WebSocket notifications here
      console.log('Balances updated for address:', data.address);
    });

    this.walletManager.on('error', (error) => {
      console.error('Wallet manager error:', error);
    });
  }

  /**
   * Clean up sessions periodically
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      for (const [sessionId, session] of this.sessions) {
        if (session.expires < now) {
          this.sessions.delete(sessionId);
        }
      }
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  /**
   * Get router with all endpoints
   */
  getRouter(): any {
    const router = require('express').Router();
    
    // Wallet management
    router.post('/create', this.createWallet.bind(this));
    router.post('/import', this.importWallet.bind(this));
    router.get('/list', this.listWallets.bind(this));
    router.get('/health', this.getHealth.bind(this));
    router.get('/tokens', this.getSupportedTokens.bind(this));
    router.post('/estimate-gas', this.estimateGas.bind(this));
    
    // Wallet operations
    router.get('/:id/balances', this.getBalances.bind(this));
    router.post('/:id/send', this.sendTransaction.bind(this));
    router.get('/:id/transactions', this.getTransactionHistory.bind(this));
    router.get('/:id/stats', this.getWalletStats.bind(this));
    router.post('/:id/export', this.exportWallet.bind(this));
    router.delete('/:id', this.removeWallet.bind(this));
    router.post('/:id/address', this.getWalletAddress.bind(this));
    
    // Session management
    router.post('/:id/session', this.createSession.bind(this));
    router.delete('/:id/session', this.destroySession.bind(this));
    
    return router;
  }
}