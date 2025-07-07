/**
 * Type definitions for EESystem AI Agent System
 */

export interface Agent {
  initialize(): Promise<void>;
  execute(task: string, context?: any): Promise<AgentResponse>;
  getMemory(): Map<string, any>;
  getConfig(): AgentConfig;
}

export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  capabilities: string[];
  priority: number;
  maxConcurrency: number;
  memorySize: number;
  timeout: number;
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  agentId: string;
  timestamp: string;
}

export enum AgentType {
  RESEARCH = 'research',
  CURATION = 'curation',
  ANALYSIS = 'analysis',
  SCRIPT_WRITER = 'script_writer',
  CAPTION_WRITER = 'caption_writer',
  MEDIA_PROMPT = 'media_prompt',
  SCHEDULING = 'scheduling',
  COMPLIANCE = 'compliance'
}

export interface AgentMemory {
  agentId: string;
  data: Map<string, any>;
  lastUpdated: string;
  version: number;
}

export interface AgentCoordination {
  agentId: string;
  dependencies: string[];
  status: AgentStatus;
  currentTask?: string;
  lastHeartbeat: string;
}

export enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  OFFLINE = 'offline'
}

export interface AgentMetrics {
  agentId: string;
  tasksCompleted: number;
  averageExecutionTime: number;
  successRate: number;
  errorCount: number;
  lastActivity: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  agentType: AgentType;
  dependencies: string[];
  timeout: number;
  retryCount: number;
  required: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  priority: number;
  createdAt: string;
  completedAt?: string;
}

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}