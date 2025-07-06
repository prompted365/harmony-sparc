/**
 * AgentFlow Workflow Registry
 * Manages workflow definitions and templates
 */

import {
  WorkflowDefinition,
  RegistryEntry,
  RegistryMetadata,
  ValidationResult
} from '../types';
import { WorkflowValidator, ValidatorOptions } from '../validator/workflow-validator';
import { EventBus } from '../events/event-bus';
import { WorkflowEventType } from '../types';

export interface RegistryOptions {
  validatorOptions?: ValidatorOptions;
  enableVersioning?: boolean;
  enableCategories?: boolean;
  maxVersionsPerWorkflow?: number;
}

export interface RegistrySearchOptions {
  query?: string;
  category?: string;
  tags?: string[];
  author?: string;
  minRating?: number;
  sortBy?: 'name' | 'created' | 'updated' | 'usage' | 'rating';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface RegistryStats {
  totalWorkflows: number;
  totalVersions: number;
  categories: Record<string, number>;
  topWorkflows: Array<{ id: string; name: string; usage: number }>;
  recentlyAdded: RegistryEntry[];
  recentlyUpdated: RegistryEntry[];
}

export class WorkflowRegistry {
  private workflows: Map<string, RegistryEntry> = new Map();
  private versions: Map<string, Map<string, RegistryEntry>> = new Map();
  private categories: Map<string, Set<string>> = new Map();
  private tags: Map<string, Set<string>> = new Map();
  private validator: WorkflowValidator;
  private eventBus: EventBus;
  private options: RegistryOptions;

  constructor(eventBus: EventBus, options: RegistryOptions = {}) {
    this.eventBus = eventBus;
    this.options = {
      enableVersioning: options.enableVersioning ?? true,
      enableCategories: options.enableCategories ?? true,
      maxVersionsPerWorkflow: options.maxVersionsPerWorkflow || 10,
      ...options
    };
    this.validator = new WorkflowValidator(options.validatorOptions);
  }

  /**
   * Register a new workflow
   */
  async register(workflow: WorkflowDefinition): Promise<RegistryEntry> {
    // Validate workflow
    const validation = this.validator.validate(workflow);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${JSON.stringify(validation.errors)}`);
    }

    // Check if workflow already exists
    const existingEntry = this.workflows.get(workflow.id);
    
    if (existingEntry) {
      if (this.options.enableVersioning) {
        return this.registerVersion(workflow);
      } else {
        throw new Error(`Workflow already exists: ${workflow.id}`);
      }
    }

    // Create registry entry
    const entry: RegistryEntry = {
      id: workflow.id,
      workflow,
      metadata: {
        registered: new Date(),
        updated: new Date(),
        usage: 0,
        rating: undefined,
        reviews: undefined
      }
    };

    // Store in registry
    this.workflows.set(workflow.id, entry);

    // Store version if versioning enabled
    if (this.options.enableVersioning) {
      if (!this.versions.has(workflow.id)) {
        this.versions.set(workflow.id, new Map());
      }
      this.versions.get(workflow.id)!.set(workflow.version, entry);
    }

    // Update categories and tags
    this.updateIndexes(workflow);

    // Emit event
    await this.eventBus.publish({
      id: `evt_${Date.now()}`,
      type: WorkflowEventType.WORKFLOW_CREATED,
      timestamp: new Date(),
      workflowId: workflow.id,
      data: { workflow, entry }
    });

    return entry;
  }

  /**
   * Register a new version of existing workflow
   */
  private async registerVersion(workflow: WorkflowDefinition): Promise<RegistryEntry> {
    const versions = this.versions.get(workflow.id);
    if (!versions) {
      throw new Error(`Workflow not found: ${workflow.id}`);
    }

    // Check if version already exists
    if (versions.has(workflow.version)) {
      throw new Error(`Version already exists: ${workflow.id}@${workflow.version}`);
    }

    // Check version limit
    if (versions.size >= this.options.maxVersionsPerWorkflow!) {
      // Remove oldest version
      const oldestVersion = Array.from(versions.entries())
        .sort((a, b) => a[1].metadata.registered.getTime() - b[1].metadata.registered.getTime())[0];
      versions.delete(oldestVersion[0]);
    }

    // Create new version entry
    const entry: RegistryEntry = {
      id: workflow.id,
      workflow,
      metadata: {
        registered: new Date(),
        updated: new Date(),
        usage: 0,
        rating: undefined,
        reviews: undefined
      }
    };

    // Store version
    versions.set(workflow.version, entry);

    // Update main entry if newer
    const mainEntry = this.workflows.get(workflow.id)!;
    if (this.compareVersions(workflow.version, mainEntry.workflow.version) > 0) {
      this.workflows.set(workflow.id, entry);
    }

    // Update indexes
    this.updateIndexes(workflow);

    // Emit event
    await this.eventBus.publish({
      id: `evt_${Date.now()}`,
      type: WorkflowEventType.WORKFLOW_UPDATED,
      timestamp: new Date(),
      workflowId: workflow.id,
      data: { workflow, entry, version: workflow.version }
    });

    return entry;
  }

  /**
   * Get workflow by ID
   */
  get(id: string, version?: string): WorkflowDefinition | undefined {
    if (version && this.options.enableVersioning) {
      const versions = this.versions.get(id);
      return versions?.get(version)?.workflow;
    }
    return this.workflows.get(id)?.workflow;
  }

  /**
   * Get registry entry
   */
  getEntry(id: string, version?: string): RegistryEntry | undefined {
    if (version && this.options.enableVersioning) {
      const versions = this.versions.get(id);
      return versions?.get(version);
    }
    return this.workflows.get(id);
  }

  /**
   * Get all versions of a workflow
   */
  getVersions(id: string): Map<string, RegistryEntry> | undefined {
    return this.versions.get(id);
  }

  /**
   * Update workflow
   */
  async update(id: string, workflow: WorkflowDefinition): Promise<RegistryEntry> {
    const entry = this.workflows.get(id);
    if (!entry) {
      throw new Error(`Workflow not found: ${id}`);
    }

    // Validate updated workflow
    const validation = this.validator.validate(workflow);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${JSON.stringify(validation.errors)}`);
    }

    // Update workflow
    entry.workflow = workflow;
    entry.metadata.updated = new Date();

    // Update indexes
    this.updateIndexes(workflow);

    // Emit event
    await this.eventBus.publish({
      id: `evt_${Date.now()}`,
      type: WorkflowEventType.WORKFLOW_UPDATED,
      timestamp: new Date(),
      workflowId: id,
      data: { workflow, entry }
    });

    return entry;
  }

  /**
   * Delete workflow
   */
  async delete(id: string): Promise<void> {
    const entry = this.workflows.get(id);
    if (!entry) {
      throw new Error(`Workflow not found: ${id}`);
    }

    // Remove from registry
    this.workflows.delete(id);
    this.versions.delete(id);

    // Remove from indexes
    this.removeFromIndexes(entry.workflow);

    // Emit event
    await this.eventBus.publish({
      id: `evt_${Date.now()}`,
      type: WorkflowEventType.WORKFLOW_DELETED,
      timestamp: new Date(),
      workflowId: id,
      data: { workflow: entry.workflow }
    });
  }

  /**
   * Search workflows
   */
  search(options: RegistrySearchOptions = {}): RegistryEntry[] {
    let results = Array.from(this.workflows.values());

    // Filter by query
    if (options.query) {
      const query = options.query.toLowerCase();
      results = results.filter(entry => 
        entry.workflow.name.toLowerCase().includes(query) ||
        entry.workflow.description?.toLowerCase().includes(query) ||
        entry.workflow.id.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (options.category && this.options.enableCategories) {
      const categoryWorkflows = this.categories.get(options.category);
      if (categoryWorkflows) {
        results = results.filter(entry => categoryWorkflows.has(entry.id));
      }
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(entry => {
        const workflowTags = entry.workflow.metadata?.tags || [];
        return options.tags!.some(tag => workflowTags.includes(tag));
      });
    }

    // Filter by author
    if (options.author) {
      results = results.filter(entry => 
        entry.workflow.metadata?.author === options.author
      );
    }

    // Filter by rating
    if (options.minRating !== undefined) {
      results = results.filter(entry => 
        (entry.metadata.rating || 0) >= options.minRating!
      );
    }

    // Sort results
    if (options.sortBy) {
      results.sort((a, b) => {
        let compare = 0;
        switch (options.sortBy) {
          case 'name':
            compare = a.workflow.name.localeCompare(b.workflow.name);
            break;
          case 'created':
            compare = a.metadata.registered.getTime() - b.metadata.registered.getTime();
            break;
          case 'updated':
            compare = a.metadata.updated.getTime() - b.metadata.updated.getTime();
            break;
          case 'usage':
            compare = a.metadata.usage - b.metadata.usage;
            break;
          case 'rating':
            compare = (a.metadata.rating || 0) - (b.metadata.rating || 0);
            break;
        }
        return options.sortOrder === 'desc' ? -compare : compare;
      });
    }

    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;
      results = results.slice(start, end);
    }

    return results;
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const categories: Record<string, number> = {};
    for (const [category, workflows] of this.categories.entries()) {
      categories[category] = workflows.size;
    }

    const topWorkflows = Array.from(this.workflows.values())
      .sort((a, b) => b.metadata.usage - a.metadata.usage)
      .slice(0, 10)
      .map(entry => ({
        id: entry.id,
        name: entry.workflow.name,
        usage: entry.metadata.usage
      }));

    const recentlyAdded = Array.from(this.workflows.values())
      .sort((a, b) => b.metadata.registered.getTime() - a.metadata.registered.getTime())
      .slice(0, 10);

    const recentlyUpdated = Array.from(this.workflows.values())
      .sort((a, b) => b.metadata.updated.getTime() - a.metadata.updated.getTime())
      .slice(0, 10);

    return {
      totalWorkflows: this.workflows.size,
      totalVersions: Array.from(this.versions.values())
        .reduce((sum, versions) => sum + versions.size, 0),
      categories,
      topWorkflows,
      recentlyAdded,
      recentlyUpdated
    };
  }

  /**
   * List all workflows
   */
  list(): RegistryEntry[] {
    return Array.from(this.workflows.values());
  }

  /**
   * List workflows by category
   */
  listByCategory(category: string): RegistryEntry[] {
    const workflowIds = this.categories.get(category);
    if (!workflowIds) return [];

    return Array.from(workflowIds)
      .map(id => this.workflows.get(id))
      .filter(entry => entry !== undefined) as RegistryEntry[];
  }

  /**
   * List workflows by tag
   */
  listByTag(tag: string): RegistryEntry[] {
    const workflowIds = this.tags.get(tag);
    if (!workflowIds) return [];

    return Array.from(workflowIds)
      .map(id => this.workflows.get(id))
      .filter(entry => entry !== undefined) as RegistryEntry[];
  }

  /**
   * Increment usage counter
   */
  incrementUsage(id: string): void {
    const entry = this.workflows.get(id);
    if (entry) {
      entry.metadata.usage++;
      entry.metadata.updated = new Date();
    }
  }

  /**
   * Update rating
   */
  updateRating(id: string, rating: number, reviews: number): void {
    const entry = this.workflows.get(id);
    if (entry) {
      entry.metadata.rating = rating;
      entry.metadata.reviews = reviews;
      entry.metadata.updated = new Date();
    }
  }

  /**
   * Validate a workflow without registering
   */
  validate(workflow: WorkflowDefinition): ValidationResult {
    return this.validator.validate(workflow);
  }

  /**
   * Export registry to JSON
   */
  export(): any {
    const workflows: any[] = [];
    
    for (const entry of this.workflows.values()) {
      workflows.push({
        workflow: entry.workflow,
        metadata: {
          ...entry.metadata,
          registered: entry.metadata.registered.toISOString(),
          updated: entry.metadata.updated.toISOString()
        }
      });
    }

    return {
      version: '1.0.0',
      exported: new Date().toISOString(),
      workflows,
      stats: this.getStats()
    };
  }

  /**
   * Import registry from JSON
   */
  async import(data: any): Promise<void> {
    if (!data.workflows || !Array.isArray(data.workflows)) {
      throw new Error('Invalid import data');
    }

    for (const item of data.workflows) {
      const workflow = item.workflow;
      const metadata = item.metadata;

      // Convert dates
      metadata.registered = new Date(metadata.registered);
      metadata.updated = new Date(metadata.updated);

      const entry: RegistryEntry = {
        id: workflow.id,
        workflow,
        metadata
      };

      this.workflows.set(workflow.id, entry);
      this.updateIndexes(workflow);
    }
  }

  /**
   * Update indexes for a workflow
   */
  private updateIndexes(workflow: WorkflowDefinition): void {
    // Update category index
    if (this.options.enableCategories && workflow.metadata?.category) {
      if (!this.categories.has(workflow.metadata.category)) {
        this.categories.set(workflow.metadata.category, new Set());
      }
      this.categories.get(workflow.metadata.category)!.add(workflow.id);
    }

    // Update tag index
    if (workflow.metadata?.tags) {
      for (const tag of workflow.metadata.tags) {
        if (!this.tags.has(tag)) {
          this.tags.set(tag, new Set());
        }
        this.tags.get(tag)!.add(workflow.id);
      }
    }
  }

  /**
   * Remove workflow from indexes
   */
  private removeFromIndexes(workflow: WorkflowDefinition): void {
    // Remove from category index
    if (workflow.metadata?.category) {
      const categoryWorkflows = this.categories.get(workflow.metadata.category);
      if (categoryWorkflows) {
        categoryWorkflows.delete(workflow.id);
        if (categoryWorkflows.size === 0) {
          this.categories.delete(workflow.metadata.category);
        }
      }
    }

    // Remove from tag index
    if (workflow.metadata?.tags) {
      for (const tag of workflow.metadata.tags) {
        const tagWorkflows = this.tags.get(tag);
        if (tagWorkflows) {
          tagWorkflows.delete(workflow.id);
          if (tagWorkflows.size === 0) {
            this.tags.delete(tag);
          }
        }
      }
    }
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 !== p2) {
        return p1 - p2;
      }
    }

    return 0;
  }
}