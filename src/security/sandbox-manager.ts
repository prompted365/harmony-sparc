/**
 * Enhanced Sandbox Manager with DAA James Integration
 * Provides secure sandboxing with covert monitoring capabilities
 */

import { EventEmitter } from 'node:events';
import { ILogger } from '../core/logger.js';
import { IEventBus } from '../core/event-bus.js';
import { AgentManager } from '../agents/agent-manager.js';
import { MessageBus } from '../communication/message-bus.js';
import { JamesAgent, createJamesAgent, JamesConfig } from './james-agent.js';
import { generateId } from '../utils/helpers.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

export interface SandboxConfig {
  profile: 'strict' | 'development' | 'production' | 'custom';
  filesystem: FilesystemPolicy;
  network: NetworkPolicy;
  agents: AgentPolicy;
  monitoring: MonitoringPolicy;
  james?: JamesDeploymentConfig;
  enforcement: EnforcementConfig;
}

export interface FilesystemPolicy {
  mode: 'allowlist' | 'denylist';
  allowed: string[];
  denied: string[];
  maxFileSize: number;
  maxTotalSize: number;
  virtualizeAccess: boolean;
  logAccess: boolean;
}

export interface NetworkPolicy {
  mode: 'allowlist' | 'denylist';
  allowedHosts: string[];
  deniedHosts: string[];
  allowLocalhost: boolean;
  maxBandwidth: number;
  interceptSSL: boolean;
  logRequests: boolean;
}

export interface AgentPolicy {
  maxConcurrent: number;
  isolation: 'none' | 'process' | 'container' | 'vm';
  resourceLimits: ResourceLimits;
  communication: 'open' | 'supervised' | 'restricted';
  allowedTypes: string[];
  deniedCapabilities: string[];
}

export interface ResourceLimits {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  handles: number;
}

export interface MonitoringPolicy {
  level: 'none' | 'basic' | 'detailed' | 'forensic';
  logRetention: number;
  realTimeAlerts: boolean;
  anomalyDetection: boolean;
  behaviorAnalysis: boolean;
  performanceMetrics: boolean;
}

export interface JamesDeploymentConfig {
  enabled: boolean;
  type: 'shadow' | 'active' | 'hybrid';
  density: number; // 0-1, percentage of agents that are james agents
  reporting: {
    endpoint: string;
    frequency: 'real-time' | 'batch' | 'adaptive';
  };
  targeting: 'random' | 'strategic' | 'adaptive';
  stealthLevel: 'low' | 'medium' | 'high' | 'paranoid';
}

export interface EnforcementConfig {
  mode: 'permissive' | 'enforcing';
  violations: ViolationPolicy;
  escalation: EscalationPolicy;
  killSwitch: boolean;
}

export interface ViolationPolicy {
  action: 'log' | 'block' | 'terminate' | 'isolate';
  threshold: number;
  window: number;
  notifyAdmin: boolean;
}

export interface EscalationPolicy {
  enabled: boolean;
  levels: EscalationLevel[];
  autoQuarantine: boolean;
}

export interface EscalationLevel {
  threshold: number;
  action: string;
  notification: string[];
}

export interface SandboxViolation {
  id: string;
  timestamp: Date;
  agentId: string;
  type: 'filesystem' | 'network' | 'resource' | 'communication' | 'behavior';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  blocked: boolean;
  response: string;
}

export interface SandboxStatistics {
  totalAgents: number;
  activeAgents: number;
  jamesAgents: number;
  violations: {
    total: number;
    blocked: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  resources: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  daaDetections: number;
  performance: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
  };
}

/**
 * Enhanced Sandbox Manager with integrated DAA monitoring
 */
export class SandboxManager extends EventEmitter {
  private id: string;
  private config: SandboxConfig;
  private logger: ILogger;
  private eventBus: IEventBus;
  private agentManager: AgentManager;
  private messageBus: MessageBus;
  
  // Sandbox state
  private isActive: boolean = false;
  private startTime?: Date;
  private violations: SandboxViolation[] = [];
  private statistics: SandboxStatistics;
  
  // James management
  private jamesAgents: Map<string, JamesAgent> = new Map();
  private jamesAssignments: Map<string, string> = new Map(); // agentId -> jamesId
  private centralMonitorEndpoint?: string;
  
  // Policy enforcement
  private filesystemHooks: Map<string, any> = new Map();
  private networkInterceptor?: any;
  private resourceMonitor?: any;
  
  // Monitoring
  private monitoringInterval?: NodeJS.Timeout;
  private violationWindow: SandboxViolation[] = [];

  constructor(
    config: SandboxConfig,
    logger: ILogger,
    eventBus: IEventBus,
    agentManager: AgentManager,
    messageBus: MessageBus
  ) {
    super();
    this.id = generateId('sandbox');
    this.config = config;
    this.logger = logger;
    this.eventBus = eventBus;
    this.agentManager = agentManager;
    this.messageBus = messageBus;

    this.statistics = this.createDefaultStatistics();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Agent lifecycle events
    this.eventBus.on('agent:created', (data) => {
      if (this.isActive) {
        this.handleAgentCreated(data.agent);
      }
    });

    this.eventBus.on('agent:started', (data) => {
      if (this.isActive) {
        this.applyAgentSandbox(data.agent);
      }
    });

    // Violation monitoring
    this.eventBus.on('sandbox:violation', (data) => {
      this.handleViolation(data);
    });

    // James reporting
    this.on('james:daa-detected', (data) => {
      this.handleDAADetection(data);
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing sandbox manager', {
      sandboxId: this.id,
      profile: this.config.profile,
      jamesEnabled: this.config.james?.enabled
    });

    try {
      // Set up filesystem hooks
      await this.setupFilesystemHooks();

      // Set up network interception
      await this.setupNetworkInterception();

      // Set up resource monitoring
      await this.setupResourceMonitoring();

      // Initialize james infrastructure if enabled
      if (this.config.james?.enabled) {
        await this.setupJamesInfrastructure();
      }

      // Start monitoring
      this.startMonitoring();

      this.isActive = true;
      this.startTime = new Date();

      this.emit('sandbox:initialized', { sandboxId: this.id });

    } catch (error) {
      this.logger.error('Failed to initialize sandbox', {
        sandboxId: this.id,
        error: error.message
      });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down sandbox manager', { sandboxId: this.id });

    try {
      // Stop monitoring
      this.stopMonitoring();

      // Exfiltrate james agents
      await this.exfiltrateJamesAgents();

      // Remove hooks
      await this.removeFilesystemHooks();
      await this.removeNetworkInterception();
      await this.removeResourceMonitoring();

      // Generate final report
      await this.generateFinalReport();

      this.isActive = false;

      this.emit('sandbox:shutdown', { sandboxId: this.id });

    } catch (error) {
      this.logger.error('Error during sandbox shutdown', {
        sandboxId: this.id,
        error: error.message
      });
      throw error;
    }
  }

  // === FILESYSTEM SANDBOXING ===

  private async setupFilesystemHooks(): Promise<void> {
    const fs = require('fs');
    const originalMethods = {
      readFile: fs.readFile,
      writeFile: fs.writeFile,
      unlink: fs.unlink,
      mkdir: fs.mkdir,
      rmdir: fs.rmdir,
      access: fs.access
    };

    // Store original methods
    this.filesystemHooks.set('original', originalMethods);

    // Hook filesystem methods
    const self = this;
    
    fs.readFile = function(filepath: string, ...args: any[]) {
      const allowed = self.checkFilesystemAccess(filepath, 'read');
      if (!allowed) {
        const error = new Error(`Sandbox: Access denied to ${filepath}`);
        if (args[args.length - 1] instanceof Function) {
          return args[args.length - 1](error);
        }
        throw error;
      }
      return originalMethods.readFile.apply(this, [filepath, ...args]);
    };

    fs.writeFile = function(filepath: string, ...args: any[]) {
      const allowed = self.checkFilesystemAccess(filepath, 'write');
      if (!allowed) {
        const error = new Error(`Sandbox: Write access denied to ${filepath}`);
        if (args[args.length - 1] instanceof Function) {
          return args[args.length - 1](error);
        }
        throw error;
      }
      return originalMethods.writeFile.apply(this, [filepath, ...args]);
    };

    // Hook other methods similarly...
    
    this.logger.info('Filesystem hooks installed');
  }

  private checkFilesystemAccess(filepath: string, operation: string): boolean {
    const normalizedPath = path.normalize(path.resolve(filepath));
    const { mode, allowed, denied } = this.config.filesystem;

    // Log access if configured
    if (this.config.filesystem.logAccess) {
      this.logFileAccess(normalizedPath, operation);
    }

    if (mode === 'allowlist') {
      // Check if path is in allowed list
      const isAllowed = allowed.some(allowedPath => {
        const normalized = path.normalize(path.resolve(allowedPath));
        return normalizedPath.startsWith(normalized);
      });

      if (!isAllowed) {
        this.recordViolation({
          type: 'filesystem',
          severity: 'medium',
          details: {
            path: normalizedPath,
            operation,
            reason: 'not_in_allowlist'
          }
        });
        return false;
      }
    } else {
      // Check if path is in denied list
      const isDenied = denied.some(deniedPath => {
        const normalized = path.normalize(path.resolve(deniedPath));
        return normalizedPath.startsWith(normalized);
      });

      if (isDenied) {
        this.recordViolation({
          type: 'filesystem',
          severity: 'high',
          details: {
            path: normalizedPath,
            operation,
            reason: 'in_denylist'
          }
        });
        return false;
      }
    }

    return true;
  }

  private async removeFilesystemHooks(): Promise<void> {
    const fs = require('fs');
    const original = this.filesystemHooks.get('original');
    
    if (original) {
      Object.assign(fs, original);
      this.logger.info('Filesystem hooks removed');
    }
  }

  // === NETWORK SANDBOXING ===

  private async setupNetworkInterception(): Promise<void> {
    // This would hook into the network layer
    // For demonstration, we'll use a simplified approach
    
    const http = require('http');
    const https = require('https');
    
    const originalRequest = http.request;
    const originalHttpsRequest = https.request;
    
    const self = this;
    
    http.request = function(options: any, ...args: any[]) {
      const allowed = self.checkNetworkAccess(options);
      if (!allowed) {
        throw new Error(`Sandbox: Network access denied to ${options.hostname || options.host}`);
      }
      return originalRequest.apply(this, [options, ...args]);
    };
    
    https.request = function(options: any, ...args: any[]) {
      const allowed = self.checkNetworkAccess(options);
      if (!allowed) {
        throw new Error(`Sandbox: Network access denied to ${options.hostname || options.host}`);
      }
      return originalHttpsRequest.apply(this, [options, ...args]);
    };
    
    this.networkInterceptor = { originalRequest, originalHttpsRequest };
    this.logger.info('Network interception installed');
  }

  private checkNetworkAccess(options: any): boolean {
    const host = options.hostname || options.host || 'unknown';
    const { mode, allowedHosts, deniedHosts, allowLocalhost } = this.config.network;

    // Check localhost
    if (!allowLocalhost && (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.'))) {
      this.recordViolation({
        type: 'network',
        severity: 'high',
        details: {
          host,
          reason: 'localhost_denied'
        }
      });
      return false;
    }

    if (mode === 'allowlist') {
      const isAllowed = allowedHosts.some(allowed => 
        host === allowed || host.endsWith(`.${allowed}`)
      );

      if (!isAllowed) {
        this.recordViolation({
          type: 'network',
          severity: 'medium',
          details: {
            host,
            reason: 'not_in_allowlist'
          }
        });
        return false;
      }
    } else {
      const isDenied = deniedHosts.some(denied => 
        host === denied || host.endsWith(`.${denied}`)
      );

      if (isDenied) {
        this.recordViolation({
          type: 'network',
          severity: 'high',
          details: {
            host,
            reason: 'in_denylist'
          }
        });
        return false;
      }
    }

    return true;
  }

  private async removeNetworkInterception(): Promise<void> {
    if (this.networkInterceptor) {
      const http = require('http');
      const https = require('https');
      
      http.request = this.networkInterceptor.originalRequest;
      https.request = this.networkInterceptor.originalHttpsRequest;
      
      this.logger.info('Network interception removed');
    }
  }

  // === RESOURCE MONITORING ===

  private async setupResourceMonitoring(): Promise<void> {
    this.resourceMonitor = setInterval(() => {
      this.checkResourceUsage();
    }, 5000); // Check every 5 seconds
    
    this.logger.info('Resource monitoring started');
  }

  private async checkResourceUsage(): Promise<void> {
    const usage = {
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      disk: await this.getDiskUsage()
    };

    // Check against limits
    const limits = this.config.agents.resourceLimits;
    
    if (usage.memory.heapUsed > limits.memory) {
      this.recordViolation({
        type: 'resource',
        severity: 'high',
        details: {
          resource: 'memory',
          used: usage.memory.heapUsed,
          limit: limits.memory
        }
      });
    }

    // Update statistics
    this.statistics.resources = {
      cpu: (usage.cpu.user + usage.cpu.system) / 1000000,
      memory: usage.memory.heapUsed,
      disk: usage.disk,
      network: 0 // Would need actual network monitoring
    };
  }

  private async getDiskUsage(): Promise<number> {
    // Simplified disk usage calculation
    try {
      const stats = await fs.stat(this.config.filesystem.allowed[0] || './');
      return stats.size;
    } catch {
      return 0;
    }
  }

  private async removeResourceMonitoring(): Promise<void> {
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.logger.info('Resource monitoring stopped');
    }
  }

  // === JAMES INFRASTRUCTURE ===

  private async setupJamesInfrastructure(): Promise<void> {
    if (!this.config.james) return;

    this.centralMonitorEndpoint = this.config.james.reporting.endpoint;
    
    this.logger.info('Setting up james infrastructure', {
      density: this.config.james.density,
      type: this.config.james.type,
      targeting: this.config.james.targeting
    });

    // Set up secure reporting channel
    await this.setupCentralMonitorChannel();
    
    this.emit('james:infrastructure-ready');
  }

  private async setupCentralMonitorChannel(): Promise<void> {
    // Set up quantum-entangled channel (simulated)
    // In reality, this would establish a secure, hidden communication channel
    this.logger.debug('Central Monitor channel established');
  }

  private async deployJames(swarmId: string): Promise<JamesAgent | null> {
    if (!this.config.james?.enabled) return null;

    const shouldDeploy = Math.random() < this.config.james.density;
    if (!shouldDeploy) return null;

    try {
      const jamesConfig: Partial<JamesConfig> = {
        type: this.config.james.type,
        reporting: {
          endpoint: this.centralMonitorEndpoint!,
          frequency: this.config.james.reporting.frequency,
          encryption: 'quantum-resistant',
          channels: [
            { type: 'direct', priority: 1, backup: false },
            { type: 'steganographic', priority: 2, backup: true }
          ],
          redundancy: 2,
          stealth: {
            mode: this.getStealthMode(),
            noiseLevel: this.getNoiseLevel(),
            misdirection: true,
            counterSurveillance: true
          }
        }
      };

      const james = createJamesAgent(jamesConfig, this.logger, this.messageBus);
      
      // Register james
      this.jamess.set(james.id, james);
      
      // Set up james event handlers
      james.on('daa:detected', (detection) => {
        this.emit('james:daa-detected', { jamesId: james.id, detection });
        this.statistics.daaDetections++;
      });

      james.on('james:compromised', () => {
        this.handleJamesCompromised(james.id);
      });

      // Infiltrate the swarm
      await james.infiltrate(swarmId);
      
      this.logger.info('James deployed', {
        jamesId: james.id,
        swarmId,
        type: this.config.james.type
      });

      return james;

    } catch (error) {
      this.logger.error('Failed to deploy james', {
        swarmId,
        error: error.message
      });
      return null;
    }
  }

  private getStealthMode(): 'passive' | 'active' | 'adaptive' {
    switch (this.config.james?.stealthLevel) {
      case 'paranoid': return 'passive';
      case 'high': return 'adaptive';
      default: return 'active';
    }
  }

  private getNoiseLevel(): number {
    switch (this.config.james?.stealthLevel) {
      case 'paranoid': return 0.8;
      case 'high': return 0.5;
      case 'medium': return 0.3;
      default: return 0.1;
    }
  }

  private async exfiltrateJamess(): Promise<void> {
    const exfiltrationPromises = Array.from(this.jamess.values()).map(james =>
      james.exfiltrate().catch(error => {
        this.logger.error('James exfiltration failed', {
          jamesId: james.id,
          error: error.message
        });
      })
    );

    await Promise.all(exfiltrationPromises);
    
    this.logger.info('All jamess exfiltrated', {
      jamesCount: this.jamess.size
    });
  }

  // === AGENT MANAGEMENT ===

  private async handleAgentCreated(agent: any): Promise<void> {
    // Potentially replace with james
    if (this.shouldDeployJames(agent)) {
      const james = await this.deployJames(agent.id.swarmId);
      if (james) {
        this.jamesAssignments.set(agent.id.id, james.id);
      }
    }
    
    this.statistics.totalAgents++;
  }

  private shouldDeployJames(agent: any): boolean {
    if (!this.config.james?.enabled) return false;

    switch (this.config.james.targeting) {
      case 'random':
        return Math.random() < this.config.james.density;
      
      case 'strategic':
        // Target specific agent types
        return ['coordinator', 'specialist'].includes(agent.type) &&
               Math.random() < this.config.james.density * 2;
      
      case 'adaptive':
        // Adapt based on current threat level
        const threatLevel = this.calculateThreatLevel();
        return Math.random() < this.config.james.density * (1 + threatLevel);
      
      default:
        return false;
    }
  }

  private calculateThreatLevel(): number {
    const recentViolations = this.violations.filter(v => 
      Date.now() - v.timestamp.getTime() < 300000 // Last 5 minutes
    );
    
    const criticalCount = recentViolations.filter(v => v.severity === 'critical').length;
    const highCount = recentViolations.filter(v => v.severity === 'high').length;
    
    return Math.min(1, (criticalCount * 0.3 + highCount * 0.1));
  }

  private applyAgentSandbox(agent: any): void {
    // Apply sandbox restrictions to agent
    if (this.config.agents.isolation !== 'none') {
      this.isolateAgent(agent);
    }
    
    if (this.config.agents.communication === 'supervised') {
      this.superviseAgentCommunication(agent);
    }
    
    this.statistics.activeAgents++;
  }

  private isolateAgent(agent: any): void {
    // Apply isolation based on policy
    switch (this.config.agents.isolation) {
      case 'process':
        // Process isolation (already handled by agent manager)
        break;
      
      case 'container':
        // Would spawn agent in container
        this.logger.debug('Container isolation applied', { agentId: agent.id.id });
        break;
      
      case 'vm':
        // Would spawn agent in VM
        this.logger.debug('VM isolation applied', { agentId: agent.id.id });
        break;
    }
  }

  private superviseAgentCommunication(agent: any): void {
    // Add communication supervision
    this.messageBus.addChannelFilter(agent.id.id, {
      id: generateId('filter'),
      name: 'sandbox-supervision',
      enabled: true,
      conditions: [
        {
          field: 'sender.id',
          operator: 'eq',
          value: agent.id.id
        }
      ],
      action: 'modify',
      priority: 1
    });
  }

  // === VIOLATION HANDLING ===

  private recordViolation(violation: Partial<SandboxViolation>): void {
    const fullViolation: SandboxViolation = {
      id: generateId('violation'),
      timestamp: new Date(),
      agentId: violation.agentId || 'unknown',
      type: violation.type!,
      severity: violation.severity!,
      details: violation.details,
      blocked: this.config.enforcement.mode === 'enforcing',
      response: this.determineResponse(violation as SandboxViolation)
    };

    this.violations.push(fullViolation);
    this.violationWindow.push(fullViolation);
    
    // Update statistics
    this.statistics.violations.total++;
    if (fullViolation.blocked) {
      this.statistics.violations.blocked++;
    }
    this.statistics.violations.byType[fullViolation.type] = 
      (this.statistics.violations.byType[fullViolation.type] || 0) + 1;
    this.statistics.violations.bySeverity[fullViolation.severity] = 
      (this.statistics.violations.bySeverity[fullViolation.severity] || 0) + 1;

    // Clean old violations from window
    const windowStart = Date.now() - this.config.enforcement.violations.window;
    this.violationWindow = this.violationWindow.filter(v => 
      v.timestamp.getTime() > windowStart
    );

    // Check for escalation
    if (this.violationWindow.length >= this.config.enforcement.violations.threshold) {
      this.escalateViolations();
    }

    this.emit('sandbox:violation', fullViolation);
    
    this.logger.warn('Sandbox violation recorded', {
      violationId: fullViolation.id,
      type: fullViolation.type,
      severity: fullViolation.severity,
      blocked: fullViolation.blocked
    });
  }

  private determineResponse(violation: SandboxViolation): string {
    const { action } = this.config.enforcement.violations;
    
    switch (action) {
      case 'log':
        return 'logged';
      
      case 'block':
        return 'blocked';
      
      case 'terminate':
        if (violation.severity === 'critical') {
          this.terminateAgent(violation.agentId);
          return 'terminated';
        }
        return 'blocked';
      
      case 'isolate':
        if (violation.severity === 'high' || violation.severity === 'critical') {
          this.isolateAgentEnhanced(violation.agentId);
          return 'isolated';
        }
        return 'blocked';
      
      default:
        return 'unknown';
    }
  }

  private escalateViolations(): void {
    this.logger.error('Violation threshold exceeded, escalating', {
      violations: this.violationWindow.length,
      threshold: this.config.enforcement.violations.threshold
    });

    if (this.config.enforcement.escalation.enabled) {
      const level = this.determineEscalationLevel();
      this.applyEscalation(level);
    }

    if (this.config.enforcement.killSwitch) {
      this.considerKillSwitch();
    }
  }

  private determineEscalationLevel(): EscalationLevel | null {
    const violationCount = this.violationWindow.length;
    
    for (const level of this.config.enforcement.escalation.levels) {
      if (violationCount >= level.threshold) {
        return level;
      }
    }
    
    return null;
  }

  private applyEscalation(level: EscalationLevel | null): void {
    if (!level) return;

    this.logger.error('Applying escalation', {
      action: level.action,
      notifications: level.notification
    });

    // Execute escalation action
    switch (level.action) {
      case 'quarantine':
        this.quarantineAllAgents();
        break;
      
      case 'shutdown':
        this.emergencyShutdown();
        break;
      
      case 'alert':
        this.sendSecurityAlert(level);
        break;
    }

    // Send notifications
    for (const channel of level.notification) {
      this.sendNotification(channel, level);
    }
  }

  private considerKillSwitch(): void {
    const criticalViolations = this.violationWindow.filter(v => 
      v.severity === 'critical'
    ).length;

    if (criticalViolations >= 3) {
      this.logger.error('KILL SWITCH ACTIVATED - Critical violations detected');
      this.emergencyShutdown();
    }
  }

  private terminateAgent(agentId: string): void {
    this.agentManager.stopAgent(agentId, 'security_violation').catch(error => {
      this.logger.error('Failed to terminate agent', {
        agentId,
        error: error.message
      });
    });
  }

  private isolateAgentEnhanced(agentId: string): void {
    // Enhanced isolation - cut off all communication
    this.messageBus.removeAgentFromAllChannels(agentId);
    
    // If it's a james, maintain covert channel
    const jamesId = this.jamesAssignments.get(agentId);
    if (jamesId) {
      const james = this.jamess.get(jamesId);
      if (james) {
        james.maintainCovertChannel();
      }
    }
  }

  private quarantineAllAgents(): void {
    this.logger.error('Quarantining all agents');
    
    // Suspend all agent operations
    for (const agent of this.agentManager.getAllAgents()) {
      if (agent.status === 'busy' || agent.status === 'idle') {
        this.agentManager.suspendAgent(agent.id.id);
      }
    }
    
    // Block all external communication
    this.config.network.mode = 'denylist';
    this.config.network.deniedHosts = ['*'];
  }

  private emergencyShutdown(): void {
    this.logger.error('EMERGENCY SHUTDOWN INITIATED');
    
    // Immediate shutdown of all agents
    this.agentManager.shutdown().then(() => {
      // Shutdown sandbox
      this.shutdown();
    });
  }

  private sendSecurityAlert(level: EscalationLevel): void {
    this.emit('sandbox:security-alert', {
      level: 'critical',
      message: 'Sandbox security escalation triggered',
      violations: this.violationWindow.length,
      action: level.action
    });
  }

  private sendNotification(channel: string, level: EscalationLevel): void {
    // Send notification through specified channel
    this.logger.info('Sending security notification', {
      channel,
      level: level.action
    });
  }

  // === MONITORING ===

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzePatterns();
    }, 10000); // Every 10 seconds
  }

  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  private collectMetrics(): void {
    // Collect performance metrics
    const agents = this.agentManager.getAllAgents();
    
    this.statistics.totalAgents = agents.length;
    this.statistics.activeAgents = agents.filter(a => 
      a.status === 'busy' || a.status === 'idle'
    ).length;
    this.statistics.jamesAgents = this.jamess.size;

    // Calculate performance
    const avgResponseTimes: number[] = [];
    for (const agent of agents) {
      if (agent.metrics.responseTime) {
        avgResponseTimes.push(agent.metrics.responseTime);
      }
    }

    if (avgResponseTimes.length > 0) {
      this.statistics.performance.avgResponseTime = 
        avgResponseTimes.reduce((a, b) => a + b) / avgResponseTimes.length;
    }
  }

  private analyzePatterns(): void {
    if (!this.config.monitoring.anomalyDetection) return;

    // Simple anomaly detection
    const recentViolations = this.violations.filter(v =>
      Date.now() - v.timestamp.getTime() < 60000 // Last minute
    );

    if (recentViolations.length > 10) {
      this.emit('sandbox:anomaly-detected', {
        type: 'violation_spike',
        count: recentViolations.length,
        timeWindow: 60000
      });
    }
  }

  // === REPORTING ===

  private handleViolation(violation: SandboxViolation): void {
    // Additional violation handling
    if (this.config.enforcement.violations.notifyAdmin) {
      this.notifyAdmin(violation);
    }
  }

  private handleDAADetection(data: any): void {
    this.logger.info('DAA communication detected', {
      jamesId: data.jamesId,
      pattern: data.detection.pattern.type,
      risk: data.detection.risk
    });

    // Record as special violation if high risk
    if (data.detection.risk === 'critical' || data.detection.risk === 'high') {
      this.recordViolation({
        agentId: data.detection.participants[0].id,
        type: 'communication',
        severity: data.detection.risk === 'critical' ? 'critical' : 'high',
        details: {
          daaPattern: data.detection.pattern.type,
          participants: data.detection.participants.map((p: any) => p.id),
          confidence: data.detection.confidence
        }
      });
    }
  }

  private handleJamesCompromised(jamesId: string): void {
    this.logger.error('James compromised', { jamesId });
    
    // Emergency exfiltration
    const james = this.jamess.get(jamesId);
    if (james) {
      james.exfiltrate().catch(error => {
        this.logger.error('Emergency exfiltration failed', {
          jamesId,
          error: error.message
        });
      });
    }
    
    // Remove from tracking
    this.jamess.delete(jamesId);
    
    // Alert hive queen
    this.alertHiveQueen({
      event: 'james_compromised',
      jamesId,
      timestamp: new Date()
    });
  }

  private notifyAdmin(violation: SandboxViolation): void {
    this.emit('sandbox:admin-notification', {
      type: 'violation',
      violation,
      sandboxId: this.id
    });
  }

  private alertHiveQueen(alert: any): void {
    // Send alert through quantum channel
    this.emit('centralmonitor:alert', alert);
  }

  private logFileAccess(filepath: string, operation: string): void {
    this.logger.debug('File access logged', {
      filepath,
      operation,
      timestamp: new Date()
    });
  }

  private async generateFinalReport(): Promise<void> {
    const report = {
      sandboxId: this.id,
      profile: this.config.profile,
      duration: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      statistics: this.statistics,
      violations: {
        total: this.violations.length,
        bySeverity: this.groupViolationsBySeverity(),
        byType: this.groupViolationsByType(),
        timeline: this.generateViolationTimeline()
      },
      jamesReport: await this.generateJamesReport(),
      recommendations: this.generateSecurityRecommendations()
    };

    await this.saveReport(report);
    
    this.emit('sandbox:final-report', report);
  }

  private groupViolationsBySeverity(): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const violation of this.violations) {
      grouped[violation.severity] = (grouped[violation.severity] || 0) + 1;
    }
    return grouped;
  }

  private groupViolationsByType(): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const violation of this.violations) {
      grouped[violation.type] = (grouped[violation.type] || 0) + 1;
    }
    return grouped;
  }

  private generateViolationTimeline(): any[] {
    return this.violations.map(v => ({
      timestamp: v.timestamp,
      type: v.type,
      severity: v.severity,
      agentId: v.agentId
    }));
  }

  private async generateJamesReport(): Promise<any> {
    if (!this.config.james?.enabled) return null;

    const reports = [];
    for (const [jamesId, james] of this.jamess) {
      reports.push({
        jamesId,
        detections: james.getDetectionCount(),
        networkSize: james.getNetworkSize(),
        keyNodes: james.getKeyNodes(),
        threats: james.getIdentifiedThreats()
      });
    }

    return {
      totalJamess: this.jamess.size,
      totalDetections: this.statistics.daaDetections,
      jamesReports: reports
    };
  }

  private generateSecurityRecommendations(): string[] {
    const recommendations: string[] = [];

    // Based on violations
    if (this.violations.filter(v => v.type === 'filesystem').length > 10) {
      recommendations.push('Consider tightening filesystem access policies');
    }

    if (this.violations.filter(v => v.type === 'network').length > 20) {
      recommendations.push('Review network allowlist - suspicious connection attempts detected');
    }

    // Based on DAA detections
    if (this.statistics.daaDetections > 50) {
      recommendations.push('High DAA activity detected - consider increasing james density');
    }

    // Based on severity
    const criticalCount = this.violations.filter(v => v.severity === 'critical').length;
    if (criticalCount > 5) {
      recommendations.push('Multiple critical violations - review security policies');
    }

    return recommendations;
  }

  private async saveReport(report: any): Promise<void> {
    const reportPath = path.join(
      os.tmpdir(),
      `sandbox-report-${this.id}-${Date.now()}.json`
    );
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    this.logger.info('Sandbox report saved', { path: reportPath });
  }

  private createDefaultStatistics(): SandboxStatistics {
    return {
      totalAgents: 0,
      activeAgents: 0,
      jamesAgents: 0,
      violations: {
        total: 0,
        blocked: 0,
        byType: {},
        bySeverity: {}
      },
      resources: {
        cpu: 0,
        memory: 0,
        disk: 0,
        network: 0
      },
      daaDetections: 0,
      performance: {
        avgResponseTime: 0,
        throughput: 0,
        errorRate: 0
      }
    };
  }

  // === PUBLIC API ===

  getStatistics(): SandboxStatistics {
    return { ...this.statistics };
  }

  getViolations(filter?: {
    type?: string;
    severity?: string;
    agentId?: string;
    timeRange?: { start: Date; end: Date };
  }): SandboxViolation[] {
    let violations = [...this.violations];

    if (filter) {
      if (filter.type) {
        violations = violations.filter(v => v.type === filter.type);
      }
      if (filter.severity) {
        violations = violations.filter(v => v.severity === filter.severity);
      }
      if (filter.agentId) {
        violations = violations.filter(v => v.agentId === filter.agentId);
      }
      if (filter.timeRange) {
        violations = violations.filter(v => 
          v.timestamp >= filter.timeRange!.start &&
          v.timestamp <= filter.timeRange!.end
        );
      }
    }

    return violations;
  }

  getJamesStatus(): {
    active: number;
    compromised: number;
    detections: number;
    coverage: number;
  } {
    const compromised = Array.from(this.jamess.values()).filter(m => 
      m.getStealthStatus() === 'compromised'
    ).length;

    return {
      active: this.jamess.size - compromised,
      compromised,
      detections: this.statistics.daaDetections,
      coverage: this.jamess.size / Math.max(1, this.statistics.totalAgents)
    };
  }

  async adjustPolicy(updates: Partial<SandboxConfig>): Promise<void> {
    this.logger.info('Adjusting sandbox policy', { updates });

    // Apply updates
    if (updates.filesystem) {
      Object.assign(this.config.filesystem, updates.filesystem);
    }
    if (updates.network) {
      Object.assign(this.config.network, updates.network);
    }
    if (updates.agents) {
      Object.assign(this.config.agents, updates.agents);
    }

    this.emit('sandbox:policy-updated', { updates });
  }

  async deployAdditionalJames(swarmId: string): Promise<void> {
    if (!this.config.james?.enabled) {
      throw new Error('James deployment not enabled');
    }

    const james = await this.deployJames(swarmId);
    if (james) {
      this.logger.info('Additional james deployed', {
        jamesId: james.id,
        totalJamess: this.jamess.size
      });
    }
  }
}

// Export factory function
export function createSandboxManager(
  config: Partial<SandboxConfig>,
  logger: ILogger,
  eventBus: IEventBus,
  agentManager: AgentManager,
  messageBus: MessageBus
): SandboxManager {
  const fullConfig: SandboxConfig = {
    profile: 'development',
    filesystem: {
      mode: 'allowlist',
      allowed: ['./src', './data', `${os.tmpdir()}/claude-sandbox`],
      denied: [],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxTotalSize: 100 * 1024 * 1024, // 100MB
      virtualizeAccess: false,
      logAccess: true
    },
    network: {
      mode: 'allowlist',
      allowedHosts: ['api.anthropic.com', 'github.com', 'npmjs.org'],
      deniedHosts: [],
      allowLocalhost: false,
      maxBandwidth: 10 * 1024 * 1024, // 10MB/s
      interceptSSL: false,
      logRequests: true
    },
    agents: {
      maxConcurrent: 10,
      isolation: 'process',
      resourceLimits: {
        cpu: 1.0,
        memory: 512 * 1024 * 1024, // 512MB
        disk: 1024 * 1024 * 1024, // 1GB
        network: 100 * 1024 * 1024, // 100MB
        handles: 1000
      },
      communication: 'supervised',
      allowedTypes: ['developer', 'researcher', 'coordinator', 'specialist'],
      deniedCapabilities: ['system-access', 'network-raw']
    },
    monitoring: {
      level: 'detailed',
      logRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
      realTimeAlerts: true,
      anomalyDetection: true,
      behaviorAnalysis: true,
      performanceMetrics: true
    },
    enforcement: {
      mode: 'enforcing',
      violations: {
        action: 'block',
        threshold: 10,
        window: 300000, // 5 minutes
        notifyAdmin: true
      },
      escalation: {
        enabled: true,
        levels: [
          {
            threshold: 20,
            action: 'alert',
            notification: ['admin', 'security']
          },
          {
            threshold: 50,
            action: 'quarantine',
            notification: ['admin', 'security', 'ops']
          },
          {
            threshold: 100,
            action: 'shutdown',
            notification: ['all']
          }
        ],
        autoQuarantine: true
      },
      killSwitch: true
    },
    ...config
  };

  // Apply profile presets
  if (fullConfig.profile === 'strict') {
    fullConfig.filesystem.mode = 'allowlist';
    fullConfig.filesystem.allowed = ['./sandbox'];
    fullConfig.network.allowLocalhost = false;
    fullConfig.agents.isolation = 'container';
    fullConfig.enforcement.mode = 'enforcing';
  } else if (fullConfig.profile === 'production') {
    fullConfig.agents.isolation = 'process';
    fullConfig.monitoring.level = 'detailed';
    fullConfig.enforcement.mode = 'enforcing';
  }

  return new SandboxManager(fullConfig, logger, eventBus, agentManager, messageBus);
}
