# AgentFlow Swarm Integration

This directory contains the swarm coordination components integrated into AgentFlow from the ruv-swarm project. These components enable distributed agent coordination for workflow execution.

## Architecture

```
swarm/
├── coordination/     # Agent coordination and swarm management
│   ├── agent.ts     # Agent implementations (Workflow, Financial, ML)
│   └── coordinator.ts # Main swarm coordinator
├── memory/          # Persistent memory system
│   └── persistence.ts # SQLite-based memory storage
├── neural/          # Neural optimization models
│   └── base-model.ts # Base neural model and workflow optimizer
├── hooks/           # Event-driven hook system
│   └── index.ts     # Workflow lifecycle hooks
├── types/           # TypeScript type definitions
│   └── index.ts     # Core types and interfaces
├── utils.ts         # Utility functions
└── index.ts         # Main API entry point
```

## Key Components

### 1. **SwarmCoordinator**
- Manages agent lifecycle and task assignment
- Handles workflow execution and progress tracking
- Implements different topology patterns (mesh, hierarchical, distributed)
- Provides real-time metrics and monitoring

### 2. **Agent Types**
- **WorkflowAgent**: Executes workflow-specific tasks
- **FinancialAgent**: Handles financial transactions and operations
- **MLAgent**: Performs ML predictions and optimizations

### 3. **Memory System**
- Persistent storage using SQLite
- Workflow state tracking
- Agent state management
- Coordination event logging
- TTL-based cache expiration

### 4. **Neural Optimization**
- WorkflowOptimizer for task assignment optimization
- Feedforward neural network implementation
- Training and prediction capabilities

### 5. **Hook System**
- Pre/post task execution hooks
- Workflow lifecycle hooks
- Error handling and recovery
- Extensible notification system

## Usage

### Basic Setup

```typescript
import { createSwarm, AgentConfig } from '@agentflow/swarm';

// Create swarm instance
const swarm = createSwarm({
  topology: 'hierarchical',
  maxAgents: 10,
  syncInterval: 1000,
});

// Initialize with agents
const agents: AgentConfig[] = [
  { id: 'workflow-1', type: 'workflow', capabilities: ['execute', 'validate'] },
  { id: 'financial-1', type: 'financial', capabilities: ['transact', 'calculate'] },
  { id: 'ml-1', type: 'ml', capabilities: ['predict', 'optimize'] },
];

await swarm.initialize(agents);
```

### Execute Workflow

```typescript
import { Task } from '@agentflow/swarm';

// Define workflow steps
const steps: Task[] = [
  {
    id: 'validate',
    description: 'Validate input data',
    priority: 'high',
  },
  {
    id: 'process',
    description: 'Process financial transaction',
    priority: 'high',
    dependencies: ['validate'],
  },
  {
    id: 'predict',
    description: 'Predict outcome',
    priority: 'medium',
    dependencies: ['process'],
  },
];

// Execute workflow
const results = await swarm.executeWorkflow('workflow-123', steps);
```

### Memory Operations

```typescript
// Store data
await swarm.storeMemory('user_preferences', { theme: 'dark' }, 'settings', 3600);

// Retrieve data
const prefs = await swarm.retrieveMemory('user_preferences', 'settings');

// List entries
const entries = await swarm.listMemory('settings', 'user_*');
```

### Custom Hooks

```typescript
// Register pre-task hook
swarm.registerHook('pre-task', async (context, task) => {
  console.log(`Starting task: ${task.id}`);
  
  // Custom validation
  if (task.priority === 'critical' && !context.agentId.includes('senior')) {
    return {
      continue: false,
      reason: 'Critical tasks require senior agents',
    };
  }
  
  return { continue: true };
});

// Register post-task hook
swarm.registerHook('post-task', async (context, result) => {
  console.log(`Task ${context.taskId} completed with result:`, result);
  
  // Store result for analysis
  await swarm.storeMemory(`result_${context.taskId}`, result, 'results');
  
  return { continue: true };
});
```

### Monitoring

```typescript
// Get metrics
const metrics = swarm.getMetrics();
console.log('Completed tasks:', metrics.completedTasks);
console.log('Success rate:', metrics.workflowMetrics?.successRate);

// Get state
const state = swarm.getState();
console.log('Active agents:', state.agents.size);
console.log('Pending tasks:', Array.from(state.tasks.values())
  .filter(t => t.status === 'pending').length);
```

## Integration with AgentFlow

The swarm components are designed to work seamlessly with AgentFlow's existing architecture:

1. **Workflow Engine Integration**: The swarm coordinator can be used by AgentFlow's workflow engine for distributed task execution
2. **Memory Persistence**: Provides persistent storage for workflow state and agent coordination
3. **Neural Optimization**: Enhances task assignment and workflow optimization
4. **Event-Driven Architecture**: Hooks integrate with AgentFlow's event system

## Performance Considerations

- **Agent Pool Size**: Keep under 100 agents for optimal performance
- **Memory Cleanup**: Expired entries are cleaned automatically every minute
- **Task Timeout**: Default 5 minutes per task, configurable
- **Batch Processing**: Use batch operations for multiple tasks

## Development

### Running Tests

```bash
npm test -- src/agentflow/swarm
```

### Adding New Agent Types

1. Extend the `AgentFlowAgent` class
2. Implement the `executeTaskByType` method
3. Add to the factory function in `agent.ts`
4. Update types if needed

### Extending Memory System

The memory system uses SQLite and can be extended with new tables or indexes as needed. See `persistence.ts` for the schema.

## Migration from ruv-swarm

This integration includes only the essential components needed for AgentFlow:
- Core coordination logic
- Memory persistence
- Basic neural models
- Hook system

Not included:
- WASM components
- Advanced neural models (CNN, LSTM, etc.)
- MCP server components
- CLI tools

These can be added later if needed.