/**
 * Escrow Manager
 * Manages task-based escrow accounts with conditions
 */

import { EventEmitter } from 'events';
import { EscrowAccount, EscrowStatus, EscrowCondition, PaymentRequest } from '../types';
import { PAYMENT_CONSTANTS, ERROR_CODES } from '../constants';

export class EscrowManager extends EventEmitter {
  private escrowAccounts: Map<string, EscrowAccount> = new Map();
  private conditionCheckers: Map<string, (condition: EscrowCondition, escrow: EscrowAccount) => Promise<boolean>> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeConditionCheckers();
    this.startConditionChecking();
  }

  /**
   * Create new escrow account
   */
  async createEscrow(
    taskId: string,
    payer: string,
    payee: string,
    amount: bigint,
    token: string,
    conditions: EscrowCondition[] = [],
    duration?: number
  ): Promise<EscrowAccount> {
    const escrowId = this.generateEscrowId(taskId);
    const releaseAt = duration ? Date.now() + duration : Date.now() + PAYMENT_CONSTANTS.DEFAULT_ESCROW_DURATION_MS;

    const escrow: EscrowAccount = {
      id: escrowId,
      taskId,
      payer,
      payee,
      amount,
      token,
      status: EscrowStatus.ACTIVE,
      createdAt: Date.now(),
      releaseAt,
      conditions: conditions.length > 0 ? conditions : [
        {
          type: 'time',
          params: { releaseAt },
          met: false
        }
      ]
    };

    this.escrowAccounts.set(escrowId, escrow);
    this.emit('escrow:created', escrow);

    return escrow;
  }

  /**
   * Release escrow funds
   */
  async releaseEscrow(escrowId: string): Promise<void> {
    const escrow = this.escrowAccounts.get(escrowId);
    if (!escrow) {
      throw new Error(ERROR_CODES.ESCROW_NOT_FOUND);
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new Error('Escrow is not active');
    }

    // Check if all conditions are met
    const allConditionsMet = await this.checkAllConditions(escrow);
    if (!allConditionsMet) {
      throw new Error(ERROR_CODES.ESCROW_CONDITIONS_NOT_MET);
    }

    // Update escrow status
    escrow.status = EscrowStatus.RELEASED;
    
    // Process payment to payee
    await this.processEscrowPayment(escrow);
    
    this.emit('escrow:released', escrow);
  }

  /**
   * Refund escrow funds
   */
  async refundEscrow(escrowId: string, reason?: string): Promise<void> {
    const escrow = this.escrowAccounts.get(escrowId);
    if (!escrow) {
      throw new Error(ERROR_CODES.ESCROW_NOT_FOUND);
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new Error('Escrow is not active');
    }

    // Update escrow status
    escrow.status = EscrowStatus.REFUNDED;
    
    // Process refund to payer
    await this.processEscrowRefund(escrow);
    
    this.emit('escrow:refunded', escrow, reason);
  }

  /**
   * Add condition to escrow
   */
  addCondition(escrowId: string, condition: EscrowCondition): void {
    const escrow = this.escrowAccounts.get(escrowId);
    if (!escrow) {
      throw new Error(ERROR_CODES.ESCROW_NOT_FOUND);
    }

    if (!escrow.conditions) {
      escrow.conditions = [];
    }

    escrow.conditions.push(condition);
    this.emit('escrow:condition_added', escrow, condition);
  }

  /**
   * Check escrow conditions
   */
  async checkConditions(escrowId: string): Promise<boolean> {
    const escrow = this.escrowAccounts.get(escrowId);
    if (!escrow) {
      throw new Error(ERROR_CODES.ESCROW_NOT_FOUND);
    }

    return await this.checkAllConditions(escrow);
  }

  /**
   * Get escrow account
   */
  getEscrow(escrowId: string): EscrowAccount | null {
    return this.escrowAccounts.get(escrowId) || null;
  }

  /**
   * Get escrows by task
   */
  getEscrowsByTask(taskId: string): EscrowAccount[] {
    return Array.from(this.escrowAccounts.values())
      .filter(escrow => escrow.taskId === taskId);
  }

  /**
   * Get escrows by status
   */
  getEscrowsByStatus(status: EscrowStatus): EscrowAccount[] {
    return Array.from(this.escrowAccounts.values())
      .filter(escrow => escrow.status === status);
  }

  /**
   * Get escrow statistics
   */
  getEscrowStats(): {
    total: number;
    active: number;
    released: number;
    refunded: number;
    disputed: number;
    totalValue: bigint;
  } {
    const escrows = Array.from(this.escrowAccounts.values());
    
    return {
      total: escrows.length,
      active: escrows.filter(e => e.status === EscrowStatus.ACTIVE).length,
      released: escrows.filter(e => e.status === EscrowStatus.RELEASED).length,
      refunded: escrows.filter(e => e.status === EscrowStatus.REFUNDED).length,
      disputed: escrows.filter(e => e.status === EscrowStatus.DISPUTED).length,
      totalValue: escrows.reduce((sum, e) => sum + e.amount, BigInt(0))
    };
  }

  /**
   * Dispute escrow
   */
  async disputeEscrow(escrowId: string, reason: string): Promise<void> {
    const escrow = this.escrowAccounts.get(escrowId);
    if (!escrow) {
      throw new Error(ERROR_CODES.ESCROW_NOT_FOUND);
    }

    escrow.status = EscrowStatus.DISPUTED;
    this.emit('escrow:disputed', escrow, reason);
  }

  private async checkAllConditions(escrow: EscrowAccount): Promise<boolean> {
    if (!escrow.conditions || escrow.conditions.length === 0) {
      return true;
    }

    for (const condition of escrow.conditions) {
      const checker = this.conditionCheckers.get(condition.type);
      if (!checker) {
        console.warn(`No checker found for condition type: ${condition.type}`);
        continue;
      }

      const met = await checker(condition, escrow);
      condition.met = met;

      if (!met) {
        return false;
      }
    }

    return true;
  }

  private initializeConditionCheckers(): void {
    // Time-based condition checker
    this.conditionCheckers.set('time', async (condition, escrow) => {
      const releaseAt = condition.params.releaseAt || escrow.releaseAt;
      return Date.now() >= releaseAt;
    });

    // Approval-based condition checker
    this.conditionCheckers.set('approval', async (condition, escrow) => {
      return condition.params.approved === true;
    });

    // Completion-based condition checker
    this.conditionCheckers.set('completion', async (condition, escrow) => {
      // Check if task is completed
      return condition.params.completed === true;
    });

    // Custom condition checker
    this.conditionCheckers.set('custom', async (condition, escrow) => {
      // Custom logic based on condition params
      return condition.params.conditionMet === true;
    });
  }

  private startConditionChecking(): void {
    // Check conditions every minute
    this.checkInterval = setInterval(() => {
      this.checkAndReleaseEscrows();
    }, 60000);
  }

  private async checkAndReleaseEscrows(): Promise<void> {
    const activeEscrows = this.getEscrowsByStatus(EscrowStatus.ACTIVE);
    
    for (const escrow of activeEscrows) {
      try {
        const conditionsMet = await this.checkAllConditions(escrow);
        if (conditionsMet) {
          await this.releaseEscrow(escrow.id);
        }
      } catch (error) {
        console.error(`Error checking escrow ${escrow.id}:`, error);
      }
    }
  }

  private async processEscrowPayment(escrow: EscrowAccount): Promise<void> {
    // Create payment request for escrow release
    const paymentRequest: PaymentRequest = {
      id: `escrow_release_${escrow.id}`,
      from: escrow.payer,
      to: escrow.payee,
      amount: escrow.amount,
      token: escrow.token,
      taskId: escrow.taskId,
      priority: 'high',
      timestamp: Date.now()
    };

    // In real implementation, this would use the payment processor
    console.log('Processing escrow payment:', paymentRequest);
  }

  private async processEscrowRefund(escrow: EscrowAccount): Promise<void> {
    // Create refund request
    const refundRequest: PaymentRequest = {
      id: `escrow_refund_${escrow.id}`,
      from: escrow.payee,
      to: escrow.payer,
      amount: escrow.amount,
      token: escrow.token,
      taskId: escrow.taskId,
      priority: 'high',
      timestamp: Date.now()
    };

    // In real implementation, this would use the payment processor
    console.log('Processing escrow refund:', refundRequest);
  }

  private generateEscrowId(taskId: string): string {
    return `escrow_${taskId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}