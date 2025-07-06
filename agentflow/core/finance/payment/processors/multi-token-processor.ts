/**
 * Multi-Token Payment Processor
 * Handles payments across different token types
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { PaymentRequest, PaymentTransaction, PaymentStatus, PaymentConfig } from '../types';
import { PAYMENT_CONSTANTS, ERROR_CODES } from '../constants';

// ERC20 ABI for token transfers
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

export class MultiTokenProcessor extends EventEmitter {
  private provider: ethers.Provider;
  private wallets: Map<string, ethers.Wallet> = new Map();
  private tokenContracts: Map<string, ethers.Contract> = new Map();
  private config: PaymentConfig;
  private nonces: Map<string, number> = new Map();

  constructor(config: PaymentConfig) {
    super();
    this.config = config;
    
    // Initialize provider (would be configured based on environment)
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
    
    // Initialize token contracts
    this.initializeTokenContracts();
  }

  /**
   * Process a payment for any supported token
   */
  async processPayment(request: PaymentRequest, wallet: ethers.Wallet): Promise<PaymentTransaction> {
    try {
      // Validate token support
      if (!this.isTokenSupported(request.token)) {
        throw new Error(ERROR_CODES.INVALID_TOKEN);
      }

      // Check balance
      const balance = await this.getBalance(wallet.address, request.token);
      if (balance < request.amount) {
        throw new Error(ERROR_CODES.INSUFFICIENT_BALANCE);
      }

      // Process based on token type
      let transaction: PaymentTransaction;
      if (this.isNativeToken(request.token)) {
        transaction = await this.processNativePayment(request, wallet);
      } else {
        transaction = await this.processERC20Payment(request, wallet);
      }

      this.emit('payment:processed', transaction);
      return transaction;
    } catch (error) {
      this.emit('payment:failed', request, error);
      throw error;
    }
  }

  /**
   * Process batch payment with multiple tokens
   */
  async processBatchPayment(
    payments: PaymentRequest[],
    wallet: ethers.Wallet
  ): Promise<PaymentTransaction[]> {
    // Group payments by token
    const paymentsByToken = this.groupPaymentsByToken(payments);
    const transactions: PaymentTransaction[] = [];

    for (const [token, tokenPayments] of paymentsByToken) {
      try {
        if (this.isNativeToken(token)) {
          // Process native token batch
          const tx = await this.processNativeBatch(tokenPayments, wallet);
          transactions.push(...tx);
        } else {
          // Process ERC20 batch
          const tx = await this.processERC20Batch(tokenPayments, wallet, token);
          transactions.push(...tx);
        }
      } catch (error) {
        console.error(`Batch processing failed for token ${token}:`, error);
        // Mark failed payments
        tokenPayments.forEach(payment => {
          this.emit('payment:failed', payment, error as Error);
        });
      }
    }

    return transactions;
  }

  /**
   * Get balance for a specific token
   */
  async getBalance(address: string, token: string): Promise<bigint> {
    if (this.isNativeToken(token)) {
      return await this.provider.getBalance(address);
    } else {
      const contract = this.getTokenContract(token);
      return await contract.balanceOf(address);
    }
  }

  /**
   * Estimate gas for a payment
   */
  async estimateGas(request: PaymentRequest, wallet: ethers.Wallet): Promise<bigint> {
    if (this.isNativeToken(request.token)) {
      const tx = {
        to: request.to,
        value: request.amount
      };
      return await wallet.estimateGas(tx);
    } else {
      const contract = this.getTokenContract(request.token);
      const connectedContract = contract.connect(wallet);
      return await connectedContract.transfer.estimateGas(request.to, request.amount);
    }
  }

  private async processNativePayment(
    request: PaymentRequest,
    wallet: ethers.Wallet
  ): Promise<PaymentTransaction> {
    const nonce = await this.getNextNonce(wallet.address);
    
    const tx = {
      to: request.to,
      value: request.amount,
      nonce,
      gasLimit: await this.estimateGas(request, wallet),
      maxFeePerGas: await this.getGasPrice(),
      maxPriorityFeePerGas: ethers.parseGwei('2')
    };

    const sentTx = await wallet.sendTransaction(tx);
    
    const transaction: PaymentTransaction = {
      id: this.generateTransactionId(request),
      requestId: request.id,
      hash: sentTx.hash,
      status: PaymentStatus.CONFIRMING,
      from: wallet.address,
      to: request.to,
      amount: request.amount,
      token: request.token,
      fee: BigInt(0), // Will be updated after confirmation
      timestamp: Date.now()
    };

    // Wait for confirmation in background
    this.waitForConfirmation(sentTx, transaction);

    return transaction;
  }

  private async processERC20Payment(
    request: PaymentRequest,
    wallet: ethers.Wallet
  ): Promise<PaymentTransaction> {
    const contract = this.getTokenContract(request.token);
    const connectedContract = contract.connect(wallet);
    const nonce = await this.getNextNonce(wallet.address);

    const gasLimit = await connectedContract.transfer.estimateGas(request.to, request.amount);
    
    const tx = await connectedContract.transfer(request.to, request.amount, {
      nonce,
      gasLimit: gasLimit * BigInt(120) / BigInt(100), // 20% buffer
      maxFeePerGas: await this.getGasPrice(),
      maxPriorityFeePerGas: ethers.parseGwei('2')
    });

    const transaction: PaymentTransaction = {
      id: this.generateTransactionId(request),
      requestId: request.id,
      hash: tx.hash,
      status: PaymentStatus.CONFIRMING,
      from: wallet.address,
      to: request.to,
      amount: request.amount,
      token: request.token,
      fee: BigInt(0), // Will be updated after confirmation
      timestamp: Date.now()
    };

    // Wait for confirmation in background
    this.waitForConfirmation(tx, transaction);

    return transaction;
  }

  private async processNativeBatch(
    payments: PaymentRequest[],
    wallet: ethers.Wallet
  ): Promise<PaymentTransaction[]> {
    // For native tokens, we need to send individual transactions
    // but we can optimize by preparing them all at once
    const transactions: PaymentTransaction[] = [];
    const baseNonce = await this.getNextNonce(wallet.address);

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      const tx = {
        to: payment.to,
        value: payment.amount,
        nonce: baseNonce + i,
        gasLimit: BigInt(21000), // Standard transfer gas
        maxFeePerGas: await this.getGasPrice(),
        maxPriorityFeePerGas: ethers.parseGwei('2')
      };

      const sentTx = await wallet.sendTransaction(tx);
      
      const transaction: PaymentTransaction = {
        id: this.generateTransactionId(payment),
        requestId: payment.id,
        hash: sentTx.hash,
        status: PaymentStatus.CONFIRMING,
        from: wallet.address,
        to: payment.to,
        amount: payment.amount,
        token: payment.token,
        fee: BigInt(0),
        timestamp: Date.now()
      };

      transactions.push(transaction);
      this.waitForConfirmation(sentTx, transaction);
    }

    // Update nonce cache
    this.nonces.set(wallet.address, baseNonce + payments.length);

    return transactions;
  }

  private async processERC20Batch(
    payments: PaymentRequest[],
    wallet: ethers.Wallet,
    token: string
  ): Promise<PaymentTransaction[]> {
    // For ERC20 tokens, we could use a batch transfer contract
    // For now, we'll process them individually with optimized nonces
    const transactions: PaymentTransaction[] = [];
    const contract = this.getTokenContract(token);
    const connectedContract = contract.connect(wallet);
    const baseNonce = await this.getNextNonce(wallet.address);

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      
      const tx = await connectedContract.transfer(payment.to, payment.amount, {
        nonce: baseNonce + i,
        gasLimit: BigInt(65000), // Standard ERC20 transfer gas
        maxFeePerGas: await this.getGasPrice(),
        maxPriorityFeePerGas: ethers.parseGwei('2')
      });

      const transaction: PaymentTransaction = {
        id: this.generateTransactionId(payment),
        requestId: payment.id,
        hash: tx.hash,
        status: PaymentStatus.CONFIRMING,
        from: wallet.address,
        to: payment.to,
        amount: payment.amount,
        token: payment.token,
        fee: BigInt(0),
        timestamp: Date.now()
      };

      transactions.push(transaction);
      this.waitForConfirmation(tx, transaction);
    }

    // Update nonce cache
    this.nonces.set(wallet.address, baseNonce + payments.length);

    return transactions;
  }

  private async waitForConfirmation(
    tx: ethers.TransactionResponse,
    transaction: PaymentTransaction
  ): Promise<void> {
    try {
      const receipt = await tx.wait();
      
      if (receipt && receipt.status === 1) {
        transaction.status = PaymentStatus.COMPLETED;
        transaction.blockNumber = receipt.blockNumber;
        transaction.gasUsed = receipt.gasUsed;
        transaction.fee = receipt.gasUsed * receipt.gasPrice;
        this.emit('payment:confirmed', transaction);
      } else {
        transaction.status = PaymentStatus.FAILED;
        transaction.error = 'Transaction reverted';
        this.emit('payment:failed', transaction);
      }
    } catch (error) {
      transaction.status = PaymentStatus.FAILED;
      transaction.error = (error as Error).message;
      this.emit('payment:failed', transaction);
    }
  }

  private initializeTokenContracts(): void {
    // Initialize contracts for supported ERC20 tokens
    Object.entries(PAYMENT_CONSTANTS.SUPPORTED_TOKENS).forEach(([symbol, address]) => {
      if (address !== 'native') {
        const contract = new ethers.Contract(address, ERC20_ABI, this.provider);
        this.tokenContracts.set(symbol, contract);
      }
    });
  }

  private getTokenContract(token: string): ethers.Contract {
    const contract = this.tokenContracts.get(token);
    if (!contract) {
      throw new Error(`Token contract not found for ${token}`);
    }
    return contract;
  }

  private isTokenSupported(token: string): boolean {
    return this.config.supportedTokens.includes(token);
  }

  private isNativeToken(token: string): boolean {
    return token === 'ETH' || PAYMENT_CONSTANTS.SUPPORTED_TOKENS[token] === 'native';
  }

  private groupPaymentsByToken(payments: PaymentRequest[]): Map<string, PaymentRequest[]> {
    const grouped = new Map<string, PaymentRequest[]>();
    
    payments.forEach(payment => {
      const group = grouped.get(payment.token) || [];
      group.push(payment);
      grouped.set(payment.token, group);
    });

    return grouped;
  }

  private generateTransactionId(request: PaymentRequest): string {
    return `tx_${Date.now()}_${request.id}`;
  }

  private async getNextNonce(address: string): Promise<number> {
    const cachedNonce = this.nonces.get(address);
    const currentNonce = await this.provider.getTransactionCount(address, 'pending');
    
    const nonce = cachedNonce && cachedNonce > currentNonce ? cachedNonce : currentNonce;
    this.nonces.set(address, nonce + 1);
    
    return nonce;
  }

  private async getGasPrice(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseGwei('30');
    
    // Apply max gas price limit
    const maxGasPrice = ethers.parseGwei(PAYMENT_CONSTANTS.MAX_GAS_PRICE_GWEI.toString());
    return gasPrice > maxGasPrice ? maxGasPrice : gasPrice;
  }
}