/**
 * Payment API Routes
 * Express.js routes for payment system
 */

import express from 'express';
import { PaymentAPI } from './payment-api';
import { PaymentProcessor } from '../processors/payment-processor';
import { EscrowManager } from '../escrow/escrow-manager';
import { WebhookManager } from '../webhooks/webhook-manager';
import { NotificationService } from '../webhooks/notification-service';

export function createPaymentRoutes(
  paymentProcessor: PaymentProcessor,
  escrowManager: EscrowManager,
  webhookManager: WebhookManager,
  notificationService: NotificationService
): express.Router {
  const router = express.Router();
  const paymentAPI = new PaymentAPI(
    paymentProcessor,
    escrowManager,
    webhookManager,
    notificationService
  );

  // Middleware for JSON parsing and request validation
  router.use(express.json({ limit: '10mb' }));
  router.use(express.urlencoded({ extended: true }));

  // Payment routes
  router.post('/payments', (req, res) => paymentAPI.submitPayment(req, res));
  router.get('/payments/:transactionId', (req, res) => paymentAPI.getPaymentStatus(req, res));
  router.get('/payments/metrics', (req, res) => paymentAPI.getPaymentMetrics(req, res));

  // Escrow routes
  router.post('/escrow', (req, res) => paymentAPI.createEscrow(req, res));
  router.post('/escrow/:escrowId/release', (req, res) => paymentAPI.releaseEscrow(req, res));
  router.get('/escrow/:escrowId', (req, res) => paymentAPI.getEscrowStatus(req, res));

  // Webhook routes
  router.post('/webhooks', (req, res) => paymentAPI.registerWebhook(req, res));
  router.post('/webhooks/:webhookId/test', (req, res) => paymentAPI.testWebhook(req, res));

  // System routes
  router.get('/health', (req, res) => paymentAPI.getHealth(req, res));
  router.get('/stats', (req, res) => paymentAPI.getDetailedStats(req, res));

  return router;
}

/**
 * Payment System Server
 * Complete Express.js server for payment processing
 */
export class PaymentServer {
  private app: express.Application;
  private paymentProcessor: PaymentProcessor;
  private escrowManager: EscrowManager;
  private webhookManager: WebhookManager;
  private notificationService: NotificationService;

  constructor() {
    this.app = express();
    this.initializeServices();
    this.setupRoutes();
    this.setupMiddleware();
  }

  /**
   * Start the payment server
   */
  async start(port: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.app.listen(port, () => {
          console.log(`Payment server running on port ${port}`);
          
          // Start payment processing
          this.paymentProcessor.start();
          
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the payment server
   */
  async stop(): Promise<void> {
    this.paymentProcessor.stop();
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }

  private initializeServices(): void {
    this.webhookManager = new WebhookManager();
    this.notificationService = new NotificationService(this.webhookManager);
    this.escrowManager = new EscrowManager();
    this.paymentProcessor = new PaymentProcessor();

    // Connect services
    this.setupServiceConnections();
  }

  private setupServiceConnections(): void {
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

  private setupRoutes(): void {
    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      const originalSend = res.send;
      
      res.send = function(body) {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
        return originalSend.call(this, body);
      };
      
      next();
    });

    // Payment routes
    const paymentRoutes = createPaymentRoutes(
      this.paymentProcessor,
      this.escrowManager,
      this.webhookManager,
      this.notificationService
    );

    this.app.use('/api', paymentRoutes);
  }

  private setupMiddleware(): void {
    // Error handling middleware
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Payment API Error:', error);
      
      res.status(500).json({
        error: 'Internal server error',
        timestamp: Date.now()
      });
    });

    // 404 handler
    this.app.use((req: express.Request, res: express.Response) => {
      res.status(404).json({
        error: 'Endpoint not found',
        timestamp: Date.now()
      });
    });
  }
}

/**
 * WebSocket server for real-time notifications
 */
export class PaymentWebSocketServer {
  private server: any; // WebSocket server instance
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Start WebSocket server
   */
  async start(port: number = 3001): Promise<void> {
    // WebSocket server implementation would go here
    // For now, this is a placeholder
    console.log(`WebSocket server would start on port ${port}`);
  }

  /**
   * Handle WebSocket connections
   */
  private handleConnection(socket: WebSocket): void {
    const channelId = this.generateChannelId();
    this.notificationService.addChannel(channelId, socket);

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(channelId, message);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    socket.addEventListener('close', () => {
      this.notificationService.removeChannel(channelId, socket);
    });
  }

  private handleMessage(channelId: string, message: any): void {
    // Handle WebSocket messages (subscription management, etc.)
    console.log(`Channel ${channelId} message:`, message);
  }

  private generateChannelId(): string {
    return `channel_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}