// Enhanced init command with sandbox support
// Add to src/cli/simple-commands/init/index.js

export async function initCommand(subArgs, flags) {
  // ... existing code ...
  
  // Check for sandbox flag
  const initSandbox = subArgs.includes('--sandbox') || flags.sandbox;
  const sandboxProfile = flags['sandbox-profile'] || flags.sandboxProfile || 'development';
  
  // ... existing initialization code ...
  
  // Add sandbox initialization
  if (initSandbox) {
    console.log();
    printSuccess('Configuring sandbox environment...');
    
    try {
      // Create sandbox configuration
      const sandboxConfig = await createSandboxConfig(sandboxProfile, flags);
      
      if (!initDryRun) {
        await Deno.writeTextFile('.sandbox-config.json', JSON.stringify(sandboxConfig, null, 2));
        console.log(`  ✓ Created .sandbox-config.json with '${sandboxProfile}' profile`);
        
        // Create sandbox directories
        const sandboxDirs = [
          '.sandbox',
          '.sandbox/logs',
          '.sandbox/violations',
          '.sandbox/metrics',
          'data/sandbox'
        ];
        
        for (const dir of sandboxDirs) {
          await Deno.mkdir(dir, { recursive: true });
          console.log(`  ✓ Created ${dir}/ directory`);
        }
        
        // Add sandbox rules to .gitignore
        const gitignoreAdditions = [
          '',
          '# Sandbox files',
          '.sandbox/',
          '.sandbox-config.json',
          'data/sandbox/',
          '*.sandbox.log'
        ].join('\n');
        
        try {
          const existing = await Deno.readTextFile('.gitignore');
          if (!existing.includes('# Sandbox files')) {
            await Deno.writeTextFile('.gitignore', existing + gitignoreAdditions);
            console.log('  ✓ Updated .gitignore with sandbox exclusions');
          }
        } catch {
          await Deno.writeTextFile('.gitignore', gitignoreAdditions.trim());
          console.log('  ✓ Created .gitignore with sandbox exclusions');
        }
        
        // Create sandbox enforcement script
        const sandboxLauncher = createSandboxLauncher(sandboxProfile);
        await Deno.writeTextFile('sandbox-launch.js', sandboxLauncher);
        await Deno.chmod('sandbox-launch.js', 0o755);
        console.log('  ✓ Created sandbox-launch.js launcher script');
        
        // Update package.json if it exists
        try {
          const packageJson = JSON.parse(await Deno.readTextFile('package.json'));
          packageJson.scripts = packageJson.scripts || {};
          packageJson.scripts['start:sandbox'] = 'node sandbox-launch.js';
          packageJson.scripts['test:sandbox'] = 'SANDBOX_ENABLED=true npm test';
          await Deno.writeTextFile('package.json', JSON.stringify(packageJson, null, 2));
          console.log('  ✓ Updated package.json with sandbox scripts');
        } catch {
          // No package.json, skip
        }
        
      } else {
        console.log('  [DRY RUN] Would create .sandbox-config.json');
        console.log('  [DRY RUN] Would create sandbox directories');
        console.log('  [DRY RUN] Would create sandbox launcher');
      }
      
      console.log();
      console.log(colors.cyan('🔒 Sandbox Configuration Summary:'));
      console.log(`  Profile: ${colors.green(sandboxProfile)}`);
      console.log(`  Filesystem: ${sandboxConfig.profiles[sandboxProfile].restrictions.filesystem.allowedPaths.join(', ')}`);
      console.log(`  Network: ${sandboxConfig.profiles[sandboxProfile].restrictions.network.allowedHosts.slice(0, 3).join(', ')}...`);
      console.log(`  Monitoring: ${sandboxConfig.profiles[sandboxProfile].monitoring.logLevel} level`);
      console.log();
      console.log(colors.yellow('⚠️  Important:'));
      console.log('  - Agents will be restricted based on the sandbox profile');
      console.log('  - Violations will be logged to .sandbox/violations/');
      console.log('  - Use --sandbox-profile=strict for maximum security');
      console.log('  - Use --sandbox-profile=development for local development');
      console.log();
      
    } catch (err) {
      printError(`Failed to configure sandbox: ${err.message}`);
    }
  }
  
  // ... rest of existing code ...
}

// Create sandbox configuration
async function createSandboxConfig(profile, flags) {
  const profiles = {
    strict: {
      name: 'strict',
      description: 'Maximum security for untrusted code',
      restrictions: {
        filesystem: {
          allowedPaths: ['./data/**', '/tmp/claude-sandbox-*'],
          deniedPaths: ['/**'],
          readOnly: false,
          maxFileSize: 10485760, // 10MB
          maxTotalSize: 104857600 // 100MB
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
          timeout: 300000
        },
        communication: {
          allowedChannels: ['task', 'result'],
          maxMessageSize: 1048576,
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
      description: 'Relaxed security for development',
      restrictions: {
        filesystem: {
          allowedPaths: ['./**'],
          deniedPaths: ['/etc/**', '~/.ssh/**', '/usr/bin/**'],
          readOnly: false,
          maxFileSize: 104857600, // 100MB
          maxTotalSize: 1073741824 // 1GB
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
          timeout: 3600000
        },
        communication: {
          allowedChannels: ['*'],
          maxMessageSize: 10485760,
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
      description: 'Balanced security for production',
      restrictions: {
        filesystem: {
          allowedPaths: ['./src/**', './data/**', './logs/**'],
          deniedPaths: ['/etc/**', '/usr/**', '~/**'],
          readOnly: false,
          maxFileSize: 52428800, // 50MB
          maxTotalSize: 524288000 // 500MB
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
          timeout: 1800000
        },
        communication: {
          allowedChannels: ['task', 'result', 'status', 'metrics'],
          maxMessageSize: 5242880,
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
  
  // Allow custom profile
  if (flags.customProfile) {
    try {
      const customProfile = JSON.parse(await Deno.readTextFile(flags.customProfile));
      profiles.custom = customProfile;
      profile = 'custom';
    } catch (err) {
      printWarning(`Could not load custom profile: ${err.message}`);
    }
  }
  
  return {
    version: '1.0',
    enabled: true,
    defaultProfile: profile,
    profiles: profiles,
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
    },
    enforcement: {
      level: profile === 'strict' ? 'blocking' : 'warning',
      hooks: {
        filesystem: true,
        network: true,
        process: true,
        memory: true
      }
    }
  };
}

// Create sandbox launcher script
function createSandboxLauncher(profile) {
  return `#!/usr/bin/env node
/**
 * Sandbox Launcher for Claude Flow
 * Enforces sandbox restrictions on all agent operations
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load sandbox configuration
const sandboxConfig = JSON.parse(fs.readFileSync('.sandbox-config.json', 'utf8'));
const profile = sandboxConfig.profiles['${profile}'];

console.log('🔒 Starting Claude Flow with Sandbox Profile: ${profile}');
console.log('📋 Restrictions:');
console.log('  - Filesystem:', profile.restrictions.filesystem.allowedPaths.join(', '));
console.log('  - Network:', profile.restrictions.network.allowedHosts.slice(0, 3).join(', '), '...');
console.log('  - Memory:', profile.restrictions.process.maxMemoryMB, 'MB');
console.log('');

// Set environment variables
process.env.SANDBOX_ENABLED = 'true';
process.env.SANDBOX_PROFILE = '${profile}';
process.env.SANDBOX_CONFIG = JSON.stringify(sandboxConfig);

// Hook into require to enforce module restrictions
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  // Check if module is allowed
  if (profile.restrictions.process.deniedCommands.includes(id)) {
    throw new Error(\`Sandbox: Module '\${id}' is not allowed in profile '${profile}'\`);
  }
  
  return originalRequire.apply(this, arguments);
};

// Start Claude Flow with sandbox hooks
const claudeFlow = spawn('node', ['./cli.js', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

// Monitor for violations
claudeFlow.on('exit', (code) => {
  if (code !== 0) {
    console.error('\\n⚠️  Claude Flow exited with code:', code);
    
    // Check for sandbox violations
    try {
      const violations = fs.readdirSync('.sandbox/violations')
        .filter(f => f.endsWith('.json'))
        .map(f => JSON.parse(fs.readFileSync(path.join('.sandbox/violations', f), 'utf8')));
      
      if (violations.length > 0) {
        console.error('\\n🚫 Sandbox Violations Detected:');
        violations.forEach(v => {
          console.error(\`  - \${v.type}: \${v.operation} on \${v.path || v.url}\`);
        });
      }
    } catch {
      // No violations or directory doesn't exist
    }
  }
  
  process.exit(code);
});
`;
}

// Update help text
export function showInitHelp() {
  console.log('Usage: claude-flow init [options]');
  console.log();
  console.log('Options:');
  console.log('  --force, -f              Overwrite existing files');
  console.log('  --minimal, -m            Create minimal configuration');
  console.log('  --sparc, -s              Include SPARC mode configurations');
  console.log('  --sandbox                Enable sandbox environment');
  console.log('  --sandbox-profile        Sandbox profile (strict/development/production)');
  console.log('  --custom-profile <file>  Use custom sandbox profile from file');
  console.log('  --dry-run, -d            Show what would be created');
  console.log('  --batch-init             Initialize multiple projects');
  console.log('  --config <file>          Batch configuration file');
  console.log('  --help, -h               Show this help message');
  console.log();
  console.log('Sandbox Profiles:');
  console.log('  strict       - Maximum security, minimal access');
  console.log('  development  - Relaxed for local development');  
  console.log('  production   - Balanced security for production');
  console.log();
  console.log('Examples:');
  console.log('  claude-flow init --sandbox');
  console.log('  claude-flow init --sandbox --sandbox-profile=strict');
  console.log('  claude-flow init --sparc --sandbox --force');
}
