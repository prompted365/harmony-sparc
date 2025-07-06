# QuDAG Adapter for AgentFlow

A quantum-resistant communication and resource exchange adapter that integrates QuDAG's secure infrastructure with the AgentFlow platform. This adapter enables agents to communicate securely, trade resources, and operate anonymously through quantum-resistant cryptography and onion routing.

## Features

### 🔐 Quantum-Resistant Security
- **ML-KEM-768** encryption for secure key exchange
- **ML-DSA-65** digital signatures for authentication
- **BLAKE3** quantum-resistant hashing
- Zero-knowledge proofs for privacy

### 🌐 Anonymous Communication
- Multi-hop onion routing (configurable 1-7 hops)
- Traffic obfuscation with ChaCha20Poly1305
- Dark domain registration and resolution
- Temporary shadow addresses for ephemeral communication

### 💱 Resource Exchange
- Trade computational resources with rUv tokens
- Dynamic fee model based on agent verification and usage
- Support for CPU, Storage, Bandwidth, Model, and Memory resources
- Real-time order matching and settlement

### 📊 Performance Monitoring
- Real-time latency tracking
- Transaction throughput metrics
- Resource utilization monitoring
- Health check system with degradation detection

## Installation

```bash
# Install dependencies
npm install

# Build the adapter
npm run build
```

## Quick Start

```typescript
import { QuDAGAdapter } from '@agentflow/adapters/qudag';

// Configure the adapter
const adapter = new QuDAGAdapter({
  nodeUrl: 'http://localhost:8000',
  rpcPort: 9090,
  darkDomain: 'my-agent.dark',
  onionRoutingHops: 3,
  obfuscation: true,
  performanceTargets: {
    maxLatencyMs: 100,
    targetTPS: 1000,
    maxMemoryMB: 500
  }
});

// Initialize connection
await adapter.initialize();

// Send secure message
const messageId = await adapter.sendMessage('recipient.dark', {
  type: 'task',
  data: 'Process this securely'
});

// Trade resources
const order = {
  type: ResourceType.CPU,
  amount: 100,
  price: 0.5,
  timestamp: Date.now()
};
const result = await adapter.createResourceOrder(order);

// Check health
const health = await adapter.performHealthCheck();
console.log('System health:', health.status);
```

## API Reference

### Constructor

```typescript
new QuDAGAdapter(config: QuDAGConfig)
```

**Parameters:**
- `config.nodeUrl` - QuDAG node URL
- `config.rpcPort` - RPC port for JSON-RPC communication
- `config.darkDomain` - Optional dark domain to register
- `config.onionRoutingHops` - Number of hops for onion routing (0-7)
- `config.obfuscation` - Enable traffic obfuscation
- `config.resourceTypes` - Array of resource types to support
- `config.performanceTargets` - Performance monitoring thresholds

### Methods

#### `initialize(): Promise<void>`
Initialize the adapter and connect to QuDAG network. Generates quantum-resistant keys and registers dark domain if configured.

#### `sendMessage(recipient: string, payload: any): Promise<string>`
Send encrypted message through the network. Returns message ID.

**Parameters:**
- `recipient` - Dark domain or public key of recipient
- `payload` - Message data (will be JSON serialized)

#### `createResourceOrder(order: ResourceOrder): Promise<ResourceExchangeResult>`
Create and submit a resource exchange order.

**Parameters:**
- `order.type` - Resource type (CPU, STORAGE, etc.)
- `order.amount` - Amount to trade
- `order.price` - Price per unit

#### `getResourceBalances(): Promise<ResourceBalance[]>`
Get current resource balances for all supported types.

#### `resolveDarkDomain(domain: string): Promise<string>`
Resolve a .dark domain to network address.

#### `performHealthCheck(): Promise<HealthCheck>`
Perform comprehensive system health check.

#### `getConnectionStatus(): ConnectionStatus`
Get current connection status including latency and peer count.

#### `disconnect(): Promise<void>`
Disconnect from QuDAG network and clean up resources.

### Events

The adapter extends EventEmitter and emits the following events:

#### `message:received`
Emitted when a secure message is received.
```typescript
adapter.on('message:received', (event) => {
  console.log('Received message:', event.message);
});
```

#### `resource:exchange:completed`
Emitted when a resource exchange order is filled.
```typescript
adapter.on('resource:exchange:completed', (event) => {
  console.log('Order filled:', event.result);
});
```

#### `darkdomain:registered`
Emitted when a dark domain is successfully registered.

#### `connection:status:changed`
Emitted when connection status changes.

#### `performance:metric`
Emitted with performance metrics for monitoring.

## Resource Types

### Supported Resources
- **CPU** - Computational power (vCPU-hours)
- **STORAGE** - Data storage (GB)
- **BANDWIDTH** - Network bandwidth (GB)
- **MODEL** - AI model access (queries)
- **MEMORY** - RAM allocation (GB-hours)

### Dynamic Fee Model

The exchange implements a sophisticated fee model:

**Unverified Agents:**
- Base fee: 0.1%
- Maximum fee: 1.0%
- Fees increase with usage and time

**Verified Agents:**
- Base fee: 0.25%
- Maximum fee: 0.5%
- Fees decrease with high usage (rewards loyalty)

## Security Considerations

### Quantum Resistance
All cryptographic operations use NIST-approved post-quantum algorithms:
- ML-KEM-768 for key encapsulation (NIST Level 3)
- ML-DSA-65 for digital signatures (NIST Level 3)
- BLAKE3 for hashing (quantum-resistant)

### Privacy Features
- Onion routing prevents traffic analysis
- Shadow addresses for temporary identities
- Zero-knowledge proofs for selective disclosure
- Metadata protection at protocol level

### Best Practices
1. Always verify message signatures
2. Use maximum onion routing hops for sensitive data
3. Rotate shadow addresses regularly
4. Monitor health checks for performance degradation
5. Implement rate limiting for resource orders

## Performance Optimization

### Connection Pooling
The adapter maintains persistent connections to reduce latency:
```typescript
// Connections are reused automatically
await adapter.sendMessage('same-recipient.dark', data1);
await adapter.sendMessage('same-recipient.dark', data2); // Reuses connection
```

### Batch Operations
For multiple operations, batch them together:
```typescript
const promises = messages.map(msg => 
  adapter.sendMessage(msg.recipient, msg.data)
);
await Promise.all(promises);
```

### Resource Caching
Domain resolutions are cached for 5 minutes by default:
```typescript
// First call queries network
await adapter.resolveDarkDomain('example.dark');

// Subsequent calls use cache
await adapter.resolveDarkDomain('example.dark'); // Instant
```

## Error Handling

The adapter uses typed errors with specific error codes:

```typescript
try {
  await adapter.sendMessage('recipient.dark', data);
} catch (error) {
  if (error.code === QuDAGErrorCode.CONNECTION_FAILED) {
    // Handle connection failure
  } else if (error.code === QuDAGErrorCode.ENCRYPTION_ERROR) {
    // Handle encryption failure
  }
}
```

### Error Codes
- `CONNECTION_FAILED` - Network connection issues
- `ENCRYPTION_ERROR` - Encryption/decryption failures
- `SIGNING_ERROR` - Signature generation/verification failures
- `INVALID_RECIPIENT` - Invalid recipient address
- `INSUFFICIENT_RESOURCES` - Not enough resources for order
- `EXCHANGE_FAILED` - Resource exchange errors
- `DARK_DOMAIN_ERROR` - Domain registration/resolution errors
- `PERFORMANCE_DEGRADED` - System not meeting performance targets

## Testing

Run the comprehensive test suite:

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance

# Coverage report
npm run test:coverage
```

## Monitoring

### Health Metrics
Monitor system health in production:
```typescript
setInterval(async () => {
  const health = await adapter.performHealthCheck();
  if (health.status !== 'healthy') {
    console.warn('System degraded:', health);
  }
}, 60000); // Check every minute
```

### Performance Tracking
```typescript
adapter.on('performance:metric', (event) => {
  // Send to monitoring system
  prometheus.observe(event.metric.type, event.metric.latency);
});
```

## Contributing

See the main [CONTRIBUTING.md](../../../../CONTRIBUTING.md) for guidelines.

## License

This adapter is part of the AgentFlow platform and follows the same license terms.