/**
 * Notification Service
 * Handles real-time payment notifications
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { PaymentTransaction, PaymentEvent, EscrowAccount } from '../types';
import { WebhookManager } from './webhook-manager';

export class NotificationService extends EventEmitter {
  private webhookManager: WebhookManager;
  private subscribers: Map<string, Set<(event: PaymentEvent, data: any) => void>> = new Map();
  private channels: Map<string, WebSocket[]> = new Map();

  constructor(webhookManager: WebhookManager) {
    super();
    this.webhookManager = webhookManager;
    this.initializeEventHandlers();
  }

  /**
   * Subscribe to payment events
   */
  subscribe(
    events: PaymentEvent[],
    callback: (event: PaymentEvent, data: any) => void
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    
    events.forEach(event => {
      if (!this.subscribers.has(event)) {
        this.subscribers.set(event, new Set());
      }
      this.subscribers.get(event)!.add(callback);
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    // Implementation would track subscriptions by ID
    // For now, this is a placeholder
    return true;
  }

  /**
   * Add WebSocket channel for real-time notifications
   */
  addChannel(channelId: string, websocket: WebSocket): void {
    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, []);
    }
    
    this.channels.get(channelId)!.push(websocket);
    
    // Clean up on close
    websocket.addEventListener('close', () => {
      this.removeChannel(channelId, websocket);
    });
  }

  /**
   * Remove WebSocket channel
   */
  removeChannel(channelId: string, websocket: WebSocket): void {
    const channels = this.channels.get(channelId);
    if (channels) {
      const index = channels.indexOf(websocket);
      if (index > -1) {
        channels.splice(index, 1);
        if (channels.length === 0) {
          this.channels.delete(channelId);
        }
      }
    }
  }

  /**
   * Send notification to all subscribers
   */
  async notify(event: PaymentEvent, data: any): Promise<void> {
    // Notify local subscribers
    const subscribers = this.subscribers.get(event);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(event, data);
        } catch (error) {
          console.error('Subscriber callback error:', error);
        }
      });
    }

    // Send to WebSocket channels
    await this.broadcastToChannels(event, data);

    // Send webhooks
    await this.webhookManager.sendWebhook(event, data);

    // Emit for other listeners
    this.emit('notification:sent', event, data);
  }

  /**
   * Notify payment created
   */
  async notifyPaymentCreated(transaction: PaymentTransaction): Promise<void> {
    await this.notify(PaymentEvent.PAYMENT_CREATED, {
      transaction,
      timestamp: Date.now()
    });
  }

  /**
   * Notify payment completed
   */
  async notifyPaymentCompleted(transaction: PaymentTransaction): Promise<void> {
    await this.notify(PaymentEvent.PAYMENT_COMPLETED, {
      transaction,
      timestamp: Date.now()
    });
  }

  /**
   * Notify payment failed
   */
  async notifyPaymentFailed(transaction: PaymentTransaction): Promise<void> {
    await this.notify(PaymentEvent.PAYMENT_FAILED, {
      transaction,
      timestamp: Date.now()
    });
  }

  /**
   * Notify escrow created
   */
  async notifyEscrowCreated(escrow: EscrowAccount): Promise<void> {
    await this.notify(PaymentEvent.ESCROW_CREATED, {
      escrow,
      timestamp: Date.now()
    });
  }

  /**
   * Notify escrow released
   */
  async notifyEscrowReleased(escrow: EscrowAccount): Promise<void> {
    await this.notify(PaymentEvent.ESCROW_RELEASED, {
      escrow,
      timestamp: Date.now()
    });
  }

  /**
   * Notify batch completed
   */
  async notifyBatchCompleted(batchId: string, transactions: PaymentTransaction[]): Promise<void> {
    await this.notify(PaymentEvent.BATCH_COMPLETED, {
      batchId,
      transactions,
      totalAmount: transactions.reduce((sum, tx) => sum + tx.amount, BigInt(0)),
      timestamp: Date.now()
    });
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(): {
    totalSubscribers: number;
    totalChannels: number;
    eventSubscriptions: Record<string, number>;
    webhookStats: any;
  } {
    const eventSubscriptions: Record<string, number> = {};
    this.subscribers.forEach((subscribers, event) => {
      eventSubscriptions[event] = subscribers.size;
    });

    return {
      totalSubscribers: Array.from(this.subscribers.values()).reduce((sum, set) => sum + set.size, 0),
      totalChannels: Array.from(this.channels.values()).reduce((sum, channels) => sum + channels.length, 0),
      eventSubscriptions,
      webhookStats: this.webhookManager.getDeliveryStats()
    };
  }

  /**
   * Create notification templates
   */
  createNotificationTemplate(event: PaymentEvent, template: any): void {
    // Store notification templates for consistent formatting
    // Implementation would store templates in database or memory
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(notifications: Array<{
    event: PaymentEvent;
    data: any;
    recipients?: string[];
  }>): Promise<void> {
    const promises = notifications.map(notification => 
      this.notify(notification.event, notification.data)
    );
    
    await Promise.allSettled(promises);
  }

  private initializeEventHandlers(): void {
    // Handle webhook delivery events
    this.webhookManager.on('webhook:delivered', (webhook, event) => {
      this.emit('notification:delivered', { webhook, event, timestamp: Date.now() });
    });

    this.webhookManager.on('webhook:failed', (webhook, event, error) => {
      this.emit('notification:failed', { webhook, event, error, timestamp: Date.now() });
    });
  }

  private async broadcastToChannels(event: PaymentEvent, data: any): Promise<void> {
    const message = JSON.stringify({
      event,
      data,
      timestamp: Date.now()
    });

    const broadcasts: Promise<void>[] = [];
    
    this.channels.forEach((websockets, channelId) => {
      websockets.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          broadcasts.push(
            new Promise((resolve, reject) => {
              try {
                ws.send(message);
                resolve();
              } catch (error) {
                reject(error);
              }
            })
          );
        }
      });
    });

    await Promise.allSettled(broadcasts);
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}