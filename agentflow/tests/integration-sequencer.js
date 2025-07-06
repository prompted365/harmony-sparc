const Sequencer = require('@jest/test-sequencer').default;

class IntegrationTestSequencer extends Sequencer {
  sort(tests) {
    // Sort tests to run in a specific order for integration testing
    const testOrder = [
      'health.test.ts',           // Basic health checks first
      'financial-integration.test.ts', // Financial system
      'qudag-integration.test.ts',     // QuDAG system
      'agent-coordination.test.ts',    // Agent system
      'workflow-integration.test.ts',  // Workflow system
      'end-to-end.test.ts'            // Full integration last
    ];

    return tests.sort((testA, testB) => {
      const getTestOrder = (testPath) => {
        const testName = testPath.split('/').pop();
        const index = testOrder.findIndex(order => testName.includes(order.replace('.test.ts', '')));
        return index === -1 ? testOrder.length : index;
      };

      return getTestOrder(testA.path) - getTestOrder(testB.path);
    });
  }
}

module.exports = IntegrationTestSequencer;