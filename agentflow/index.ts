/**
 * AgentFlow - Distributed agent orchestration and workflow engine
 * 
 * Main entry point for the AgentFlow module
 */

// Export API components
export * from './api';

// Export core components
export * from './core/finance';
export * from './core/workflows';

// Export adapters
export * from './adapters/qudag';

// Export types
export * from './api/types';
export * from './core/workflows/types';

// Main API server export
export { default as createServer } from './api/server';

// Convenience exports
export {
  // Finance
  FeeEngine,
  PaymentSystem,
  WalletManager,
} from './core/finance';

export {
  // Workflows
  WorkflowRegistry,
  ExecutionEngine,
  EventBus,
} from './core/workflows';

export {
  // QUDAG
  QudagAdapter,
  CryptoManager,
  NetworkManager,
  DomainManager,
  ExchangeManager,
  RoutingManager,
} from './adapters/qudag';