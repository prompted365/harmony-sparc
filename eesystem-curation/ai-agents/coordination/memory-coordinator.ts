/**
 * Memory Coordinator - EESystem Content Curation Platform
 * Manages memory sharing and coordination between AI agents
 */

export class MemoryCoordinator {
  private sharedMemory: Map<string, any>;
  private agentMemories: Map<string, Map<string, any>>;
  private memoryHistory: Array<MemoryEntry>;
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 1000) {
    this.sharedMemory = new Map();
    this.agentMemories = new Map();
    this.memoryHistory = [];
    this.maxHistorySize = maxHistorySize;
  }

  // Shared memory operations
  setShared(key: string, value: any, agentId?: string): void {
    const entry: MemoryEntry = {
      id: this.generateEntryId(),
      key,
      value,
      agentId,
      timestamp: new Date().toISOString(),
      type: 'shared'
    };

    this.sharedMemory.set(key, value);
    this.addToHistory(entry);
  }

  getShared(key: string): any {
    return this.sharedMemory.get(key);
  }

  hasShared(key: string): boolean {
    return this.sharedMemory.has(key);
  }

  deleteShared(key: string): boolean {
    const deleted = this.sharedMemory.delete(key);
    if (deleted) {
      this.addToHistory({
        id: this.generateEntryId(),
        key,
        value: null,
        timestamp: new Date().toISOString(),
        type: 'shared',
        operation: 'delete'
      });
    }
    return deleted;
  }

  // Agent-specific memory operations
  setAgentMemory(agentId: string, key: string, value: any): void {
    if (!this.agentMemories.has(agentId)) {
      this.agentMemories.set(agentId, new Map());
    }

    const agentMemory = this.agentMemories.get(agentId)!;
    agentMemory.set(key, value);

    this.addToHistory({
      id: this.generateEntryId(),
      key,
      value,
      agentId,
      timestamp: new Date().toISOString(),
      type: 'agent'
    });
  }

  getAgentMemory(agentId: string, key: string): any {
    const agentMemory = this.agentMemories.get(agentId);
    return agentMemory ? agentMemory.get(key) : undefined;
  }

  getAllAgentMemory(agentId: string): Map<string, any> | undefined {
    return this.agentMemories.get(agentId);
  }

  // Cross-agent memory sharing
  shareMemory(sourceAgentId: string, targetAgentId: string, key: string, newKey?: string): boolean {
    const sourceMemory = this.agentMemories.get(sourceAgentId);
    if (!sourceMemory || !sourceMemory.has(key)) {
      return false;
    }

    const value = sourceMemory.get(key);
    const sharedKey = newKey || key;
    
    this.setAgentMemory(targetAgentId, sharedKey, value);
    
    // Also store in shared memory for coordination
    this.setShared(`shared:${sourceAgentId}:${targetAgentId}:${sharedKey}`, value, sourceAgentId);
    
    return true;
  }

  // Coordination patterns
  broadcastToAgents(agentIds: string[], key: string, value: any): void {
    agentIds.forEach(agentId => {
      this.setAgentMemory(agentId, key, value);
    });

    this.setShared(`broadcast:${key}`, {
      value,
      recipients: agentIds,
      timestamp: new Date().toISOString()
    });
  }

  gatherFromAgents(agentIds: string[], key: string): Map<string, any> {
    const gathered = new Map<string, any>();
    
    agentIds.forEach(agentId => {
      const value = this.getAgentMemory(agentId, key);
      if (value !== undefined) {
        gathered.set(agentId, value);
      }
    });

    this.setShared(`gather:${key}`, Object.fromEntries(gathered));
    
    return gathered;
  }

  // Workflow coordination
  setWorkflowState(workflowId: string, state: WorkflowState): void {
    this.setShared(`workflow:${workflowId}:state`, state);
  }

  getWorkflowState(workflowId: string): WorkflowState | undefined {
    return this.getShared(`workflow:${workflowId}:state`);
  }

  setStepResult(workflowId: string, stepId: string, agentId: string, result: any): void {
    const key = `workflow:${workflowId}:step:${stepId}:result`;
    this.setShared(key, {
      agentId,
      result,
      timestamp: new Date().toISOString()
    });
  }

  getStepResult(workflowId: string, stepId: string): any {
    return this.getShared(`workflow:${workflowId}:step:${stepId}:result`);
  }

  getAllStepResults(workflowId: string): Map<string, any> {
    const results = new Map<string, any>();
    
    for (const [key, value] of this.sharedMemory) {
      if (key.startsWith(`workflow:${workflowId}:step:`) && key.endsWith(':result')) {
        const stepId = key.split(':')[3];
        results.set(stepId, value);
      }
    }
    
    return results;
  }

  // Coordination hooks
  registerPreTaskHook(agentId: string, task: string): void {
    const key = `hook:pre-task:${agentId}`;
    this.setShared(key, {
      task,
      timestamp: new Date().toISOString(),
      status: 'registered'
    });
  }

  registerPostTaskHook(agentId: string, task: string, result: any): void {
    const key = `hook:post-task:${agentId}`;
    this.setShared(key, {
      task,
      result,
      timestamp: new Date().toISOString(),
      status: 'completed'
    });
  }

  registerNotificationHook(agentId: string, message: string, recipients?: string[]): void {
    const key = `hook:notification:${Date.now()}`;
    this.setShared(key, {
      agentId,
      message,
      recipients,
      timestamp: new Date().toISOString()
    });

    // Notify specific recipients if provided
    if (recipients) {
      recipients.forEach(recipientId => {
        this.setAgentMemory(recipientId, `notification:${Date.now()}`, {
          from: agentId,
          message,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  // Memory analysis and cleanup
  getMemoryStats(): MemoryStats {
    const sharedSize = this.sharedMemory.size;
    const agentCount = this.agentMemories.size;
    const totalAgentMemory = Array.from(this.agentMemories.values())
      .reduce((total, memory) => total + memory.size, 0);

    return {
      sharedMemorySize: sharedSize,
      agentCount,
      totalAgentMemorySize: totalAgentMemory,
      historySize: this.memoryHistory.length,
      totalMemorySize: sharedSize + totalAgentMemory
    };
  }

  getMemoryUsage(agentId?: string): any {
    if (agentId) {
      const agentMemory = this.agentMemories.get(agentId);
      return {
        agentId,
        memorySize: agentMemory ? agentMemory.size : 0,
        keys: agentMemory ? Array.from(agentMemory.keys()) : [],
        lastActivity: this.getLastActivity(agentId)
      };
    }

    return {
      shared: {
        size: this.sharedMemory.size,
        keys: Array.from(this.sharedMemory.keys())
      },
      agents: Array.from(this.agentMemories.entries()).map(([id, memory]) => ({
        agentId: id,
        memorySize: memory.size,
        lastActivity: this.getLastActivity(id)
      }))
    };
  }

  cleanupOldMemory(maxAge: number = 24 * 60 * 60 * 1000): number {
    // Clean up memory entries older than maxAge (in milliseconds)
    const cutoffTime = Date.now() - maxAge;
    let cleanedCount = 0;

    // Clean history
    const oldHistoryLength = this.memoryHistory.length;
    this.memoryHistory = this.memoryHistory.filter(entry => 
      new Date(entry.timestamp).getTime() > cutoffTime
    );
    cleanedCount += oldHistoryLength - this.memoryHistory.length;

    // Clean shared memory (keep workflow and important data)
    const keysToDelete = [];
    for (const [key, value] of this.sharedMemory) {
      if (!key.startsWith('workflow:') && 
          !key.startsWith('agent-config:') &&
          this.isOldEntry(value, cutoffTime)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.sharedMemory.delete(key);
      cleanedCount++;
    });

    return cleanedCount;
  }

  exportMemorySnapshot(): MemorySnapshot {
    return {
      timestamp: new Date().toISOString(),
      sharedMemory: Object.fromEntries(this.sharedMemory),
      agentMemories: Object.fromEntries(
        Array.from(this.agentMemories.entries()).map(([agentId, memory]) => [
          agentId,
          Object.fromEntries(memory)
        ])
      ),
      stats: this.getMemoryStats(),
      recentHistory: this.memoryHistory.slice(-100) // Last 100 entries
    };
  }

  importMemorySnapshot(snapshot: MemorySnapshot): void {
    // Import shared memory
    this.sharedMemory.clear();
    Object.entries(snapshot.sharedMemory).forEach(([key, value]) => {
      this.sharedMemory.set(key, value);
    });

    // Import agent memories
    this.agentMemories.clear();
    Object.entries(snapshot.agentMemories).forEach(([agentId, memory]) => {
      const agentMemoryMap = new Map(Object.entries(memory));
      this.agentMemories.set(agentId, agentMemoryMap);
    });

    // Import recent history
    if (snapshot.recentHistory) {
      this.memoryHistory = [...snapshot.recentHistory];
    }
  }

  // Private methods
  private addToHistory(entry: MemoryEntry): void {
    this.memoryHistory.push(entry);
    
    // Trim history if it gets too large
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory = this.memoryHistory.slice(-this.maxHistorySize);
    }
  }

  private generateEntryId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getLastActivity(agentId: string): string | null {
    // Find the most recent activity for an agent
    const agentEntries = this.memoryHistory
      .filter(entry => entry.agentId === agentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return agentEntries.length > 0 ? agentEntries[0].timestamp : null;
  }

  private isOldEntry(value: any, cutoffTime: number): boolean {
    // Check if entry is old based on its timestamp
    if (value && typeof value === 'object' && value.timestamp) {
      return new Date(value.timestamp).getTime() < cutoffTime;
    }
    return false; // Keep entries without timestamps
  }
}

// Type definitions
export interface MemoryEntry {
  id: string;
  key: string;
  value: any;
  agentId?: string;
  timestamp: string;
  type: 'shared' | 'agent';
  operation?: 'set' | 'delete' | 'update';
}

export interface WorkflowState {
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStep?: string;
  completedSteps: string[];
  failedSteps: string[];
  startTime: string;
  endTime?: string;
  metadata?: any;
}

export interface MemoryStats {
  sharedMemorySize: number;
  agentCount: number;
  totalAgentMemorySize: number;
  historySize: number;
  totalMemorySize: number;
}

export interface MemorySnapshot {
  timestamp: string;
  sharedMemory: Record<string, any>;
  agentMemories: Record<string, Record<string, any>>;
  stats: MemoryStats;
  recentHistory?: MemoryEntry[];
}