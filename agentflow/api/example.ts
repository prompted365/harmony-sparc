/**
 * AgentFlow API Usage Example
 * Demonstrates how to start and use the API server
 */

import { createApiServer, createProductionApiServer, createDevelopmentApiServer } from './index';

// Example 1: Basic server setup
async function basicExample() {
  console.log('🚀 Starting AgentFlow API Server...');
  
  const server = createApiServer({
    port: 3000
  });

  try {
    await server.start();
    console.log('✅ Server started successfully!');
    console.log('📚 API Documentation: http://localhost:3000/api-docs');
    console.log('❤️  Health Check: http://localhost:3000/health');
    
    // Server is now running and ready to accept requests
    
    // Example API calls (would typically be made by clients):
    /*
    // Create a workflow
    POST /api/v1/workflows
    {
      "workflow": {
        "name": "Data Processing Pipeline",
        "version": "1.0.0",
        "nodes": [...],
        "edges": [...]
      }
    }
    
    // Get all agents
    GET /api/v1/agents
    
    // Check wallet balance
    GET /api/v1/financial/wallets/0x742d35Cc6634C0532925a3b8D598C4F7d2A0d7F0/balance
    
    // Get QuDAG status
    GET /api/v1/qudag/status
    */
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Example 2: Production configuration
async function productionExample() {
  console.log('🏭 Starting Production AgentFlow API Server...');
  
  const server = createProductionApiServer();
  
  // Setup graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('📤 Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('📤 Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  try {
    await server.start();
    console.log('✅ Production server started successfully!');
  } catch (error) {
    console.error('❌ Failed to start production server:', error);
    process.exit(1);
  }
}

// Example 3: Development with hot reload simulation
async function developmentExample() {
  console.log('🔧 Starting Development AgentFlow API Server...');
  
  const server = createDevelopmentApiServer();
  
  try {
    await server.start();
    console.log('✅ Development server started!');
    console.log('📚 API Documentation: http://localhost:3000/api-docs');
    console.log('🔍 Try these endpoints:');
    console.log('  GET  /health - Health check');
    console.log('  GET  /api/v1/workflows - List workflows');
    console.log('  GET  /api/v1/agents - List agents');
    console.log('  GET  /api/v1/financial/tokens - List supported tokens');
    console.log('  GET  /api/v1/qudag/status - QuDAG network status');
    
    // Simulate some activity
    setTimeout(() => {
      console.log('📊 Current metrics:', server.getMetrics());
    }, 5000);
    
  } catch (error) {
    console.error('❌ Failed to start development server:', error);
    process.exit(1);
  }
}

// Example 4: Custom configuration with middleware
async function customExample() {
  console.log('⚙️  Starting Custom AgentFlow API Server...');
  
  const server = createApiServer({
    port: 8080,
    corsOrigins: ['https://app.agentflow.ai', 'https://dashboard.agentflow.ai']
  });

  // Event listeners
  server.on('started', () => {
    console.log('🎉 Server started event fired!');
  });

  server.on('stopped', () => {
    console.log('🛑 Server stopped event fired!');
  });

  try {
    await server.start();
    console.log('✅ Custom server configuration started!');
    
    // Example: Check if server is healthy
    if (server.isHealthy()) {
      console.log('💚 Server is healthy');
    }
    
  } catch (error) {
    console.error('❌ Failed to start custom server:', error);
    process.exit(1);
  }
}

// Example client requests (using fetch)
async function clientExamples() {
  const baseUrl = 'http://localhost:3000/api/v1';
  const apiKey = 'ak_dev_1234567890abcdef'; // Development API key
  
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey
  };

  try {
    // 1. List workflows
    console.log('📋 Fetching workflows...');
    const workflowsResponse = await fetch(`${baseUrl}/workflows`, { headers });
    const workflows = await workflowsResponse.json();
    console.log('Workflows:', workflows);

    // 2. Get available agents
    console.log('🤖 Fetching available agents...');
    const agentsResponse = await fetch(`${baseUrl}/agents/available`, { headers });
    const agents = await agentsResponse.json();
    console.log('Available agents:', agents);

    // 3. Check QuDAG status
    console.log('🔗 Checking QuDAG status...');
    const qudagResponse = await fetch(`${baseUrl}/qudag/status`, { headers });
    const qudagStatus = await qudagResponse.json();
    console.log('QuDAG status:', qudagStatus);

    // 4. Get system health
    console.log('❤️  Checking system health...');
    const healthResponse = await fetch('http://localhost:3000/health');
    const health = await healthResponse.json();
    console.log('System health:', health);

  } catch (error) {
    console.error('❌ Client request failed:', error);
  }
}

// Run examples based on environment
if (require.main === module) {
  const mode = process.env.NODE_ENV || 'development';
  
  switch (mode) {
    case 'production':
      productionExample();
      break;
    case 'development':
      developmentExample();
      break;
    case 'custom':
      customExample();
      break;
    default:
      basicExample();
  }
  
  // Uncomment to run client examples after server starts
  // setTimeout(clientExamples, 2000);
}

export {
  basicExample,
  productionExample,
  developmentExample,
  customExample,
  clientExamples
};