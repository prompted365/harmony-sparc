/**
 * Payment API
 * High-performance REST API for payment operations
 */

import { Request, Response } from 'express';
import { PaymentProcessor } from '../processors/payment-processor';
import { EscrowManager } from '../escrow/escrow-manager';
import { WebhookManager } from '../webhooks/webhook-manager';
import { NotificationService } from '../webhooks/notification-service';
import { PaymentRequest, PaymentEvent, EscrowCondition } from '../types';
import { PAYMENT_CONSTANTS, ERROR_CODES } from '../constants';

export class PaymentAPI {
  private paymentProcessor: PaymentProcessor;
  private escrowManager: EscrowManager;
  private webhookManager: WebhookManager;
  private notificationService: NotificationService;
  private rateLimiter: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(
    paymentProcessor: PaymentProcessor,
    escrowManager: EscrowManager,
    webhookManager: WebhookManager,
    notificationService: NotificationService
  ) {
    this.paymentProcessor = paymentProcessor;
    this.escrowManager = escrowManager;
    this.webhookManager = webhookManager;
    this.notificationService = notificationService;
  }

  /**
   * Submit payment
   * POST /api/payments
   */
  async submitPayment(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Rate limiting
      if (!this.checkRateLimit(req.ip)) {
        res.status(429).json({
          error: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: 'Rate limit exceeded'
        });
        return;
      }

      // Validate request
      const paymentRequest = this.validatePaymentRequest(req.body);
      
      // Submit payment
      const transactionId = await this.paymentProcessor.submitPayment(paymentRequest);
      
      // Ensure response time is under 100ms
      const responseTime = Date.now() - startTime;
      if (responseTime > PAYMENT_CONSTANTS.MAX_RESPONSE_TIME_MS) {
        console.warn(`Payment submission took ${responseTime}ms, exceeding target of ${PAYMENT_CONSTANTS.MAX_RESPONSE_TIME_MS}ms`);
      }

      res.status(201).json({
        success: true,
        transactionId,
        responseTime
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      res.status(400).json({
        error: (error as Error).message,
        responseTime
      });
    }
  }

  /**
   * Get payment status
   * GET /api/payments/:transactionId
   */
  async getPaymentStatus(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { transactionId } = req.params;
      const transaction = await this.paymentProcessor.getPaymentStatus(transactionId);
      
      if (!transaction) {
        res.status(404).json({
          error: 'Transaction not found'
        });
        return;
      }

      const responseTime = Date.now() - startTime;
      res.json({
        success: true,
        transaction,
        responseTime
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      res.status(500).json({
        error: (error as Error).message,
        responseTime
      });
    }
  }

  /**
   * Get payment metrics
   * GET /api/payments/metrics
   */
  async getPaymentMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this.paymentProcessor.getMetrics();
      const processorStats = this.paymentProcessor.getMetrics();
      
      res.json({
        success: true,
        metrics: {
          ...metrics,
          ...processorStats
        }
      });
    } catch (error) {
      res.status(500).json({
        error: (error as Error).message
      });
    }
  }

  /**
   * Create escrow
   * POST /api/escrow
   */
  async createEscrow(req: Request, res: Response): Promise<void> {
    try {
      const {
        taskId,
        payer,
        payee,
        amount,
        token,
        conditions,
        duration
      } = req.body;

      // Validate required fields
      if (!taskId || !payer || !payee || !amount || !token) {
        res.status(400).json({
          error: 'Missing required fields'
        });
        return;
      }

      const escrow = await this.escrowManager.createEscrow(
        taskId,
        payer,
        payee,
        BigInt(amount),
        token,
        conditions,
        duration
      );

      res.status(201).json({
        success: true,
        escrow
      });
    } catch (error) {
      res.status(400).json({
        error: (error as Error).message
      });
    }
  }

  /**
   * Release escrow
   * POST /api/escrow/:escrowId/release
   */
  async releaseEscrow(req: Request, res: Response): Promise<void> {
    try {
      const { escrowId } = req.params;
      await this.escrowManager.releaseEscrow(escrowId);
      
      res.json({
        success: true,
        message: 'Escrow released successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: (error as Error).message
      });
    }
  }

  /**
   * Get escrow status
   * GET /api/escrow/:escrowId
   */
  async getEscrowStatus(req: Request, res: Response): Promise<void> {
    try {
      const { escrowId } = req.params;
      const escrow = this.escrowManager.getEscrow(escrowId);
      
      if (!escrow) {
        res.status(404).json({
          error: 'Escrow not found'
        });
        return;
      }

      res.json({
        success: true,
        escrow
      });
    } catch (error) {
      res.status(500).json({
        error: (error as Error).message
      });
    }
  }

  /**
   * Register webhook
   * POST /api/webhooks
   */
  async registerWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { url, events, secret } = req.body;
      
      if (!url || !events || !Array.isArray(events)) {
        res.status(400).json({
          error: 'Invalid webhook configuration'
        });
        return;
      }

      const webhookId = this.webhookManager.registerWebhook(url, events, secret);
      
      res.status(201).json({
        success: true,
        webhookId
      });
    } catch (error) {
      res.status(400).json({
        error: (error as Error).message
      });
    }
  }

  /**
   * Test webhook
   * POST /api/webhooks/:webhookId/test
   */
  async testWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const success = await this.webhookManager.testWebhook(webhookId);
      
      res.json({
        success,
        message: success ? 'Webhook test successful' : 'Webhook test failed'
      });
    } catch (error) {
      res.status(500).json({
        error: (error as Error).message
      });
    }
  }

  /**
   * Get system health
   * GET /api/health
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this.paymentProcessor.getMetrics();
      const escrowStats = this.escrowManager.getEscrowStats();
      const webhookStats = this.webhookManager.getDeliveryStats();
      const notificationStats = this.notificationService.getNotificationStats();

      const health = {
        status: 'healthy',
        timestamp: Date.now(),
        performance: {
          tps: metrics.tps,
          avgResponseTime: metrics.avgResponseTime,
          queueDepth: metrics.queueDepth,
          successRate: metrics.successRate
        },
        escrow: escrowStats,
        webhooks: webhookStats,
        notifications: notificationStats
      };

      // Check if system is healthy
      if (metrics.avgResponseTime > PAYMENT_CONSTANTS.MAX_RESPONSE_TIME_MS) {
        health.status = 'degraded';
      }

      if (metrics.tps < PAYMENT_CONSTANTS.TARGET_TPS * 0.8) {
        health.status = 'degraded';
      }

      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get detailed statistics
   * GET /api/stats
   */
  async getDetailedStats(req: Request, res: Response): Promise<void> {
    try {
      const paymentMetrics = this.paymentProcessor.getMetrics();
      const escrowStats = this.escrowManager.getEscrowStats();
      const webhookStats = this.webhookManager.getDeliveryStats();
      const notificationStats = this.notificationService.getNotificationStats();

      res.json({
        success: true,
        stats: {
          payments: paymentMetrics,
          escrow: escrowStats,
          webhooks: webhookStats,
          notifications: notificationStats,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      res.status(500).json({
        error: (error as Error).message
      });
    }
  }

  private validatePaymentRequest(body: any): PaymentRequest {
    const {
      id,
      from,
      to,
      amount,
      token,
      taskId,
      metadata,
      priority
    } = body;

    if (!id || !from || !to || !amount || !token) {
      throw new Error('Missing required payment fields');
    }

    if (typeof amount !== 'string' && typeof amount !== 'number') {
      throw new Error('Invalid amount format');
    }

    return {
      id,
      from,
      to,
      amount: BigInt(amount),
      token,
      taskId,
      metadata,
      priority: priority || 'normal',
      timestamp: Date.now()
    };
  }

  private checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const limit = this.rateLimiter.get(ip);
    
    if (!limit) {
      this.rateLimiter.set(ip, { count: 1, resetTime: now + 60000 });
      return true;
    }

    if (now > limit.resetTime) {
      // Reset limit
      this.rateLimiter.set(ip, { count: 1, resetTime: now + 60000 });
      return true;
    }

    if (limit.count >= 100) { // 100 requests per minute
      return false;
    }

    limit.count++;
    return true;
  }
}