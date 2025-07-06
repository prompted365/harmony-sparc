# QuDAG Adapter API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Core Classes](#core-classes)
3. [Interfaces & Types](#interfaces--types)
4. [Event System](#event-system)
5. [Error Handling](#error-handling)
6. [Performance Metrics](#performance-metrics)

## Overview

The QuDAG Adapter provides a comprehensive API for integrating quantum-resistant communication and resource exchange capabilities into the AgentFlow platform. All cryptographic operations use NIST-approved post-quantum algorithms.

## Core Classes

### QuDAGAdapter

The main adapter class that orchestrates all QuDAG functionality.

```typescript
class QuDAGAdapter extends EventEmitter
```

#### Constructor

```typescript
constructor(config: QuDAGConfig)
```

#### Methods

##### `initialize(): Promise<void>`
Initializes the adapter, generates quantum-resistant keys, and establishes network connection.

**Example:**
```typescript
const adapter = new QuDAGAdapter(config);
await adapter.initialize();
```

##### `sendMessage(recipient: string, payload: any): Promise<string>`
Sends an encrypted message through the QuDAG network.

**Parameters:**
- `recipient` - Dark domain address or public key
- `payload` - Message data (will be JSON serialized)

**Returns:** Message ID

**Example:**
```typescript
const messageId = await adapter.sendMessage('agent.dark', {
  type: 'task',
  data: { action: 'process', params: {} }
});
```

##### `createResourceOrder(order: ResourceOrder): Promise<ResourceExchangeResult>`
Creates and submits a resource exchange order.

**Parameters:**
- `order` - Resource order details

**Returns:** Exchange result with order ID and transaction details

##### `getResourceBalances(): Promise<ResourceBalance[]>`
Retrieves current resource balances for all supported types.

##### `resolveDarkDomain(domain: string): Promise<string>`
Resolves a .dark domain to its network address.

##### `performHealthCheck(): Promise<HealthCheck>`
Performs comprehensive system health check.

##### `getConnectionStatus(): ConnectionStatus`
Returns current connection status.

##### `disconnect(): Promise<void>`
Disconnects from the QuDAG network.

### CryptoManager

Handles all quantum-resistant cryptographic operations.

#### Methods

##### `generateKeys(): Promise<QuantumResistantKeys>`
Generates ML-KEM-768 and ML-DSA-65 key pairs.

##### `encrypt(data: Uint8Array, recipientPublicKey: string): Promise<Uint8Array>`
Encrypts data using ML-KEM encryption.

##### `decrypt(encryptedData: Uint8Array, privateKey: MLKEMKeyPair): Promise<Uint8Array>`
Decrypts data using ML-KEM decryption.

##### `sign(data: Uint8Array, signingKey: MLDSAKeyPair): Promise<Uint8Array>`
Signs data using ML-DSA signatures.

##### `verify(data: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean>`
Verifies ML-DSA signatures.

### NetworkManager

Manages P2P networking and message routing.

#### Methods

##### `connect(): Promise<void>`
Establishes connection to QuDAG network.

##### `sendMessage(message: SecureMessage): Promise<void>`
Sends message through P2P network.

##### `checkConnection(): Promise<boolean>`
Checks network connection health.

##### `getMetrics(): NetworkMetrics`
Returns network performance metrics.

### ExchangeManager

Handles resource trading and fee calculations.

#### Methods

##### `initialize(keys: QuantumResistantKeys): Promise<void>`
Initializes exchange with agent keys.

##### `submitOrder(order: ResourceOrder): Promise<ResourceExchangeResult>`
Submits signed order to exchange.

##### `calculateFee(orderValue: number): number`
Calculates dynamic fee based on agent status.

##### `verifyAgent(proofData: any): Promise<boolean>`
Verifies agent for reduced fees.

### DomainManager

Manages dark domain registration and resolution.

#### Methods

##### `registerDomain(domain: string, signingKey: MLDSAKeyPair, metadata?: any): Promise<string>`
Registers a .dark domain.

##### `resolveDomain(domain: string): Promise<string>`
Resolves domain to network address.

##### `generateShadowAddress(ttl?: number): Promise<string>`
Generates temporary shadow address.

##### `createFingerprint(data: string): Promise<string>`
Creates quantum-resistant fingerprint.

### RoutingManager

Handles onion routing for anonymous communication.

#### Methods

##### `sendThroughOnionRoute(message: SecureMessage, hops: number): Promise<void>`
Routes message through onion network.

##### `createCircuit(hops: number): Promise<Circuit>`
Creates new onion routing circuit.

## Interfaces & Types

### QuDAGConfig

```typescript
interface QuDAGConfig {
  nodeUrl: string;                    // QuDAG node URL
  rpcPort: number;                    // RPC port
  darkDomain?: string;                // Optional dark domain
  onionRoutingHops?: number;          // Onion routing hops (0-7)
  obfuscation?: boolean;              // Traffic obfuscation
  resourceTypes?: ResourceType[];     // Supported resources
  performanceTargets?: PerformanceTargets;
}
```

### QuantumResistantKeys

```typescript
interface QuantumResistantKeys {
  encryption: MLKEMKeyPair;   // ML-KEM-768 keys
  signing: MLDSAKeyPair;      // ML-DSA-65 keys
  darkDomainId?: string;      // Registered domain ID
}
```

### SecureMessage

```typescript
interface SecureMessage {
  id: string;
  sender: string;
  recipient: string;
  payload: Uint8Array;      // Encrypted with ML-KEM
  signature: Uint8Array;    // Signed with ML-DSA
  timestamp: number;
  nonce: string;
}
```

### ResourceOrder

```typescript
interface ResourceOrder {
  id?: string;
  type: ResourceType;
  amount: number;
  price: number;
  timestamp: number;
  signature: Uint8Array;
  status?: OrderStatus;
}
```

### ResourceExchangeResult

```typescript
interface ResourceExchangeResult {
  orderId: string;
  txHash: string;
  status: OrderStatus;
  filledAmount: number;
  remainingAmount: number;
  averagePrice: number;
}
```

### HealthCheck

```typescript
interface HealthCheck {
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
```

## Event System

The adapter emits the following events:

### `message:received`
Emitted when a secure message is received.

```typescript
adapter.on(QuDAGEventType.MESSAGE_RECEIVED, (event) => {
  // event.message: SecureMessage
  // event.timestamp: number
});
```

### `resource:exchange:completed`
Emitted when a resource exchange is completed.

```typescript
adapter.on(QuDAGEventType.RESOURCE_EXCHANGE_COMPLETED, (event) => {
  // event.result: ResourceExchangeResult
  // event.timestamp: number
});
```

### `darkdomain:registered`
Emitted when a dark domain is registered.

```typescript
adapter.on(QuDAGEventType.DARK_DOMAIN_REGISTERED, (event) => {
  // event.domain: string
  // event.timestamp: number
});
```

### `connection:status:changed`
Emitted when connection status changes.

```typescript
adapter.on(QuDAGEventType.CONNECTION_STATUS_CHANGED, (event) => {
  // event.connected: boolean
  // event.timestamp: number
});
```

### `performance:metric`
Emitted with performance metrics.

```typescript
adapter.on(QuDAGEventType.PERFORMANCE_METRIC, (event) => {
  // event.metric: { type: string, latency: number, ... }
  // event.timestamp: number
});
```

## Error Handling

All errors extend the `QuDAGError` class:

```typescript
class QuDAGError extends Error {
  code: QuDAGErrorCode;
  details?: any;
}
```

### Error Codes

```typescript
enum QuDAGErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  SIGNING_ERROR = 'SIGNING_ERROR',
  INVALID_RECIPIENT = 'INVALID_RECIPIENT',
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',
  EXCHANGE_FAILED = 'EXCHANGE_FAILED',
  DARK_DOMAIN_ERROR = 'DARK_DOMAIN_ERROR',
  PERFORMANCE_DEGRADED = 'PERFORMANCE_DEGRADED'
}
```

### Error Handling Example

```typescript
try {
  await adapter.sendMessage('recipient.dark', data);
} catch (error) {
  if (error instanceof QuDAGError) {
    switch (error.code) {
      case QuDAGErrorCode.CONNECTION_FAILED:
        // Handle connection failure
        break;
      case QuDAGErrorCode.ENCRYPTION_ERROR:
        // Handle encryption error
        break;
      default:
        // Handle other errors
    }
  }
}
```

## Performance Metrics

### Network Metrics

```typescript
interface NetworkMetrics {
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  averageLatency: number;
  currentTPS: number;
}
```

### Performance Targets

```typescript
interface PerformanceTargets {
  maxLatencyMs: number;     // Maximum acceptable latency
  targetTPS: number;        // Target transactions per second
  maxMemoryMB: number;      // Maximum memory usage
}
```

### Monitoring Example

```typescript
// Set performance targets
const adapter = new QuDAGAdapter({
  performanceTargets: {
    maxLatencyMs: 100,
    targetTPS: 1000,
    maxMemoryMB: 500
  }
});

// Monitor performance
adapter.on(QuDAGEventType.PERFORMANCE_METRIC, (event) => {
  if (event.metric.latency > 100) {
    console.warn('High latency:', event.metric.latency);
  }
});

// Check health
const health = await adapter.performHealthCheck();
if (health.status !== 'healthy') {
  console.error('System degraded:', health);
}
```