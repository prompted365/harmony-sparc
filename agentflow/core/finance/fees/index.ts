/**
 * Fee Engine - Main Export
 * Comprehensive fee calculation, distribution, and monitoring system
 */

export * from './fee-engine';
export * from './fee-monitor';
export * from './fee-distributor';
export * from './fee-api';

// Re-export from payment fees for backward compatibility
export * from '../payment/fees/fee-calculator';

import { FeeEngine, FeeEngineConfig } from './fee-engine';
import { FeeMonitor, FeeMonitorConfig } from './fee-monitor';
import { FeeDistributor, DistributionConfig } from './fee-distributor';
import { FeeAPIService, FeeAPIConfig } from './fee-api';
import { PaymentConfig } from '../payment/types';
import { PAYMENT_CONSTANTS } from '../payment/constants';

/**
 * Default configuration for the fee engine
 */
export const DEFAULT_FEE_ENGINE_CONFIG: FeeEngineConfig = {
  realTimeUpdates: true,
  analyticsRetention: 30, // 30 days
  distributionThreshold: BigInt('1000000000000000000'), // 1 ETH
  gasOptimization: true,
  batchProcessing: true,
  performanceTargets: {
    maxLatency: 100, // 100ms
    targetThroughput: 1000 // 1000 TPS
  }
};

export const DEFAULT_FEE_MONITOR_CONFIG: FeeMonitorConfig = {
  updateInterval: 5000, // 5 seconds
  alertThresholds: {
    highFeeRate: 0.01, // 1% fee rate
    lowThroughput: 100, // 100 TPS
    highLatency: 200, // 200ms
    errorRate: 5 // 5% error rate
  },
  metricsRetention: 168, // 7 days in hours
  realTimeUpdates: true
};

export const DEFAULT_DISTRIBUTION_CONFIG: DistributionConfig = {
  batchSize: 100,
  processingInterval: 30000, // 30 seconds
  minDistributionAmount: BigInt('100000000000000000'), // 0.1 ETH
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  gasOptimization: true,
  stakingPoolAddress: process.env.STAKING_POOL_ADDRESS || '0x0000000000000000000000000000000000000004',
  platformTreasuryAddress: process.env.PLATFORM_TREASURY_ADDRESS || '0x0000000000000000000000000000000000000001',
  networkFundAddress: process.env.NETWORK_FUND_ADDRESS || '0x0000000000000000000000000000000000000002'
};

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  maxBatchSize: PAYMENT_CONSTANTS.MAX_BATCH_SIZE,
  batchTimeout: PAYMENT_CONSTANTS.BATCH_TIMEOUT_MS,
  maxRetries: PAYMENT_CONSTANTS.MAX_RETRIES,
  retryDelay: PAYMENT_CONSTANTS.RETRY_DELAYS_MS[0],
  maxQueueSize: PAYMENT_CONSTANTS.MAX_QUEUE_SIZE,
  targetTps: PAYMENT_CONSTANTS.TARGET_TPS,
  feePercentage: PAYMENT_CONSTANTS.DEFAULT_FEE_PERCENTAGE,
  minFee: PAYMENT_CONSTANTS.MIN_FEE_WEI,
  supportedTokens: Object.keys(PAYMENT_CONSTANTS.SUPPORTED_TOKENS),
  webhookTimeout: PAYMENT_CONSTANTS.WEBHOOK_TIMEOUT_MS,
  escrowDuration: PAYMENT_CONSTANTS.DEFAULT_ESCROW_DURATION_MS
};

/**
 * Factory function to create a complete fee management system
 */
export function createFeeSystem(config?: Partial<FeeAPIConfig>): FeeAPIService {
  const fullConfig: FeeAPIConfig = {
    feeEngine: { ...DEFAULT_FEE_ENGINE_CONFIG, ...config?.feeEngine },
    feeMonitor: { ...DEFAULT_FEE_MONITOR_CONFIG, ...config?.feeMonitor },
    feeDistributor: { ...DEFAULT_DISTRIBUTION_CONFIG, ...config?.feeDistributor },
    paymentConfig: { ...DEFAULT_PAYMENT_CONFIG, ...config?.paymentConfig }
  };

  return new FeeAPIService(fullConfig);
}

/**
 * Fee system utility functions
 */
export class FeeUtils {
  /**
   * Convert wei to ETH
   */
  static weiToEth(wei: bigint): number {
    return Number(wei) / 1e18;
  }

  /**
   * Convert ETH to wei
   */
  static ethToWei(eth: number): bigint {
    return BigInt(Math.floor(eth * 1e18));
  }

  /**
   * Calculate percentage of amount
   */
  static calculatePercentage(amount: bigint, percentage: number): bigint {
    return amount * BigInt(Math.floor(percentage * 10000)) / BigInt(10000);
  }

  /**
   * Format fee amount for display
   */
  static formatFee(amount: bigint, token: string): string {
    const ethAmount = this.weiToEth(amount);
    return `${ethAmount.toFixed(6)} ${token}`;
  }

  /**
   * Calculate gas cost in wei
   */
  static calculateGasCost(gasLimit: bigint, gasPrice: bigint): bigint {
    return gasLimit * gasPrice;
  }

  /**
   * Optimize gas price based on network conditions
   */
  static optimizeGasPrice(baseGasPrice: bigint, congestionLevel: number): bigint {
    const multiplier = 1 + (congestionLevel * 0.5); // Up to 50% increase
    return baseGasPrice * BigInt(Math.floor(multiplier * 100)) / BigInt(100);
  }

  /**
   * Calculate batch discount based on transaction count
   */
  static calculateBatchDiscount(transactionCount: number): number {
    if (transactionCount >= 100) return 0.4; // 40% discount
    if (transactionCount >= 50) return 0.3;  // 30% discount
    if (transactionCount >= 20) return 0.2;  // 20% discount
    if (transactionCount >= 10) return 0.1;  // 10% discount
    return 0;
  }

  /**
   * Calculate volume discount based on total volume
   */
  static calculateVolumeDiscount(volumeEth: number): number {
    if (volumeEth >= 1000) return 0.3; // 30% discount
    if (volumeEth >= 100) return 0.2;   // 20% discount
    if (volumeEth >= 10) return 0.1;    // 10% discount
    if (volumeEth >= 1) return 0.05;    // 5% discount
    return 0;
  }

  /**
   * Validate fee parameters
   */
  static validateFeeParameters(amount: bigint, token: string, feePercentage: number): boolean {
    if (amount <= 0) return false;
    if (feePercentage < 0 || feePercentage > 1) return false;
    if (!Object.keys(PAYMENT_CONSTANTS.SUPPORTED_TOKENS).includes(token)) return false;
    return true;
  }

  /**
   * Calculate APY for staking rewards
   */
  static calculateStakingAPY(totalRewards: bigint, totalStaked: bigint, periodDays: number): number {
    if (totalStaked === BigInt(0)) return 0;
    
    const rewardRate = Number(totalRewards) / Number(totalStaked);
    const annualizedRate = (rewardRate * 365) / periodDays;
    return annualizedRate * 100; // Convert to percentage
  }
}

/**
 * Fee system constants
 */
export const FEE_CONSTANTS = {
  // Distribution percentages
  PLATFORM_FEE_PERCENTAGE: 0.4,  // 40%
  NETWORK_FEE_PERCENTAGE: 0.3,   // 30%
  AGENT_FEE_PERCENTAGE: 0.2,     // 20%
  STAKING_FEE_PERCENTAGE: 0.1,   // 10%

  // Discount limits
  MAX_VOLUME_DISCOUNT: 0.3,      // 30%
  MAX_BATCH_DISCOUNT: 0.4,       // 40%
  
  // Performance targets
  TARGET_LATENCY_MS: 100,
  TARGET_THROUGHPUT_TPS: 1000,
  MAX_ERROR_RATE: 0.05,          // 5%
  
  // Gas optimization
  BASE_GAS_LIMIT: 21000,
  GAS_PRICE_OPTIMIZATION_THRESHOLD: 0.6, // 60% congestion
  
  // Staking parameters
  DEFAULT_STAKING_LOCKUP_DAYS: 30,
  DEFAULT_STAKING_APY: 0.05      // 5%
} as const;

/**
 * Fee system types for export
 */
export type FeeSystemConfig = FeeAPIConfig;
export type FeeSystemInstance = FeeAPIService;

/**
 * Default export for convenience
 */
export default {
  createFeeSystem,
  FeeUtils,
  FEE_CONSTANTS,
  DEFAULT_FEE_ENGINE_CONFIG,
  DEFAULT_FEE_MONITOR_CONFIG,
  DEFAULT_DISTRIBUTION_CONFIG,
  DEFAULT_PAYMENT_CONFIG
};