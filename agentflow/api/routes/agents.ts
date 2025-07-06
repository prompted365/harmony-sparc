/**
 * Agent Coordination API Routes
 * Agent management and coordination endpoints
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { 
  ApiRequest, 
  ApiResponse, 
  AgentInfo,
  AgentMetrics,
  AssignAgentRequest,
  PaginationParams,
  ApiErrorCode 
} from '../types';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validation';

// Mock agent store (would be replaced with actual agent management system)
interface Agent {
  id: string;
  type: 'researcher' | 'coder' | 'analyst' | 'tester' | 'coordinator' | 'financial';
  name: string;
  status: 'idle' | 'busy' | 'offline';
  capabilities: string[];
  currentTask?: string;
  metrics: AgentMetrics;
  createdAt: Date;
  lastActive: Date;
  resources: {
    cpu: number;
    memory: number;
    maxConcurrentTasks: number;
  };
}

class AgentManager {
  private agents: Map<string, Agent> = new Map();
  private taskAssignments: Map<string, string> = new Map(); // taskId -> agentId

  constructor() {
    // Initialize with some default agents
    this.initializeDefaultAgents();
  }

  private initializeDefaultAgents(): void {
    const defaultAgents: Omit<Agent, 'id' | 'createdAt' | 'lastActive'>[] = [
      {
        type: 'researcher',
        name: 'Research Agent Alpha',
        status: 'idle',
        capabilities: ['web_search', 'data_analysis', 'report_generation'],
        metrics: {
          tasksCompleted: 147,
          successRate: 0.95,
          avgExecutionTime: 2340,
          lastActive: new Date()
        },
        resources: { cpu: 2, memory: 4096, maxConcurrentTasks: 3 }
      },
      {
        type: 'coder',
        name: 'Code Agent Beta',
        status: 'idle',
        capabilities: ['code_generation', 'debugging', 'refactoring', 'testing'],
        metrics: {
          tasksCompleted: 89,
          successRate: 0.92,
          avgExecutionTime: 3120,
          lastActive: new Date()
        },
        resources: { cpu: 4, memory: 8192, maxConcurrentTasks: 2 }
      },
      {
        type: 'analyst',
        name: 'Data Analyst Gamma',
        status: 'idle',
        capabilities: ['data_processing', 'statistical_analysis', 'visualization'],
        metrics: {
          tasksCompleted: 203,
          successRate: 0.97,
          avgExecutionTime: 1850,
          lastActive: new Date()
        },
        resources: { cpu: 3, memory: 6144, maxConcurrentTasks: 4 }
      },
      {
        type: 'financial',
        name: 'Finance Agent Delta',
        status: 'idle',
        capabilities: ['portfolio_analysis', 'risk_assessment', 'trading', 'defi_operations'],
        metrics: {
          tasksCompleted: 76,
          successRate: 0.99,
          avgExecutionTime: 890,
          lastActive: new Date()
        },
        resources: { cpu: 2, memory: 4096, maxConcurrentTasks: 5 }
      }
    ];

    defaultAgents.forEach(agent => {
      const id = this.generateAgentId();
      this.agents.set(id, {
        ...agent,
        id,
        createdAt: new Date(),
        lastActive: new Date()
      });
    });
  }

  private generateAgentId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentsByType(type: string): Agent[] {
    return this.getAllAgents().filter(agent => agent.type === type);
  }

  getAgentsByStatus(status: string): Agent[] {
    return this.getAllAgents().filter(agent => agent.status === status);
  }

  assignTask(agentId: string, taskId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status !== 'idle') {
      return false;
    }

    agent.status = 'busy';
    agent.currentTask = taskId;
    agent.lastActive = new Date();
    this.taskAssignments.set(taskId, agentId);
    return true;
  }

  completeTask(agentId: string, taskId: string, success: boolean): boolean {
    const agent = this.agents.get(agentId);
    if (!agent || agent.currentTask !== taskId) {
      return false;
    }

    agent.status = 'idle';
    agent.currentTask = undefined;
    agent.lastActive = new Date();
    agent.metrics.tasksCompleted++;
    
    if (success) {
      agent.metrics.successRate = 
        (agent.metrics.successRate * (agent.metrics.tasksCompleted - 1) + 1) / agent.metrics.tasksCompleted;
    }

    this.taskAssignments.delete(taskId);
    return true;
  }

  createAgent(agentData: Omit<Agent, 'id' | 'createdAt' | 'lastActive' | 'metrics'>): Agent {
    const id = this.generateAgentId();
    const agent: Agent = {
      ...agentData,
      id,
      createdAt: new Date(),
      lastActive: new Date(),
      metrics: {
        tasksCompleted: 0,
        successRate: 0,
        avgExecutionTime: 0,
        lastActive: new Date()
      }
    };

    this.agents.set(id, agent);
    return agent;
  }

  updateAgent(id: string, updates: Partial<Agent>): Agent | undefined {
    const agent = this.agents.get(id);
    if (!agent) return undefined;

    const updated = { ...agent, ...updates, id, lastActive: new Date() };
    this.agents.set(id, updated);
    return updated;
  }

  deleteAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent || agent.status === 'busy') {
      return false;
    }

    return this.agents.delete(id);
  }

  getAgentMetrics(id: string): AgentMetrics | undefined {
    const agent = this.agents.get(id);
    return agent?.metrics;
  }

  getSystemMetrics(): {
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    busyAgents: number;
    offlineAgents: number;
    averageSuccessRate: number;
    totalTasksCompleted: number;
  } {
    const agents = this.getAllAgents();
    const totalAgents = agents.length;
    const activeAgents = agents.filter(a => a.status !== 'offline').length;
    const idleAgents = agents.filter(a => a.status === 'idle').length;
    const busyAgents = agents.filter(a => a.status === 'busy').length;
    const offlineAgents = agents.filter(a => a.status === 'offline').length;
    
    const totalTasksCompleted = agents.reduce((sum, agent) => sum + agent.metrics.tasksCompleted, 0);
    const averageSuccessRate = agents.reduce((sum, agent) => sum + agent.metrics.successRate, 0) / totalAgents;

    return {
      totalAgents,
      activeAgents,
      idleAgents,
      busyAgents,
      offlineAgents,
      averageSuccessRate,
      totalTasksCompleted
    };
  }
}

// Validation schemas
const createAgentSchema = z.object({
  type: z.enum(['researcher', 'coder', 'analyst', 'tester', 'coordinator', 'financial']),
  name: z.string().min(1).max(100),
  capabilities: z.array(z.string()).min(1),
  resources: z.object({
    cpu: z.number().positive(),
    memory: z.number().positive(),
    maxConcurrentTasks: z.number().positive()
  })
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  capabilities: z.array(z.string()).optional(),
  resources: z.object({
    cpu: z.number().positive().optional(),
    memory: z.number().positive().optional(),
    maxConcurrentTasks: z.number().positive().optional()
  }).optional()
});

const assignTaskSchema = z.object({
  agentId: z.string(),
  taskId: z.string(),
  priority: z.number().min(1).max(10).optional()
});

const paginationSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20),
  type: z.string().optional(),
  status: z.enum(['idle', 'busy', 'offline']).optional()
});

// Initialize agent manager
const agentManager = new AgentManager();

// Create router
const router = Router();

/**
 * GET /agents
 * List all agents with filtering and pagination
 */
router.get('/', 
  validateRequest({ query: paginationSchema }),
  asyncHandler(async (req: ApiRequest, res: Response) => {
    const { page, limit, type, status } = req.query as any;
    const offset = (page - 1) * limit;

    let agents = agentManager.getAllAgents();

    // Apply filters
    if (type) {
      agents = agents.filter(agent => agent.type === type);
    }
    if (status) {
      agents = agents.filter(agent => agent.status === status);
    }

    // Apply pagination
    const paginatedAgents = agents.slice(offset, offset + limit);

    // Convert to API format
    const agentInfos: AgentInfo[] = paginatedAgents.map(agent => ({
      id: agent.id,
      type: agent.type,
      status: agent.status,
      capabilities: agent.capabilities,
      currentTask: agent.currentTask,
      metrics: agent.metrics
    }));

    const response: ApiResponse = {
      success: true,
      data: agentInfos,
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req.requestId!,
        pagination: {
          page,
          limit,
          total: agents.length,
          totalPages: Math.ceil(agents.length / limit)
        }
      }
    };

    res.json(response);
  })
);

/**
 * GET /agents/:id
 * Get agent by ID
 */
router.get('/:id', asyncHandler(async (req: ApiRequest, res: Response) => {
  const { id } = req.params;

  const agent = agentManager.getAgent(id);
  if (!agent) {
    return res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Agent ${id} not found`
      }
    } as ApiResponse);
  }

  const agentInfo: AgentInfo = {
    id: agent.id,
    type: agent.type,
    status: agent.status,
    capabilities: agent.capabilities,
    currentTask: agent.currentTask,
    metrics: agent.metrics
  };

  const response: ApiResponse<AgentInfo> = {
    success: true,
    data: agentInfo,
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * POST /agents
 * Create a new agent
 */
router.post('/',
  validateRequest({ body: createAgentSchema }),
  asyncHandler(async (req: ApiRequest, res: Response) => {
    const agentData = req.body;

    const agent = agentManager.createAgent({
      ...agentData,
      status: 'idle' as const
    });

    const agentInfo: AgentInfo = {
      id: agent.id,
      type: agent.type,
      status: agent.status,
      capabilities: agent.capabilities,
      currentTask: agent.currentTask,
      metrics: agent.metrics
    };

    const response: ApiResponse<AgentInfo> = {
      success: true,
      data: agentInfo,
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req.requestId!
      }
    };

    res.status(201).json(response);
  })
);

/**
 * PUT /agents/:id
 * Update agent
 */
router.put('/:id',
  validateRequest({ body: updateAgentSchema }),
  asyncHandler(async (req: ApiRequest, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    const agent = agentManager.updateAgent(id, updates);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: ApiErrorCode.NOT_FOUND,
          message: `Agent ${id} not found`
        }
      } as ApiResponse);
    }

    const agentInfo: AgentInfo = {
      id: agent.id,
      type: agent.type,
      status: agent.status,
      capabilities: agent.capabilities,
      currentTask: agent.currentTask,
      metrics: agent.metrics
    };

    const response: ApiResponse<AgentInfo> = {
      success: true,
      data: agentInfo,
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req.requestId!
      }
    };

    res.json(response);
  })
);

/**
 * DELETE /agents/:id
 * Delete agent
 */
router.delete('/:id', asyncHandler(async (req: ApiRequest, res: Response) => {
  const { id } = req.params;

  const deleted = agentManager.deleteAgent(id);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Agent ${id} not found or currently busy`
      }
    } as ApiResponse);
  }

  const response: ApiResponse = {
    success: true,
    data: { deleted: true },
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * POST /agents/assign
 * Assign task to agent
 */
router.post('/assign',
  validateRequest({ body: assignTaskSchema }),
  asyncHandler(async (req: ApiRequest, res: Response) => {
    const { agentId, taskId } = req.body as AssignAgentRequest;

    const assigned = agentManager.assignTask(agentId, taskId);
    if (!assigned) {
      return res.status(400).json({
        success: false,
        error: {
          code: ApiErrorCode.INVALID_REQUEST,
          message: `Cannot assign task to agent ${agentId}. Agent not found or not available.`
        }
      } as ApiResponse);
    }

    const response: ApiResponse = {
      success: true,
      data: { assigned: true, agentId, taskId },
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req.requestId!
      }
    };

    res.json(response);
  })
);

/**
 * POST /agents/:id/complete
 * Mark task as completed
 */
router.post('/:id/complete',
  validateRequest({ body: z.object({ taskId: z.string(), success: z.boolean() }) }),
  asyncHandler(async (req: ApiRequest, res: Response) => {
    const { id } = req.params;
    const { taskId, success } = req.body;

    const completed = agentManager.completeTask(id, taskId, success);
    if (!completed) {
      return res.status(400).json({
        success: false,
        error: {
          code: ApiErrorCode.INVALID_REQUEST,
          message: `Cannot complete task ${taskId} for agent ${id}`
        }
      } as ApiResponse);
    }

    const response: ApiResponse = {
      success: true,
      data: { completed: true, taskId, success },
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req.requestId!
      }
    };

    res.json(response);
  })
);

/**
 * GET /agents/:id/metrics
 * Get agent metrics
 */
router.get('/:id/metrics', asyncHandler(async (req: ApiRequest, res: Response) => {
  const { id } = req.params;

  const metrics = agentManager.getAgentMetrics(id);
  if (!metrics) {
    return res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Agent ${id} not found`
      }
    } as ApiResponse);
  }

  const response: ApiResponse<AgentMetrics> = {
    success: true,
    data: metrics,
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * GET /agents/system/metrics
 * Get system-wide agent metrics
 */
router.get('/system/metrics', asyncHandler(async (req: ApiRequest, res: Response) => {
  const metrics = agentManager.getSystemMetrics();

  const response: ApiResponse = {
    success: true,
    data: metrics,
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * GET /agents/available
 * Get available agents for task assignment
 */
router.get('/available', asyncHandler(async (req: ApiRequest, res: Response) => {
  const { capability } = req.query;

  let agents = agentManager.getAgentsByStatus('idle');

  // Filter by capability if specified
  if (capability) {
    agents = agents.filter(agent => 
      agent.capabilities.includes(capability as string)
    );
  }

  const agentInfos: AgentInfo[] = agents.map(agent => ({
    id: agent.id,
    type: agent.type,
    status: agent.status,
    capabilities: agent.capabilities,
    currentTask: agent.currentTask,
    metrics: agent.metrics
  }));

  const response: ApiResponse = {
    success: true,
    data: agentInfos,
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

export { router as agentRouter };