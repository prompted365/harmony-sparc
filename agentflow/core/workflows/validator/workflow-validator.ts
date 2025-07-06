/**
 * AgentFlow Workflow Validator
 * Validates workflow definitions and instances
 */

import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  Condition,
  AgentConfig
} from '../types';

export interface ValidatorOptions {
  strict?: boolean;
  validateSemantics?: boolean;
  validateResources?: boolean;
  customRules?: ValidationRule[];
}

export interface ValidationRule {
  name: string;
  validate: (workflow: WorkflowDefinition) => ValidationResult;
}

export class WorkflowValidator {
  private options: ValidatorOptions;
  private customRules: ValidationRule[];

  constructor(options: ValidatorOptions = {}) {
    this.options = {
      strict: options.strict ?? true,
      validateSemantics: options.validateSemantics ?? true,
      validateResources: options.validateResources ?? true,
      customRules: options.customRules || []
    };
    this.customRules = options.customRules || [];
  }

  /**
   * Validate a workflow definition
   */
  validate(workflow: WorkflowDefinition): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic structure validation
    this.validateBasicStructure(workflow, errors, warnings);

    // Node validation
    this.validateNodes(workflow, errors, warnings);

    // Edge validation
    this.validateEdges(workflow, errors, warnings);

    // Graph validation
    this.validateGraph(workflow, errors, warnings);

    // Semantic validation
    if (this.options.validateSemantics) {
      this.validateSemantics(workflow, errors, warnings);
    }

    // Resource validation
    if (this.options.validateResources) {
      this.validateResources(workflow, errors, warnings);
    }

    // Custom rules
    for (const rule of this.customRules) {
      const result = rule.validate(workflow);
      if (result.errors) errors.push(...result.errors);
      if (result.warnings) warnings.push(...result.warnings);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate basic structure
   */
  private validateBasicStructure(
    workflow: WorkflowDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Required fields
    if (!workflow.id) {
      errors.push({
        path: 'id',
        message: 'Workflow ID is required',
        code: 'MISSING_ID'
      });
    }

    if (!workflow.name) {
      errors.push({
        path: 'name',
        message: 'Workflow name is required',
        code: 'MISSING_NAME'
      });
    }

    if (!workflow.version) {
      errors.push({
        path: 'version',
        message: 'Workflow version is required',
        code: 'MISSING_VERSION'
      });
    }

    // Validate version format
    if (workflow.version && !this.isValidVersion(workflow.version)) {
      errors.push({
        path: 'version',
        message: 'Invalid version format (expected semver)',
        code: 'INVALID_VERSION'
      });
    }

    // Arrays must exist
    if (!Array.isArray(workflow.nodes)) {
      errors.push({
        path: 'nodes',
        message: 'Nodes must be an array',
        code: 'INVALID_NODES'
      });
    }

    if (!Array.isArray(workflow.edges)) {
      errors.push({
        path: 'edges',
        message: 'Edges must be an array',
        code: 'INVALID_EDGES'
      });
    }

    // Check for empty workflow
    if (workflow.nodes?.length === 0) {
      errors.push({
        path: 'nodes',
        message: 'Workflow must have at least one node',
        code: 'EMPTY_WORKFLOW'
      });
    }
  }

  /**
   * Validate nodes
   */
  private validateNodes(
    workflow: WorkflowDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const nodeIds = new Set<string>();
    let startNodes = 0;
    let endNodes = 0;

    for (let i = 0; i < workflow.nodes.length; i++) {
      const node = workflow.nodes[i];
      const path = `nodes[${i}]`;

      // Required fields
      if (!node.id) {
        errors.push({
          path: `${path}.id`,
          message: 'Node ID is required',
          code: 'MISSING_NODE_ID'
        });
        continue;
      }

      // Duplicate IDs
      if (nodeIds.has(node.id)) {
        errors.push({
          path: `${path}.id`,
          message: `Duplicate node ID: ${node.id}`,
          code: 'DUPLICATE_NODE_ID'
        });
      }
      nodeIds.add(node.id);

      // Validate node type
      if (!Object.values(NodeType).includes(node.type)) {
        errors.push({
          path: `${path}.type`,
          message: `Invalid node type: ${node.type}`,
          code: 'INVALID_NODE_TYPE'
        });
      }

      // Count start/end nodes
      if (node.type === NodeType.START) startNodes++;
      if (node.type === NodeType.END) endNodes++;

      // Validate specific node types
      this.validateNodeByType(node, path, errors, warnings);

      // Validate dependencies
      if (node.dependencies) {
        for (const dep of node.dependencies) {
          if (!nodeIds.has(dep) && !workflow.nodes.some(n => n.id === dep)) {
            errors.push({
              path: `${path}.dependencies`,
              message: `Unknown dependency: ${dep}`,
              code: 'UNKNOWN_DEPENDENCY'
            });
          }
        }
      }
    }

    // Validate start/end nodes
    if (startNodes === 0) {
      errors.push({
        path: 'nodes',
        message: 'Workflow must have at least one START node',
        code: 'MISSING_START_NODE'
      });
    }

    if (startNodes > 1 && this.options.strict) {
      warnings.push({
        path: 'nodes',
        message: 'Multiple START nodes detected',
        code: 'MULTIPLE_START_NODES'
      });
    }

    if (endNodes === 0) {
      warnings.push({
        path: 'nodes',
        message: 'Workflow has no END node',
        code: 'MISSING_END_NODE'
      });
    }
  }

  /**
   * Validate node by type
   */
  private validateNodeByType(
    node: WorkflowNode,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    switch (node.type) {
      case NodeType.TASK:
        if (!node.config?.command && !node.config?.script) {
          errors.push({
            path: `${path}.config`,
            message: 'Task node must have command or script',
            code: 'MISSING_TASK_CONFIG'
          });
        }
        break;

      case NodeType.CONDITIONAL:
        if (!node.config?.condition) {
          errors.push({
            path: `${path}.config`,
            message: 'Conditional node must have condition',
            code: 'MISSING_CONDITION'
          });
        }
        break;

      case NodeType.PARALLEL:
        if (!node.config?.branches || node.config.branches.length < 2) {
          warnings.push({
            path: `${path}.config`,
            message: 'Parallel node should have at least 2 branches',
            code: 'INSUFFICIENT_BRANCHES'
          });
        }
        break;

      case NodeType.LOOP:
        if (!node.config?.condition && !node.config?.count) {
          errors.push({
            path: `${path}.config`,
            message: 'Loop node must have condition or count',
            code: 'MISSING_LOOP_CONFIG'
          });
        }
        break;

      case NodeType.AGENT:
        this.validateAgentNode(node, path, errors, warnings);
        break;

      case NodeType.SUBWORKFLOW:
        if (!node.config?.workflowId) {
          errors.push({
            path: `${path}.config`,
            message: 'Subworkflow node must reference a workflow',
            code: 'MISSING_SUBWORKFLOW_ID'
          });
        }
        break;
    }
  }

  /**
   * Validate agent node
   */
  private validateAgentNode(
    node: WorkflowNode,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!node.agent) {
      errors.push({
        path: `${path}.agent`,
        message: 'Agent node must have agent configuration',
        code: 'MISSING_AGENT_CONFIG'
      });
      return;
    }

    const agent = node.agent;

    // Validate agent type
    const validTypes = ['researcher', 'coder', 'analyst', 'tester', 'coordinator', 'financial', 'custom'];
    if (!validTypes.includes(agent.type)) {
      errors.push({
        path: `${path}.agent.type`,
        message: `Invalid agent type: ${agent.type}`,
        code: 'INVALID_AGENT_TYPE'
      });
    }

    // Validate capabilities
    if (!agent.capabilities || agent.capabilities.length === 0) {
      warnings.push({
        path: `${path}.agent.capabilities`,
        message: 'Agent should have at least one capability',
        code: 'NO_CAPABILITIES'
      });
    }

    // Validate resources
    if (agent.resources) {
      if (agent.resources.cpu && (agent.resources.cpu < 0 || agent.resources.cpu > 100)) {
        errors.push({
          path: `${path}.agent.resources.cpu`,
          message: 'CPU must be between 0 and 100',
          code: 'INVALID_CPU'
        });
      }

      if (agent.resources.memory && agent.resources.memory < 0) {
        errors.push({
          path: `${path}.agent.resources.memory`,
          message: 'Memory must be positive',
          code: 'INVALID_MEMORY'
        });
      }
    }
  }

  /**
   * Validate edges
   */
  private validateEdges(
    workflow: WorkflowDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const nodeIds = new Set(workflow.nodes.map(n => n.id));
    const edgeIds = new Set<string>();

    for (let i = 0; i < workflow.edges.length; i++) {
      const edge = workflow.edges[i];
      const path = `edges[${i}]`;

      // Required fields
      if (!edge.id) {
        errors.push({
          path: `${path}.id`,
          message: 'Edge ID is required',
          code: 'MISSING_EDGE_ID'
        });
        continue;
      }

      // Duplicate IDs
      if (edgeIds.has(edge.id)) {
        errors.push({
          path: `${path}.id`,
          message: `Duplicate edge ID: ${edge.id}`,
          code: 'DUPLICATE_EDGE_ID'
        });
      }
      edgeIds.add(edge.id);

      // Validate source/target
      if (!edge.source) {
        errors.push({
          path: `${path}.source`,
          message: 'Edge source is required',
          code: 'MISSING_SOURCE'
        });
      } else if (!nodeIds.has(edge.source)) {
        errors.push({
          path: `${path}.source`,
          message: `Unknown source node: ${edge.source}`,
          code: 'UNKNOWN_SOURCE_NODE'
        });
      }

      if (!edge.target) {
        errors.push({
          path: `${path}.target`,
          message: 'Edge target is required',
          code: 'MISSING_TARGET'
        });
      } else if (!nodeIds.has(edge.target)) {
        errors.push({
          path: `${path}.target`,
          message: `Unknown target node: ${edge.target}`,
          code: 'UNKNOWN_TARGET_NODE'
        });
      }

      // Validate condition
      if (edge.condition) {
        this.validateCondition(edge.condition, `${path}.condition`, errors, warnings);
      }
    }
  }

  /**
   * Validate condition
   */
  private validateCondition(
    condition: Condition,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const validTypes = ['expression', 'script', 'function'];
    if (!validTypes.includes(condition.type)) {
      errors.push({
        path: `${path}.type`,
        message: `Invalid condition type: ${condition.type}`,
        code: 'INVALID_CONDITION_TYPE'
      });
    }

    if (!condition.value) {
      errors.push({
        path: `${path}.value`,
        message: 'Condition value is required',
        code: 'MISSING_CONDITION_VALUE'
      });
    }

    if (condition.type === 'script' && !condition.language) {
      warnings.push({
        path: `${path}.language`,
        message: 'Script condition should specify language',
        code: 'MISSING_SCRIPT_LANGUAGE'
      });
    }
  }

  /**
   * Validate graph structure
   */
  private validateGraph(
    workflow: WorkflowDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Build adjacency list
    const graph = new Map<string, string[]>();
    const reverseGraph = new Map<string, string[]>();

    for (const node of workflow.nodes) {
      graph.set(node.id, []);
      reverseGraph.set(node.id, []);
    }

    for (const edge of workflow.edges) {
      if (graph.has(edge.source) && reverseGraph.has(edge.target)) {
        graph.get(edge.source)!.push(edge.target);
        reverseGraph.get(edge.target)!.push(edge.source);
      }
    }

    // Check for cycles (except in nodes that support loops)
    if (this.hasCycles(graph, workflow.nodes)) {
      errors.push({
        path: 'graph',
        message: 'Workflow contains cycles',
        code: 'CIRCULAR_DEPENDENCY'
      });
    }

    // Check for unreachable nodes
    const reachable = this.findReachableNodes(graph, workflow.nodes);
    const unreachable = workflow.nodes.filter(n => !reachable.has(n.id) && n.type !== NodeType.START);

    if (unreachable.length > 0) {
      warnings.push({
        path: 'graph',
        message: `Unreachable nodes: ${unreachable.map(n => n.id).join(', ')}`,
        code: 'UNREACHABLE_NODES'
      });
    }

    // Check for deadends (nodes with no outgoing edges except END nodes)
    for (const [nodeId, targets] of graph.entries()) {
      const node = workflow.nodes.find(n => n.id === nodeId);
      if (node && node.type !== NodeType.END && targets.length === 0) {
        warnings.push({
          path: `nodes[${nodeId}]`,
          message: `Node has no outgoing edges: ${nodeId}`,
          code: 'DEAD_END_NODE'
        });
      }
    }
  }

  /**
   * Validate semantics
   */
  private validateSemantics(
    workflow: WorkflowDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check parallel branches converge
    const parallelNodes = workflow.nodes.filter(n => n.type === NodeType.PARALLEL);
    for (const parallel of parallelNodes) {
      // Implementation would check that branches eventually converge
      // This is a simplified check
      const branches = parallel.config?.branches || [];
      if (branches.length > 0) {
        // Add semantic validation logic here
      }
    }

    // Check conditional branches are complete
    const conditionalNodes = workflow.nodes.filter(n => n.type === NodeType.CONDITIONAL);
    for (const conditional of conditionalNodes) {
      const outgoingEdges = workflow.edges.filter(e => e.source === conditional.id);
      if (outgoingEdges.length < 2) {
        warnings.push({
          path: `nodes[${conditional.id}]`,
          message: 'Conditional node should have at least 2 branches',
          code: 'INCOMPLETE_CONDITIONAL'
        });
      }
    }
  }

  /**
   * Validate resource requirements
   */
  private validateResources(
    workflow: WorkflowDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Calculate total resource requirements
    let totalCpu = 0;
    let totalMemory = 0;
    let gpuRequired = false;

    for (const node of workflow.nodes) {
      if (node.agent?.resources) {
        totalCpu += node.agent.resources.cpu || 0;
        totalMemory += node.agent.resources.memory || 0;
        gpuRequired = gpuRequired || node.agent.resources.gpu || false;
      }
    }

    // Warn if resources seem excessive
    if (totalCpu > 400) {
      warnings.push({
        path: 'resources',
        message: `High total CPU requirement: ${totalCpu}%`,
        code: 'HIGH_CPU_REQUIREMENT'
      });
    }

    if (totalMemory > 16384) {
      warnings.push({
        path: 'resources',
        message: `High total memory requirement: ${totalMemory}MB`,
        code: 'HIGH_MEMORY_REQUIREMENT'
      });
    }

    if (gpuRequired) {
      warnings.push({
        path: 'resources',
        message: 'Workflow requires GPU resources',
        code: 'GPU_REQUIRED'
      });
    }
  }

  /**
   * Check for cycles in graph
   */
  private hasCycles(graph: Map<string, string[]>, nodes: WorkflowNode[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const visit = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = nodes.find(n => n.id === nodeId);
      // Allow cycles for loop nodes
      if (node?.type === NodeType.LOOP) {
        recursionStack.delete(nodeId);
        return false;
      }

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (visit(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (visit(node.id)) return true;
      }
    }

    return false;
  }

  /**
   * Find reachable nodes from start nodes
   */
  private findReachableNodes(graph: Map<string, string[]>, nodes: WorkflowNode[]): Set<string> {
    const reachable = new Set<string>();
    const startNodes = nodes.filter(n => n.type === NodeType.START);

    const visit = (nodeId: string): void => {
      if (reachable.has(nodeId)) return;
      reachable.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        visit(neighbor);
      }
    };

    for (const start of startNodes) {
      visit(start.id);
    }

    return reachable;
  }

  /**
   * Validate version format
   */
  private isValidVersion(version: string): boolean {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    return semverRegex.test(version);
  }
}