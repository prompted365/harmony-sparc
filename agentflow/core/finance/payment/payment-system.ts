/**
 * Payment System Main Entry Point
 * Complete payment processing system with all components
 */

import { PaymentProcessor } from './processors/payment-processor';
import { EscrowManager } from './escrow/escrow-manager';
import { WebhookManager } from './webhooks/webhook-manager';
import { NotificationService } from './webhooks/notification-service';
import { PaymentServer } from './api/payment-routes';
import { PaymentConfig, PaymentRequest, PaymentTransaction, EscrowAccount } from './types';
import { PAYMENT_CONSTANTS } from './constants';

export class PaymentSystem {
  private paymentProcessor: PaymentProcessor;
  private escrowManager: EscrowManager;
  private webhookManager: WebhookManager;
  private notificationService: NotificationService;
  private paymentServer: PaymentServer;
  private isRunning: boolean = false;

  constructor(config: Partial<PaymentConfig> = {}) {
    // Initialize all components
    this.webhookManager = new WebhookManager();
    this.notificationService = new NotificationService(this.webhookManager);
    this.escrowManager = new EscrowManager();
    this.paymentProcessor = new PaymentProcessor(config);
    this.paymentServer = new PaymentServer();

    // Set up event connections
    this.setupEventConnections();
  }

  /**
   * Start the payment system
   */
  async start(port: number = 3000): Promise<void> {
    if (this.isRunning) {
      throw new Error('Payment system is already running');
    }

    try {
      // Start payment processor
      this.paymentProcessor.start();

      // Start API server
      await this.paymentServer.start(port);

      this.isRunning = true;
      console.log(`Payment system started successfully on port ${port}`);
      
      // Log system capabilities
      this.logSystemCapabilities();
    } catch (error) {
      console.error('Failed to start payment system:', error);
      throw error;
    }
  }

  /**
   * Stop the payment system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop payment processor
      this.paymentProcessor.stop();

      // Stop API server
      await this.paymentServer.stop();

      this.isRunning = false;
      console.log('Payment system stopped successfully');
    } catch (error) {
      console.error('Error stopping payment system:', error);
      throw error;
    }
  }

  /**
   * Submit a payment
   */
  async submitPayment(request: PaymentRequest): Promise<string> {
    return await this.paymentProcessor.submitPayment(request);
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(transactionId: string): Promise<PaymentTransaction | null> {
    return await this.paymentProcessor.getPaymentStatus(transactionId);
  }

  /**
   * Create escrow account
   */
  async createEscrow(
    taskId: string,
    payer: string,
    payee: string,
    amount: bigint,
    token: string,
    duration?: number
  ): Promise<EscrowAccount> {
    return await this.escrowManager.createEscrow(
      taskId,
      payer,
      payee,
      amount,
      token,
      [],
      duration
    );
  }

  /**
   * Release escrow
   */
  async releaseEscrow(escrowId: string): Promise<void> {
    await this.escrowManager.releaseEscrow(escrowId);
  }

  /**
   * Register webhook
   */
  registerWebhook(url: string, events: string[], secret?: string): string {
    return this.webhookManager.registerWebhook(url, events as any, secret);
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): {
    payments: any;
    escrow: any;
    webhooks: any;
    notifications: any;
  } {
    return {
      payments: this.paymentProcessor.getMetrics(),
      escrow: this.escrowManager.getEscrowStats(),
      webhooks: this.webhookManager.getDeliveryStats(),
      notifications: this.notificationService.getNotificationStats()
    };
  }

  /**
   * Get system health
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, boolean>;
    metrics: any;
  } {
    const metrics = this.getSystemMetrics();
    const health = {
      status: 'healthy' as 'healthy' | 'degraded',
      components: {
        paymentProcessor: this.isRunning,
        escrowManager: true,
        webhookManager: true,
        notificationService: true
      },
      metrics
    };

    // Check if system is healthy
    if (metrics.payments.avgResponseTime > PAYMENT_CONSTANTS.MAX_RESPONSE_TIME_MS) {
      health.status = 'degraded';
    }

    if (metrics.payments.tps < PAYMENT_CONSTANTS.TARGET_TPS * 0.8) {
      health.status = 'degraded';
    }

    return health;
  }

  private setupEventConnections(): void {
    // Payment processor events
    this.paymentProcessor.on('payment:created', (transaction) => {
      this.notificationService.notifyPaymentCreated(transaction);
    });

    this.paymentProcessor.on('payment:completed', (transaction) => {
      this.notificationService.notifyPaymentCompleted(transaction);
    });

    this.paymentProcessor.on('payment:failed', (transaction) => {
      this.notificationService.notifyPaymentFailed(transaction);
    });

    // Escrow manager events
    this.escrowManager.on('escrow:created', (escrow) => {
      this.notificationService.notifyEscrowCreated(escrow);
    });

    this.escrowManager.on('escrow:released', (escrow) => {
      this.notificationService.notifyEscrowReleased(escrow);
    });
  }

  private logSystemCapabilities(): void {
    console.log('\n🚀 AgentFlow Payment System Capabilities:');
    console.log(`   ⚡ Target TPS: ${PAYMENT_CONSTANTS.TARGET_TPS}`);
    console.log(`   📊 Max Response Time: ${PAYMENT_CONSTANTS.MAX_RESPONSE_TIME_MS}ms`);
    console.log(`   🔗 Multi-Token Support: ${Object.keys(PAYMENT_CONSTANTS.SUPPORTED_TOKENS).join(', ')}`);
    console.log(`   🏪 Escrow Management: Active`);
    console.log(`   📡 Webhook Notifications: Active`);
    console.log(`   📈 Real-time Metrics: Active`);
    console.log(`   🔄 Batch Processing: Active`);
    console.log(`   🎯 Priority Queue: Active\n`);
  }
}

/**
 * Factory function to create payment system
 */
export function createPaymentSystem(config: Partial<PaymentConfig> = {}): PaymentSystem {
  return new PaymentSystem(config);
}

/**
 * Default export for easy importing
 */
export default PaymentSystem;