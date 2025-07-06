/**
 * API Types
 * Common types and interfaces for the AgentFlow API
 */

import { Request, Response, NextFunction } from 'express';
import { WorkflowDefinition, WorkflowInstance, WorkflowStatus } from '../../core/workflows/types';
import { QuDAGTransaction, ResourceBalance } from '../../adapters/qudag/types';

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

export interface ApiMeta {
  timestamp: number;
  version: string;
  requestId: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Request Types
export interface ApiRequest extends Request {
  user?: AuthUser;
  requestId?: string;
  startTime?: number;
}

export interface AuthUser {
  id: string;
  address: string;
  roles: string[];
  permissions: string[];
  apiKey?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Workflow API Types
export interface CreateWorkflowRequest {
  workflow: Omit<WorkflowDefinition, 'id'>;
  autoStart?: boolean;
}

export interface UpdateWorkflowRequest {
  workflow: Partial<WorkflowDefinition>;
}

export interface ExecuteWorkflowRequest {
  workflowId: string;
  input?: Record<string, any>;
  options?: ExecutionOptions;
}

export interface ExecutionOptions {
  async?: boolean;
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
  tags?: string[];
}

// Agent API Types
export interface AgentInfo {
  id: string;
  type: string;
  status: 'idle' | 'busy' | 'offline';
  capabilities: string[];
  currentTask?: string;
  metrics: AgentMetrics;
}

export interface AgentMetrics {
  tasksCompleted: number;
  successRate: number;
  avgExecutionTime: number;
  lastActive: Date;
}

export interface AssignAgentRequest {
  agentId: string;
  taskId: string;
  priority?: number;
}

// Financial API Types
export interface WalletInfo {
  address: string;
  balances: TokenBalance[];
  transactions: Transaction[];
  totalValue: number;
}

export interface TokenBalance {
  token: string;
  balance: number;
  value: number;
  change24h: number;
}

export interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'stake';
  amount: number;
  token: string;
  from: string;
  to: string;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
  fee?: number;
}

export interface PaymentRequest {
  amount: number;
  token: string;
  recipient: string;
  memo?: string;
  urgency?: 'normal' | 'high';
}

// QuDAG API Types
export interface QuDAGStatus {
  connected: boolean;
  peers: number;
  latency: number;
  darkDomainActive: boolean;
  resources: ResourceBalance[];
}

export interface ResourceExchangeRequest {
  resourceType: string;
  amount: number;
  maxPrice?: number;
  urgent?: boolean;
}

// Rate Limiting
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

// WebSocket Events
export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: number;
}

export interface SubscriptionRequest {
  events: string[];
  filters?: Record<string, any>;
}

// Monitoring
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  timestamp: Date;
  uptime: number;
}

export interface ServiceHealth {
  name: string;
  status: boolean;
  latency?: number;
  error?: string;
}

export interface MetricsSnapshot {
  requests: {
    total: number;
    rate: number;
    errors: number;
  };
  performance: {
    p50: number;
    p95: number;
    p99: number;
  };
  resources: {
    cpu: number;
    memory: number;
    connections: number;
  };
}

// Middleware Types
export type ApiMiddleware = (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

export interface CacheOptions {
  ttl: number;
  key?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
}

// Error Codes
export enum ApiErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

// OpenAPI Types
export interface OpenApiInfo {
  title: string;
  version: string;
  description: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface OpenApiSecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
}