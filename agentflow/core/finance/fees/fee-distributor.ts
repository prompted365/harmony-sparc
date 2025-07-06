/**
 * Fee Distribution Service
 * Handles automated fee collection and distribution to stakeholders
 */

import { EventEmitter } from 'events';
import { FeeDistribution } from '../payment/fees/fee-calculator';
import { PaymentRequest, PaymentTransaction } from '../payment/types';

export interface DistributionConfig {
  batchSize: number;
  processingInterval: number; // milliseconds
  minDistributionAmount: bigint;
  maxRetries: number;
  retryDelay: number;
  gasOptimization: boolean;
  stakingPoolAddress: string;
  platformTreasuryAddress: string;
  networkFundAddress: string;
}

export interface DistributionBatch {
  id: string;
  distributions: FeeDistribution[];
  totalAmount: bigint;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  processedAt?: number;
  transactionHash?: string;
  error?: string;
  retryCount: number;
}

export interface DistributionStats {
  totalDistributed: bigint;
  distributionsByType: Record<string, bigint>;
  distributionsByToken: Record<string, bigint>;
  successRate: number;
  averageProcessingTime: number;
  pendingDistributions: number;
  failedDistributions: number;
}

export interface StakingPool {
  address: string;
  totalStaked: bigint;
  stakeholders: Map<string, bigint>;
  rewardRate: number;
  lockupPeriod: number;
}

export interface DistributionReceipt {
  id: string;
  batchId: string;
  recipient: string;
  amount: bigint;
  token: string;
  type: 'platform' | 'network' | 'agent' | 'staking';
  transactionHash: string;
  timestamp: number;
  gasUsed: bigint;
}

export class FeeDistributor extends EventEmitter {
  private config: DistributionConfig;
  private pendingDistributions: Map<string, FeeDistribution[]> = new Map();
  private processingBatches: Map<string, DistributionBatch> = new Map();
  private completedBatches: Map<string, DistributionBatch> = new Map();
  private distributionStats: DistributionStats;
  private stakingPool: StakingPool;
  private processingTimer?: NodeJS.Timeout;
  private batchCounter = 0;
  private receipts: DistributionReceipt[] = [];

  constructor(config: DistributionConfig) {
    super();
    this.config = config;
    this.initializeStats();
    this.initializeStakingPool();
    this.startProcessing();
  }

  /**
   * Queue fee distributions for batch processing
   */
  queueDistributions(distributions: FeeDistribution[]): void {
    for (const distribution of distributions) {
      const key = `${distribution.token}-${distribution.type}`;
      
      if (!this.pendingDistributions.has(key)) {
        this.pendingDistributions.set(key, []);
      }
      
      this.pendingDistributions.get(key)!.push(distribution);
    }

    this.emit('distributionsQueued', {
      count: distributions.length,
      totalAmount: distributions.reduce((sum, d) => sum + d.amount, BigInt(0))
    });
  }

  /**
   * Process pending distributions in batches
   */
  async processPendingDistributions(): Promise<void> {
    if (this.pendingDistributions.size === 0) return;

    const batches = this.createDistributionBatches();
    
    for (const batch of batches) {
      this.processingBatches.set(batch.id, batch);
      
      try {
        await this.processBatch(batch);
      } catch (error) {
        await this.handleBatchError(batch, error as Error);
      }
    }
  }

  /**
   * Get distribution statistics
   */
  getDistributionStats(): DistributionStats {
    return { ...this.distributionStats };
  }

  /**
   * Get staking pool information
   */
  getStakingPool(): StakingPool {
    return { ...this.stakingPool };
  }

  /**
   * Add to staking pool
   */
  addToStakingPool(address: string, amount: bigint): void {
    const currentStake = this.stakingPool.stakeholders.get(address) || BigInt(0);
    this.stakingPool.stakeholders.set(address, currentStake + amount);
    this.stakingPool.totalStaked += amount;

    this.emit('stakingPoolUpdated', {
      address,
      newStake: currentStake + amount,
      totalStaked: this.stakingPool.totalStaked
    });
  }

  /**
   * Calculate staking rewards
   */
  calculateStakingRewards(address: string): bigint {
    const stake = this.stakingPool.stakeholders.get(address) || BigInt(0);
    if (stake === BigInt(0)) return BigInt(0);

    const sharePercentage = Number(stake * BigInt(10000) / this.stakingPool.totalStaked) / 10000;
    const totalRewards = this.distributionStats.distributionsByType.staking || BigInt(0);
    
    return totalRewards * BigInt(Math.floor(sharePercentage * 10000)) / BigInt(10000);
  }

  /**
   * Distribute staking rewards
   */
  async distributeStakingRewards(): Promise<void> {
    const rewardPool = this.distributionStats.distributionsByType.staking || BigInt(0);
    if (rewardPool === BigInt(0)) return;

    const distributions: FeeDistribution[] = [];

    for (const [address, stake] of this.stakingPool.stakeholders) {
      const reward = this.calculateStakingRewards(address);
      if (reward > BigInt(0)) {
        distributions.push({
          recipient: address,
          amount: reward,
          type: 'staking',
          token: 'ETH' // Default token for staking rewards
        });
      }
    }

    if (distributions.length > 0) {
      this.queueDistributions(distributions);
      this.emit('stakingRewardsDistributed', {
        recipientCount: distributions.length,
        totalRewards: rewardPool
      });
    }
  }

  /**
   * Get distribution history
   */
  getDistributionHistory(limit: number = 100): DistributionBatch[] {
    return Array.from(this.completedBatches.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get distribution receipts
   */
  getDistributionReceipts(address?: string): DistributionReceipt[] {
    if (address) {
      return this.receipts.filter(receipt => receipt.recipient === address);
    }
    return [...this.receipts];
  }

  /**
   * Retry failed distributions
   */
  async retryFailedDistributions(): Promise<void> {
    const failedBatches = Array.from(this.completedBatches.values())
      .filter(batch => batch.status === 'failed' && batch.retryCount < this.config.maxRetries);

    for (const batch of failedBatches) {
      batch.retryCount++;
      batch.status = 'pending';
      this.processingBatches.set(batch.id, batch);
      this.completedBatches.delete(batch.id);

      try {
        await this.processBatch(batch);
      } catch (error) {
        await this.handleBatchError(batch, error as Error);
      }
    }
  }

  /**
   * Get real-time distribution dashboard
   */
  getDistributionDashboard(): {
    stats: DistributionStats;
    pendingBatches: number;
    processingBatches: number;
    recentDistributions: DistributionBatch[];
    stakingPool: StakingPool;
    topRecipients: Array<{ address: string; amount: bigint; type: string }>;
  } {
    const recentDistributions = Array.from(this.completedBatches.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);

    // Calculate top recipients
    const recipientTotals = new Map<string, { amount: bigint; type: string }>();
    for (const receipt of this.receipts) {
      const current = recipientTotals.get(receipt.recipient) || { amount: BigInt(0), type: receipt.type };
      current.amount += receipt.amount;
      recipientTotals.set(receipt.recipient, current);
    }

    const topRecipients = Array.from(recipientTotals.entries())
      .sort(([, a], [, b]) => Number(b.amount - a.amount))
      .slice(0, 10)
      .map(([address, data]) => ({ address, ...data }));

    return {
      stats: this.distributionStats,
      pendingBatches: this.pendingDistributions.size,
      processingBatches: this.processingBatches.size,
      recentDistributions,
      stakingPool: this.stakingPool,
      topRecipients
    };
  }

  /**
   * Export distribution data
   */
  exportDistributionData(): {
    stats: DistributionStats;
    batches: DistributionBatch[];
    receipts: DistributionReceipt[];
    stakingPool: StakingPool;
  } {
    return {
      stats: this.distributionStats,
      batches: Array.from(this.completedBatches.values()),
      receipts: this.receipts,
      stakingPool: this.stakingPool
    };
  }

  /**
   * Stop processing and cleanup
   */
  destroy(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
    this.removeAllListeners();
  }

  private initializeStats(): void {
    this.distributionStats = {
      totalDistributed: BigInt(0),
      distributionsByType: {
        platform: BigInt(0),
        network: BigInt(0),
        agent: BigInt(0),
        staking: BigInt(0)
      },
      distributionsByToken: {},
      successRate: 100,
      averageProcessingTime: 0,
      pendingDistributions: 0,
      failedDistributions: 0
    };
  }

  private initializeStakingPool(): void {
    this.stakingPool = {
      address: this.config.stakingPoolAddress,
      totalStaked: BigInt(0),
      stakeholders: new Map(),
      rewardRate: 0.05, // 5% APY
      lockupPeriod: 30 * 24 * 60 * 60 * 1000 // 30 days
    };
  }

  private startProcessing(): void {
    this.processingTimer = setInterval(async () => {
      await this.processPendingDistributions();
    }, this.config.processingInterval);
  }

  private createDistributionBatches(): DistributionBatch[] {
    const batches: DistributionBatch[] = [];
    
    for (const [key, distributions] of this.pendingDistributions) {
      // Group by recipient to optimize gas costs
      const recipientGroups = new Map<string, FeeDistribution[]>();
      
      for (const distribution of distributions) {
        if (!recipientGroups.has(distribution.recipient)) {
          recipientGroups.set(distribution.recipient, []);
        }
        recipientGroups.get(distribution.recipient)!.push(distribution);
      }

      // Create batches respecting batch size limits
      let currentBatch: FeeDistribution[] = [];
      let currentBatchAmount = BigInt(0);

      for (const [recipient, recipientDistributions] of recipientGroups) {
        const recipientAmount = recipientDistributions.reduce((sum, d) => sum + d.amount, BigInt(0));
        
        if (recipientAmount >= this.config.minDistributionAmount) {
          // Add to current batch or create new batch
          if (currentBatch.length + recipientDistributions.length <= this.config.batchSize) {
            currentBatch.push(...recipientDistributions);
            currentBatchAmount += recipientAmount;
          } else {
            // Create batch from current distributions
            if (currentBatch.length > 0) {
              batches.push(this.createBatch(currentBatch, currentBatchAmount));
            }
            
            // Start new batch
            currentBatch = [...recipientDistributions];
            currentBatchAmount = recipientAmount;
          }
        }
      }

      // Add remaining distributions to final batch
      if (currentBatch.length > 0) {
        batches.push(this.createBatch(currentBatch, currentBatchAmount));
      }
    }

    // Clear pending distributions
    this.pendingDistributions.clear();
    
    return batches;
  }

  private createBatch(distributions: FeeDistribution[], totalAmount: bigint): DistributionBatch {
    const batchId = `batch_${++this.batchCounter}_${Date.now()}`;
    
    return {
      id: batchId,
      distributions,
      totalAmount,
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0
    };
  }

  private async processBatch(batch: DistributionBatch): Promise<void> {
    const startTime = Date.now();
    batch.status = 'processing';

    try {
      // Simulate transaction processing
      const transactionHash = await this.executeDistributionTransaction(batch);
      
      batch.status = 'completed';
      batch.processedAt = Date.now();
      batch.transactionHash = transactionHash;

      // Update statistics
      this.updateStats(batch, Date.now() - startTime);
      
      // Create receipts
      this.createReceipts(batch);

      // Move to completed
      this.completedBatches.set(batch.id, batch);
      this.processingBatches.delete(batch.id);

      this.emit('batchProcessed', {
        batchId: batch.id,
        distributionCount: batch.distributions.length,
        totalAmount: batch.totalAmount,
        transactionHash,
        processingTime: Date.now() - startTime
      });
    } catch (error) {
      throw error;
    }
  }

  private async executeDistributionTransaction(batch: DistributionBatch): Promise<string> {
    // This would interact with the blockchain to execute the actual distribution
    // For now, simulate the transaction
    
    if (this.config.gasOptimization) {
      // Optimize gas by batching similar transactions
      await this.optimizeGasForBatch(batch);
    }

    // Simulate transaction delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Generate mock transaction hash
    const hash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    
    return hash;
  }

  private async optimizeGasForBatch(batch: DistributionBatch): Promise<void> {
    // Gas optimization logic
    // - Group by token to reduce token switches
    // - Batch multiple distributions to same recipient
    // - Use more efficient contract calls
    
    const tokenGroups = new Map<string, FeeDistribution[]>();
    for (const distribution of batch.distributions) {
      if (!tokenGroups.has(distribution.token)) {
        tokenGroups.set(distribution.token, []);
      }
      tokenGroups.get(distribution.token)!.push(distribution);
    }

    // Process each token group optimally
    for (const [token, distributions] of tokenGroups) {
      // Additional gas optimization would be implemented here
    }
  }

  private async handleBatchError(batch: DistributionBatch, error: Error): Promise<void> {
    batch.status = 'failed';
    batch.error = error.message;
    batch.processedAt = Date.now();

    if (batch.retryCount < this.config.maxRetries) {
      // Schedule retry
      setTimeout(async () => {
        if (batch.retryCount < this.config.maxRetries) {
          batch.retryCount++;
          batch.status = 'pending';
          try {
            await this.processBatch(batch);
          } catch (retryError) {
            await this.handleBatchError(batch, retryError as Error);
          }
        }
      }, this.config.retryDelay * Math.pow(2, batch.retryCount)); // Exponential backoff
    } else {
      // Max retries reached, mark as permanently failed
      this.completedBatches.set(batch.id, batch);
      this.processingBatches.delete(batch.id);
      this.distributionStats.failedDistributions++;
    }

    this.emit('batchError', {
      batchId: batch.id,
      error: error.message,
      retryCount: batch.retryCount,
      willRetry: batch.retryCount < this.config.maxRetries
    });
  }

  private updateStats(batch: DistributionBatch, processingTime: number): void {
    this.distributionStats.totalDistributed += batch.totalAmount;
    
    for (const distribution of batch.distributions) {
      this.distributionStats.distributionsByType[distribution.type] += distribution.amount;
      this.distributionStats.distributionsByToken[distribution.token] = 
        (this.distributionStats.distributionsByToken[distribution.token] || BigInt(0)) + distribution.amount;
    }

    // Update average processing time
    const currentAvg = this.distributionStats.averageProcessingTime;
    const completedBatches = this.completedBatches.size;
    this.distributionStats.averageProcessingTime = 
      (currentAvg * completedBatches + processingTime) / (completedBatches + 1);

    // Update success rate
    const totalBatches = this.completedBatches.size + this.distributionStats.failedDistributions;
    this.distributionStats.successRate = 
      (this.completedBatches.size / totalBatches) * 100;
  }

  private createReceipts(batch: DistributionBatch): void {
    for (const distribution of batch.distributions) {
      const receipt: DistributionReceipt = {
        id: `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        batchId: batch.id,
        recipient: distribution.recipient,
        amount: distribution.amount,
        token: distribution.token,
        type: distribution.type,
        transactionHash: batch.transactionHash!,
        timestamp: batch.processedAt!,
        gasUsed: BigInt(21000) // Mock gas usage
      };

      this.receipts.push(receipt);
    }

    // Keep only recent receipts to manage memory
    if (this.receipts.length > 10000) {
      this.receipts = this.receipts.slice(-5000);
    }
  }
}