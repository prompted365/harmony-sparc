# AgentFlow Directory Structure

This document describes the organization of the AgentFlow module after reorganization.

## Root Structure

```
harmony-sparc/
├── agentflow/              # Main AgentFlow module (standalone)
│   ├── api/               # REST API and HTTP layer
│   ├── core/              # Core business logic
│   ├── adapters/          # External system integrations
│   ├── contracts/         # Smart contract interfaces
│   ├── tests/             # Test suites
│   ├── package.json       # Module configuration
│   ├── tsconfig.json      # TypeScript configuration
│   ├── jest.config.js     # Jest test configuration
│   ├── README.md          # Module documentation
│   └── index.ts           # Main entry point
├── src/                   # Main Harmony SPARC application source
└── ...                    # Other project directories
```

## Detailed Structure

### `/agentflow/api/`
REST API server implementation with Express.js

- `server.ts` - Main server setup and configuration
- `index.ts` - API exports
- `routes/` - API endpoint definitions
  - `agents.ts` - Agent management endpoints
  - `workflows.ts` - Workflow execution endpoints
  - `financial.ts` - Payment and wallet endpoints
  - `qudag.ts` - QUDAG integration endpoints
  - `health.ts` - Health check endpoints
- `middleware/` - Express middleware
  - `auth.ts` - Authentication middleware
  - `error-handler.ts` - Global error handling
  - `rate-limit.ts` - Rate limiting
  - `validation.ts` - Request validation
- `utils/` - Utility functions
- `types/` - TypeScript type definitions
- `docs/` - API documentation
- `deployment/` - Deployment configurations
  - `kubernetes/` - K8s manifests
  - `helm/` - Helm charts
  - `scripts/` - Deployment scripts

### `/agentflow/core/`
Core business logic and domain models

- `finance/` - Financial components
  - `payment/` - Payment processing system
  - `fees/` - Fee calculation and distribution
  - `wallet/` - Wallet management
- `workflows/` - Workflow engine
  - `engine/` - Execution engine
  - `registry/` - Workflow registry
  - `events/` - Event bus
  - `validator/` - Workflow validation

### `/agentflow/adapters/`
External system integrations

- `qudag/` - Quantum DAG adapter
  - `crypto/` - Cryptographic operations
  - `network/` - Network management
  - `domain/` - Domain resolution
  - `exchange/` - Exchange integration
  - `routing/` - Routing algorithms

### `/agentflow/contracts/`
Smart contract interfaces and ABIs (when added)

### `/agentflow/tests/`
Test suites

- `integration/` - Integration tests
- `performance.test.ts` - Performance benchmarks
- `setup.ts` - Test setup and utilities

## Import Paths

The module supports the following import patterns:

```typescript
// From external packages
import { PaymentSystem } from '@harmony-sparc/agentflow';
import { FeeEngine } from '@harmony-sparc/agentflow/core';
import { QudagAdapter } from '@harmony-sparc/agentflow/adapters';

// Within AgentFlow
import { WorkflowRegistry } from '@core/workflows';
import { validateRequest } from '@api/middleware/validation';
import { CryptoManager } from '@adapters/qudag/crypto';
```

## Migration Notes

1. AgentFlow is now a standalone module at `/agentflow/`
2. All imports from `src/agentflow/` should be updated to `agentflow/`
3. The module can be published to npm as `@harmony-sparc/agentflow`
4. Tests remain co-located with their respective modules
5. API server can run independently or be imported as a library

## Benefits of New Structure

1. **Modularity**: AgentFlow can be used independently
2. **Clear Separation**: API, core logic, and adapters are clearly separated
3. **Easier Testing**: Each layer can be tested in isolation
4. **Better Imports**: Cleaner import paths with aliases
5. **Deployment Flexibility**: Can deploy as microservice or library