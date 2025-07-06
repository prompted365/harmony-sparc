/**
 * Payment System Usage Example
 * Demonstrates all payment system features
 */

import { PaymentSystem } from '../payment-system';
import { PaymentRequest, PaymentEvent } from '../types';
import { PAYMENT_CONSTANTS } from '../constants';

async function demonstratePaymentSystem() {
  console.log('🚀 Starting Payment System Demo...\n');

  // 1. Initialize Payment System
  const paymentSystem = new PaymentSystem({
    targetTps: 1500,
    maxBatchSize: 200,
    feePercentage: 0.25,
    supportedTokens: ['ETH', 'USDC', 'USDT', 'DAI']
  });

  try {
    // 2. Start the system
    await paymentSystem.start(3000);

    // 3. Register webhooks for notifications
    const webhookId = paymentSystem.registerWebhook(
      'https://api.example.com/webhooks/payments',
      [
        PaymentEvent.PAYMENT_COMPLETED,
        PaymentEvent.PAYMENT_FAILED,
        PaymentEvent.ESCROW_CREATED,
        PaymentEvent.ESCROW_RELEASED
      ],
      'webhook-secret-key'
    );
    console.log(`📡 Webhook registered: ${webhookId}`);

    // 4. Submit high-throughput payments
    console.log('\n💸 Submitting high-throughput payments...');
    const paymentPromises: Promise<string>[] = [];

    for (let i = 0; i < 1000; i++) {
      const payment: PaymentRequest = {
        id: `payment_${i}`,
        from: `0x${Math.random().toString(16).substr(2, 40)}`,
        to: `0x${Math.random().toString(16).substr(2, 40)}`,
        amount: BigInt(Math.floor(Math.random() * 1000000000000000000)), // Random amount up to 1 ETH
        token: ['ETH', 'USDC', 'USDT', 'DAI'][Math.floor(Math.random() * 4)],
        taskId: `task_${Math.floor(i / 10)}`,
        priority: ['low', 'normal', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
        timestamp: Date.now()
      };

      paymentPromises.push(paymentSystem.submitPayment(payment));
    }

    // Submit all payments and measure performance
    const startTime = Date.now();
    const transactionIds = await Promise.all(paymentPromises);
    const endTime = Date.now();

    console.log(`✅ Submitted ${transactionIds.length} payments in ${endTime - startTime}ms`);
    console.log(`📊 Average: ${((endTime - startTime) / transactionIds.length).toFixed(2)}ms per payment`);
    console.log(`⚡ TPS: ${(transactionIds.length / (endTime - startTime) * 1000).toFixed(2)}`);

    // 5. Create escrow accounts
    console.log('\n🏪 Creating escrow accounts...');
    const escrowAccounts = [];

    for (let i = 0; i < 10; i++) {
      const escrow = await paymentSystem.createEscrow(
        `task_${i}`,
        `0x${Math.random().toString(16).substr(2, 40)}`,
        `0x${Math.random().toString(16).substr(2, 40)}`,
        BigInt('1000000000000000000'), // 1 ETH
        'ETH',
        24 * 60 * 60 * 1000 // 24 hours
      );
      escrowAccounts.push(escrow);
    }

    console.log(`✅ Created ${escrowAccounts.length} escrow accounts`);

    // 6. Monitor payment status
    console.log('\n📊 Monitoring payment status...');
    const sampleTransactions = transactionIds.slice(0, 10);
    
    for (const txId of sampleTransactions) {
      const status = await paymentSystem.getPaymentStatus(txId);
      console.log(`Transaction ${txId}: ${status?.status || 'Not found'}`);
    }

    // 7. Release some escrow accounts
    console.log('\n🔓 Releasing escrow accounts...');
    const releasedEscrows = escrowAccounts.slice(0, 3);
    
    for (const escrow of releasedEscrows) {
      try {
        await paymentSystem.releaseEscrow(escrow.id);
        console.log(`✅ Released escrow: ${escrow.id}`);
      } catch (error) {
        console.log(`❌ Failed to release escrow ${escrow.id}: ${error}`);
      }
    }

    // 8. Get system metrics
    console.log('\n📈 System Metrics:');
    const metrics = paymentSystem.getSystemMetrics();
    console.log('Payment Metrics:', {
      tps: metrics.payments.tps,
      avgResponseTime: `${metrics.payments.avgResponseTime.toFixed(2)}ms`,
      queueDepth: metrics.payments.queueDepth,
      successRate: `${metrics.payments.successRate.toFixed(2)}%`,
      totalProcessed: metrics.payments.totalProcessed
    });

    console.log('Escrow Metrics:', {
      total: metrics.escrow.total,
      active: metrics.escrow.active,
      released: metrics.escrow.released,
      totalValue: `${metrics.escrow.totalValue.toString()} wei`
    });

    console.log('Webhook Metrics:', {
      totalWebhooks: metrics.webhooks.totalWebhooks,
      activeWebhooks: metrics.webhooks.activeWebhooks,
      queueSize: metrics.webhooks.queueSize
    });

    // 9. Health check
    console.log('\n🏥 Health Check:');
    const health = paymentSystem.getHealth();
    console.log(`Status: ${health.status}`);
    console.log('Components:', health.components);

    // 10. Performance test
    console.log('\n⚡ Performance Test (Response Time):');
    const performanceTests = [];
    
    for (let i = 0; i < 100; i++) {
      const startTime = Date.now();
      const payment: PaymentRequest = {
        id: `perf_test_${i}`,
        from: `0x${Math.random().toString(16).substr(2, 40)}`,
        to: `0x${Math.random().toString(16).substr(2, 40)}`,
        amount: BigInt('100000000000000000'), // 0.1 ETH
        token: 'ETH',
        priority: 'high',
        timestamp: Date.now()
      };

      const txId = await paymentSystem.submitPayment(payment);
      const responseTime = Date.now() - startTime;
      performanceTests.push(responseTime);
    }

    const avgResponseTime = performanceTests.reduce((a, b) => a + b, 0) / performanceTests.length;
    const maxResponseTime = Math.max(...performanceTests);
    const minResponseTime = Math.min(...performanceTests);
    const under100ms = performanceTests.filter(t => t < 100).length;

    console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`Min Response Time: ${minResponseTime}ms`);
    console.log(`Max Response Time: ${maxResponseTime}ms`);
    console.log(`Under 100ms: ${under100ms}/100 (${(under100ms/100*100).toFixed(1)}%)`);

    // Wait a bit to see some processing
    console.log('\n⏳ Waiting for processing to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Final metrics
    console.log('\n📊 Final Metrics:');
    const finalMetrics = paymentSystem.getSystemMetrics();
    console.log('Final Payment Metrics:', {
      tps: finalMetrics.payments.tps,
      avgResponseTime: `${finalMetrics.payments.avgResponseTime.toFixed(2)}ms`,
      totalProcessed: finalMetrics.payments.totalProcessed,
      successRate: `${finalMetrics.payments.successRate.toFixed(2)}%`
    });

    console.log('\n✅ Payment System Demo Complete!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Clean up
    await paymentSystem.stop();
  }
}

// Run the demo
if (require.main === module) {
  demonstratePaymentSystem().catch(console.error);
}

export { demonstratePaymentSystem };