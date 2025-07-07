/**
 * Workflow Management API Routes
 * CRUD operations for workflows with <100ms response times
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { WorkflowRegistry } from '../../core/workflows/registry/workflow-registry';
import { WorkflowValidator } from '../../core/workflows/validator/workflow-validator';
import { ExecutionEngine } from '../../core/workflows/execution/execution-engine';
import { 
  ApiRequest, 
  ApiResponse, 
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  ExecuteWorkflowRequest,
  PaginationParams,
  ApiErrorCode 
} from '../types';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validation';
import { 
  WorkflowDefinition, 
  WorkflowInstance, 
  WorkflowStatus,
  ValidationResult,
  WorkflowContext 
} from '../../core/workflows/types';

// Validation schemas
const createWorkflowSchema = z.object({
  workflow: z.object({
    name: z.string().min(1).max(100),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    description: z.string().optional(),
    nodes: z.array(z.any()).min(1),
    edges: z.array(z.any()),
    variables: z.record(z.any()).optional(),
    triggers: z.array(z.any()).optional(),
    metadata: z.any().optional()
  }),
  autoStart: z.boolean().optional()
});

const executeWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
  input: z.record(z.any()).optional(),
  options: z.object({
    async: z.boolean().optional(),
    timeout: z.number().positive().optional(),
    priority: z.enum(['low', 'normal', 'high']).optional(),
    tags: z.array(z.string()).optional()
  }).optional()
});

const paginationSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc')
});

// Initialize services
import { EventBus } from '../../core/workflows/events/event-bus';
const eventBus = new EventBus();
const registry = new WorkflowRegistry(eventBus);
const validator = new WorkflowValidator();
const engine = new ExecutionEngine(eventBus, registry);

// Create router
const router = Router();

/**
 * GET /workflows
 * List all workflows with pagination
 */
router.get('/', 
  validateRequest({ query: paginationSchema }),
  asyncHandler(async (req: ApiRequest, res: Response) => {
    const { page, limit, sort, order } = req.query as any;
    const offset = (page - 1) * limit;

    // Search workflows from registry
    const searchResults = registry.search({
      sortBy: sort as any,
      sortOrder: order,
      offset,
      limit
    });
    
    // Extract workflows from registry entries
    const workflows = searchResults.map(entry => entry.workflow);
    
    // The workflows are already sorted and paginated by the search method

    const response: ApiResponse = {
      success: true,
      data: workflows,
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req.requestId!,
        pagination: {
          page,
          limit,
          total: workflows.length,
          totalPages: Math.ceil(workflows.length / limit)
        }
      }
    };

    res.json(response);
  })
);

/**
 * GET /workflows/:id
 * Get workflow by ID
 */
router.get('/:id', asyncHandler(async (req: ApiRequest, res: Response) => {
  const { id } = req.params;

  const workflow = registry.get(id);
  if (!workflow) {
    return res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Workflow ${id} not found`
      }
    } as ApiResponse);
  }

  const response: ApiResponse<WorkflowDefinition> = {
    success: true,
    data: workflow,
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * POST /workflows
 * Create a new workflow
 */
router.post('/',
  validateRequest({ body: createWorkflowSchema }),
  asyncHandler(async (req: ApiRequest, res: Response) => {
    const { workflow, autoStart } = req.body as CreateWorkflowRequest;

    // Validate workflow definition
    const validation = await validator.validate(workflow as WorkflowDefinition);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: ApiErrorCode.INVALID_REQUEST,
          message: 'Invalid workflow definition',
          details: validation.errors
        }
      } as ApiResponse);
    }

    // Generate ID and register workflow
    const workflowWithId: WorkflowDefinition = {
      ...workflow,
      id: generateWorkflowId()
    } as WorkflowDefinition;

    await registry.register(workflowWithId);

    // Auto-start if requested
    let instance: WorkflowInstance | undefined;
    if (autoStart) {
      const context: WorkflowContext = { variables: {} };
      instance = await engine.execute(workflowWithId.id, context);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        workflow: workflowWithId,
        instance
      },
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
 * PUT /workflows/:id
 * Update workflow
 */
router.put('/:id',
  validateRequest({ body: z.object({ workflow: z.any() }) }),
  asyncHandler(async (req: ApiRequest, res: Response) => {
    const { id } = req.params;
    const { workflow } = req.body as UpdateWorkflowRequest;

    // Check if workflow exists
    const existing = registry.getWorkflow(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: ApiErrorCode.NOT_FOUND,
          message: `Workflow ${id} not found`
        }
      } as ApiResponse);
    }

    // Merge updates
    const updated: WorkflowDefinition = {
      ...existing,
      ...workflow,
      id, // Ensure ID doesn't change
      metadata: {
        ...existing.metadata,
        ...workflow.metadata,
        updated: new Date()
      }
    };

    // Validate updated workflow
    const validation = await validator.validate(updated);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: ApiErrorCode.INVALID_REQUEST,
          message: 'Invalid workflow definition',
          details: validation.errors
        }
      } as ApiResponse);
    }

    // Update in registry
    registry.updateWorkflow(id, updated);

    const response: ApiResponse<WorkflowDefinition> = {
      success: true,
      data: updated,
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
 * DELETE /workflows/:id
 * Delete workflow
 */
router.delete('/:id', asyncHandler(async (req: ApiRequest, res: Response) => {
  const { id } = req.params;

  const workflow = registry.get(id);
  if (!workflow) {
    return res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Workflow ${id} not found`
      }
    } as ApiResponse);
  }

  // Check if workflow has running instances
  const runningInstances = engine.getInstancesByStatus(WorkflowStatus.RUNNING)
    .filter(instance => instance.workflowId === id);

  if (runningInstances.length > 0) {
    return res.status(409).json({
      success: false,
      error: {
        code: ApiErrorCode.CONFLICT,
        message: 'Cannot delete workflow with running instances',
        details: { runningInstances: runningInstances.length }
      }
    } as ApiResponse);
  }

  // Delete workflow
  registry.unregisterWorkflow(id);

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
 * POST /workflows/:id/execute
 * Execute a workflow
 */
router.post('/:id/execute',
  validateRequest({ body: executeWorkflowSchema.omit({ workflowId: true }) }),
  asyncHandler(async (req: ApiRequest, res: Response) => {
    const { id } = req.params;
    const { input, options } = req.body as Omit<ExecuteWorkflowRequest, 'workflowId'>;

    // Check if workflow exists
    const workflow = registry.get(id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: {
          code: ApiErrorCode.NOT_FOUND,
          message: `Workflow ${id} not found`
        }
      } as ApiResponse);
    }

    // Execute workflow
    const instance = await engine.execute(id, { variables: input || {} }, {
      timeout: options?.timeout,
      parallel: options?.priority === 'high'
    });

    // Handle async execution
    if (options?.async) {
      const response: ApiResponse = {
        success: true,
        data: {
          instanceId: instance.id,
          status: instance.status,
          message: 'Workflow execution started'
        },
        meta: {
          timestamp: Date.now(),
          version: '1.0.0',
          requestId: req.requestId!
        }
      };
      return res.status(202).json(response);
    }

    // Wait for completion (with timeout)
    const timeout = options?.timeout || 30000; // 30 seconds default
    const startTime = Date.now();

    while (instance.status === WorkflowStatus.RUNNING) {
      if (Date.now() - startTime > timeout) {
        return res.status(408).json({
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'Workflow execution timeout'
          }
        } as ApiResponse);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const response: ApiResponse<WorkflowInstance> = {
      success: true,
      data: instance,
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
 * GET /workflows/:id/instances
 * Get workflow instances
 */
router.get('/:id/instances', 
  validateRequest({ query: paginationSchema }),
  asyncHandler(async (req: ApiRequest, res: Response) => {
    const { id } = req.params;
    const { page, limit } = req.query as any;
    const offset = (page - 1) * limit;

    // Check if workflow exists
    const workflow = registry.get(id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: {
          code: ApiErrorCode.NOT_FOUND,
          message: `Workflow ${id} not found`
        }
      } as ApiResponse);
    }

    // Get instances
    const allInstances = engine.getInstances()
      .filter(instance => instance.workflowId === id)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    const instances = allInstances.slice(offset, offset + limit);

    const response: ApiResponse = {
      success: true,
      data: instances,
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req.requestId!,
        pagination: {
          page,
          limit,
          total: allInstances.length,
          totalPages: Math.ceil(allInstances.length / limit)
        }
      }
    };

    res.json(response);
  })
);

/**
 * GET /workflows/:id/validate
 * Validate workflow definition
 */
router.post('/:id/validate', asyncHandler(async (req: ApiRequest, res: Response) => {
  const { id } = req.params;

  const workflow = registry.get(id);
  if (!workflow) {
    return res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Workflow ${id} not found`
      }
    } as ApiResponse);
  }

  const validation = await validator.validate(workflow);

  const response: ApiResponse<ValidationResult> = {
    success: true,
    data: validation,
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * POST /workflows/:id/pause
 * Pause workflow instance
 */
router.post('/:id/pause', asyncHandler(async (req: ApiRequest, res: Response) => {
  const { id } = req.params;

  const instance = engine.getInstance(id);
  if (!instance) {
    return res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Workflow instance ${id} not found`
      }
    } as ApiResponse);
  }

  await engine.pause(id);

  const response: ApiResponse = {
    success: true,
    data: { paused: true },
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * POST /workflows/:id/resume
 * Resume workflow instance
 */
router.post('/:id/resume', asyncHandler(async (req: ApiRequest, res: Response) => {
  const { id } = req.params;

  const instance = engine.getInstance(id);
  if (!instance) {
    return res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Workflow instance ${id} not found`
      }
    } as ApiResponse);
  }

  await engine.resume(id);

  const response: ApiResponse = {
    success: true,
    data: { resumed: true },
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * POST /workflows/:id/cancel
 * Cancel workflow instance
 */
router.post('/:id/cancel', asyncHandler(async (req: ApiRequest, res: Response) => {
  const { id } = req.params;

  const instance = engine.getInstance(id);
  if (!instance) {
    return res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: `Workflow instance ${id} not found`
      }
    } as ApiResponse);
  }

  await engine.cancel(id);

  const response: ApiResponse = {
    success: true,
    data: { cancelled: true },
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

// Utility functions
function generateWorkflowId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export { router as workflowRouter };