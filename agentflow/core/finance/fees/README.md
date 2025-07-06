# AgentFlow Fee Engine

A comprehensive fee calculation, distribution, and monitoring system for the AgentFlow platform. This engine handles dynamic fee calculation, multi-tier distribution, volume-based discounts, batch processing, and real-time analytics.

## Features

### 🧮 Dynamic Fee Calculation
- **Real-time network condition adjustments** - Fees adapt to gas prices and network congestion
- **Multi-tier fee distribution** - Platform (40%), Network (30%), Agent (20%), Staking (10%)
- **Volume-based discounts** - Up to 30% off for high-volume users
- **Batch processing discounts** - Up to 40% off for batch transactions
- **Priority-based fee scaling** - Different rates for critical, high, normal, and low priority transactions

### 📊 Comprehensive Analytics
- **Real-time metrics** - Transaction throughput, latency, error rates
- **Historical trending** - Hourly, daily, and weekly analytics
- **Performance monitoring** - Service health, bottleneck detection
- **Revenue tracking** - Fee collection by token, type, and time period

### 🔄 Automated Distribution
- **Batch processing** - Efficient gas-optimized distributions
- **Staking rewards** - Automated reward calculation and distribution
- **Retry mechanisms** - Robust error handling with exponential backoff
- **Gas optimization** - Smart batching and transaction optimization

### 🚨 Real-time Monitoring
- **Performance alerts** - Automated alerts for threshold breaches
- **Network condition monitoring** - Track gas prices and congestion
- **Distribution tracking** - Monitor success rates and processing times
- **Custom dashboards** - Real-time visualization of all metrics

## Quick Start

### Basic Usage

```typescript
import { createFeeSystem } from '@agentflow/core/finance/fees';

// Create fee system with default configuration
const feeSystem = createFeeSystem();

// Calculate fee for a transaction
const fee = await feeSystem.getFeeEngine().calculateOptimalFee({
  id: 'tx-1',
  from: '0x1234...',
  to: '0x5678...',
  amount: BigInt('1000000000000000000'), // 1 ETH
  token: 'ETH',
  priority: 'normal',
  timestamp: Date.now()
});

console.log('Fee breakdown:', {
  total: fee.totalFee.toString(),
  platform: fee.platformFee.toString(),
  network: fee.networkFee.toString(),
  agent: fee.agentFee.toString(),
  staking: fee.stakingRewards.toString()
});
```

### Batch Processing

```typescript
// Calculate fees for multiple transactions with batch discount
const transactions = [
  { id: 'tx-1', from: '0x1234...', to: '0x5678...', amount: BigInt('1000000000000000000'), token: 'ETH' },
  { id: 'tx-2', from: '0x1234...', to: '0x9abc...', amount: BigInt('500000000000000000'), token: 'ETH' },
  // ... more transactions
];

const batchResult = await feeSystem.getFeeEngine().calculateBatchFees(transactions);

console.log('Batch savings:', {
  totalFees: batchResult.totalFees.toString(),
  discount: batchResult.batchDiscount,
  savings: batchResult.savings.toString()
});
```

### Real-time Monitoring

```typescript
// Start monitoring
const monitor = feeSystem.getFeeMonitor();
monitor.startMonitoring();

// Listen for alerts
monitor.on('alertCreated', (alert) => {
  console.log(`Alert: ${alert.type} - ${alert.message}`);
});

// Get dashboard data
const dashboard = monitor.getDashboardData();
console.log('Current metrics:', dashboard.currentMetrics);
```

## API Reference

### FeeEngine

The core fee calculation engine with dynamic pricing and optimization.

#### Methods

```typescript
// Calculate optimal fee for a transaction
async calculateOptimalFee(request: PaymentRequest): Promise<FeeBreakdown>

// Calculate batch fees with volume discounts
async calculateBatchFees(requests: PaymentRequest[]): Promise<BatchFeeResult>

// Get fee optimization recommendations
async getFeeOptimization(request: PaymentRequest): Promise<FeeOptimization>

// Get comprehensive analytics
getAnalytics(): FeeAnalytics

// Export fee data
exportFeeData(format: 'json' | 'csv'): string
```

### FeeMonitor

Real-time monitoring and alerting system.

#### Methods

```typescript
// Start/stop monitoring
startMonitoring(): void
stopMonitoring(): void

// Get current metrics
getCurrentMetrics(): FeeMetrics | null

// Get dashboard data
getDashboardData(): DashboardData

// Get performance report
getPerformanceReport(hours: number): FeePerformanceReport
```

### FeeDistributor

Automated fee distribution and staking management.

#### Methods

```typescript
// Queue distributions for processing
queueDistributions(distributions: FeeDistribution[]): void

// Get distribution statistics
getDistributionStats(): DistributionStats

// Manage staking pool
addToStakingPool(address: string, amount: bigint): void
calculateStakingRewards(address: string): bigint

// Get distribution history
getDistributionHistory(limit: number): DistributionBatch[]
```

### FeeAPIService

RESTful API service for fee management.

#### Endpoints

```typescript
// Fee calculation
POST /api/fees/calculate
POST /api/fees/batch

// Analytics
GET /api/fees/analytics
GET /api/fees/report

// Monitoring
GET /api/fees/dashboard
GET /api/fees/health

// Distribution
GET /api/fees/distribution/stats
POST /api/fees/distribution/process
```

## Configuration

### FeeEngineConfig

```typescript
interface FeeEngineConfig {
  realTimeUpdates: boolean;           // Enable real-time updates
  analyticsRetention: number;         // Days to retain analytics
  distributionThreshold: bigint;      // Minimum amount for distribution
  gasOptimization: boolean;           // Enable gas optimization
  batchProcessing: boolean;           // Enable batch processing
  performanceTargets: {
    maxLatency: number;               // Maximum latency in ms
    targetThroughput: number;         // Target transactions per second
  };
}
```

### FeeMonitorConfig

```typescript
interface FeeMonitorConfig {
  updateInterval: number;             // Monitoring update interval (ms)
  alertThresholds: {
    highFeeRate: number;              // High fee rate threshold
    lowThroughput: number;            // Low throughput threshold (TPS)
    highLatency: number;              // High latency threshold (ms)
    errorRate: number;                // Error rate threshold (%)
  };
  metricsRetention: number;           // Hours to retain metrics
  realTimeUpdates: boolean;           // Enable real-time updates
}
```

### DistributionConfig

```typescript
interface DistributionConfig {
  batchSize: number;                  // Distribution batch size
  processingInterval: number;         // Processing interval (ms)
  minDistributionAmount: bigint;      // Minimum distribution amount
  maxRetries: number;                 // Maximum retry attempts
  retryDelay: number;                 // Retry delay (ms)
  gasOptimization: boolean;           // Enable gas optimization
  stakingPoolAddress: string;         // Staking pool contract address
  platformTreasuryAddress: string;    // Platform treasury address
  networkFundAddress: string;         // Network fund address
}
```

## Fee Structure

### Distribution Breakdown

- **Platform Fee (40%)** - Platform operations and development
- **Network Fee (30%)** - Gas costs and network infrastructure
- **Agent Fee (20%)** - Agent operators and task execution
- **Staking Rewards (10%)** - Distributed to token stakers

### Discount Tiers

#### Volume Discounts (up to 30% off)
- **1+ ETH volume**: 5% discount
- **10+ ETH volume**: 10% discount
- **100+ ETH volume**: 20% discount
- **1000+ ETH volume**: 30% discount

#### Batch Discounts (up to 40% off)
- **10+ transactions**: 10% discount
- **20+ transactions**: 20% discount
- **50+ transactions**: 30% discount
- **100+ transactions**: 40% discount

### Dynamic Pricing

Fees automatically adjust based on:
- Network congestion levels
- Gas price fluctuations
- Transaction priority
- Time of day patterns

## Performance Metrics

### Target Performance
- **Throughput**: 1,000+ transactions per second
- **Latency**: <100ms average response time
- **Availability**: 99.9% uptime
- **Error Rate**: <0.5% failed transactions

### Monitoring Metrics
- Transaction processing rate
- Fee calculation latency
- Distribution success rate
- Network condition tracking
- Revenue analytics

## Integration Examples

### With Payment Processor

```typescript
import { createFeeSystem } from '@agentflow/core/finance/fees';
import { PaymentProcessor } from '@agentflow/core/finance/payment';

const feeSystem = createFeeSystem();
const paymentProcessor = new PaymentProcessor(config);

// Integrate fee calculation with payment processing
paymentProcessor.on('paymentCreated', async (payment) => {
  const fee = await feeSystem.getFeeEngine().calculateOptimalFee(payment);
  await feeSystem.getFeeEngine().queueFeeDistribution(payment);
});
```

### With Analytics Dashboard

```typescript
// Real-time dashboard updates
const monitor = feeSystem.getFeeMonitor();
monitor.on('metricsUpdated', (metrics) => {
  updateDashboard(metrics);
});

// Performance reports
const report = monitor.getPerformanceReport(24); // Last 24 hours
sendReport(report);
```

### With Staking System

```typescript
// Add user to staking pool
const distributor = feeSystem.getFeeDistributor();
distributor.addToStakingPool(userAddress, stakeAmount);

// Distribute rewards
await distributor.distributeStakingRewards();

// Check user rewards
const rewards = distributor.calculateStakingRewards(userAddress);
```

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test fees

# Run specific test categories
npm test fees/fee-engine
npm test fees/fee-monitor
npm test fees/fee-distributor
npm test fees/fee-api

# Run integration tests
npm test fees/integration

# Run performance tests
npm test fees/performance
```

## Monitoring and Alerts

### Available Alerts

- **High Fee Rate**: When fees exceed configured thresholds
- **Low Throughput**: When transaction processing falls below targets
- **High Latency**: When response times exceed limits
- **Error Rate**: When error rates exceed acceptable levels
- **Network Congestion**: When network conditions deteriorate

### Custom Alerts

```typescript
// Set custom alert thresholds
monitor.setAlertThresholds({
  highFeeRate: 0.02,    // 2% fee rate
  lowThroughput: 500,   // 500 TPS
  highLatency: 150,     // 150ms
  errorRate: 2          // 2% error rate
});

// Listen for specific alerts
monitor.on('alertCreated', (alert) => {
  if (alert.type === 'high_fees') {
    notifyOperators(alert);
  }
});
```

## Troubleshooting

### Common Issues

1. **High Latency**
   - Enable fee caching
   - Reduce analytics retention period
   - Optimize batch sizes

2. **Distribution Failures**
   - Check gas limits
   - Verify recipient addresses
   - Review network conditions

3. **Alert Noise**
   - Adjust threshold values
   - Increase alert cooldown periods
   - Filter by severity levels

### Debug Mode

```typescript
// Enable debug logging
const feeSystem = createFeeSystem({
  feeEngine: {
    ...config,
    debug: true
  }
});

// Export debug data
const debugData = feeSystem.getFeeEngine().exportFeeData('json');
console.log('Debug data:', debugData);
```

## License

This fee engine is part of the AgentFlow platform and is subject to the platform's licensing terms.

## Support

For technical support and questions:
- GitHub Issues: [AgentFlow Issues](https://github.com/agentflow/issues)
- Documentation: [AgentFlow Docs](https://docs.agentflow.ai)
- Community: [AgentFlow Discord](https://discord.gg/agentflow)