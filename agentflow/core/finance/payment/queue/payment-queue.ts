/**
 * High-Performance Payment Queue
 * Priority-based queue with batching support
 */

import { PaymentRequest } from '../types';
import { PAYMENT_CONSTANTS, ERROR_CODES } from '../constants';

interface QueueItem {
  request: PaymentRequest;
  priority: number;
  timestamp: number;
}

export class PaymentQueue {
  private queue: QueueItem[] = [];
  private maxSize: number;
  private processingCount: number = 0;

  constructor(maxSize: number = PAYMENT_CONSTANTS.MAX_QUEUE_SIZE) {
    this.maxSize = maxSize;
  }

  /**
   * Add payment to queue with priority
   */
  async enqueue(request: PaymentRequest): Promise<void> {
    if (this.queue.length >= this.maxSize) {
      throw new Error(ERROR_CODES.QUEUE_FULL);
    }

    const priority = this.calculatePriority(request);
    const item: QueueItem = {
      request,
      priority,
      timestamp: Date.now()
    };

    // Insert at correct position based on priority
    this.insertSorted(item);
  }

  /**
   * Get next payment from queue
   */
  async dequeue(): Promise<PaymentRequest | null> {
    const item = this.queue.shift();
    if (item) {
      this.processingCount++;
      return item.request;
    }
    return null;
  }

  /**
   * Get batch of payments from queue
   */
  async dequeueBatch(maxSize: number): Promise<PaymentRequest[]> {
    const batch: PaymentRequest[] = [];
    const batchSize = Math.min(maxSize, this.queue.length);

    for (let i = 0; i < batchSize; i++) {
      const item = this.queue.shift();
      if (item) {
        batch.push(item.request);
        this.processingCount++;
      }
    }

    return batch;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get processing count
   */
  getProcessingCount(): number {
    return this.processingCount;
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
    this.processingCount = 0;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    size: number;
    processing: number;
    oldestItem: number | null;
    priorityDistribution: Record<string, number>;
  } {
    const priorityDist: Record<string, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0
    };

    this.queue.forEach(item => {
      const priority = item.request.priority || 'normal';
      priorityDist[priority]++;
    });

    return {
      size: this.queue.length,
      processing: this.processingCount,
      oldestItem: this.queue.length > 0 ? Date.now() - this.queue[0].timestamp : null,
      priorityDistribution: priorityDist
    };
  }

  /**
   * Re-prioritize items in queue
   */
  reprioritize(): void {
    // Recalculate priorities for all items
    this.queue.forEach(item => {
      item.priority = this.calculatePriority(item.request);
    });

    // Re-sort queue
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  private calculatePriority(request: PaymentRequest): number {
    const basePriority = PAYMENT_CONSTANTS.PRIORITY_WEIGHTS[request.priority || 'normal'];
    
    // Add time-based priority boost (older requests get higher priority)
    const ageMs = Date.now() - request.timestamp;
    const ageBoost = Math.min(ageMs / 1000, 100); // Max 100 point boost

    // Add amount-based priority (larger amounts get slight boost)
    const amountBoost = Math.log10(Number(request.amount) / 1e18) * 2; // Log scale boost

    return basePriority + ageBoost + amountBoost;
  }

  private insertSorted(item: QueueItem): void {
    // Binary search for insertion position
    let low = 0;
    let high = this.queue.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.queue[mid].priority > item.priority) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    this.queue.splice(low, 0, item);
  }
}