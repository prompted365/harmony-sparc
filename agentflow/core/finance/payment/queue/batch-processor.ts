/**
 * Batch Payment Processor
 * Optimized for high-throughput processing
 */

import { EventEmitter } from 'events';
import { PaymentRequest, PaymentBatch, BatchStatus, PaymentConfig } from '../types';
import { PAYMENT_CONSTANTS } from '../constants';

export class BatchProcessor extends EventEmitter {
  private config: PaymentConfig;
  private activeBatches: Map<string, PaymentBatch> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;
  private currentBatch: PaymentRequest[] = [];

  constructor(config: PaymentConfig) {
    super();
    this.config = config;
  }

  /**
   * Process a batch of payments
   */
  async processBatch(payments: PaymentRequest[]): Promise<PaymentBatch> {
    const batch: PaymentBatch = {
      id: this.generateBatchId(),
      payments,
      status: BatchStatus.PENDING,
      createdAt: Date.now()
    };

    this.activeBatches.set(batch.id, batch);
    this.emit('batch:created', batch);

    try {
      // Update status to processing
      batch.status = BatchStatus.PROCESSING;
      this.emit('batch:processing', batch);

      // Process the batch
      const result = await this.executeBatch(batch);
      
      // Update status to completed
      batch.status = BatchStatus.COMPLETED;
      batch.processedAt = Date.now();
      batch.transactionHash = result.transactionHash;
      
      this.emit('batch:completed', batch);
      return batch;
    } catch (error) {
      batch.status = BatchStatus.FAILED;
      this.emit('batch:failed', batch, error);
      throw error;
    } finally {
      this.activeBatches.delete(batch.id);
    }
  }

  /**
   * Add payment to current batch
   */
  addToBatch(payment: PaymentRequest): void {
    this.currentBatch.push(payment);

    // Check if batch is ready to process
    if (this.currentBatch.length >= this.config.maxBatchSize) {
      this.flushBatch();
    } else if (this.currentBatch.length === 1) {
      // Start timeout for first item
      this.startBatchTimeout();
    }
  }

  /**
   * Flush current batch
   */
  flushBatch(): void {
    if (this.currentBatch.length === 0) return;

    const batch = [...this.currentBatch];
    this.currentBatch = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    // Process batch asynchronously
    this.processBatch(batch).catch(error => {
      console.error('Batch processing error:', error);
    });
  }

  /**
   * Get batch statistics
   */
  getBatchStats(): {
    activeBatches: number;
    currentBatchSize: number;
    averageBatchSize: number;
    processingTime: number;
  } {
    const activeBatches = Array.from(this.activeBatches.values());
    const completedBatches = activeBatches.filter(b => b.status === BatchStatus.COMPLETED);
    
    let avgBatchSize = 0;
    let avgProcessingTime = 0;

    if (completedBatches.length > 0) {
      avgBatchSize = completedBatches.reduce((sum, batch) => sum + batch.payments.length, 0) / completedBatches.length;
      avgProcessingTime = completedBatches.reduce((sum, batch) => {
        return sum + (batch.processedAt! - batch.createdAt);
      }, 0) / completedBatches.length;
    }

    return {
      activeBatches: this.activeBatches.size,
      currentBatchSize: this.currentBatch.length,
      averageBatchSize: avgBatchSize,
      processingTime: avgProcessingTime
    };
  }

  /**
   * Get active batches
   */
  getActiveBatches(): PaymentBatch[] {
    return Array.from(this.activeBatches.values());
  }

  private async executeBatch(batch: PaymentBatch): Promise<{ transactionHash: string }> {
    // Group payments by token for efficient processing
    const paymentsByToken = this.groupByToken(batch.payments);
    
    // Process each token group
    const results: string[] = [];
    
    for (const [token, payments] of paymentsByToken) {
      try {
        const result = await this.processTokenBatch(token, payments);
        results.push(result.transactionHash);
      } catch (error) {
        console.error(`Token batch processing failed for ${token}:`, error);
        throw error;
      }
    }

    // Return combined result (in practice, this would be more sophisticated)
    return {
      transactionHash: results.join(',')
    };
  }

  private async processTokenBatch(token: string, payments: PaymentRequest[]): Promise<{ transactionHash: string }> {
    // Simulate batch processing
    // In real implementation, this would interact with the MultiTokenProcessor
    await this.delay(100); // Simulate processing time
    
    return {
      transactionHash: `0x${Date.now().toString(16)}${Math.random().toString(16).substring(2, 10)}`
    };
  }

  private groupByToken(payments: PaymentRequest[]): Map<string, PaymentRequest[]> {
    const groups = new Map<string, PaymentRequest[]>();
    
    payments.forEach(payment => {
      const tokenPayments = groups.get(payment.token) || [];
      tokenPayments.push(payment);
      groups.set(payment.token, tokenPayments);
    });

    return groups;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private startBatchTimeout(): void {
    this.batchTimeout = setTimeout(() => {
      this.flushBatch();
    }, this.config.batchTimeout);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}