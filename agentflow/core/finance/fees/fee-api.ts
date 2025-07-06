/**
 * Fee API Service
 * Comprehensive REST API for fee management, analytics, and monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { FeeEngine, FeeEngineConfig } from './fee-engine';
import { FeeMonitor, FeeMonitorConfig } from './fee-monitor';
import { FeeDistributor, DistributionConfig } from './fee-distributor';
import { PaymentRequest, PaymentConfig } from '../payment/types';
import { PAYMENT_CONSTANTS } from '../payment/constants';

export interface FeeAPIConfig {
  feeEngine: FeeEngineConfig;
  feeMonitor: FeeMonitorConfig;
  feeDistributor: DistributionConfig;
  paymentConfig: PaymentConfig;
}

export class FeeAPIService {
  private feeEngine: FeeEngine;
  private feeMonitor: FeeMonitor;
  private feeDistributor: FeeDistributor;

  constructor(config: FeeAPIConfig) {
    this.feeEngine = new FeeEngine(config.paymentConfig, config.feeEngine);
    this.feeMonitor = new FeeMonitor(this.feeEngine, config.feeMonitor);
    this.feeDistributor = new FeeDistributor(config.feeDistributor);
    
    this.setupEventHandlers();
    this.feeMonitor.startMonitoring();
  }

  /**
   * Calculate fee for a single transaction
   */
  async calculateFee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, token, from, to, priority } = req.body;

      if (!amount || !token || !from || !to) {
        res.status(400).json({
          error: 'Missing required fields: amount, token, from, to'
        });
        return;
      }

      const paymentRequest: PaymentRequest = {
        id: `fee_calc_${Date.now()}`,
        from,
        to,
        amount: BigInt(amount),
        token,
        priority: priority || 'normal',
        timestamp: Date.now()
      };

      const feeBreakdown = await this.feeEngine.calculateOptimalFee(paymentRequest);

      res.json({
        success: true,
        data: {
          totalFee: feeBreakdown.totalFee.toString(),
          platformFee: feeBreakdown.platformFee.toString(),
          networkFee: feeBreakdown.networkFee.toString(),
          agentFee: feeBreakdown.agentFee.toString(),
          stakingRewards: feeBreakdown.stakingRewards.toString(),
          feePercentage: feeBreakdown.feePercentage,
          breakdown: feeBreakdown.breakdown
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculate fees for batch transaction
   */
  async calculateBatchFees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactions } = req.body;

      if (!Array.isArray(transactions) || transactions.length === 0) {
        res.status(400).json({
          error: 'transactions must be a non-empty array'
        });
        return;
      }

      const paymentRequests: PaymentRequest[] = transactions.map((tx, index) => ({
        id: `batch_${Date.now()}_${index}`,
        from: tx.from,
        to: tx.to,
        amount: BigInt(tx.amount),
        token: tx.token,
        priority: tx.priority || 'normal',
        timestamp: Date.now()
      }));

      const batchResult = await this.feeEngine.calculateBatchFees(paymentRequests);

      res.json({
        success: true,
        data: {
          totalFees: batchResult.totalFees.toString(),
          batchDiscount: batchResult.batchDiscount,
          savings: batchResult.savings.toString(),
          individualFees: batchResult.individualFees.map(fee => ({
            totalFee: fee.totalFee.toString(),
            platformFee: fee.platformFee.toString(),
            networkFee: fee.networkFee.toString(),
            agentFee: fee.agentFee.toString(),
            stakingRewards: fee.stakingRewards.toString(),
            feePercentage: fee.feePercentage,
            breakdown: fee.breakdown
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get fee estimation
   */
  async getFeeEstimation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, token, userAddress } = req.query;

      if (!amount || !token) {
        res.status(400).json({
          error: 'Missing required parameters: amount, token'
        });
        return;
      }

      const estimation = this.feeEngine.getCalculator().getFeeEstimation(
        BigInt(amount as string),
        token as string,
        userAddress as string
      );

      res.json({
        success: true,
        data: {
          minFee: estimation.minFee.toString(),
          maxFee: estimation.maxFee.toString(),
          estimatedFee: estimation.estimatedFee.toString(),
          breakdown: {
            totalFee: estimation.breakdown.totalFee.toString(),
            platformFee: estimation.breakdown.platformFee.toString(),
            networkFee: estimation.breakdown.networkFee.toString(),
            agentFee: estimation.breakdown.agentFee.toString(),
            stakingRewards: estimation.breakdown.stakingRewards.toString(),
            feePercentage: estimation.breakdown.feePercentage,
            breakdown: estimation.breakdown.breakdown
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get fee optimization recommendations
   */
  async getFeeOptimization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, token, from, to } = req.body;

      const paymentRequest: PaymentRequest = {
        id: `optimization_${Date.now()}`,
        from,
        to,
        amount: BigInt(amount),
        token,
        timestamp: Date.now()
      };

      const optimization = await this.feeEngine.getFeeOptimization(paymentRequest);

      res.json({
        success: true,
        data: {
          recommendedFeeRate: optimization.recommendedFeeRate,
          estimatedSavings: optimization.estimatedSavings.toString(),
          batchOpportunities: optimization.batchOpportunities,
          gasOptimizationLevel: optimization.gasOptimizationLevel
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get comprehensive fee analytics
   */
  async getFeeAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { period = '24h' } = req.query;
      const analytics = this.feeEngine.getAnalytics();

      res.json({
        success: true,
        data: {
          totalFeesCollected: analytics.totalFeesCollected.toString(),
          feesByToken: Object.fromEntries(
            Object.entries(analytics.feesByToken).map(([token, fees]) => [token, fees.toString()])
          ),
          distributionsByType: Object.fromEntries(
            Object.entries(analytics.distributionsByType).map(([type, amount]) => [type, amount.toString()])
          ),
          volumeMetrics: {
            totalVolume: analytics.volumeMetrics.totalVolume.toString(),
            averageTransactionSize: analytics.volumeMetrics.averageTransactionSize.toString(),
            transactionCount: analytics.volumeMetrics.transactionCount
          },
          performanceMetrics: analytics.performanceMetrics,
          trends: {
            hourly: analytics.trends.hourly.map(this.formatDataPoint),
            daily: analytics.trends.daily.map(this.formatDataPoint),
            weekly: analytics.trends.weekly.map(this.formatDataPoint)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get real-time fee monitoring dashboard
   */
  async getFeeMonitoringDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dashboard = this.feeMonitor.getDashboardData();

      res.json({
        success: true,
        data: {
          currentMetrics: dashboard.currentMetrics ? {
            ...dashboard.currentMetrics,
            totalFees: dashboard.currentMetrics.totalFees.toString(),
            averageFee: dashboard.currentMetrics.averageFee.toString(),
            networkConditions: {
              ...dashboard.currentMetrics.networkConditions,
              gasPrice: dashboard.currentMetrics.networkConditions.gasPrice.toString()
            }
          } : null,
          alerts: dashboard.alerts,
          trends: dashboard.trends,
          summary: {
            ...dashboard.summary,
            totalFees24h: dashboard.summary.totalFees24h.toString()
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get fee distribution statistics
   */
  async getFeeDistributionStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = this.feeDistributor.getDistributionStats();

      res.json({
        success: true,
        data: {
          totalDistributed: stats.totalDistributed.toString(),
          distributionsByType: Object.fromEntries(
            Object.entries(stats.distributionsByType).map(([type, amount]) => [type, amount.toString()])
          ),
          distributionsByToken: Object.fromEntries(
            Object.entries(stats.distributionsByToken).map(([token, amount]) => [token, amount.toString()])
          ),
          successRate: stats.successRate,
          averageProcessingTime: stats.averageProcessingTime,
          pendingDistributions: stats.pendingDistributions,
          failedDistributions: stats.failedDistributions
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get staking pool information
   */
  async getStakingPool(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stakingPool = this.feeDistributor.getStakingPool();

      res.json({
        success: true,
        data: {
          address: stakingPool.address,
          totalStaked: stakingPool.totalStaked.toString(),
          stakeholders: Object.fromEntries(
            Array.from(stakingPool.stakeholders.entries()).map(([address, amount]) => [address, amount.toString()])
          ),
          rewardRate: stakingPool.rewardRate,
          lockupPeriod: stakingPool.lockupPeriod
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculate staking rewards for an address
   */
  async getStakingRewards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { address } = req.params;

      if (!address) {
        res.status(400).json({
          error: 'Address parameter is required'
        });
        return;
      }

      const rewards = this.feeDistributor.calculateStakingRewards(address);

      res.json({
        success: true,
        data: {
          address,
          rewards: rewards.toString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get distribution history
   */
  async getDistributionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 100 } = req.query;
      const history = this.feeDistributor.getDistributionHistory(Number(limit));

      res.json({
        success: true,
        data: history.map(batch => ({
          ...batch,
          totalAmount: batch.totalAmount.toString(),
          distributions: batch.distributions.map(dist => ({
            ...dist,
            amount: dist.amount.toString()
          }))
        }))
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get comprehensive fee report
   */
  async getFeeReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { period = 'day' } = req.query;
      const report = this.feeEngine.generateFeeReport(period as any);

      res.json({
        success: true,
        data: {
          summary: {
            totalFeesCollected: report.summary.totalFeesCollected.toString(),
            feesByToken: Object.fromEntries(
              Object.entries(report.summary.feesByToken).map(([token, fees]) => [token, fees.toString()])
            ),
            distributionsByType: Object.fromEntries(
              Object.entries(report.summary.distributionsByType).map(([type, amount]) => [type, amount.toString()])
            ),
            volumeMetrics: {
              totalVolume: report.summary.volumeMetrics.totalVolume.toString(),
              averageTransactionSize: report.summary.volumeMetrics.averageTransactionSize.toString(),
              transactionCount: report.summary.volumeMetrics.transactionCount
            },
            performanceMetrics: report.summary.performanceMetrics,
            trends: {
              hourly: report.summary.trends.hourly.map(this.formatDataPoint),
              daily: report.summary.trends.daily.map(this.formatDataPoint),
              weekly: report.summary.trends.weekly.map(this.formatDataPoint)
            }
          },
          topTokens: report.topTokens.map(token => ({
            ...token,
            fees: token.fees.toString()
          })),
          distributionBreakdown: Object.fromEntries(
            Object.entries(report.distributionBreakdown).map(([type, amount]) => [type, amount.toString()])
          ),
          performanceMetrics: report.performanceMetrics
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export fee data
   */
  async exportFeeData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { format = 'json' } = req.query;
      const data = this.feeEngine.exportFeeData(format as any);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="fee_data_${Date.now()}.${format}"`);
      res.send(data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process fee distribution
   */
  async processFeeDistribution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { distributions } = req.body;

      if (!Array.isArray(distributions) || distributions.length === 0) {
        res.status(400).json({
          error: 'distributions must be a non-empty array'
        });
        return;
      }

      this.feeDistributor.queueDistributions(distributions.map(dist => ({
        recipient: dist.recipient,
        amount: BigInt(dist.amount),
        type: dist.type,
        token: dist.token
      })));

      res.json({
        success: true,
        message: `${distributions.length} distributions queued for processing`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retry failed distributions
   */
  async retryFailedDistributions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.feeDistributor.retryFailedDistributions();

      res.json({
        success: true,
        message: 'Failed distributions retry initiated'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get supported tokens and their configurations
   */
  async getSupportedTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          tokens: PAYMENT_CONSTANTS.SUPPORTED_TOKENS,
          feeConfiguration: {
            defaultFeePercentage: PAYMENT_CONSTANTS.DEFAULT_FEE_PERCENTAGE,
            minFee: PAYMENT_CONSTANTS.MIN_FEE_WEI.toString(),
            maxGasPrice: PAYMENT_CONSTANTS.MAX_GAS_PRICE_GWEI
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get fee engine accessor for internal use
   */
  getFeeEngine(): FeeEngine {
    return this.feeEngine;
  }

  /**
   * Get fee monitor accessor for internal use
   */
  getFeeMonitor(): FeeMonitor {
    return this.feeMonitor;
  }

  /**
   * Get fee distributor accessor for internal use
   */
  getFeeDistributor(): FeeDistributor {
    return this.feeDistributor;
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentMetrics = this.feeMonitor.getCurrentMetrics();
      const distributionStats = this.feeDistributor.getDistributionStats();

      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: Date.now(),
          services: {
            feeEngine: 'operational',
            feeMonitor: 'operational',
            feeDistributor: 'operational'
          },
          metrics: {
            currentThroughput: currentMetrics?.throughput || 0,
            averageLatency: currentMetrics?.latency || 0,
            distributionSuccessRate: distributionStats.successRate
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.feeEngine.destroy();
    this.feeMonitor.destroy();
    this.feeDistributor.destroy();
  }

  private setupEventHandlers(): void {
    // Handle fee distribution events
    this.feeEngine.on('feeCalculated', (data) => {
      // Queue for distribution
      const paymentRequest: PaymentRequest = {
        id: data.requestId,
        from: '',
        to: '',
        amount: BigInt(0),
        token: '',
        timestamp: Date.now()
      };
      this.feeEngine.queueFeeDistribution(paymentRequest);
    });

    // Handle monitoring alerts
    this.feeMonitor.on('alertCreated', (alert) => {
      console.log(`Fee Alert: ${alert.type} - ${alert.message}`);
    });

    // Handle distribution events
    this.feeDistributor.on('batchProcessed', (data) => {
      console.log(`Distribution batch processed: ${data.batchId}`);
    });
  }

  private formatDataPoint(point: any): any {
    return {
      timestamp: point.timestamp,
      totalFees: point.totalFees.toString(),
      transactionCount: point.transactionCount,
      averageFee: point.averageFee.toString(),
      gasUsed: point.gasUsed?.toString()
    };
  }
}