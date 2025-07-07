/**
 * AgentFlow - Distributed agent orchestration and workflow engine
 * 
 * Main entry point for the AgentFlow module
 */

// Export API components (explicit to avoid conflicts)
export {
  Server,
  config,
  logger,
  errorHandler,
  asyncHandler,
  createApiServer,
  createProductionApiServer,
  createDevelopmentApiServer,
} from './api';

// Export API types separately to avoid ApiError conflict
export type { Config, Request, Response, NextFunction } from './api';
export type { ApiError as ApiErrorType } from './api/middleware/error-handler';

// Export core finance components (explicit to avoid conflicts)
export {
  // Fee components
  FeeEngine,
  FeeDistributor,
  FeeMonitor,
  createFeeSystem,
  // Payment components
  PaymentSystem,
  PaymentProcessor,
  EscrowManager,
  // Wallet components  
  WalletManager,
  TransactionManager,
  KeyManager,
  createWalletSystem,
  WalletSystemBuilder,
} from './core/finance';

// Export finance types separately to avoid conflicts
export type {
  PaymentStatus,
  WalletConfig,
  WalletStats,
} from './core/finance';

// Export specific types from finance submodules
export type { PaymentRequest, PaymentTransaction } from './core/finance/payment/types';
export type { Transaction, SignedTransaction, TransactionRequest } from './core/finance/wallet/types';

// Export workflow components (explicit to avoid conflicts)
export {
  WorkflowRegistry,
  ExecutionEngine,
  EventBus,
  WorkflowValidator,
} from './core/workflows';

// Export workflow types separately to avoid ExecutionOptions conflict
export type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowStatus,
  WorkflowInstance,
  WorkflowEvent,
  WorkflowEventType,
} from './core/workflows/types';

// Export ExecutionOptions explicitly from its source
export type { ExecutionOptions } from './core/workflows/types';

// Export QUDAG adapter components (with correct naming)
export {
  QuDAGAdapter,
  QuDAGAdapter as QudagAdapter, // Alias for backward compatibility
  CryptoManager,
  NetworkManager,
  DomainManager,
  ExchangeManager,
  RoutingManager,
} from './adapters/qudag';

// Export API types if they exist
export type {
  ApiRequest,
  ApiResponse,
  ApiErrorCode,
  ApiError,
} from './api/types';

// Main API server export
export { default as createServer } from './api/server';