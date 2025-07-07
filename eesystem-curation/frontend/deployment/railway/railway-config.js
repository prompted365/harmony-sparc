// Railway Deployment Configuration for EESystem AstraDB Integration

const fs = require('fs')
const path = require('path')

class RailwayConfig {
  constructor() {
    this.requiredEnvVars = [
      'ASTRA_DB_DATABASE_ID',
      'ASTRA_DB_REGION', 
      'ASTRA_DB_APPLICATION_TOKEN',
      'REDIS_URL'
    ]
    
    this.optionalEnvVars = [
      'ASTRA_DB_NAMESPACE',
      'ASTRA_DB_ENDPOINT',
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'SENTRY_DSN'
    ]
  }

  // Validate environment variables
  validateEnvironment() {
    const missing = []
    const warnings = []

    // Check required variables
    for (const envVar of this.requiredEnvVars) {
      if (!process.env[envVar]) {
        missing.push(envVar)
      }
    }

    // Check optional but recommended variables
    for (const envVar of this.optionalEnvVars) {
      if (!process.env[envVar]) {
        warnings.push(envVar)
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      warnings
    }
  }

  // Generate environment template
  generateEnvTemplate() {
    const template = `# AstraDB Configuration
ASTRA_DB_DATABASE_ID=your-database-id
ASTRA_DB_REGION=your-region
ASTRA_DB_APPLICATION_TOKEN=your-application-token
ASTRA_DB_NAMESPACE=default
ASTRA_DB_ENDPOINT=https://your-database-id-your-region.apps.astra.datastax.com

# Redis Configuration
REDIS_URL=redis://username:password@hostname:port
REDIS_TLS=true

# Security Configuration
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-32-character-encryption-key
API_RATE_LIMIT=100

# Application Configuration
VITE_API_URL=https://your-app.railway.app/api
MAX_CONTENT_SIZE=10485760
MAX_UPLOAD_SIZE=52428800

# Monitoring Configuration
ENABLE_METRICS=true
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Railway Configuration
PORT=3000
NODE_ENV=production
`

    return template
  }

  // Create Railway service configuration
  generateServiceConfig() {
    return {
      build: {
        builder: "nixpacks",
        buildCommand: "npm ci && npm run build",
        watchPatterns: [
          "src/**/*",
          "package.json",
          "package-lock.json"
        ]
      },
      deploy: {
        startCommand: "npm start",
        healthcheckPath: "/api/health",
        healthcheckTimeout: 300,
        restartPolicyType: "on_failure",
        restartPolicyMaxRetries: 3
      },
      networking: {
        ipv6: true
      }
    }
  }

  // Generate AstraDB connection test script
  generateConnectionTest() {
    return `// AstraDB Connection Test for Railway Deployment
const { DataAPIClient } = require('@datastax/astra-db-ts')

async function testAstraDBConnection() {
  try {
    console.log('Testing AstraDB connection...')
    
    const requiredVars = [
      'ASTRA_DB_DATABASE_ID',
      'ASTRA_DB_REGION',
      'ASTRA_DB_APPLICATION_TOKEN'
    ]
    
    // Check environment variables
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        throw new Error(\`Missing required environment variable: \${varName}\`)
      }
    }
    
    // Create client
    const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN)
    const endpoint = process.env.ASTRA_DB_ENDPOINT || 
      \`https://\${process.env.ASTRA_DB_DATABASE_ID}-\${process.env.ASTRA_DB_REGION}.apps.astra.datastax.com\`
    
    const database = client.db(endpoint)
    
    // Test connection
    const info = await database.info()
    console.log('✅ AstraDB connection successful')
    console.log('Database info:', {
      name: info.name || 'Unknown',
      namespace: process.env.ASTRA_DB_NAMESPACE || 'default'
    })
    
    return true
  } catch (error) {
    console.error('❌ AstraDB connection failed:', error.message)
    return false
  }
}

async function testRedisConnection() {
  try {
    console.log('Testing Redis connection...')
    
    if (!process.env.REDIS_URL) {
      console.warn('⚠️  REDIS_URL not set, Redis caching will be disabled')
      return true
    }
    
    const Redis = require('ioredis')
    const redis = new Redis(process.env.REDIS_URL, {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    })
    
    await redis.connect()
    const result = await redis.ping()
    await redis.quit()
    
    if (result === 'PONG') {
      console.log('✅ Redis connection successful')
      return true
    } else {
      throw new Error('Invalid ping response')
    }
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message)
    return false
  }
}

async function runTests() {
  console.log('🚀 Running Railway deployment connection tests...')
  
  const astraDBResult = await testAstraDBConnection()
  const redisResult = await testRedisConnection()
  
  if (astraDBResult && redisResult) {
    console.log('✅ All connection tests passed')
    process.exit(0)
  } else {
    console.log('❌ Some connection tests failed')
    process.exit(1)
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests()
}

module.exports = {
  testAstraDBConnection,
  testRedisConnection,
  runTests
}
`
  }

  // Generate health check endpoint
  generateHealthCheck() {
    return `// Health Check Endpoint for Railway Deployment
const express = require('express')
const { astraDBService } = require('../src/lib/astradb')

const router = express.Router()

router.get('/health', async (req, res) => {
  try {
    const startTime = Date.now()
    
    // Check service initialization
    if (!astraDBService.isInitialized()) {
      return res.status(503).json({
        status: 'unhealthy',
        error: 'AstraDB service not initialized',
        timestamp: new Date().toISOString()
      })
    }
    
    // Get system health
    const health = await astraDBService.getSystemHealth()
    const responseTime = Date.now() - startTime
    
    const status = health.overall ? 'healthy' : 'degraded'
    const httpStatus = health.overall ? 200 : 503
    
    res.status(httpStatus).json({
      status,
      responseTime,
      checks: {
        database: health.database,
        cache: health.cache,
        connections: health.connections
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

router.get('/health/detailed', async (req, res) => {
  try {
    const [health, metrics, settings] = await Promise.all([
      astraDBService.getSystemHealth(),
      astraDBService.getPerformanceMetrics(),
      astraDBService.getSettings()
    ])
    
    res.json({
      status: health.overall ? 'healthy' : 'degraded',
      health,
      metrics,
      settings: {
        totalConnections: settings.connections.length,
        defaultConnection: settings.defaultConnection,
        cacheEnabled: settings.cache.enabled
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

module.exports = router
`
  }

  // Generate deployment script
  generateDeploymentScript() {
    return `#!/bin/bash
# Railway Deployment Script for EESystem AstraDB Integration

set -e

echo "🚀 Starting Railway deployment for EESystem AstraDB Integration..."

# Check Node.js version
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(npm --version)
echo "npm version: $NPM_VERSION"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Run connection tests
echo "🔍 Testing database connections..."
node deployment/railway/connection-test.js

# Build application
echo "🏗️  Building application..."
npm run build

# Validate build
if [ ! -d "dist" ]; then
  echo "❌ Build failed - dist directory not found"
  exit 1
fi

echo "✅ Build completed successfully"

# Start application with health check
echo "🚀 Starting application..."
npm start &
APP_PID=$!

# Wait for health check
echo "⏳ Waiting for health check..."
sleep 10

# Test health endpoint
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/health || echo "000")

if [ "$HEALTH_RESPONSE" = "200" ]; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed (HTTP $HEALTH_RESPONSE)"
  kill $APP_PID 2>/dev/null || true
  exit 1
fi

echo "🎉 Deployment completed successfully!"
`
  }

  // Generate monitoring configuration
  generateMonitoringConfig() {
    return {
      alerts: {
        database_connection: {
          condition: "database_healthy == false",
          message: "AstraDB connection is unhealthy",
          severity: "critical"
        },
        cache_connection: {
          condition: "cache_healthy == false", 
          message: "Redis cache connection is unhealthy",
          severity: "warning"
        },
        high_response_time: {
          condition: "response_time > 5000",
          message: "High response time detected",
          severity: "warning"
        },
        error_rate: {
          condition: "error_rate > 0.05",
          message: "High error rate detected",
          severity: "critical"
        }
      },
      metrics: {
        collection_interval: 60,
        retention_days: 30,
        custom_metrics: [
          "astradb_connection_count",
          "astradb_response_time",
          "cache_hit_rate",
          "content_operations_per_minute"
        ]
      }
    }
  }

  // Save all configuration files
  saveConfigs() {
    const deploymentDir = path.join(process.cwd(), 'deployment', 'railway')
    
    // Create deployment directory
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true })
    }

    // Save environment template
    fs.writeFileSync(
      path.join(process.cwd(), '.env.railway.template'),
      this.generateEnvTemplate()
    )

    // Save connection test
    fs.writeFileSync(
      path.join(deploymentDir, 'connection-test.js'),
      this.generateConnectionTest()
    )

    // Save health check
    fs.writeFileSync(
      path.join(deploymentDir, 'health-check.js'),
      this.generateHealthCheck()
    )

    // Save deployment script
    const deployScript = path.join(deploymentDir, 'deploy.sh')
    fs.writeFileSync(deployScript, this.generateDeploymentScript())
    fs.chmodSync(deployScript, 0o755)

    // Save monitoring config
    fs.writeFileSync(
      path.join(deploymentDir, 'monitoring.json'),
      JSON.stringify(this.generateMonitoringConfig(), null, 2)
    )

    // Save service config
    fs.writeFileSync(
      path.join(deploymentDir, 'service-config.json'),
      JSON.stringify(this.generateServiceConfig(), null, 2)
    )

    console.log('✅ Railway configuration files generated successfully')
    console.log('📁 Files created:')
    console.log('  - .env.railway.template')
    console.log('  - deployment/railway/connection-test.js')
    console.log('  - deployment/railway/health-check.js')
    console.log('  - deployment/railway/deploy.sh')
    console.log('  - deployment/railway/monitoring.json')
    console.log('  - deployment/railway/service-config.json')
  }
}

module.exports = RailwayConfig

// Generate configs if run directly
if (require.main === module) {
  const config = new RailwayConfig()
  config.saveConfigs()
}