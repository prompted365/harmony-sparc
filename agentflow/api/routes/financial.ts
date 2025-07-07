/**
 * Financial API Routes
 * Wallet, payments, and balance management endpoints
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { Wallet, isAddress } from 'ethers';
import { 
  ApiRequest, 
  ApiResponse, 
  WalletInfo,
  TokenBalance,
  Transaction,
  PaymentRequest,
  ApiErrorCode 
} from '../types';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validation';

// Mock financial data (would be replaced with actual blockchain integration)
interface WalletData {
  address: string;
  privateKey: string;
  balances: Map<string, number>;
  transactions: Transaction[];
  createdAt: Date;
}

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address?: string;
  price: number; // USD price
  change24h: number;
}

class FinancialManager {
  private wallets: Map<string, WalletData> = new Map();
  private tokenInfo: Map<string, TokenInfo> = new Map();

  constructor() {
    // Initialize with mock data
    this.initializeTokens();
    this.initializeWallets();
  }

  private initializeTokens(): void {
    const tokens: TokenInfo[] = [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, price: 3200, change24h: 2.5 },
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xA0b86a33E6A6b8A6d6d8E4A6d9C7f8E9', price: 1, change24h: 0.01 },
      { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', price: 1, change24h: -0.02 },
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', price: 65000, change24h: 1.8 },
      { symbol: 'QUDAG', name: 'QuDAG Token', decimals: 18, address: '0x1234567890123456789012345678901234567890', price: 0.45, change24h: 15.2 }
    ];

    tokens.forEach(token => {
      this.tokenInfo.set(token.symbol, token);
    });
  }

  private initializeWallets(): void {
    // Create a demo wallet
    const wallet = Wallet.createRandom();
    const walletData: WalletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      balances: new Map([
        ['ETH', 2.5],
        ['USDC', 1000],
        ['DAI', 500],
        ['WBTC', 0.1],
        ['QUDAG', 2500]
      ]),
      transactions: this.generateMockTransactions(wallet.address),
      createdAt: new Date()
    };

    this.wallets.set(wallet.address, walletData);
  }

  private generateMockTransactions(address: string): Transaction[] {
    const transactions: Transaction[] = [];
    const types: Transaction['type'][] = ['send', 'receive', 'swap', 'stake'];
    const tokens = Array.from(this.tokenInfo.keys());

    for (let i = 0; i < 20; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const token = tokens[Math.floor(Math.random() * tokens.length)];
      const amount = Math.random() * 100;
      
      transactions.push({
        id: `tx_${Date.now()}_${i}`,
        type,
        amount,
        token,
        from: type === 'receive' ? this.generateRandomAddress() : address,
        to: type === 'send' ? this.generateRandomAddress() : address,
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        status: Math.random() > 0.05 ? 'confirmed' : 'pending',
        fee: Math.random() * 0.001
      });
    }

    return transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private generateRandomAddress(): string {
    return Wallet.createRandom().address;
  }

  getWallet(address: string): WalletData | undefined {
    return this.wallets.get(address);
  }

  getAllWallets(): WalletData[] {
    return Array.from(this.wallets.values());
  }

  createWallet(): WalletData {
    const wallet = Wallet.createRandom();
    const walletData: WalletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      balances: new Map(),
      transactions: [],
      createdAt: new Date()
    };

    this.wallets.set(wallet.address, walletData);
    return walletData;
  }

  getWalletInfo(address: string): WalletInfo | undefined {
    const wallet = this.wallets.get(address);
    if (!wallet) return undefined;

    const balances: TokenBalance[] = [];
    let totalValue = 0;

    for (const [token, balance] of wallet.balances) {
      const tokenInfo = this.tokenInfo.get(token);
      if (tokenInfo) {
        const value = balance * tokenInfo.price;
        totalValue += value;
        
        balances.push({
          token,
          balance,
          value,
          change24h: tokenInfo.change24h
        });
      }
    }

    return {
      address,
      balances,
      transactions: wallet.transactions.slice(0, 10), // Latest 10 transactions
      totalValue
    };
  }

  async sendPayment(fromAddress: string, payment: PaymentRequest): Promise<Transaction> {
    const wallet = this.wallets.get(fromAddress);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const currentBalance = wallet.balances.get(payment.token) || 0;
    if (currentBalance < payment.amount) {
      throw new Error('Insufficient balance');
    }

    // Create transaction
    const transaction: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'send',
      amount: payment.amount,
      token: payment.token,
      from: fromAddress,
      to: payment.recipient,
      timestamp: new Date(),
      status: 'pending',
      fee: 0.001 // Mock fee
    };

    // Update balances
    wallet.balances.set(payment.token, currentBalance - payment.amount);
    wallet.transactions.unshift(transaction);

    // Simulate network delay
    setTimeout(() => {
      transaction.status = 'confirmed';
    }, payment.urgency === 'high' ? 1000 : 5000);

    return transaction;
  }

  updateBalance(address: string, token: string, amount: number): boolean {
    const wallet = this.wallets.get(address);
    if (!wallet) return false;

    wallet.balances.set(token, amount);
    return true;
  }

  getTokenInfo(symbol: string): TokenInfo | undefined {
    return this.tokenInfo.get(symbol);
  }

  getAllTokens(): TokenInfo[] {
    return Array.from(this.tokenInfo.values());
  }

  getTransactionHistory(address: string, limit: number = 50): Transaction[] {
    const wallet = this.wallets.get(address);
    if (!wallet) return [];

    return wallet.transactions.slice(0, limit);
  }

  async getGasPrice(): Promise<number> {
    // Mock gas price in gwei
    return 20 + Math.random() * 30;
  }

  async estimateGas(_transaction: Partial<Transaction>): Promise<number> {
    // Mock gas estimation
    return 21000 + Math.random() * 50000;
  }
}

// Validation schemas
const paymentSchema = z.object({
  amount: z.number().positive(),
  token: z.string().min(1),
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  memo: z.string().optional(),
  urgency: z.enum(['normal', 'high']).optional()
});

const paginationSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20)
});

// Initialize financial manager
const financialManager = new FinancialManager();

// Create router
const router = Router();

/**
 * GET /wallets
 * List all wallets
 */
router.get('/wallets', 
  validateRequest({ query: paginationSchema }),
  asyncHandler(async (req: ApiRequest, res: Response) => {
    const { page, limit } = req.query as any;
    const offset = (page - 1) * limit;

    const wallets = financialManager.getAllWallets();
    const paginatedWallets = wallets.slice(offset, offset + limit);

    const walletInfos = await Promise.all(
      paginatedWallets.map(async (wallet) => {
        const info = financialManager.getWalletInfo(wallet.address);
        return info;
      })
    );

    const response: ApiResponse = {
      success: true,
      data: walletInfos.filter(Boolean),
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req.requestId!,
        pagination: {
          page,
          limit,
          total: wallets.length,
          totalPages: Math.ceil(wallets.length / limit)
        }
      }
    };

    res.json(response);
  })
);

/**
 * POST /wallets
 * Create a new wallet
 */
router.post('/wallets', asyncHandler(async (req: ApiRequest, res: Response) => {
  const wallet = financialManager.createWallet();
  const walletInfo = financialManager.getWalletInfo(wallet.address);

  const response: ApiResponse<WalletInfo> = {
    success: true,
    data: walletInfo!,
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.status(201).json(response);
}));

/**
 * GET /wallets/:address
 * Get wallet information
 */
router.get('/wallets/:address', asyncHandler(async (req: ApiRequest, res: Response): Promise<void> => {
  const { address } = req.params;

  if (!isAddress(address)) {
    res.status(400).json({
      success: false,
      error: {
        code: ApiErrorCode.INVALID_REQUEST,
        message: 'Invalid wallet address'
      }
    } as ApiResponse);
    return;
  }

  const walletInfo = financialManager.getWalletInfo(address);
  if (!walletInfo) {
    res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Wallet ${address} not found`
      }
    } as ApiResponse);
    return;
  }

  const response: ApiResponse<WalletInfo> = {
    success: true,
    data: walletInfo,
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * GET /wallets/:address/balance
 * Get wallet balance
 */
router.get('/wallets/:address/balance', asyncHandler(async (req: ApiRequest, res: Response): Promise<void> => {
  const { address } = req.params;

  if (!isAddress(address)) {
    res.status(400).json({
      success: false,
      error: {
        code: ApiErrorCode.INVALID_REQUEST,
        message: 'Invalid wallet address'
      }
    } as ApiResponse);
    return;
  }

  const walletInfo = financialManager.getWalletInfo(address);
  if (!walletInfo) {
    res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Wallet ${address} not found`
      }
    } as ApiResponse);
    return;
  }

  const response: ApiResponse = {
    success: true,
    data: {
      address,
      balances: walletInfo.balances,
      totalValue: walletInfo.totalValue
    },
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * POST /wallets/:address/send
 * Send payment from wallet
 */
router.post('/wallets/:address/send',
  validateRequest({ body: paymentSchema }),
  asyncHandler(async (req: ApiRequest, res: Response): Promise<void> => {
    const { address } = req.params;
    const payment = req.body as PaymentRequest;

    if (!isAddress(address)) {
      res.status(400).json({
        success: false,
        error: {
          code: ApiErrorCode.INVALID_REQUEST,
          message: 'Invalid wallet address'
        }
      } as ApiResponse);
      return;
    }

    try {
      const transaction = await financialManager.sendPayment(address, payment);

      const response: ApiResponse<Transaction> = {
        success: true,
        data: transaction,
        meta: {
          timestamp: Date.now(),
          version: '1.0.0',
          requestId: req.requestId!
        }
      };

      res.json(response);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: ApiErrorCode.INVALID_REQUEST,
          message: (error as Error).message
        }
      } as ApiResponse);
    }
  })
);

/**
 * GET /wallets/:address/transactions
 * Get transaction history
 */
router.get('/wallets/:address/transactions', 
  validateRequest({ query: paginationSchema }),
  asyncHandler(async (req: ApiRequest, res: Response): Promise<void> => {
    const { address } = req.params;
    const { page, limit } = req.query as any;
    const offset = (page - 1) * limit;

    if (!isAddress(address)) {
      res.status(400).json({
        success: false,
        error: {
          code: ApiErrorCode.INVALID_REQUEST,
          message: 'Invalid wallet address'
        }
      } as ApiResponse);
      return;
    }

    const allTransactions = financialManager.getTransactionHistory(address, 1000);
    const paginatedTransactions = allTransactions.slice(offset, offset + limit);

    const response: ApiResponse = {
      success: true,
      data: paginatedTransactions,
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req.requestId!,
        pagination: {
          page,
          limit,
          total: allTransactions.length,
          totalPages: Math.ceil(allTransactions.length / limit)
        }
      }
    };

    res.json(response);
  })
);

/**
 * GET /tokens
 * List all supported tokens
 */
router.get('/tokens', asyncHandler(async (req: ApiRequest, res: Response) => {
  const tokens = financialManager.getAllTokens();

  const response: ApiResponse = {
    success: true,
    data: tokens,
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * GET /tokens/:symbol
 * Get token information
 */
router.get('/tokens/:symbol', asyncHandler(async (req: ApiRequest, res: Response): Promise<void> => {
  const { symbol } = req.params;

  const tokenInfo = financialManager.getTokenInfo(symbol.toUpperCase());
  if (!tokenInfo) {
    res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Token ${symbol} not found`
      }
    } as ApiResponse);
    return;
  }

  const response: ApiResponse = {
    success: true,
    data: tokenInfo,
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * GET /gas
 * Get current gas price
 */
router.get('/gas', asyncHandler(async (req: ApiRequest, res: Response) => {
  const gasPrice = await financialManager.getGasPrice();

  const response: ApiResponse = {
    success: true,
    data: {
      gasPrice: gasPrice,
      unit: 'gwei',
      timestamp: Date.now()
    },
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * POST /gas/estimate
 * Estimate gas for transaction
 */
router.post('/gas/estimate',
  validateRequest({ body: z.object({
    from: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    amount: z.number().positive(),
    token: z.string()
  }) }),
  asyncHandler(async (req: ApiRequest, res: Response) => {
    const transaction = req.body;

    const gasEstimate = await financialManager.estimateGas(transaction);
    const gasPrice = await financialManager.getGasPrice();
    const totalCost = gasEstimate * gasPrice / 1e9; // Convert to ETH

    const response: ApiResponse = {
      success: true,
      data: {
        gasEstimate,
        gasPrice,
        totalCost,
        unit: 'ETH'
      },
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req.requestId!
      }
    };

    res.json(response);
  })
);

/**
 * GET /portfolio/:address
 * Get portfolio analysis
 */
router.get('/portfolio/:address', asyncHandler(async (req: ApiRequest, res: Response): Promise<void> => {
  const { address } = req.params;

  if (!isAddress(address)) {
    res.status(400).json({
      success: false,
      error: {
        code: ApiErrorCode.INVALID_REQUEST,
        message: 'Invalid wallet address'
      }
    } as ApiResponse);
    return;
  }

  const walletInfo = financialManager.getWalletInfo(address);
  if (!walletInfo) {
    res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Wallet ${address} not found`
      }
    } as ApiResponse);
    return;
  }

  // Calculate portfolio metrics
  const totalValue = walletInfo.totalValue;
  const tokenAllocation = walletInfo.balances.map(balance => ({
    token: balance.token,
    percentage: (balance.value / totalValue) * 100,
    value: balance.value
  }));

  const dayChange = walletInfo.balances.reduce((sum, balance) => {
    return sum + (balance.value * balance.change24h / 100);
  }, 0);

  const response: ApiResponse = {
    success: true,
    data: {
      address,
      totalValue,
      dayChange,
      dayChangePercent: (dayChange / totalValue) * 100,
      tokenAllocation,
      lastUpdated: Date.now()
    },
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

export { router as financialRouter };