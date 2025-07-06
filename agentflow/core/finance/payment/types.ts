/**
 * Payment System Type Definitions
 */

export interface PaymentRequest {
  id: string;
  from: string;
  to: string;
  amount: bigint;
  token: string;
  taskId?: string;
  metadata?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  timestamp: number;
}

export interface PaymentTransaction {
  id: string;
  requestId: string;
  hash: string;
  status: PaymentStatus;
  from: string;
  to: string;
  amount: bigint;
  token: string;
  fee: bigint;
  gasUsed?: bigint;
  blockNumber?: number;
  timestamp: number;
  error?: string;
}

export enum PaymentStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  CONFIRMING = 'confirming',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface PaymentBatch {
  id: string;
  payments: PaymentRequest[];
  status: BatchStatus;
  createdAt: number;
  processedAt?: number;
  transactionHash?: string;
}

export enum BatchStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUBMITTED = 'submitted',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface EscrowAccount {
  id: string;
  taskId: string;
  payer: string;
  payee: string;
  amount: bigint;
  token: string;
  status: EscrowStatus;
  createdAt: number;
  releaseAt?: number;
  conditions?: EscrowCondition[];
}

export enum EscrowStatus {
  ACTIVE = 'active',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
  EXPIRED = 'expired'
}

export interface EscrowCondition {
  type: 'time' | 'approval' | 'completion' | 'custom';
  params: Record<string, any>;
  met: boolean;
}

export interface PaymentWebhook {
  id: string;
  url: string;
  events: PaymentEvent[];
  active: boolean;
  secret?: string;
  retries: number;
  lastError?: string;
}

export enum PaymentEvent {
  PAYMENT_CREATED = 'payment.created',
  PAYMENT_QUEUED = 'payment.queued',
  PAYMENT_PROCESSING = 'payment.processing',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  ESCROW_CREATED = 'escrow.created',
  ESCROW_RELEASED = 'escrow.released',
  ESCROW_REFUNDED = 'escrow.refunded',
  BATCH_COMPLETED = 'batch.completed'
}

export interface PaymentMetrics {
  tps: number;
  avgResponseTime: number;
  queueDepth: number;
  successRate: number;
  totalProcessed: number;
  totalVolume: bigint;
  tokenMetrics: Map<string, TokenMetrics>;
}

export interface TokenMetrics {
  token: string;
  volume: bigint;
  transactions: number;
  avgAmount: bigint;
  successRate: number;
}

export interface PaymentConfig {
  maxBatchSize: number;
  batchTimeout: number;
  maxRetries: number;
  retryDelay: number;
  maxQueueSize: number;
  targetTps: number;
  feePercentage: number;
  minFee: bigint;
  supportedTokens: string[];
  webhookTimeout: number;
  escrowDuration: number;
}