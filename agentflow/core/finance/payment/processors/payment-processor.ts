/**
 * High-Throughput Payment Processor
 * Handles >1000 TPS with <100ms response times
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { PaymentRequest, PaymentTransaction, PaymentStatus, PaymentMetrics, TokenMetrics, PaymentConfig } from '../types';
import { PAYMENT_CONSTANTS, ERROR_CODES } from '../constants';
import { PaymentQueue } from '../queue/payment-queue';
import { BatchProcessor } from '../queue/batch-processor';
import { MultiTokenProcessor } from './multi-token-processor';

export class PaymentProcessor extends EventEmitter {
  private queue: PaymentQueue;
  private batchProcessor: BatchProcessor;
  private tokenProcessor: MultiTokenProcessor;
  private metrics: PaymentMetrics;
  private config: PaymentConfig;
  private processing: boolean = false;
  private metricsWindow: number[] = [];
  private transactionCache: Map<string, PaymentTransaction> = new Map();

  constructor(config: Partial<PaymentConfig> = {}) {
    super();
    
    this.config = {
      maxBatchSize: config.maxBatchSize || PAYMENT_CONSTANTS.DEFAULT_BATCH_SIZE,
      batchTimeout: config.batchTimeout || PAYMENT_CONSTANTS.BATCH_TIMEOUT_MS,
      maxRetries: config.maxRetries || PAYMENT_CONSTANTS.MAX_RETRIES,
      retryDelay: config.retryDelay || PAYMENT_CONSTANTS.RETRY_DELAYS_MS[0],
      maxQueueSize: config.maxQueueSize || PAYMENT_CONSTANTS.MAX_QUEUE_SIZE,
      targetTps: config.targetTps || PAYMENT_CONSTANTS.TARGET_TPS,
      feePercentage: config.feePercentage || PAYMENT_CONSTANTS.DEFAULT_FEE_PERCENTAGE,
      minFee: config.minFee || PAYMENT_CONSTANTS.MIN_FEE_WEI,
      supportedTokens: config.supportedTokens || Object.keys(PAYMENT_CONSTANTS.SUPPORTED_TOKENS),
      webhookTimeout: config.webhookTimeout || PAYMENT_CONSTANTS.WEBHOOK_TIMEOUT_MS,
      escrowDuration: config.escrowDuration || PAYMENT_CONSTANTS.DEFAULT_ESCROW_DURATION_MS
    };

    this.queue = new PaymentQueue(this.config.maxQueueSize);
    this.batchProcessor = new BatchProcessor(this.config);
    this.tokenProcessor = new MultiTokenProcessor(this.config);
    
    this.metrics = {
      tps: 0,
      avgResponseTime: 0,
      queueDepth: 0,
      successRate: 0,
      totalProcessed: 0,
      totalVolume: BigInt(0),
      tokenMetrics: new Map()
    };

    this.initializeProcessing();
  }

  /**
   * Submit a payment request
   * @returns Payment transaction ID with <100ms response time
   */
  async submitPayment(request: PaymentRequest): Promise<string> {
    const startTime = performance.now();
    
    try {
      // Validate request
      this.validatePaymentRequest(request);
      
      // Generate transaction ID
      const transactionId = this.generateTransactionId(request);
      
      // Create initial transaction record
      const transaction: PaymentTransaction = {
        id: transactionId,
        requestId: request.id,
        hash: '',
        status: PaymentStatus.PENDING,
        from: request.from,
        to: request.to,
        amount: request.amount,
        token: request.token,
        fee: this.calculateFee(request.amount),
        timestamp: Date.now()
      };
      
      // Cache transaction for fast lookup
      this.transactionCache.set(transactionId, transaction);
      
      // Add to queue with priority
      await this.queue.enqueue(request);
      
      // Update metrics
      this.updateResponseTime(performance.now() - startTime);
      
      // Emit event
      this.emit('payment:created', transaction);
      
      return transactionId;
    } catch (error) {
      this.updateResponseTime(performance.now() - startTime);
      throw error;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(transactionId: string): Promise<PaymentTransaction | null> {
    return this.transactionCache.get(transactionId) || null;
  }

  /**
   * Get current metrics
   */
  getMetrics(): PaymentMetrics {
    return {
      ...this.metrics,
      queueDepth: this.queue.size(),
      tokenMetrics: new Map(this.metrics.tokenMetrics)
    };
  }

  /**
   * Start processing payments
   */
  start(): void {
    if (this.processing) return;
    
    this.processing = true;
    this.processQueue();
    this.startMetricsCollection();
  }

  /**
   * Stop processing payments
   */
  stop(): void {
    this.processing = false;
  }

  private initializeProcessing(): void {
    // Set up batch processor events
    this.batchProcessor.on('batch:completed', (batch) => {
      this.handleBatchCompleted(batch);
    });

    this.batchProcessor.on('batch:failed', (batch, error) => {
      this.handleBatchFailed(batch, error);
    });

    // Set up token processor events
    this.tokenProcessor.on('payment:processed', (transaction) => {
      this.handlePaymentProcessed(transaction);
    });

    this.tokenProcessor.on('payment:failed', (request, error) => {
      this.handlePaymentFailed(request, error);
    });
  }

  private async processQueue(): Promise<void> {
    while (this.processing) {
      try {
        const batch = await this.queue.dequeueBatch(this.config.maxBatchSize);
        
        if (batch.length > 0) {
          // Process batch asynchronously
          this.batchProcessor.processBatch(batch).catch(error => {
            console.error('Batch processing error:', error);
          });
        } else {
          // No items in queue, wait briefly
          await this.sleep(PAYMENT_CONSTANTS.QUEUE_POLL_INTERVAL_MS);
        }
      } catch (error) {
        console.error('Queue processing error:', error);
        await this.sleep(PAYMENT_CONSTANTS.QUEUE_POLL_INTERVAL_MS);
      }
    }
  }

  private validatePaymentRequest(request: PaymentRequest): void {
    if (!request.from || !request.to) {
      throw new Error(ERROR_CODES.INVALID_RECIPIENT);
    }

    if (request.amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    if (!this.config.supportedTokens.includes(request.token)) {
      throw new Error(ERROR_CODES.INVALID_TOKEN);
    }
  }

  private generateTransactionId(request: PaymentRequest): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `tx_${timestamp}_${random}_${request.id}`;
  }

  private calculateFee(amount: bigint): bigint {
    const fee = (amount * BigInt(Math.floor(this.config.feePercentage * 100))) / BigInt(10000);
    return fee < this.config.minFee ? this.config.minFee : fee;
  }

  private updateResponseTime(responseTime: number): void {
    this.metricsWindow.push(responseTime);
    
    if (this.metricsWindow.length > PAYMENT_CONSTANTS.METRICS_WINDOW_SIZE) {
      this.metricsWindow.shift();
    }
    
    const sum = this.metricsWindow.reduce((a, b) => a + b, 0);
    this.metrics.avgResponseTime = sum / this.metricsWindow.length;
  }

  private handleBatchCompleted(batch: any): void {
    // Update transaction statuses
    batch.payments.forEach((payment: PaymentRequest) => {
      const transaction = this.transactionCache.get(`tx_${payment.id}`);
      if (transaction) {
        transaction.status = PaymentStatus.COMPLETED;
        transaction.hash = batch.transactionHash;
        this.emit('payment:completed', transaction);
      }
    });

    // Update metrics
    this.metrics.totalProcessed += batch.payments.length;
  }

  private handleBatchFailed(batch: any, error: Error): void {
    // Update transaction statuses
    batch.payments.forEach((payment: PaymentRequest) => {
      const transaction = this.transactionCache.get(`tx_${payment.id}`);
      if (transaction) {
        transaction.status = PaymentStatus.FAILED;
        transaction.error = error.message;
        this.emit('payment:failed', transaction);
      }
    });
  }

  private handlePaymentProcessed(transaction: PaymentTransaction): void {
    // Update cache
    this.transactionCache.set(transaction.id, transaction);
    
    // Update token metrics
    this.updateTokenMetrics(transaction);
    
    // Update total volume
    this.metrics.totalVolume += transaction.amount;
  }

  private handlePaymentFailed(request: PaymentRequest, error: Error): void {
    const transaction = this.transactionCache.get(`tx_${request.id}`);
    if (transaction) {
      transaction.status = PaymentStatus.FAILED;
      transaction.error = error.message;
      this.emit('payment:failed', transaction);
    }
  }

  private updateTokenMetrics(transaction: PaymentTransaction): void {
    let tokenMetrics = this.metrics.tokenMetrics.get(transaction.token);
    
    if (!tokenMetrics) {
      tokenMetrics = {
        token: transaction.token,
        volume: BigInt(0),
        transactions: 0,
        avgAmount: BigInt(0),
        successRate: 0
      };
      this.metrics.tokenMetrics.set(transaction.token, tokenMetrics);
    }
    
    tokenMetrics.volume += transaction.amount;
    tokenMetrics.transactions += 1;
    tokenMetrics.avgAmount = tokenMetrics.volume / BigInt(tokenMetrics.transactions);
    
    // Calculate success rate (simplified)
    if (transaction.status === PaymentStatus.COMPLETED) {
      tokenMetrics.successRate = ((tokenMetrics.successRate * (tokenMetrics.transactions - 1)) + 100) / tokenMetrics.transactions;
    } else {
      tokenMetrics.successRate = (tokenMetrics.successRate * (tokenMetrics.transactions - 1)) / tokenMetrics.transactions;
    }
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.calculateTps();
      this.calculateSuccessRate();
    }, PAYMENT_CONSTANTS.METRICS_UPDATE_INTERVAL_MS);
  }

  private calculateTps(): void {
    // Calculate TPS based on recent transactions
    const now = Date.now();
    const recentTransactions = Array.from(this.transactionCache.values())
      .filter(tx => tx.timestamp > now - 1000);
    
    this.metrics.tps = recentTransactions.length;
  }

  private calculateSuccessRate(): void {
    const transactions = Array.from(this.transactionCache.values());
    if (transactions.length === 0) {
      this.metrics.successRate = 0;
      return;
    }
    
    const successful = transactions.filter(tx => tx.status === PaymentStatus.COMPLETED).length;
    this.metrics.successRate = (successful / transactions.length) * 100;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}