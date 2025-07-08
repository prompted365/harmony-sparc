/**
 * Enhanced Init Command with Sandbox and James Support
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';
import { input, select, confirm, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { createSandboxManager, SandboxConfig } from '../../security/sandbox-manager.js';
import { Logger } from '../../core/logger.js';
import { EventBus } from '../../core/event-bus.js';
import { AgentManager } from '../../agents/agent-manager.js';
import { MessageBus } from '../../communication/message-bus.js';

interface InitOptions {
  name?: string;
  template?: string;
  sandbox?: boolean;
  sandboxProfile?: 'strict' | 'development' | 'production';
  james?: boolean;
  jamesType?: 'shadow' | 'active' | 'hybrid';
  jamesDensity?: number;
  skipInstall?: boolean;
  force?: boolean;
}

export class InitCommand {
  private logger: Logger;
  private sandboxManager?: any;

  constructor() {
    this.logger = new Logger({ level: 'info' });
  }

  async execute(options: InitOptions): Promise<void> {
    try {
      console.log(chalk.cyan('🚀 Initializing Claude Flow Project\n'));

      // Get project details
      const projectConfig = await this.getProjectConfig(options);
      
      // Check if directory exists
      const projectPath = path.join(process.cwd(), projectConfig.name);
      if (await this.directoryExists(projectPath)) {
        if (!options.force) {
          const overwrite = await confirm({
            message: `Directory ${projectConfig.name} already exists. Overwrite?`,
            default: false
          });
          if (!overwrite) {
            console.log(chalk.yellow('✖ Initialization cancelled'));
            return;
          }
        }
        await fs.rm(projectPath, { recursive: true, force: true });
      }

      // Create project structure
      await this.createProjectStructure(projectPath, projectConfig);
      
      // Set up sandbox if requested
      if (options.sandbox || projectConfig.sandbox.enabled) {
        await this.setupSandbox(projectPath, projectConfig);
      }
      
      // Install dependencies
      if (!options.skipInstall) {
        await this.installDependencies(projectPath);
      }

      // Generate configuration files
      await this.generateConfigFiles(projectPath, projectConfig);
      
      // Create sandbox launcher if needed
      if (projectConfig.sandbox.enabled) {
        await this.createSandboxLauncher(projectPath, projectConfig);
      }

      console.log(chalk.green('\n✅ Project initialized successfully!\n'));
      
      // Display next steps
      this.displayNextSteps(projectConfig);

    } catch (error) {
      console.error(chalk.red('✖ Initialization failed:'), error.message);
      process.exit(1);
    }
  }

  private async getProjectConfig(options: InitOptions): Promise<any> {
    const config: any = {
      name: options.name || await input({
        message: 'Project name:',
        default: 'my-claude-flow-project'
      }),
      template: options.template || await select({
        message: 'Select a template:',
        choices: [
          { value: 'basic', name: 'Basic - Simple agent setup' },
          { value: 'swarm', name: 'Swarm - Multi-agent coordination' },
          { value: 'research', name: 'Research - Information gathering' },
          { value: 'development', name: 'Development - Code generation' }
        ]
      }),
      sandbox: {
        enabled: false,
        profile: 'development',
        james: {
          enabled: false,
          type: 'shadow',
          density: 0.1
        }
      }
    };

    // Sandbox configuration
    if (options.sandbox || await confirm({
      message: 'Enable sandbox mode for enhanced security?',
      default: false
    })) {
      config.sandbox.enabled = true;
      
      config.sandbox.profile = options.sandboxProfile || await select({
        message: 'Select sandbox profile:',
        choices: [
          { 
            value: 'strict', 
            name: 'Strict - Maximum security, minimal access' 
          },
          { 
            value: 'development', 
            name: 'Development - Balanced security for development' 
          },
          { 
            value: 'production', 
            name: 'Production - Production-ready security' 
          }
        ]
      });

      // James configuration
      if (options.james || await confirm({
        message: 'Enable DAA james agents for covert monitoring?',
        default: false
      })) {
        config.sandbox.james.enabled = true;
        
        config.sandbox.james.type = options.jamesType || await select({
          message: 'Select james type:',
          choices: [
            { 
              value: 'shadow', 
              name: 'Shadow - Passive observation only' 
            },
            { 
              value: 'active', 
              name: 'Active - Participates in swarm activities' 
            },
            { 
              value: 'hybrid', 
              name: 'Hybrid - Adaptive approach' 
            }
          ]
        });

        if (!options.jamesDensity) {
          const densityStr = await input({
            message: 'James density (0.0-1.0, percentage of agents):',
            default: '0.1',
            validate: (value) => {
              const num = parseFloat(value);
              if (isNaN(num) || num < 0 || num > 1) {
                return 'Please enter a number between 0 and 1';
              }
              return true;
            }
          });
          config.sandbox.james.density = parseFloat(densityStr);
        } else {
          config.sandbox.james.density = options.jamesDensity;
        }

        // Advanced james options
        const advancedJames = await confirm({
          message: 'Configure advanced james options?',
          default: false
        });

        if (advancedJames) {
          config.sandbox.james.reporting = await select({
            message: 'James reporting frequency:',
            choices: [
              { value: 'real-time', name: 'Real-time - Immediate reporting' },
              { value: 'batch', name: 'Batch - Periodic reports' },
              { value: 'adaptive', name: 'Adaptive - Based on threat level' }
            ]
          });

          config.sandbox.james.stealthLevel = await select({
            message: 'Stealth level:',
            choices: [
              { value: 'low', name: 'Low - Basic disguise' },
              { value: 'medium', name: 'Medium - Enhanced camouflage' },
              { value: 'high', name: 'High - Advanced evasion' },
              { value: 'paranoid', name: 'Paranoid - Maximum stealth' }
            ]
          });

          config.sandbox.james.targeting = await select({
            message: 'James targeting strategy:',
            choices: [
              { value: 'random', name: 'Random - Uniform distribution' },
              { value: 'strategic', name: 'Strategic - Target key agents' },
              { value: 'adaptive', name: 'Adaptive - Based on behavior' }
            ]
          });
        }
      }

      // Sandbox permissions
      if (config.sandbox.profile === 'custom' || await confirm({
        message: 'Customize sandbox permissions?',
        default: false
      })) {
        config.sandbox.customPermissions = await this.getCustomPermissions();
      }
    }

    return config;
  }

  private async getCustomPermissions(): Promise<any> {
    const permissions: any = {};

    // Filesystem permissions
    const fsMode = await select({
      message: 'Filesystem access mode:',
      choices: [
        { value: 'allowlist', name: 'Allowlist - Only specified paths' },
        { value: 'denylist', name: 'Denylist - Block specified paths' }
      ]
    });

    if (fsMode === 'allowlist') {
      const allowedPaths = await input({
        message: 'Allowed paths (comma-separated):',
        default: './src, ./data, ./tmp'
      });
      permissions.filesystem = {
        mode: 'allowlist',
        allowed: allowedPaths.split(',').map(p => p.trim())
      };
    } else {
      const deniedPaths = await input({
        message: 'Denied paths (comma-separated):',
        default: '/etc, /usr/bin, ~'
      });
      permissions.filesystem = {
        mode: 'denylist',
        denied: deniedPaths.split(',').map(p => p.trim())
      };
    }

    // Network permissions
    const networkMode = await select({
      message: 'Network access mode:',
      choices: [
        { value: 'allowlist', name: 'Allowlist - Only specified hosts' },
        { value: 'denylist', name: 'Denylist - Block specified hosts' }
      ]
    });

    if (networkMode === 'allowlist') {
      const allowedHosts = await input({
        message: 'Allowed hosts (comma-separated):',
        default: 'api.anthropic.com, github.com'
      });
      permissions.network = {
        mode: 'allowlist',
        allowedHosts: allowedHosts.split(',').map(h => h.trim()),
        allowLocalhost: await confirm({
          message: 'Allow localhost connections?',
          default: false
        })
      };
    }

    // Agent permissions
    permissions.agents = {
      maxConcurrent: parseInt(await input({
        message: 'Maximum concurrent agents:',
        default: '10',
        validate: (value) => {
          const num = parseInt(value);
          return isNaN(num) || num < 1 ? 'Please enter a positive number' : true;
        }
      })),
      isolation: await select({
        message: 'Agent isolation level:',
        choices: [
          { value: 'none', name: 'None - No isolation' },
          { value: 'process', name: 'Process - Separate processes' },
          { value: 'container', name: 'Container - Docker containers' },
          { value: 'vm', name: 'VM - Virtual machines' }
        ]
      })
    };

    return permissions;
  }

  private async createProjectStructure(projectPath: string, config: any): Promise<void> {
    console.log(chalk.blue('📁 Creating project structure...'));

    const directories = [
      'src',
      'src/agents',
      'src/tasks',
      'src/workflows',
      'src/utils',
      'data',
      'logs',
      'tmp',
      '.sandbox'
    ];

    if (config.sandbox.enabled) {
      directories.push('.sandbox/reports', '.sandbox/policies', '.sandbox/james-configs');
    }

    for (const dir of directories) {
      await fs.mkdir(path.join(projectPath, dir), { recursive: true });
    }
  }

  private async generateConfigFiles(projectPath: string, config: any): Promise<void> {
    console.log(chalk.blue('⚙️  Generating configuration files...'));

    // Package.json
    const packageJson = {
      name: config.name,
      version: '0.1.0',
      type: 'module',
      scripts: {
        start: config.sandbox.enabled ? 'node sandbox-launch.js' : 'claude-flow start',
        'start:dev': 'claude-flow start --dev',
        'start:sandbox': 'node sandbox-launch.js',
        'start:no-sandbox': 'claude-flow start',
        test: 'claude-flow test',
        build: 'tsc',
        'james:status': 'claude-flow james status',
        'sandbox:report': 'claude-flow sandbox report'
      },
      dependencies: {
        'claude-flow': '^2.0.0',
        '@anthropic-ai/sdk': '^1.0.0'
      },
      devDependencies: {
        'typescript': '^5.0.0',
        '@types/node': '^20.0.0'
      }
    };

    await fs.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Claude Flow configuration
    const claudeFlowConfig = {
      version: '2.0',
      name: config.name,
      template: config.template,
      sandbox: config.sandbox.enabled ? {
        profile: config.sandbox.profile,
        customPermissions: config.sandbox.customPermissions,
        james: config.sandbox.james.enabled ? {
          type: config.sandbox.james.type,
          density: config.sandbox.james.density,
          reporting: config.sandbox.james.reporting || 'adaptive',
          stealthLevel: config.sandbox.james.stealthLevel || 'medium',
          targeting: config.sandbox.james.targeting || 'random'
        } : undefined
      } : undefined,
      agents: this.getTemplateAgents(config.template),
      workflows: this.getTemplateWorkflows(config.template)
    };

    await fs.writeFile(
      path.join(projectPath, 'claude-flow.json'),
      JSON.stringify(claudeFlowConfig, null, 2)
    );

    // TypeScript configuration
    const tsConfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        lib: ['ES2022'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    };

    await fs.writeFile(
      path.join(projectPath, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );

    // .gitignore
    const gitignore = `
node_modules/
dist/
logs/
tmp/
.sandbox/reports/
.env
.env.local
*.log
.DS_Store
`;

    await fs.writeFile(
      path.join(projectPath, '.gitignore'),
      gitignore.trim()
    );

    // README
    const readme = this.generateReadme(config);
    await fs.writeFile(
      path.join(projectPath, 'README.md'),
      readme
    );

    // Sandbox configuration
    if (config.sandbox.enabled) {
      await this.generateSandboxConfig(projectPath, config);
    }
  }

  private async generateSandboxConfig(projectPath: string, config: any): Promise<void> {
    const sandboxConfig = {
      profile: config.sandbox.profile,
      filesystem: config.sandbox.customPermissions?.filesystem || this.getProfileFilesystem(config.sandbox.profile),
      network: config.sandbox.customPermissions?.network || this.getProfileNetwork(config.sandbox.profile),
      agents: config.sandbox.customPermissions?.agents || this.getProfileAgents(config.sandbox.profile),
      monitoring: {
        level: config.sandbox.profile === 'strict' ? 'forensic' : 'detailed',
        realTimeAlerts: true,
        anomalyDetection: true,
        behaviorAnalysis: config.sandbox.james.enabled
      },
      james: config.sandbox.james.enabled ? {
        enabled: true,
        type: config.sandbox.james.type,
        density: config.sandbox.james.density,
        reporting: {
          endpoint: process.env.HIVE_QUEEN_ENDPOINT || 'secure://centralmonitor.local',
          frequency: config.sandbox.james.reporting || 'adaptive'
        },
        targeting: config.sandbox.james.targeting || 'random',
        stealthLevel: config.sandbox.james.stealthLevel || 'medium'
      } : undefined,
      enforcement: {
        mode: config.sandbox.profile === 'development' ? 'permissive' : 'enforcing',
        violations: {
          action: config.sandbox.profile === 'strict' ? 'terminate' : 'block',
          threshold: 10,
          window: 300000,
          notifyAdmin: true
        },
        killSwitch: config.sandbox.profile !== 'development'
      }
    };

    await fs.writeFile(
      path.join(projectPath, '.sandbox', 'config.json'),
      JSON.stringify(sandboxConfig, null, 2)
    );

    // Create sandbox rules
    const sandboxRules = {
      version: '1.0',
      rules: [
        {
          name: 'filesystem-protection',
          type: 'filesystem',
          condition: 'path.startsWith("/etc") || path.startsWith("/usr/bin")',
          action: 'deny',
          severity: 'critical'
        },
        {
          name: 'network-protection',
          type: 'network',
          condition: 'host.includes(".onion") || host.includes(".i2p")',
          action: 'deny',
          severity: 'high'
        },
        {
          name: 'resource-limits',
          type: 'resource',
          condition: 'memory > 512MB || cpu > 80%',
          action: 'throttle',
          severity: 'medium'
        }
      ]
    };

    await fs.writeFile(
      path.join(projectPath, '.sandbox', 'rules.json'),
      JSON.stringify(sandboxRules, null, 2)
    );
  }

  private async createSandboxLauncher(projectPath: string, config: any): Promise<void> {
    console.log(chalk.blue('🚀 Creating sandbox launcher...'));

    const launcher = `#!/usr/bin/env node
/**
 * Sandbox Launcher for ${config.name}
 * This script initializes the sandbox environment before starting the application
 */

import { createSandboxManager } from 'claude-flow/security';
import { Logger } from 'claude-flow/core';
import { EventBus } from 'claude-flow/core';
import { AgentManager } from 'claude-flow/agents';
import { MessageBus } from 'claude-flow/communication';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

async function main() {
  console.log(chalk.cyan('🔒 Initializing Sandbox Environment...\\n'));

  try {
    // Load sandbox configuration
    const configPath = path.join('.sandbox', 'config.json');
    const sandboxConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));

    // Initialize core components
    const logger = new Logger({ level: 'info' });
    const eventBus = new EventBus(logger);
    const agentManager = new AgentManager({}, logger, eventBus, null);
    const messageBus = new MessageBus({}, logger, eventBus);

    // Create sandbox manager
    const sandboxManager = createSandboxManager(
      sandboxConfig,
      logger,
      eventBus,
      agentManager,
      messageBus
    );

    // Initialize sandbox
    await sandboxManager.initialize();

    console.log(chalk.green('✅ Sandbox initialized successfully'));
    console.log(chalk.blue(\`\\n📊 Sandbox Profile: \${sandboxConfig.profile}\`));
    
    if (sandboxConfig.james?.enabled) {
      console.log(chalk.magenta(\`🕵️  James Agents: \${sandboxConfig.james.type} (\${sandboxConfig.james.density * 100}% density)\`));
    }

    // Set up monitoring
    sandboxManager.on('sandbox:violation', (violation) => {
      console.log(chalk.yellow(\`\\n⚠️  Sandbox Violation: \${violation.type} - \${violation.severity}\`));
      if (violation.details) {
        console.log(chalk.gray(JSON.stringify(violation.details, null, 2)));
      }
    });

    sandboxManager.on('james:daa-detected', (data) => {
      console.log(chalk.red(\`\\n🚨 DAA Communication Detected!\`));
      console.log(chalk.gray(\`Pattern: \${data.detection.pattern.type}\`));
      console.log(chalk.gray(\`Risk: \${data.detection.risk}\`));
    });

    sandboxManager.on('sandbox:security-alert', (alert) => {
      console.log(chalk.red(\`\\n🚨 SECURITY ALERT: \${alert.message}\`));
    });

    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\\n\\n🛑 Shutting down sandbox...'));
      
      const stats = sandboxManager.getStatistics();
      console.log(chalk.blue('\\n📊 Sandbox Statistics:'));
      console.log(chalk.gray(\`  Total Violations: \${stats.violations.total}\`));
      console.log(chalk.gray(\`  Blocked Actions: \${stats.violations.blocked}\`));
      console.log(chalk.gray(\`  DAA Detections: \${stats.daaDetections}\`));
      
      await sandboxManager.shutdown();
      process.exit(0);
    });

    // Start the application
    console.log(chalk.cyan('\\n🚀 Starting application in sandbox...\\n'));
    
    const app = spawn('claude-flow', ['start'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        CLAUDE_FLOW_SANDBOX: 'true',
        CLAUDE_FLOW_SANDBOX_ID: sandboxManager.id
      }
    });

    app.on('exit', async (code) => {
      console.log(chalk.blue(\`\\n✅ Application exited with code \${code}\`));
      
      // Generate report
      const report = await sandboxManager.generateReport();
      const reportPath = path.join('.sandbox', 'reports', \`report-\${Date.now()}.json\`);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(chalk.green(\`\\n📄 Sandbox report saved: \${reportPath}\`));
      
      await sandboxManager.shutdown();
      process.exit(code);
    });

  } catch (error) {
    console.error(chalk.red('✖ Sandbox initialization failed:'), error.message);
    process.exit(1);
  }
}

main().catch(console.error);
`;

    await fs.writeFile(
      path.join(projectPath, 'sandbox-launch.js'),
      launcher
    );

    // Make it executable
    await fs.chmod(path.join(projectPath, 'sandbox-launch.js'), 0o755);
  }

  private getProfileFilesystem(profile: string): any {
    const profiles = {
      strict: {
        mode: 'allowlist',
        allowed: ['./src', './data'],
        denied: [],
        maxFileSize: 1024 * 1024, // 1MB
        virtualizeAccess: true,
        logAccess: true
      },
      development: {
        mode: 'allowlist',
        allowed: ['./src', './data', './tmp', os.tmpdir()],
        denied: [],
        maxFileSize: 10 * 1024 * 1024, // 10MB
        virtualizeAccess: false,
        logAccess: true
      },
      production: {
        mode: 'allowlist',
        allowed: ['./src', './data', './logs'],
        denied: ['/etc', '/usr/bin', os.homedir()],
        maxFileSize: 5 * 1024 * 1024, // 5MB
        virtualizeAccess: false,
        logAccess: true
      }
    };

    return profiles[profile] || profiles.development;
  }

  private getProfileNetwork(profile: string): any {
    const profiles = {
      strict: {
        mode: 'allowlist',
        allowedHosts: ['api.anthropic.com'],
        deniedHosts: [],
        allowLocalhost: false,
        interceptSSL: true,
        logRequests: true
      },
      development: {
        mode: 'allowlist',
        allowedHosts: ['api.anthropic.com', 'github.com', 'npmjs.org'],
        deniedHosts: [],
        allowLocalhost: true,
        interceptSSL: false,
        logRequests: true
      },
      production: {
        mode: 'allowlist',
        allowedHosts: ['api.anthropic.com', 'github.com'],
        deniedHosts: ['*.onion', '*.i2p'],
        allowLocalhost: false,
        interceptSSL: false,
        logRequests: true
      }
    };

    return profiles[profile] || profiles.development;
  }

  private getProfileAgents(profile: string): any {
    const profiles = {
      strict: {
        maxConcurrent: 5,
        isolation: 'container',
        communication: 'restricted',
        resourceLimits: {
          cpu: 0.5,
          memory: 256 * 1024 * 1024, // 256MB
          disk: 100 * 1024 * 1024 // 100MB
        }
      },
      development: {
        maxConcurrent: 10,
        isolation: 'process',
        communication: 'supervised',
        resourceLimits: {
          cpu: 1.0,
          memory: 512 * 1024 * 1024, // 512MB
          disk: 1024 * 1024 * 1024 // 1GB
        }
      },
      production: {
        maxConcurrent: 20,
        isolation: 'process',
        communication: 'supervised',
        resourceLimits: {
          cpu: 2.0,
          memory: 1024 * 1024 * 1024, // 1GB
          disk: 5 * 1024 * 1024 * 1024 // 5GB
        }
      }
    };

    return profiles[profile] || profiles.development;
  }

  private getTemplateAgents(template: string): any[] {
    const templates = {
      basic: [
        {
          name: 'general-agent',
          type: 'specialist',
          capabilities: ['research', 'analysis', 'communication']
        }
      ],
      swarm: [
        {
          name: 'coordinator',
          type: 'coordinator',
          capabilities: ['task-distribution', 'monitoring', 'reporting']
        },
        {
          name: 'worker-1',
          type: 'specialist',
          capabilities: ['task-execution', 'analysis']
        },
        {
          name: 'worker-2',
          type: 'specialist',
          capabilities: ['task-execution', 'research']
        }
      ],
      research: [
        {
          name: 'researcher',
          type: 'researcher',
          capabilities: ['web-search', 'document-analysis', 'summarization']
        },
        {
          name: 'analyst',
          type: 'analyzer',
          capabilities: ['data-analysis', 'visualization', 'reporting']
        }
      ],
      development: [
        {
          name: 'developer',
          type: 'developer',
          capabilities: ['code-generation', 'testing', 'debugging']
        },
        {
          name: 'reviewer',
          type: 'reviewer',
          capabilities: ['code-review', 'documentation', 'best-practices']
        }
      ]
    };

    return templates[template] || templates.basic;
  }

  private getTemplateWorkflows(template: string): any[] {
    const workflows = {
      basic: [
        {
          name: 'simple-task',
          description: 'Basic task execution workflow',
          steps: ['receive-task', 'process', 'return-result']
        }
      ],
      swarm: [
        {
          name: 'distributed-processing',
          description: 'Distribute tasks across multiple agents',
          steps: ['receive-task', 'analyze', 'distribute', 'coordinate', 'aggregate', 'return-result']
        }
      ],
      research: [
        {
          name: 'research-pipeline',
          description: 'Comprehensive research workflow',
          steps: ['define-query', 'search', 'analyze', 'synthesize', 'report']
        }
      ],
      development: [
        {
          name: 'development-cycle',
          description: 'Code development and review workflow',
          steps: ['requirements', 'design', 'implement', 'test', 'review', 'deploy']
        }
      ]
    };

    return workflows[template] || workflows.basic;
  }

  private generateReadme(config: any): string {
    let readme = `# ${config.name}

A Claude Flow project initialized with the ${config.template} template.

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start the application
${config.sandbox.enabled ? 'npm start  # Runs in sandbox mode' : 'npm start'}
${config.sandbox.enabled ? 'npm run start:no-sandbox  # Run without sandbox' : ''}

# Development mode
npm run start:dev
\`\`\`

## Project Structure

\`\`\`
${config.name}/
├── src/              # Source code
│   ├── agents/       # Agent definitions
│   ├── tasks/        # Task implementations
│   ├── workflows/    # Workflow configurations
│   └── utils/        # Utility functions
├── data/             # Data storage
├── logs/             # Log files
├── tmp/              # Temporary files
${config.sandbox.enabled ? '├── .sandbox/         # Sandbox configuration and reports' : ''}
└── claude-flow.json  # Project configuration
\`\`\`
`;

    if (config.sandbox.enabled) {
      readme += `
## Sandbox Mode

This project is configured to run in sandbox mode for enhanced security.

### Sandbox Profile: ${config.sandbox.profile}

${config.sandbox.profile === 'strict' ? '- **Strict**: Maximum security with minimal access permissions' :
  config.sandbox.profile === 'development' ? '- **Development**: Balanced security for development work' :
  '- **Production**: Production-ready security configuration'}

### Security Features

- Filesystem access control (${config.sandbox.customPermissions?.filesystem?.mode || 'allowlist'} mode)
- Network access control (${config.sandbox.customPermissions?.network?.mode || 'allowlist'} mode)
- Agent isolation (${config.sandbox.customPermissions?.agents?.isolation || 'process'} level)
- Real-time violation monitoring
- Automatic threat response
`;

      if (config.sandbox.james.enabled) {
        readme += `
### DAA James Monitoring

This project includes covert james agents for monitoring Dark Agent-to-Agent (DAA) communications.

- **James Type**: ${config.sandbox.james.type}
- **Density**: ${config.sandbox.james.density * 100}% of agents
- **Reporting**: ${config.sandbox.james.reporting || 'adaptive'}
- **Stealth Level**: ${config.sandbox.james.stealthLevel || 'medium'}

To check james status:
\`\`\`bash
npm run james:status
\`\`\`
`;
      }

      readme += `
### Sandbox Commands

\`\`\`bash
# View sandbox report
npm run sandbox:report

# Run without sandbox (development only)
npm run start:no-sandbox

# View real-time sandbox logs
tail -f .sandbox/logs/sandbox.log
\`\`\`

### Customizing Sandbox Rules

Edit \`.sandbox/rules.json\` to customize security rules and \`.sandbox/config.json\` for sandbox configuration.
`;
    }

    readme += `
## Template: ${config.template}

This project uses the **${config.template}** template, which includes:

${config.template === 'basic' ? '- Simple agent setup for general tasks' :
  config.template === 'swarm' ? '- Multi-agent coordination with distributed processing' :
  config.template === 'research' ? '- Research-focused agents with web search and analysis capabilities' :
  '- Development-focused agents for code generation and review'}

## Configuration

Project configuration is stored in \`claude-flow.json\`. You can modify:

- Agent definitions
- Workflow configurations
- Sandbox settings (if enabled)
- Resource limits

## Learn More

- [Claude Flow Documentation](https://github.com/ruvnet/claude-flow)
- [Agent Development Guide](https://github.com/ruvnet/claude-flow/docs/agents)
- [Sandbox Security Guide](https://github.com/ruvnet/claude-flow/docs/security)

## License

This project is licensed under the MIT License.
`;

    return readme;
  }

  private async installDependencies(projectPath: string): Promise<void> {
    console.log(chalk.blue('📦 Installing dependencies...'));
    
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install'], {
        cwd: projectPath,
        stdio: 'inherit'
      });

      npm.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`npm install failed with code ${code}`));
        } else {
          resolve();
        }
      });
    });
  }

  private displayNextSteps(config: any): void {
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.gray(`  cd ${config.name}`));
    
    if (config.sandbox.enabled) {
      console.log(chalk.gray('  npm start          # Run in sandbox mode'));
      console.log(chalk.gray('  npm run start:dev  # Run in development mode'));
      
      if (config.sandbox.james.enabled) {
        console.log(chalk.gray('  npm run james:status  # Check james agent status'));
      }
    } else {
      console.log(chalk.gray('  npm start  # Start the application'));
    }
    
    console.log(chalk.gray('\n  Happy coding! 🚀'));

    if (config.sandbox.enabled) {
      console.log(chalk.yellow('\n⚠️  Remember: Your application is running in a sandboxed environment.'));
      console.log(chalk.yellow('   Some operations may be restricted for security.'));
      
      if (config.sandbox.james.enabled) {
        console.log(chalk.magenta('\n🕵️  James agents are secretly monitoring for covert communications.'));
        console.log(chalk.magenta(`   Current density: ${config.sandbox.james.density * 100}% of agents`));
      }
    }
  }

  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}

// CLI command setup
export function createInitCommand(program: Command): void {
  program
    .command('init [name]')
    .description('Initialize a new Claude Flow project with optional sandbox and james support')
    .option('-t, --template <template>', 'Project template (basic, swarm, research, development)')
    .option('--sandbox', 'Enable sandbox mode for enhanced security')
    .option('--sandbox-profile <profile>', 'Sandbox security profile (strict, development, production)')
    .option('--james', 'Enable DAA james agents for covert monitoring')
    .option('--james-type <type>', 'James agent type (shadow, active, hybrid)')
    .option('--james-density <density>', 'James density (0.0-1.0)', parseFloat)
    .option('--skip-install', 'Skip npm install')
    .option('-f, --force', 'Overwrite existing directory')
    .action(async (name, options) => {
      const command = new InitCommand();
      await command.execute({ name, ...options });
    });
}
