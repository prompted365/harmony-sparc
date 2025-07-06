/**
 * AgentFlow Swarm Memory Persistence Layer
 * Simplified memory system for AgentFlow workflow coordination
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface MemoryEntry {
  id: string;
  key: string;
  value: any;
  category: string;
  timestamp: number;
  ttl?: number;
  metadata?: Record<string, any>;
}

export interface WorkflowMemory {
  workflowId: string;
  stepResults: Map<number, any>;
  decisions: Decision[];
  performance: WorkflowPerformance;
}

export interface Decision {
  timestamp: number;
  agentId: string;
  decision: string;
  reasoning: string;
  confidence: number;
}

export interface WorkflowPerformance {
  startTime: number;
  endTime?: number;
  resourcesUsed: Record<string, number>;
  errors: Error[];
}

export class AgentFlowMemory {
  private db: Database.Database;
  private cache: Map<string, MemoryEntry> = new Map();

  constructor(dbPath?: string) {
    const defaultPath = path.join(process.cwd(), 'data', 'agentflow-memory.db');
    const finalPath = dbPath || defaultPath;
    
    // Ensure data directory exists
    const dataDir = path.dirname(finalPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(finalPath);
    this.initDatabase();
  }

  private initDatabase(): void {
    // Enable foreign keys
    this.db.exec('PRAGMA foreign_keys = ON');

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        value TEXT,
        category TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        ttl INTEGER,
        expires_at INTEGER,
        metadata TEXT,
        UNIQUE(key, category)
      );
      
      CREATE TABLE IF NOT EXISTS workflow_memory (
        workflow_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        step_results TEXT,
        decisions TEXT,
        performance TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS agent_state (
        agent_id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        last_task TEXT,
        performance TEXT,
        updated_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS coordination_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        agent_id TEXT,
        workflow_id TEXT,
        data TEXT,
        timestamp INTEGER NOT NULL
      );
      
      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_memory_key ON memory_entries(key);
      CREATE INDEX IF NOT EXISTS idx_memory_category ON memory_entries(category);
      CREATE INDEX IF NOT EXISTS idx_memory_expires ON memory_entries(expires_at);
      CREATE INDEX IF NOT EXISTS idx_workflow_status ON workflow_memory(status);
      CREATE INDEX IF NOT EXISTS idx_coordination_timestamp ON coordination_events(timestamp);
    `);

    // Clean up expired entries periodically
    this.cleanupExpired();
  }

  // Memory operations
  async store(key: string, value: any, category: string = 'general', ttl?: number): Promise<void> {
    const id = `${category}_${key}_${Date.now()}`;
    const timestamp = Date.now();
    const expiresAt = ttl ? timestamp + (ttl * 1000) : null;

    const entry: MemoryEntry = {
      id,
      key,
      value,
      category,
      timestamp,
      ttl,
    };

    // Store in cache
    this.cache.set(key, entry);

    // Store in database
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memory_entries (id, key, value, category, timestamp, ttl, expires_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      key,
      JSON.stringify(value),
      category,
      timestamp,
      ttl,
      expiresAt,
      JSON.stringify(entry.metadata || {})
    );
  }

  async retrieve(key: string, category?: string): Promise<any> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)!.value;
    }

    // Query database
    let query = 'SELECT * FROM memory_entries WHERE key = ?';
    const params: any[] = [key];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' AND (expires_at IS NULL OR expires_at > ?) ORDER BY timestamp DESC LIMIT 1';
    params.push(Date.now());

    const stmt = this.db.prepare(query);
    const row = stmt.get(...params);

    if (row) {
      const value = JSON.parse(row.value);
      const entry: MemoryEntry = {
        id: row.id,
        key: row.key,
        value,
        category: row.category,
        timestamp: row.timestamp,
        ttl: row.ttl,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      };

      // Update cache
      this.cache.set(key, entry);

      return value;
    }

    return null;
  }

  async list(category?: string, pattern?: string): Promise<MemoryEntry[]> {
    let query = 'SELECT * FROM memory_entries WHERE (expires_at IS NULL OR expires_at > ?)';
    const params: any[] = [Date.now()];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (pattern) {
      query += ' AND key LIKE ?';
      params.push(pattern.replace('*', '%'));
    }

    query += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(row => ({
      id: row.id,
      key: row.key,
      value: JSON.parse(row.value),
      category: row.category,
      timestamp: row.timestamp,
      ttl: row.ttl,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  // Workflow-specific memory
  async storeWorkflowMemory(workflowId: string, memory: WorkflowMemory): Promise<void> {
    const now = Date.now();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workflow_memory (workflow_id, status, step_results, decisions, performance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      workflowId,
      'active',
      JSON.stringify(Array.from(memory.stepResults.entries())),
      JSON.stringify(memory.decisions),
      JSON.stringify(memory.performance),
      now,
      now
    );
  }

  async getWorkflowMemory(workflowId: string): Promise<WorkflowMemory | null> {
    const stmt = this.db.prepare('SELECT * FROM workflow_memory WHERE workflow_id = ?');
    const row = stmt.get(workflowId);

    if (row) {
      return {
        workflowId: row.workflow_id,
        stepResults: new Map(JSON.parse(row.step_results)),
        decisions: JSON.parse(row.decisions),
        performance: JSON.parse(row.performance)
      };
    }

    return null;
  }

  // Agent state management
  async updateAgentState(agentId: string, state: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO agent_state (agent_id, state, last_task, performance, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      agentId,
      JSON.stringify(state),
      state.currentTask || null,
      JSON.stringify(state.performance || {}),
      Date.now()
    );
  }

  async getAgentState(agentId: string): Promise<any> {
    const stmt = this.db.prepare('SELECT * FROM agent_state WHERE agent_id = ?');
    const row = stmt.get(agentId);

    if (row) {
      return JSON.parse(row.state);
    }

    return null;
  }

  // Coordination events
  async logCoordinationEvent(eventType: string, agentId?: string, workflowId?: string, data?: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO coordination_events (event_type, agent_id, workflow_id, data, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      eventType,
      agentId || null,
      workflowId || null,
      data ? JSON.stringify(data) : null,
      Date.now()
    );
  }

  async getCoordinationEvents(filters: { eventType?: string; agentId?: string; workflowId?: string; limit?: number }): Promise<any[]> {
    let query = 'SELECT * FROM coordination_events WHERE 1=1';
    const params: any[] = [];

    if (filters.eventType) {
      query += ' AND event_type = ?';
      params.push(filters.eventType);
    }

    if (filters.agentId) {
      query += ' AND agent_id = ?';
      params.push(filters.agentId);
    }

    if (filters.workflowId) {
      query += ' AND workflow_id = ?';
      params.push(filters.workflowId);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(row => ({
      id: row.id,
      eventType: row.event_type,
      agentId: row.agent_id,
      workflowId: row.workflow_id,
      data: row.data ? JSON.parse(row.data) : null,
      timestamp: row.timestamp
    }));
  }

  // Cleanup
  private cleanupExpired(): void {
    // Run cleanup every minute
    setInterval(() => {
      const stmt = this.db.prepare('DELETE FROM memory_entries WHERE expires_at IS NOT NULL AND expires_at < ?');
      stmt.run(Date.now());

      // Clean cache
      for (const [key, entry] of this.cache.entries()) {
        if (entry.ttl && entry.timestamp + (entry.ttl * 1000) < Date.now()) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }

  close(): void {
    this.db.close();
  }
}