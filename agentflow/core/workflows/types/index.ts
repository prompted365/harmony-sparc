/**
 * AgentFlow Workflow Types
 * Core type definitions for the workflow engine
 */

// Workflow Status
export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Task Status
export enum TaskStatus {
  PENDING = 'pending',
  READY = 'ready',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled'
}

// Node Types
export enum NodeType {
  START = 'start',
  END = 'end',
  TASK = 'task',
  CONDITIONAL = 'conditional',
  PARALLEL = 'parallel',
  LOOP = 'loop',
  SUBWORKFLOW = 'subworkflow',
  AGENT = 'agent',
  HUMAN = 'human'
}

// Agent Types
export type AgentType = 'researcher' | 'coder' | 'analyst' | 'tester' | 'coordinator' | 'financial' | 'custom';

// Workflow Node Definition
export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  config: Record<string, any>;
  inputs?: string[];
  outputs?: string[];
  dependencies?: string[];
  retryPolicy?: RetryPolicy;
  timeout?: number;
  agent?: AgentConfig;
}

// Agent Configuration
export interface AgentConfig {
  type: AgentType;
  capabilities: string[];
  constraints?: Record<string, any>;
  resources?: ResourceRequirements;
}

// Resource Requirements
export interface ResourceRequirements {
  cpu?: number;
  memory?: number;
  storage?: number;
  gpu?: boolean;
  network?: 'low' | 'medium' | 'high';
}

// Retry Policy
export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay?: number;
}

// Workflow Edge
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: Condition;
  priority?: number;
}

// Condition
export interface Condition {
  type: 'expression' | 'script' | 'function';
  value: string;
  language?: string;
}

// Workflow Definition
export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: Record<string, any>;
  triggers?: Trigger[];
  metadata?: WorkflowMetadata;
}

// Workflow Metadata
export interface WorkflowMetadata {
  author?: string;
  created?: Date;
  updated?: Date;
  tags?: string[];
  category?: string;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'secret';
}

// Trigger
export interface Trigger {
  type: 'manual' | 'schedule' | 'event' | 'webhook' | 'condition';
  config: Record<string, any>;
}

// Workflow Instance
export interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  startTime: Date;
  endTime?: Date;
  context: WorkflowContext;
  tasks: TaskInstance[];
  error?: WorkflowError;
}

// Task Instance
export interface TaskInstance {
  id: string;
  nodeId: string;
  status: TaskStatus;
  startTime?: Date;
  endTime?: Date;
  input?: any;
  output?: any;
  error?: TaskError;
  retries?: number;
  assignedAgent?: string;
}

// Workflow Context
export interface WorkflowContext {
  variables: Record<string, any>;
  secrets?: Record<string, string>;
  user?: UserContext;
  environment?: EnvironmentContext;
}

// User Context
export interface UserContext {
  id: string;
  roles?: string[];
  permissions?: string[];
}

// Environment Context
export interface EnvironmentContext {
  name: string;
  region?: string;
  tags?: Record<string, string>;
}

// Errors
export interface WorkflowError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

export interface TaskError extends WorkflowError {
  taskId: string;
  nodeId: string;
}

// Events
export interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  timestamp: Date;
  workflowId: string;
  instanceId?: string;
  taskId?: string;
  data?: any;
}

export enum WorkflowEventType {
  WORKFLOW_CREATED = 'workflow.created',
  WORKFLOW_UPDATED = 'workflow.updated',
  WORKFLOW_DELETED = 'workflow.deleted',
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  WORKFLOW_PAUSED = 'workflow.paused',
  WORKFLOW_RESUMED = 'workflow.resumed',
  WORKFLOW_CANCELLED = 'workflow.cancelled',
  TASK_STARTED = 'task.started',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  TASK_RETRYING = 'task.retrying',
  AGENT_ASSIGNED = 'agent.assigned',
  AGENT_COMPLETED = 'agent.completed'
}

// Validation
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

// Execution Options
export interface ExecutionOptions {
  parallel?: boolean;
  maxParallelTasks?: number;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  checkpoints?: boolean;
  monitoring?: MonitoringOptions;
}

export interface MonitoringOptions {
  metrics?: boolean;
  traces?: boolean;
  logs?: boolean;
  events?: boolean;
}

// Persistence
export interface PersistenceOptions {
  type: 'memory' | 'file' | 'database';
  config: Record<string, any>;
}

// Registry
export interface RegistryEntry {
  id: string;
  workflow: WorkflowDefinition;
  metadata: RegistryMetadata;
}

export interface RegistryMetadata {
  registered: Date;
  updated: Date;
  usage: number;
  rating?: number;
  reviews?: number;
}