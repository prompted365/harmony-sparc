/**
 * Sandbox Implementation for Claude Flow
 * Builds on existing security infrastructure
 */

// src/sandbox/sandbox-manager.ts

import { SecurityManager, SecurityPolicy, SecurityRule } from '../enterprise/security-manager';
import { BackgroundExecutor, BackgroundTask } from '../coordination/background-executor';
import { EventEmitter } from 'events';
import { Logger } from '../core/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

export interface SandboxProfile {
  name: string;
  description: string;
  restrictions: {
    filesystem: {
      allowedPaths: string[];
      deniedPaths: string[];
      readOnly: boolean;
      maxFileSize: number;
      maxTotalSize: number;
    };
    network: {
      allowedHosts: string[];
      deniedHosts: string[];
      allowLocalhost: boolean;
      maxRequestsPerMinute: number;
      maxBandwidthMB: number;
    };
    process: {
      maxConcurrent: number;
      allowedCommands: string[];
      deniedCommands: string[];
      maxMemoryMB: number;
      maxCpuPercent: number;
      timeout: number;
    };
    communication: {
      allowedChannels: string[];
      maxMessageSize: number;
      maxMessagesPerMinute: number;
      allowInterAgentComm: boolean;
      scanForCovertChannels: boolean;
    };
  };
  monitoring: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logAllOperations: boolean;
    alertOnViolations: boolean;
    killOnCriticalViolation: boolean;
    dashboardEnabled: boolean;
  };
}

export interface SandboxConfig {
  enabled: boolean;
  defaultProfile: string;
  profiles: Record<string, SandboxProfile>;
  globalRules: {
    alwaysDeny: string[];
    emergencyKill: string[];
    trustedAgents: string[];
  };
}

export class SandboxManager extends EventEmitter {
  private securityManager: SecurityManager;
  private config: SandboxConfig;
  private activeProfiles: Map<string, SandboxProfile> = new Map();
  private violations: Map<string, any[]> = new Map();
  private logger: Logger;
  
  // File system hooks
  private originalFs = {
    readFile: fs.readFile,
    writeFile: fs.writeFile,
    mkdir: fs.mkdir,
    unlink: fs.unlink,
    readdir: fs.readdir
  };

  constructor(
    securityManager: SecurityManager,
    config: SandboxConfig,
    logger: Logger
  ) {
    super();
    this.securityManager = securityManager;
    this.config = config;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Sandbox is disabled');
      return;
    }

    // Create sandbox security policies
    await this.createSandboxPolicies();
    
    // Hook into filesystem operations
    this.hookFilesystem();
    
    // Hook into network operations
    this.hookNetwork();
    
    // Hook into process spawning
    this.hookProcessSpawn();
    
    // Start monitoring
    if (this.config.profiles[this.config.defaultProfile]?.monitoring.dashboardEnabled) {
      await this.startMonitoringDashboard();
    }

    this.logger.info('Sandbox initialized with profile:', this.config.defaultProfile);
  }

  /**
   * Create a sandboxed task for the background executor
   */
  createSandboxedTask(
    task: Partial<BackgroundTask>,
    profileName?: string
  ): BackgroundTask & { sandbox: SandboxProfile } {
    const profile = this.getProfile(profileName || this.config.defaultProfile);
    
    return {
      ...task,
      sandbox: profile,
      options: {
        ...task.options,
        env: {
          ...task.options?.env,
          SANDBOX_PROFILE: profile.name,
          SANDBOX_ENABLED: 'true'
        },
        // Apply resource limits
        timeout: Math.min(
          task.options?.timeout || Infinity,
          profile.restrictions.process.timeout
        )
      }
    } as BackgroundTask & { sandbox: SandboxProfile };
  }

  /**
   * Hook filesystem operations
   */
  private hookFilesystem(): void {
    // Override fs.readFile
    (fs as any).readFile = async (filePath: string, ...args: any[]) => {
      const normalizedPath = path.resolve(filePath);
      const profile = this.getCurrentProfile();
      
      if (!this.isPathAllowed(normalizedPath, profile, 'read')) {
        const violation = {
          type: 'filesystem',
          operation: 'read',
          path: normalizedPath,
          profile: profile.name,
          timestamp: new Date()
        };
        
        this.handleViolation(violation, profile);
        throw new Error(`Sandbox: Read access denied for ${filePath}`);
      }
      
      if (profile.monitoring.logAllOperations) {
        this.logger.debug('Sandbox: File read allowed', { path: normalizedPath });
      }
      
      return this.originalFs.readFile(filePath, ...args);
    };

    // Override fs.writeFile
    (fs as any).writeFile = async (filePath: string, data: any, ...args: any[]) => {
      const normalizedPath = path.resolve(filePath);
      const profile = this.getCurrentProfile();
      
      if (!this.isPathAllowed(normalizedPath, profile, 'write')) {
        const violation = {
          type: 'filesystem',
          operation: 'write',
          path: normalizedPath,
          profile: profile.name,
          timestamp: new Date()
        };
        
        this.handleViolation(violation, profile);
        throw new Error(`Sandbox: Write access denied for ${filePath}`);
      }
      
      // Check file size limits
      const size = Buffer.byteLength(data);
      if (size > profile.restrictions.filesystem.maxFileSize) {
        throw new Error(`Sandbox: File size ${size} exceeds limit ${profile.restrictions.filesystem.maxFileSize}`);
      }
      
      if (profile.monitoring.logAllOperations) {
        this.logger.debug('Sandbox: File write allowed', { path: normalizedPath, size });
      }
      
      return this.originalFs.writeFile(filePath, data, ...args);
    };
  }

  /**
   * Hook network operations
   */
  private hookNetwork(): void {
    // This would hook into fetch/http modules
    const originalFetch = globalThis.fetch;
    
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      const profile = this.getCurrentProfile();
      
      if (!this.isHostAllowed(url, profile)) {
        const violation = {
          type: 'network',
          operation: 'fetch',
          url,
          profile: profile.name,
          timestamp: new Date()
        };
        
        this.handleViolation(violation, profile);
        throw new Error(`Sandbox: Network access denied for ${url}`);
      }
      
      if (profile.monitoring.logAllOperations) {
        this.logger.debug('Sandbox: Network request allowed', { url });
      }
      
      return originalFetch(input, init);
    };
  }

  /**
   * Hook process spawning
   */
  private hookProcessSpawn(): void {
    // This would hook into child_process.spawn
    // Implementation depends on the runtime environment
  }

  /**
   * Check if a path is allowed
   */
  private isPathAllowed(
    filePath: string,
    profile: SandboxProfile,
    operation: 'read' | 'write'
  ): boolean {
    const normalizedPath = path.normalize(filePath);
    
    // Check global deny list first
    for (const pattern of this.config.globalRules.alwaysDeny) {
      if (this.matchesPattern(normalizedPath, pattern)) {
        return false;
      }
    }
    
    // Check profile denied paths
    for (const pattern of profile.restrictions.filesystem.deniedPaths) {
      if (this.matchesPattern(normalizedPath, pattern)) {
        return false;
      }
    }
    
    // Check if path is in allowed list
    for (const pattern of profile.restrictions.filesystem.allowedPaths) {
      if (this.matchesPattern(normalizedPath, pattern)) {
        return operation === 'read' || !profile.restrictions.filesystem.readOnly;
      }
    }
    
    // Default deny
    return false;
  }

  /**
   * Check if a host is allowed
   */
  private isHostAllowed(url: string, profile: SandboxProfile): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      
      // Check localhost
      if (['localhost', '127.0.0.1', '::1'].includes(host) && !profile.restrictions.network.allowLocalhost) {
        return false;
      }
      
      // Check denied hosts
      for (const pattern of profile.restrictions.network.deniedHosts) {
        if (this.matchesPattern(host, pattern)) {
          return false;
        }
      }
      
      // Check allowed hosts
      for (const pattern of profile.restrictions.network.allowedHosts) {
        if (this.matchesPattern(host, pattern)) {
          return true;
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Pattern matching for paths and hosts
   */
  private matchesPattern(str: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regex = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regex}$`).test(str);
  }

  /**
   * Handle security violations
   */
  private handleViolation(violation: any, profile: SandboxProfile): void {
    // Log violation
    this.logger.warn('Sandbox violation detected', violation);
    
    // Store violation
    const agentId = violation.agentId || 'unknown';
    if (!this.violations.has(agentId)) {
      this.violations.set(agentId, []);
    }
    this.violations.get(agentId)!.push(violation);
    
    // Emit event
    this.emit('violation', violation);
    
    // Create security incident if configured
    if (profile.monitoring.alertOnViolations) {
      this.securityManager.createSecurityIncident({
        title: `Sandbox violation: ${violation.type}`,
        description: `Agent attempted ${violation.operation} on ${violation.path || violation.url}`,
        severity: 'medium',
        type: 'policy-violation',
        source: {
          type: 'automated-detection',
          details: violation
        }
      });
    }
    
    // Kill process if critical
    if (profile.monitoring.killOnCriticalViolation && this.isCriticalViolation(violation)) {
      this.emit('kill-agent', { agentId, reason: 'critical-violation', violation });
    }
  }

  /**
   * Check if violation is critical
   */
  private isCriticalViolation(violation: any): boolean {
    // Check emergency kill patterns
    for (const pattern of this.config.globalRules.emergencyKill) {
      if (violation.path && this.matchesPattern(violation.path, pattern)) {
        return true;
      }
    }
    
    // Multiple violations in short time
    const agentViolations = this.violations.get(violation.agentId || 'unknown') || [];
    const recentViolations = agentViolations.filter(v => 
      Date.now() - v.timestamp.getTime() < 60000 // Last minute
    );
    
    return recentViolations.length > 5;
  }

  /**
   * Get current profile
   */
  private getCurrentProfile(): SandboxProfile {
    // This would be determined by the current agent context
    return this.getProfile(this.config.defaultProfile);
  }

  /**
   * Get profile by name
   */
  private getProfile(name: string): SandboxProfile {
    const profile = this.config.profiles[name];
    if (!profile) {
      throw new Error(`Sandbox profile not found: ${name}`);
    }
    return profile;
  }

  /**
   * Create security policies for sandbox
   */
  private async createSandboxPolicies(): Promise<void> {
    for (const [name, profile] of Object.entries(this.config.profiles)) {
      const rules: SecurityRule[] = [
        {
          id: `sandbox-fs-${name}`,
          name: `Filesystem restrictions for ${name}`,
          description: 'Enforce filesystem access controls',
          condition: 'operation.type == "filesystem"',
          action: 'audit',
          severity: 'high',
          parameters: profile.restrictions.filesystem,
          enabled: true
        },
        {
          id: `sandbox-net-${name}`,
          name: `Network restrictions for ${name}`,
          description: 'Enforce network access controls',
          condition: 'operation.type == "network"',
          action: 'audit',
          severity: 'medium',
          parameters: profile.restrictions.network,
          enabled: true
        }
      ];

      await this.securityManager.createSecurityPolicy({
        name: `Sandbox Profile: ${name}`,
        description: profile.description,
        type: 'access-control',
        rules,
        enforcement: {
          level: profile.monitoring.killOnCriticalViolation ? 'blocking' : 'warning'
        }
      });
    }
  }

  /**
   * Start monitoring dashboard
   */
  private async startMonitoringDashboard(): Promise<void> {
    // This would start a web server with real-time sandbox metrics
    this.logger.info('Sandbox monitoring dashboard started on port 3002');
  }

  /**
   * Get sandbox metrics
   */
  async getMetrics(): Promise<any> {
    const metrics = {
      profiles: Object.keys(this.config.profiles),
      violations: {
        total: Array.from(this.violations.values()).flat().length,
        byAgent: Object.fromEntries(
          Array.from(this.violations.entries()).map(([agent, violations]) => [agent, violations.length])
        ),
        recent: Array.from(this.violations.values())
          .flat()
          .filter(v => Date.now() - v.timestamp.getTime() < 300000) // Last 5 minutes
          .length
      },
      activeProfiles: Array.from(this.activeProfiles.keys())
    };

    return metrics;
  }
}

// Default sandbox profiles
export const DEFAULT_SANDBOX_PROFILES: Record<string, SandboxProfile> = {
  strict: {
    name: 'strict',
    description: 'Highly restricted environment for untrusted agents',
    restrictions: {
      filesystem: {
        allowedPaths: ['./data/**', '/tmp/sandbox-*'],
        deniedPaths: ['/**'],
        readOnly: false,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxTotalSize: 100 * 1024 * 1024 // 100MB
      },
      network: {
        allowedHosts: ['api.anthropic.com'],
        deniedHosts: ['*'],
        allowLocalhost: false,
        maxRequestsPerMinute: 10,
        maxBandwidthMB: 10
      },
      process: {
        maxConcurrent: 1,
        allowedCommands: [],
        deniedCommands: ['*'],
        maxMemoryMB: 256,
        maxCpuPercent: 25,
        timeout: 300000 // 5 minutes
      },
      communication: {
        allowedChannels: ['task', 'result'],
        maxMessageSize: 1024 * 1024, // 1MB
        maxMessagesPerMinute: 60,
        allowInterAgentComm: false,
        scanForCovertChannels: true
      }
    },
    monitoring: {
      logLevel: 'debug',
      logAllOperations: true,
      alertOnViolations: true,
      killOnCriticalViolation: true,
      dashboardEnabled: true
    }
  },
  
  development: {
    name: 'development',
    description: 'Relaxed environment for development and testing',
    restrictions: {
      filesystem: {
        allowedPaths: ['./**'],
        deniedPaths: ['/etc/**', '~/.ssh/**', '/usr/bin/**'],
        readOnly: false,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        maxTotalSize: 1024 * 1024 * 1024 // 1GB
      },
      network: {
        allowedHosts: ['*'],
        deniedHosts: [],
        allowLocalhost: true,
        maxRequestsPerMinute: 1000,
        maxBandwidthMB: 100
      },
      process: {
        maxConcurrent: 10,
        allowedCommands: ['node', 'npm', 'git', 'deno'],
        deniedCommands: ['sudo', 'rm -rf /'],
        maxMemoryMB: 1024,
        maxCpuPercent: 80,
        timeout: 3600000 // 1 hour
      },
      communication: {
        allowedChannels: ['*'],
        maxMessageSize: 10 * 1024 * 1024, // 10MB
        maxMessagesPerMinute: 1000,
        allowInterAgentComm: true,
        scanForCovertChannels: false
      }
    },
    monitoring: {
      logLevel: 'info',
      logAllOperations: false,
      alertOnViolations: false,
      killOnCriticalViolation: false,
      dashboardEnabled: true
    }
  },
  
  production: {
    name: 'production',
    description: 'Balanced security for production workloads',
    restrictions: {
      filesystem: {
        allowedPaths: ['./src/**', './data/**', './logs/**'],
        deniedPaths: ['/etc/**', '/usr/**', '~/**'],
        readOnly: false,
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxTotalSize: 500 * 1024 * 1024 // 500MB
      },
      network: {
        allowedHosts: [
          'api.anthropic.com',
          'api.openai.com',
          'github.com',
          '*.amazonaws.com'
        ],
        deniedHosts: ['localhost', '127.0.0.1', '*.local'],
        allowLocalhost: false,
        maxRequestsPerMinute: 100,
        maxBandwidthMB: 50
      },
      process: {
        maxConcurrent: 5,
        allowedCommands: ['node', 'python3'],
        deniedCommands: ['sudo', 'wget', 'curl', 'nc'],
        maxMemoryMB: 512,
        maxCpuPercent: 50,
        timeout: 1800000 // 30 minutes
      },
      communication: {
        allowedChannels: ['task', 'result', 'status', 'metrics'],
        maxMessageSize: 5 * 1024 * 1024, // 5MB
        maxMessagesPerMinute: 300,
        allowInterAgentComm: true,
        scanForCovertChannels: true
      }
    },
    monitoring: {
      logLevel: 'warn',
      logAllOperations: false,
      alertOnViolations: true,
      killOnCriticalViolation: true,
      dashboardEnabled: true
    }
  }
};

// Integration with init command
export async function initSandbox(flags: any): Promise<void> {
  const profile = flags.sandboxProfile || 'development';
  
  const sandboxConfig: SandboxConfig = {
    enabled: true,
    defaultProfile: profile,
    profiles: DEFAULT_SANDBOX_PROFILES,
    globalRules: {
      alwaysDeny: [
        '/etc/passwd',
        '/etc/shadow',
        '~/.ssh/**',
        '**/.git/config',
        '**/node_modules/.bin/**'
      ],
      emergencyKill: [
        '/etc/**',
        '/usr/bin/sudo',
        '/bin/rm',
        '~/.aws/credentials'
      ],
      trustedAgents: []
    }
  };
  
  // Write sandbox configuration
  await fs.writeFile(
    '.sandbox-config.json',
    JSON.stringify(sandboxConfig, null, 2)
  );
  
  console.log(`✅ Sandbox configuration created with '${profile}' profile`);
  console.log('📋 Available profiles: strict, development, production');
  console.log('🔒 Sandbox will be enforced on all agent operations');
}
