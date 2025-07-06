# AgentFlow

AgentFlow is a distributed agent orchestration and workflow engine that provides:

- **Agent Coordination**: Manage and coordinate multiple agents working on complex tasks
- **Workflow Engine**: Define, execute, and monitor multi-step workflows
- **Financial Components**: Built-in payment processing, fee management, and wallet functionality
- **QUDAG Integration**: Quantum DAG adapter for advanced routing and optimization
- **High Performance**: Optimized for throughput with caching, batching, and parallel execution

## Directory Structure

```
agentflow/
├── api/          # REST API server and HTTP endpoints
├── core/         # Core business logic and domain models
├── adapters/     # External system integrations (QUDAG, etc.)
├── contracts/    # Smart contract interfaces and ABIs
├── tests/        # Integration and unit tests
├── package.json  # Module configuration
└── index.ts      # Main entry point
```

## Installation

```bash
npm install @harmony-sparc/agentflow
```

## Quick Start

### As a Library

```typescript
import { createServer, PaymentSystem, WorkflowRegistry } from '@harmony-sparc/agentflow';

// Create and start API server
const server = createServer({
  port: 3000,
  enableMetrics: true,
});

// Use financial components
const paymentSystem = new PaymentSystem();
await paymentSystem.processPayment({
  amount: 100,
  currency: 'USDC',
  recipient: '0x...',
});

// Register workflows
const registry = new WorkflowRegistry();
registry.register({
  name: 'data-processing',
  steps: [...],
});
```

### As a Standalone Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/agents` - Create new agent
- `POST /api/workflows` - Submit workflow
- `GET /api/workflows/:id` - Get workflow status
- `POST /api/financial/payment` - Process payment
- `GET /api/financial/wallet/:address` - Get wallet balance

See [API Documentation](./api/docs/API.md) for full details.

## Core Components

### Finance Module
- **Payment System**: Multi-token payment processing with escrow
- **Fee Engine**: Dynamic fee calculation and distribution
- **Wallet Manager**: Secure key management and transaction signing

### Workflow Engine
- **Registry**: Store and manage workflow definitions
- **Execution Engine**: Run workflows with parallel step execution
- **Event Bus**: Real-time workflow events and notifications

### QUDAG Adapter
- **Quantum Routing**: Optimize task distribution across agents
- **Crypto Manager**: Handle cryptographic operations
- **Network Manager**: Manage P2P connections and discovery

## Configuration

Create a `.env` file:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
```

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance
```

## Deployment

AgentFlow includes production-ready deployment configurations:

- Docker & Docker Compose
- Kubernetes manifests
- Helm charts
- CI/CD pipelines (GitHub Actions, GitLab CI)

See [Deployment Guide](./api/deployment/README.md) for details.

## License

MIT