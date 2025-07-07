/**
 * QuDAG Adapter Usage Examples
 * Demonstrates various features and use cases of the quantum-resistant adapter
 */

import { QuDAGAdapter, ResourceType, OrderStatus, QuDAGEventType } from '../index';

async function basicUsageExample() {
  console.log('=== Basic QuDAG Adapter Usage ===\n');

  // Create adapter with basic configuration
  const adapter = new QuDAGAdapter({
    nodeUrl: 'http://localhost:8000',
    rpcPort: 9090,
    darkDomain: 'agent-example.dark'
  });

  try {
    // Initialize connection
    console.log('Initializing QuDAG connection...');
    await adapter.initialize();
    console.log('✓ Connected to QuDAG network');

    // Get connection status
    const status = adapter.getConnectionStatus();
    console.log('\nConnection Status:', {
      connected: status.connected,
      peers: status.peers,
      latency: `${status.latency}ms`,
      darkDomain: status.darkDomainActive ? 'agent-example.dark' : 'none'
    });

    // Send a secure message
    console.log('\nSending secure message...');
    const messageId = await adapter.sendMessage('recipient.dark', {
      type: 'greeting',
      message: 'Hello from quantum-resistant network!',
      timestamp: Date.now()
    });
    console.log('✓ Message sent:', messageId);

    // Check resource balances
    console.log('\nChecking resource balances...');
    const balances = await adapter.getResourceBalances();
    balances.forEach(balance => {
      console.log(`  ${balance.type}: ${balance.available} ${balance.unit} available`);
    });

  } finally {
    await adapter.disconnect();
    console.log('\n✓ Disconnected from QuDAG network');
  }
}

async function advancedSecurityExample() {
  console.log('\n=== Advanced Security Features ===\n');

  // Create adapter with maximum security settings
  const adapter = new QuDAGAdapter({
    nodeUrl: 'http://localhost:8000',
    rpcPort: 9090,
    darkDomain: 'secure-agent.dark',
    onionRoutingHops: 7, // Maximum anonymity
    obfuscation: true     // Traffic obfuscation enabled
  });

  try {
    await adapter.initialize();

    // Generate shadow address for ephemeral communication
    const domainManager = (adapter as any).domainManager;
    const shadowAddress = await domainManager.generateShadowAddress(300000); // 5 min TTL
    console.log('Generated shadow address:', shadowAddress);

    // Send highly sensitive data through maximum onion routing
    console.log('\nSending sensitive data with 7-hop onion routing...');
    const sensitiveData = {
      classification: 'TOP_SECRET',
      data: 'Quantum-resistant encrypted payload',
      expiresAt: Date.now() + 3600000
    };

    const messageId = await adapter.sendMessage(shadowAddress, sensitiveData);
    console.log('✓ Sensitive message sent through onion network:', messageId);

    // Create fingerprint for data verification
    const fingerprint = await domainManager.createFingerprint(
      JSON.stringify(sensitiveData)
    );
    console.log('Data fingerprint for verification:', fingerprint);

  } finally {
    await adapter.disconnect();
  }
}

async function resourceTradingExample() {
  console.log('\n=== Resource Trading Example ===\n');

  const adapter = new QuDAGAdapter({
    nodeUrl: 'http://localhost:8000',
    rpcPort: 9090,
    darkDomain: 'trader-agent.dark',
    resourceTypes: [ResourceType.CPU, ResourceType.STORAGE, ResourceType.MODEL]
  });

  try {
    await adapter.initialize();

    // Set up event listeners for trading
    adapter.on(QuDAGEventType.RESOURCE_EXCHANGE_COMPLETED, (event) => {
      console.log('\n📊 Resource exchange completed:', {
        orderId: event.result.orderId,
        status: event.result.status,
        filled: `${event.result.filledAmount} units at ${event.result.averagePrice}`
      });
    });

    // Create buy order for CPU resources
    console.log('Creating CPU resource order...');
    const cpuOrder = {
      type: ResourceType.CPU,
      amount: 50,  // 50 vCPU-hours
      price: 0.1,  // 0.1 rUv per vCPU-hour
      timestamp: Date.now(),
      signature: Buffer.from('mock-signature') as Uint8Array
    };

    const cpuResult = await adapter.createResourceOrder(cpuOrder);
    console.log('✓ CPU order placed:', {
      orderId: cpuResult.orderId,
      txHash: cpuResult.txHash,
      status: cpuResult.status
    });

    // Create sell order for storage resources
    console.log('\nCreating storage resource order...');
    const storageOrder = {
      type: ResourceType.STORAGE,
      amount: 100, // 100 GB
      price: 0.05, // 0.05 rUv per GB
      timestamp: Date.now(),
      signature: Buffer.from('mock-signature') as Uint8Array
    };

    const storageResult = await adapter.createResourceOrder(storageOrder);
    console.log('✓ Storage order placed:', storageResult.orderId);

    // Check updated balances
    const balances = await adapter.getResourceBalances();
    console.log('\nUpdated balances:');
    balances.forEach(balance => {
      if (balance.allocated > 0) {
        console.log(`  ${balance.type}: ${balance.available} available, ${balance.allocated} allocated`);
      }
    });

    // Calculate fees
    const exchangeManager = (adapter as any).exchangeManager;
    const orderValue = cpuOrder.amount * cpuOrder.price;
    const fee = exchangeManager.calculateFee(orderValue);
    console.log(`\nTransaction fee: ${(fee / orderValue * 100).toFixed(3)}% (${fee.toFixed(4)} rUv)`);

  } finally {
    await adapter.disconnect();
  }
}

async function performanceMonitoringExample() {
  console.log('\n=== Performance Monitoring Example ===\n');

  const adapter = new QuDAGAdapter({
    nodeUrl: 'http://localhost:8000',
    rpcPort: 9090,
    performanceTargets: {
      maxLatencyMs: 50,
      targetTPS: 1000,
      maxMemoryMB: 200
    }
  });

  // Set up performance monitoring
  const metrics: any[] = [];
  adapter.on(QuDAGEventType.PERFORMANCE_METRIC, (event) => {
    metrics.push(event.metric);
  });

  try {
    await adapter.initialize();

    // Send multiple messages to generate metrics
    console.log('Sending messages to generate performance metrics...');
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        adapter.sendMessage(`peer${i}.dark`, {
          test: true,
          index: i
        })
      );
    }

    await Promise.all(promises);
    console.log('✓ Messages sent');

    // Perform health check
    console.log('\nPerforming system health check...');
    const health = await adapter.performHealthCheck();
    
    console.log('Health Status:', health.status);
    console.log('Health Checks:', health.checks);
    console.log('Metrics:', {
      avgLatency: `${health.metrics.avgLatencyMs}ms`,
      currentTPS: health.metrics.currentTPS,
      memoryUsage: `${health.metrics.memoryUsageMB.toFixed(2)}MB`
    });

    // Analyze collected metrics
    if (metrics.length > 0) {
      const latencies = metrics
        .filter(m => m.type === 'message_sent')
        .map(m => m.latency);
      
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);

      console.log('\nPerformance Analysis:');
      console.log(`  Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`  Min latency: ${minLatency}ms`);
      console.log(`  Max latency: ${maxLatency}ms`);
      console.log(`  Total messages: ${latencies.length}`);
    }

  } finally {
    await adapter.disconnect();
  }
}

async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===\n');

  const adapter = new QuDAGAdapter({
    nodeUrl: 'http://localhost:8000',
    rpcPort: 9090
  });

  try {
    // Try to send message before initialization
    console.log('Attempting to send message before initialization...');
    try {
      await adapter.sendMessage('test.dark', { fail: true });
    } catch (error: any) {
      console.log('✓ Caught expected error:', error.message);
      console.log('  Error code:', error.code);
    }

    await adapter.initialize();

    // Try to resolve non-existent domain
    console.log('\nAttempting to resolve non-existent domain...');
    try {
      await adapter.resolveDarkDomain('does-not-exist.dark');
    } catch (error: any) {
      console.log('✓ Caught domain error:', error.message);
    }

    // Try to create order with insufficient resources
    console.log('\nAttempting to create order with insufficient resources...');
    try {
      await adapter.createResourceOrder({
        type: ResourceType.CPU,
        amount: 999999,
        price: 1.0,
        timestamp: Date.now(),
        signature: new Uint8Array()
      });
    } catch (error: any) {
      console.log('✓ Caught resource error:', error.message);
    }

  } finally {
    await adapter.disconnect();
  }
}

// Run examples
async function runExamples() {
  try {
    await basicUsageExample();
    await advancedSecurityExample();
    await resourceTradingExample();
    await performanceMonitoringExample();
    await errorHandlingExample();
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export for use in other modules
export {
  basicUsageExample,
  advancedSecurityExample,
  resourceTradingExample,
  performanceMonitoringExample,
  errorHandlingExample
};

// Run if executed directly
if (require.main === module) {
  runExamples();
}