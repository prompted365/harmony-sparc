/**
 * QuDAG Integration Types
 * Defines all types for quantum-resistant QuDAG network integration
 */

// Quantum-resistant cryptography types
export interface MLKEMKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  algorithm: 'ML-KEM-768';
}

export interface MLDSAKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  algorithm: 'ML-DSA-65';
}

export interface QuantumResistantKeys {
  encryption: MLKEMKeyPair;
  signing: MLDSAKeyPair;
  darkDomainId?: string;
}

// QuDAG configuration
export interface QuDAGConfig {
  nodeUrl: string;
  rpcPort: number;
  darkDomain?: string;
  onionRoutingHops?: number;
  obfuscation?: boolean;
  resourceTypes?: ResourceType[];
  performanceTargets?: PerformanceTargets;
}

export interface PerformanceTargets {
  maxLatencyMs: number;
  targetTPS: number;
  maxMemoryMB: number;
}

// Resource types for QuDAG network
export enum ResourceType {
  CPU = 'CPU',
  STORAGE = 'Storage',
  BANDWIDTH = 'Bandwidth',
  MODEL = 'Model',
  MEMORY = 'Memory'
}

export interface ResourceBalance {
  type: ResourceType;
  available: number;
  allocated: number;
  unit: string;
}

// Message types
export interface SecureMessage {
  id: string;
  sender: string;
  recipient: string;
  payload: Uint8Array; // Encrypted with ML-KEM
  signature: Uint8Array; // Signed with ML-DSA
  timestamp: number;
  nonce: string;
  fingerprint?: number[]; // Quantum fingerprint for integrity
  compressionUsed?: boolean;
  encryptionAlgorithm?: string;
  signatureAlgorithm?: string;
  // Blockchain compatibility fields
  ethSignature?: string;
  orderHash?: string;
  creator?: string;
  txHash?: string;
}

export interface OnionRoutingConfig {
  hops: number;
  obfuscation: boolean;
  exitNode?: string;
}

// Resource exchange types
export interface ResourceOrder {
  id?: string;
  type: ResourceType;
  amount: number;
  price: number;
  timestamp: number;
  signature: Uint8Array;
  status?: OrderStatus;
  // Blockchain-specific fields (optional for blockchain integration)
  ethSignature?: string;
  orderHash?: string;
  creator?: string;
  txHash?: string;
}

export enum OrderStatus {
  PENDING = 'pending',
  FILLED = 'filled',
  PARTIALLY_FILLED = 'partially_filled',
  CANCELLED = 'cancelled'
}

export interface ResourceExchangeResult {
  orderId: string;
  txHash: string;
  status: OrderStatus;
  filledAmount: number;
  remainingAmount: number;
  averagePrice: number;
  gasUsed?: number;
  blockNumber?: number;
  fee?: number;
}

// Event types
export enum QuDAGEventType {
  MESSAGE_RECEIVED = 'message:received',
  RESOURCE_EXCHANGE_COMPLETED = 'resource:exchange:completed',
  DARK_DOMAIN_REGISTERED = 'darkdomain:registered',
  CONNECTION_STATUS_CHANGED = 'connection:status:changed',
  PERFORMANCE_METRIC = 'performance:metric'
}

export interface QuDAGEvent {
  type: QuDAGEventType;
  data: any;
  timestamp: number;
}

// Connection and health types
export interface ConnectionStatus {
  connected: boolean;
  latency: number;
  peers: number;
  darkDomainActive: boolean;
  lastHeartbeat: number;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    connectivity: boolean;
    encryption: boolean;
    signing: boolean;
    resourceExchange: boolean;
    performance: boolean;
  };
  metrics: {
    avgLatencyMs: number;
    currentTPS: number;
    memoryUsageMB: number;
  };
}

// Transaction types
export interface QuDAGTransaction {
  hash: string;
  from: string;
  to: string;
  value: number;
  resourceType?: ResourceType;
  data?: Uint8Array;
  signature: Uint8Array;
  timestamp: number;
  confirmations: number;
}

export interface TransactionReceipt {
  txHash: string;
  transactionHash: string; // ethers v6 uses this property name
  status: 'success' | 'failed' | number; // ethers v6 may return numeric status
  blockNumber: number;
  gasUsed?: number | bigint; // ethers v6 uses bigint
  logs: TransactionLog[];
}

export interface TransactionLog {
  address: string;
  topics: string[];
  data: string;
}

// Error types
export class QuDAGError extends Error {
  constructor(
    message: string,
    public code: QuDAGErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'QuDAGError';
  }
}

export enum QuDAGErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  SIGNING_ERROR = 'SIGNING_ERROR',
  INVALID_RECIPIENT = 'INVALID_RECIPIENT',
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',
  EXCHANGE_FAILED = 'EXCHANGE_FAILED',
  DARK_DOMAIN_ERROR = 'DARK_DOMAIN_ERROR',
  PERFORMANCE_DEGRADED = 'PERFORMANCE_DEGRADED'
}