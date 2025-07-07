/**
 * AgentFlow Event Bus
 * Real-time event system for workflow updates
 */

import { EventEmitter } from 'events';
import { WorkflowEvent, WorkflowEventType } from '../types';

export interface EventBusOptions {
  maxListeners?: number;
  enableLogging?: boolean;
  persistEvents?: boolean;
}

export interface EventHandler {
  id: string;
  pattern?: string | RegExp;
  handler: (event: WorkflowEvent) => void | Promise<void>;
  options?: EventHandlerOptions;
}

export interface EventHandlerOptions {
  once?: boolean;
  filter?: (event: WorkflowEvent) => boolean;
  priority?: number;
  errorHandler?: (error: Error, event: WorkflowEvent) => void;
}

export class EventBus extends EventEmitter {
  private handlers: Map<string, EventHandler[]> = new Map();
  private eventHistory: WorkflowEvent[] = [];
  private options: EventBusOptions;
  private handlerCounter = 0;

  constructor(options: EventBusOptions = {}) {
    super();
    this.options = {
      maxListeners: options.maxListeners || 100,
      enableLogging: options.enableLogging ?? false,
      persistEvents: options.persistEvents ?? false
    };
    this.setMaxListeners(this.options.maxListeners!);
  }

  /**
   * Subscribe to events with pattern matching
   */
  subscribe(
    pattern: string | RegExp | WorkflowEventType,
    handler: (event: WorkflowEvent) => void | Promise<void>,
    options?: EventHandlerOptions
  ): string {
    const handlerId = `handler_${++this.handlerCounter}`;
    const eventHandler: EventHandler = {
      id: handlerId,
      pattern: typeof pattern === 'string' ? pattern : pattern,
      handler,
      options
    };

    // Get event key for storage
    const key = this.getEventKey(pattern);
    const handlers = this.handlers.get(key) || [];
    
    // Add handler sorted by priority
    const priority = options?.priority || 0;
    const insertIndex = handlers.findIndex(h => (h.options?.priority || 0) < priority);
    if (insertIndex === -1) {
      handlers.push(eventHandler);
    } else {
      handlers.splice(insertIndex, 0, eventHandler);
    }
    
    this.handlers.set(key, handlers);

    // Set up actual event listener
    const wrappedHandler = async (event: WorkflowEvent) => {
      try {
        // Check filter
        if (options?.filter && !options.filter(event)) {
          return;
        }

        // Check pattern match
        if (!this.matchesPattern(event, pattern)) {
          return;
        }

        // Execute handler
        await handler(event);

        // Remove if once
        if (options?.once) {
          this.unsubscribe(handlerId);
        }
      } catch (error) {
        if (options?.errorHandler) {
          options.errorHandler(error as Error, event);
        } else if (this.options.enableLogging) {
          console.error(`Event handler error: ${error}`, event);
        }
      }
    };

    // Listen to all events or specific type
    if (pattern === '*' || pattern instanceof RegExp) {
      this.on('workflow.event', wrappedHandler);
    } else {
      this.on(key, wrappedHandler);
    }

    return handlerId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(handlerId: string): boolean {
    for (const [key, handlers] of this.handlers.entries()) {
      const index = handlers.findIndex(h => h.id === handlerId);
      if (index !== -1) {
        handlers.splice(index, 1);
        if (handlers.length === 0) {
          this.handlers.delete(key);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Publish an event
   */
  async publish(event: WorkflowEvent): Promise<void> {
    if (this.options.enableLogging) {
      console.log(`Publishing event: ${event.type}`, event);
    }

    // Store in history if persistence enabled
    if (this.options.persistEvents) {
      this.eventHistory.push(event);
    }

    // Emit to specific type listeners
    this.emit(event.type, event);

    // Emit to wildcard listeners
    this.emit('workflow.event', event);

    // Process pattern-based handlers
    await this.processPatternHandlers(event);
  }

  /**
   * Publish multiple events
   */
  async publishBatch(events: WorkflowEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Get event history
   */
  getHistory(filter?: {
    type?: WorkflowEventType;
    workflowId?: string;
    instanceId?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): WorkflowEvent[] {
    let events = [...this.eventHistory];

    if (filter) {
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.workflowId) {
        events = events.filter(e => e.workflowId === filter.workflowId);
      }
      if (filter.instanceId) {
        events = events.filter(e => e.instanceId === filter.instanceId);
      }
      if (filter.startTime) {
        events = events.filter(e => e.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        events = events.filter(e => e.timestamp <= filter.endTime!);
      }
      if (filter.limit) {
        events = events.slice(-filter.limit);
      }
    }

    return events;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Wait for specific event
   */
  async waitFor(
    pattern: string | RegExp | WorkflowEventType,
    timeout?: number,
    filter?: (event: WorkflowEvent) => boolean
  ): Promise<WorkflowEvent> {
    return new Promise((resolve, reject) => {
      const timeoutId = timeout
        ? setTimeout(() => {
            this.unsubscribe(handlerId);
            reject(new Error(`Timeout waiting for event: ${pattern}`));
          }, timeout)
        : null;

      const handlerId = this.subscribe(
        pattern,
        (event) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve(event);
        },
        { once: true, filter }
      );
    });
  }

  /**
   * Create event factory
   */
  createEvent(
    type: WorkflowEventType,
    workflowId: string,
    data?: any,
    additional?: Partial<WorkflowEvent>
  ): WorkflowEvent {
    return {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date(),
      workflowId,
      data,
      ...additional
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalHandlers: number;
    totalEvents: number;
    eventTypes: Record<string, number>;
    handlersByType: Record<string, number>;
  } {
    const eventTypes: Record<string, number> = {};
    const handlersByType: Record<string, number> = {};

    // Count events by type
    for (const event of this.eventHistory) {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    }

    // Count handlers by type
    for (const [key, handlers] of this.handlers.entries()) {
      handlersByType[key] = handlers.length;
    }

    return {
      totalHandlers: Array.from(this.handlers.values()).reduce((sum, h) => sum + h.length, 0),
      totalEvents: this.eventHistory.length,
      eventTypes,
      handlersByType
    };
  }

  /**
   * Private helper to get event key
   */
  private getEventKey(pattern: string | RegExp | WorkflowEventType): string {
    if (pattern instanceof RegExp) {
      return 'workflow.event';
    }
    return pattern.toString();
  }

  /**
   * Private helper to match pattern
   */
  private matchesPattern(event: WorkflowEvent, pattern: string | RegExp | WorkflowEventType): boolean {
    if (pattern === '*') return true;
    if (pattern instanceof RegExp) {
      return pattern.test(event.type);
    }
    return event.type === pattern;
  }

  /**
   * Process pattern-based handlers
   */
  private async processPatternHandlers(event: WorkflowEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [key, handlers] of this.handlers.entries()) {
      for (const handler of handlers) {
        if (handler.pattern instanceof RegExp && handler.pattern.test(event.type)) {
          promises.push(
            (async () => {
              try {
                if (handler.options?.filter && !handler.options.filter(event)) {
                  return;
                }
                await handler.handler(event);
              } catch (error) {
                if (handler.options?.errorHandler) {
                  handler.options.errorHandler(error as Error, event);
                }
              }
            })()
          );
        }
      }
    }

    await Promise.all(promises);
  }
}