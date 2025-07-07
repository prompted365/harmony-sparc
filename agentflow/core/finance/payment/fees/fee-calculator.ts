/**
 * Fee Calculator
 * Advanced fee calculation and distribution system
 */

import { PaymentRequest, PaymentConfig } from '../types';
import { PAYMENT_CONSTANTS } from '../constants';

export interface FeeBreakdown {
  totalFee: bigint;
  platformFee: bigint;
  networkFee: bigint;
  agentFee: bigint;
  stakingRewards: bigint;
  feePercentage: number;
  breakdown: {
    platform: number;
    network: number;
    agent: number;
    staking: number;
  };
}

export interface FeeDistribution {
  recipient: string;
  amount: bigint;
  type: 'platform' | 'network' | 'agent' | 'staking';
  token: string;
}

export class FeeCalculator {
  private config: PaymentConfig;
  private feeRecipients: Record<string, string> = {};
  private dynamicFeeRates: Map<string, number> = new Map();
  private volumeDiscounts: Map<string, number> = new Map();

  constructor(config: PaymentConfig) {
    this.config = config;
    this.initializeFeeRecipients();
    this.initializeDynamicFees();
  }

  /**
   * Calculate comprehensive fee breakdown
   */
  calculateFee(request: PaymentRequest): FeeBreakdown {
    const baseFeeRate = this.getBaseFeeRate(request);
    const adjustedFeeRate = this.applyDiscounts(request, baseFeeRate);
    const totalFee = this.calculateTotalFee(request.amount, adjustedFeeRate);

    // Fee distribution breakdown
    const breakdown = {
      platform: 0.4,  // 40% to platform
      network: 0.3,   // 30% for network/gas costs
      agent: 0.2,     // 20% to agent operators
      staking: 0.1    // 10% to staking rewards
    };

    return {
      totalFee,
      platformFee: totalFee * BigInt(Math.floor(breakdown.platform * 100)) / BigInt(100),
      networkFee: totalFee * BigInt(Math.floor(breakdown.network * 100)) / BigInt(100),
      agentFee: totalFee * BigInt(Math.floor(breakdown.agent * 100)) / BigInt(100),
      stakingRewards: totalFee * BigInt(Math.floor(breakdown.staking * 100)) / BigInt(100),
      feePercentage: adjustedFeeRate,
      breakdown
    };
  }

  /**
   * Calculate fee distribution
   */
  calculateFeeDistribution(request: PaymentRequest): FeeDistribution[] {
    const feeBreakdown = this.calculateFee(request);
    const distributions: FeeDistribution[] = [];

    // Platform fee
    distributions.push({
      recipient: this.feeRecipients.platform,
      amount: feeBreakdown.platformFee,
      type: 'platform',
      token: request.token
    });

    // Network fee (gas optimization fund)
    distributions.push({
      recipient: this.feeRecipients.network,
      amount: feeBreakdown.networkFee,
      type: 'network',
      token: request.token
    });

    // Agent fee (for task execution)
    distributions.push({
      recipient: this.feeRecipients.agent,
      amount: feeBreakdown.agentFee,
      type: 'agent',
      token: request.token
    });

    // Staking rewards
    distributions.push({
      recipient: this.feeRecipients.staking,
      amount: feeBreakdown.stakingRewards,
      type: 'staking',
      token: request.token
    });

    return distributions;
  }

  /**
   * Get dynamic fee rate based on network conditions
   */
  getDynamicFeeRate(token: string): number {
    return this.dynamicFeeRates.get(token) || this.config.feePercentage;
  }

  /**
   * Update dynamic fee rates
   */
  updateDynamicFeeRates(gasPrice: bigint, networkCongestion: number): void {
    // Adjust fees based on network conditions
    const baseRate = this.config.feePercentage;
    const congestionMultiplier = 1 + (networkCongestion * 0.5); // Up to 50% increase
    const gasMultiplier = Number(gasPrice) / 1e9 / 30; // Normalize to 30 gwei

    // Update rates for each token
    Object.keys(PAYMENT_CONSTANTS.SUPPORTED_TOKENS).forEach(token => {
      let adjustedRate = baseRate;
      
      if (token === 'ETH') {
        adjustedRate = baseRate * gasMultiplier;
      } else {
        adjustedRate = baseRate * congestionMultiplier;
      }

      // Cap the fee rate
      adjustedRate = Math.min(adjustedRate, baseRate * 2);
      adjustedRate = Math.max(adjustedRate, baseRate * 0.5);

      this.dynamicFeeRates.set(token, adjustedRate);
    });
  }

  /**
   * Apply volume discounts
   */
  applyVolumeDiscount(userAddress: string, volume: bigint): void {
    let discountRate = 0;

    // Volume-based discount tiers
    const volumeEth = Number(volume) / 1e18;
    
    if (volumeEth >= 1000) {
      discountRate = 0.3; // 30% discount for 1000+ ETH
    } else if (volumeEth >= 100) {
      discountRate = 0.2; // 20% discount for 100+ ETH
    } else if (volumeEth >= 10) {
      discountRate = 0.1; // 10% discount for 10+ ETH
    } else if (volumeEth >= 1) {
      discountRate = 0.05; // 5% discount for 1+ ETH
    }

    this.volumeDiscounts.set(userAddress, discountRate);
  }

  /**
   * Calculate gas-optimized fee
   */
  calculateGasOptimizedFee(
    request: PaymentRequest,
    estimatedGas: bigint,
    gasPrice: bigint
  ): FeeBreakdown {
    const baseFee = this.calculateFee(request);
    const gasCost = estimatedGas * gasPrice;
    
    // Add gas cost to network fee
    const optimizedFee = {
      ...baseFee,
      networkFee: baseFee.networkFee + gasCost,
      totalFee: baseFee.totalFee + gasCost
    };

    return optimizedFee;
  }

  /**
   * Calculate batch fee discount
   */
  calculateBatchFeeDiscount(batchSize: number): number {
    // Batch discount tiers
    if (batchSize >= 100) {
      return 0.4; // 40% discount for 100+ transactions
    } else if (batchSize >= 50) {
      return 0.3; // 30% discount for 50+ transactions
    } else if (batchSize >= 20) {
      return 0.2; // 20% discount for 20+ transactions
    } else if (batchSize >= 10) {
      return 0.1; // 10% discount for 10+ transactions
    }
    
    return 0;
  }

  /**
   * Get fee estimation
   */
  getFeeEstimation(amount: bigint, token: string, userAddress?: string): {
    minFee: bigint;
    maxFee: bigint;
    estimatedFee: bigint;
    breakdown: FeeBreakdown;
  } {
    const mockRequest: PaymentRequest = {
      id: 'estimation',
      from: userAddress || '0x0000000000000000000000000000000000000000',
      to: '0x0000000000000000000000000000000000000000',
      amount,
      token,
      timestamp: Date.now()
    };

    const breakdown = this.calculateFee(mockRequest);
    const dynamicRate = this.getDynamicFeeRate(token);
    
    // Calculate min/max based on potential network conditions
    const minFee = this.calculateTotalFee(amount, this.config.feePercentage * 0.5);
    const minFeeWithFloor = minFee > this.config.minFee ? minFee : this.config.minFee;
    
    const maxFee = this.calculateTotalFee(amount, dynamicRate * 2);

    return {
      minFee: minFeeWithFloor,
      maxFee: BigInt(maxFee),
      estimatedFee: breakdown.totalFee,
      breakdown
    };
  }

  /**
   * Update fee recipients
   */
  updateFeeRecipients(recipients: Partial<Record<string, string>>): void {
    Object.assign(this.feeRecipients, recipients);
  }

  /**
   * Get fee statistics
   */
  getFeeStats(): {
    totalFeesCollected: bigint;
    feesByToken: Record<string, bigint>;
    averageFeeRate: number;
    totalDistributions: number;
  } {
    // This would typically be stored in a database
    return {
      totalFeesCollected: BigInt(0),
      feesByToken: {},
      averageFeeRate: this.config.feePercentage,
      totalDistributions: 0
    };
  }

  private getBaseFeeRate(request: PaymentRequest): number {
    // Get dynamic rate for the token
    const dynamicRate = this.getDynamicFeeRate(request.token);
    
    // Apply priority-based adjustments
    let priorityMultiplier = 1;
    switch (request.priority) {
      case 'critical':
        priorityMultiplier = 1.5;
        break;
      case 'high':
        priorityMultiplier = 1.2;
        break;
      case 'normal':
        priorityMultiplier = 1;
        break;
      case 'low':
        priorityMultiplier = 0.8;
        break;
    }

    return dynamicRate * priorityMultiplier;
  }

  private applyDiscounts(request: PaymentRequest, baseRate: number): number {
    let adjustedRate = baseRate;

    // Apply volume discount
    const volumeDiscount = this.volumeDiscounts.get(request.from) || 0;
    adjustedRate = adjustedRate * (1 - volumeDiscount);

    // Apply minimum rate
    adjustedRate = Math.max(adjustedRate, this.config.feePercentage * 0.1);

    return adjustedRate;
  }

  private calculateTotalFee(amount: bigint, feeRate: number): bigint {
    const fee = (amount * BigInt(Math.floor(feeRate * 10000))) / BigInt(10000);
    return fee < this.config.minFee ? this.config.minFee : fee;
  }

  private initializeFeeRecipients(): void {
    this.feeRecipients = {
      platform: process.env.PLATFORM_FEE_RECIPIENT || '0x0000000000000000000000000000000000000001',
      network: process.env.NETWORK_FEE_RECIPIENT || '0x0000000000000000000000000000000000000002',
      agent: process.env.AGENT_FEE_RECIPIENT || '0x0000000000000000000000000000000000000003',
      staking: process.env.STAKING_FEE_RECIPIENT || '0x0000000000000000000000000000000000000004'
    };
  }

  private initializeDynamicFees(): void {
    // Initialize with base rates
    Object.keys(PAYMENT_CONSTANTS.SUPPORTED_TOKENS).forEach(token => {
      this.dynamicFeeRates.set(token, this.config.feePercentage);
    });
  }
}