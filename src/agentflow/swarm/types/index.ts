/**
 * AgentFlow Swarm Type Definitions
 * Core types for swarm coordination in AgentFlow
 */

export interface SwarmOptions {
  topology?: SwarmTopology;
  maxAgents?: number;
  connectionDensity?: number;
  syncInterval?: number;
}

export type SwarmTopology = 'mesh' | 'hierarchical' | 'distributed' | 'centralized' | 'hybrid';

export interface AgentConfig {
  id: string;
  type: AgentType;
  capabilities?: string[];
  memory?: AgentMemory;
  workflowSpecific?: WorkflowAgentConfig;
}

export type AgentType = 
  | 'workflow'
  | 'financial'
  | 'ml'
  | 'coordinator'
  | 'validator'
  | 'executor'
  | 'monitor'
  | 'custom';

export interface WorkflowAgentConfig {
  supportedWorkflowTypes?: string[];
  maxConcurrentWorkflows?: number;
  specializations?: string[];
}

export interface AgentMemory {
  shortTerm: Map<string, any>;
  longTerm: Map<string, any>;
  workflowHistory?: WorkflowMemory[];
}

export interface WorkflowMemory {
  workflowId: string;
  timestamp: number;
  result: any;
  performance: WorkflowPerformance;
}

export interface WorkflowPerformance {
  executionTime: number;
  resourcesUsed: ResourceMetrics;
  success: boolean;
}

export interface ResourceMetrics {
  cpu: number;
  memory: number;
  network: number;
  storage: number;
}

export interface Task {
  id: string;
  description: string;
  priority: TaskPriority;
  dependencies?: string[];
  assignedAgents?: string[];
  status: TaskStatus;
  result?: any;
  error?: Error;
  metadata?: TaskMetadata;
}

export interface TaskMetadata {
  workflowId?: string;
  workflowStep?: number;
  expectedResults?: any;
  timeout?: number;
  retryCount?: number;
  [key: string]: any;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';

export interface SwarmState {
  agents: Map<string, Agent>;
  tasks: Map<string, Task>;
  topology: SwarmTopology;
  connections: Connection[];
  metrics: SwarmMetrics;
  workflows?: Map<string, WorkflowState>;
}

export interface WorkflowState {
  id: string;
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  assignedAgents: string[];
  startTime: number;
  endTime?: number;
}

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'completed' | 'failed';

export interface Connection {
  from: string;
  to: string;
  weight: number;
  type: ConnectionType;
}

export type ConnectionType = 'data' | 'control' | 'feedback' | 'coordination' | 'workflow';

export interface SwarmMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageCompletionTime: number;
  agentUtilization: Map<string, number>;
  throughput: number;
  workflowMetrics?: WorkflowMetrics;
}

export interface WorkflowMetrics {
  totalWorkflows: number;
  activeWorkflows: number;
  completedWorkflows: number;
  averageWorkflowTime: number;
  successRate: number;
}

export interface Agent {
  id: string;
  config: AgentConfig;
  state: AgentState;
  connections: string[];
  execute(task: Task): Promise<any>;
  communicate(message: Message): Promise<void>;
  update(state: Partial<AgentState>): void;
}

export interface AgentState {
  status: AgentStatus;
  currentTask?: string;
  load: number;
  performance: AgentPerformance;
}

export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline';

export interface AgentPerformance {
  tasksCompleted: number;
  tasksFailed: number;
  averageExecutionTime: number;
  successRate: number;
}

export interface Message {
  id: string;
  from: string;
  to: string | string[];
  type: MessageType;
  payload: any;
  timestamp: number;
}

export type MessageType = 
  | 'task_assignment'
  | 'task_result'
  | 'status_update'
  | 'coordination'
  | 'workflow_update'
  | 'resource_request'
  | 'error';

export interface SwarmEventEmitter {
  on(event: SwarmEvent, handler: (data: any) => void): void;
  off(event: SwarmEvent, handler: (data: any) => void): void;
  emit(event: SwarmEvent, data: any): void;
}

export type SwarmEvent =
  | 'agent:added'
  | 'agent:removed'
  | 'agent:status_changed'
  | 'task:created'
  | 'task:assigned'
  | 'task:completed'
  | 'task:failed'
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'swarm:topology_changed'
  | 'swarm:error';

// AgentFlow specific coordination interfaces
export interface CoordinationProtocol {
  id: string;
  type: 'consensus' | 'leader_election' | 'distributed' | 'centralized';
  participants: string[];
  state: any;
}

export interface SwarmCoordinator {
  protocol: CoordinationProtocol;
  coordinate(agents: Agent[], task: Task): Promise<TaskAssignment[]>;
  resolveConflicts(conflicts: Conflict[]): Promise<Resolution[]>;
  optimizeTopology(metrics: SwarmMetrics): Promise<SwarmTopology>;
}

export interface TaskAssignment {
  agentId: string;
  taskId: string;
  subtasks?: Task[];
  deadline?: number;
}

export interface Conflict {
  type: 'resource' | 'scheduling' | 'dependency';
  agents: string[];
  resource?: string;
  description: string;
}

export interface Resolution {
  conflictId: string;
  solution: string;
  affectedAgents: string[];
}