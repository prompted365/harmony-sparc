/**
 * Webhook Manager
 * Handles payment event notifications
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { PaymentWebhook, PaymentEvent, PaymentTransaction } from '../types';
import { PAYMENT_CONSTANTS, ERROR_CODES } from '../constants';

export class WebhookManager extends EventEmitter {
  private webhooks: Map<string, PaymentWebhook> = new Map();
  private deliveryQueue: Array<{
    webhook: PaymentWebhook;
    event: PaymentEvent;
    payload: any;
    attempt: number;
  }> = [];
  private processing: boolean = false;

  constructor() {
    super();
    this.startDeliveryProcessor();
  }

  /**
   * Register a webhook
   */
  registerWebhook(
    url: string,
    events: PaymentEvent[],
    secret?: string
  ): string {
    const id = this.generateWebhookId();
    
    const webhook: PaymentWebhook = {
      id,
      url,
      events,
      active: true,
      secret,
      retries: 0,
      lastError: undefined
    };

    this.webhooks.set(id, webhook);
    this.emit('webhook:registered', webhook);
    
    return id;
  }

  /**
   * Unregister a webhook
   */
  unregisterWebhook(id: string): boolean {
    const webhook = this.webhooks.get(id);
    if (!webhook) return false;

    this.webhooks.delete(id);
    this.emit('webhook:unregistered', webhook);
    
    return true;
  }

  /**
   * Update webhook configuration
   */
  updateWebhook(
    id: string,
    updates: Partial<Pick<PaymentWebhook, 'url' | 'events' | 'secret' | 'active'>>
  ): boolean {
    const webhook = this.webhooks.get(id);
    if (!webhook) return false;

    Object.assign(webhook, updates);
    this.emit('webhook:updated', webhook);
    
    return true;
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(
    event: PaymentEvent,
    payload: any
  ): Promise<void> {
    const relevantWebhooks = Array.from(this.webhooks.values())
      .filter(webhook => webhook.active && webhook.events.includes(event));

    for (const webhook of relevantWebhooks) {
      this.queueDelivery(webhook, event, payload);
    }
  }

  /**
   * Get webhook by ID
   */
  getWebhook(id: string): PaymentWebhook | null {
    return this.webhooks.get(id) || null;
  }

  /**
   * Get all webhooks
   */
  getWebhooks(): PaymentWebhook[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStats(): {
    totalWebhooks: number;
    activeWebhooks: number;
    queueSize: number;
    failedDeliveries: number;
    averageRetries: number;
  } {
    const webhooks = Array.from(this.webhooks.values());
    const failed = webhooks.filter(w => w.lastError).length;
    const totalRetries = webhooks.reduce((sum, w) => sum + w.retries, 0);

    return {
      totalWebhooks: webhooks.length,
      activeWebhooks: webhooks.filter(w => w.active).length,
      queueSize: this.deliveryQueue.length,
      failedDeliveries: failed,
      averageRetries: webhooks.length > 0 ? totalRetries / webhooks.length : 0
    };
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(id: string): Promise<boolean> {
    const webhook = this.webhooks.get(id);
    if (!webhook) return false;

    const testPayload = {
      event: 'webhook.test',
      timestamp: Date.now(),
      data: {
        message: 'This is a test webhook'
      }
    };

    try {
      await this.deliverWebhook(webhook, 'PAYMENT_CREATED' as PaymentEvent, testPayload);
      return true;
    } catch (error) {
      return false;
    }
  }

  private queueDelivery(
    webhook: PaymentWebhook,
    event: PaymentEvent,
    payload: any
  ): void {
    this.deliveryQueue.push({
      webhook,
      event,
      payload,
      attempt: 0
    });
  }

  private startDeliveryProcessor(): void {
    if (this.processing) return;
    
    this.processing = true;
    this.processDeliveryQueue();
  }

  private async processDeliveryQueue(): Promise<void> {
    while (this.processing) {
      if (this.deliveryQueue.length === 0) {
        await this.sleep(100);
        continue;
      }

      const delivery = this.deliveryQueue.shift();
      if (!delivery) continue;

      try {
        await this.deliverWebhook(delivery.webhook, delivery.event, delivery.payload);
        
        // Reset retry count on successful delivery
        delivery.webhook.retries = 0;
        delivery.webhook.lastError = undefined;
        
        this.emit('webhook:delivered', delivery.webhook, delivery.event);
      } catch (error) {
        delivery.attempt++;
        delivery.webhook.retries++;
        delivery.webhook.lastError = (error as Error).message;
        
        if (delivery.attempt < PAYMENT_CONSTANTS.WEBHOOK_MAX_RETRIES) {
          // Retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, delivery.attempt), 30000);
          setTimeout(() => {
            this.deliveryQueue.push(delivery);
          }, delay);
        } else {
          this.emit('webhook:failed', delivery.webhook, delivery.event, error);
        }
      }
    }
  }

  private async deliverWebhook(
    webhook: PaymentWebhook,
    event: PaymentEvent,
    payload: any
  ): Promise<void> {
    const deliveryPayload = {
      id: this.generateDeliveryId(),
      event,
      timestamp: Date.now(),
      data: payload
    };

    const body = JSON.stringify(deliveryPayload);
    const signature = webhook.secret ? this.generateSignature(body, webhook.secret) : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AgentFlow-Payment-System/1.0',
      'X-Webhook-Event': event,
      'X-Webhook-Delivery': deliveryPayload.id
    };

    if (signature) {
      headers['X-Webhook-Signature'] = signature;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAYMENT_CONSTANTS.WEBHOOK_TIMEOUT_MS);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Optional: validate response
      const responseText = await response.text();
      if (responseText && responseText.toLowerCase().includes('error')) {
        throw new Error(`Webhook endpoint returned error: ${responseText}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Webhook delivery timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private generateWebhookId(): string {
    return `webhook_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateDeliveryId(): string {
    return `delivery_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private generateSignature(body: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    return `sha256=${hmac.digest('hex')}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}