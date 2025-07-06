/**
 * OpenAPI/Swagger Documentation Setup
 * Comprehensive API documentation with examples and schemas
 */

import { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AgentFlow API',
      version: '1.0.0',
      description: `
        AgentFlow API provides comprehensive endpoints for managing autonomous agent workflows,
        financial operations, and quantum-resistant QuDAG network integration.
        
        ## Features
        - Workflow Management (CRUD operations)
        - Agent Coordination and Assignment
        - Financial Operations (Wallets, Payments, Balances)
        - QuDAG Network Integration
        - Real-time Performance Monitoring
        - Quantum-resistant Security
        
        ## Authentication
        This API supports multiple authentication methods:
        - API Keys (recommended for server-to-server)
        - JWT Tokens (recommended for client applications)
        - Ethereum Signature Verification
        
        ## Rate Limiting
        API endpoints are rate-limited to ensure fair usage:
        - Standard endpoints: 100 requests/minute
        - Financial endpoints: 50 requests/minute
        - Admin endpoints: 10 requests/minute
        
        ## Response Format
        All responses follow a consistent format with success/error indicators,
        data payload, and metadata including timestamps and request IDs.
      `,
      contact: {
        name: 'AgentFlow Team',
        email: 'support@agentflow.ai',
        url: 'https://agentflow.ai'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.agentflow.ai',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication'
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        },
        SignatureAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Signature',
          description: 'Ethereum signature for authentication'
        }
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: { $ref: '#/components/schemas/ApiError' },
            meta: { $ref: '#/components/schemas/ApiMeta' }
          },
          required: ['success']
        },
        ApiError: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' },
            stack: { type: 'string', description: 'Only in development mode' }
          },
          required: ['code', 'message']
        },
        ApiMeta: {
          type: 'object',
          properties: {
            timestamp: { type: 'number' },
            version: { type: 'string' },
            requestId: { type: 'string' },
            pagination: { $ref: '#/components/schemas/PaginationMeta' }
          },
          required: ['timestamp', 'version', 'requestId']
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' }
          }
        },
        WorkflowDefinition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
            description: { type: 'string' },
            nodes: {
              type: 'array',
              items: { $ref: '#/components/schemas/WorkflowNode' }
            },
            edges: {
              type: 'array',
              items: { $ref: '#/components/schemas/WorkflowEdge' }
            },
            variables: { type: 'object' },
            triggers: {
              type: 'array',
              items: { $ref: '#/components/schemas/Trigger' }
            },
            metadata: { $ref: '#/components/schemas/WorkflowMetadata' }
          },
          required: ['id', 'name', 'version', 'nodes', 'edges']
        },
        WorkflowNode: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: {
              type: 'string',
              enum: ['start', 'end', 'task', 'conditional', 'parallel', 'loop', 'subworkflow', 'agent', 'human']
            },
            name: { type: 'string' },
            description: { type: 'string' },
            config: { type: 'object' },
            inputs: { type: 'array', items: { type: 'string' } },
            outputs: { type: 'array', items: { type: 'string' } },
            dependencies: { type: 'array', items: { type: 'string' } },
            retryPolicy: { $ref: '#/components/schemas/RetryPolicy' },
            timeout: { type: 'number' },
            agent: { $ref: '#/components/schemas/AgentConfig' }
          },
          required: ['id', 'type', 'name', 'config']
        },
        WorkflowEdge: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            source: { type: 'string' },
            target: { type: 'string' },
            condition: { $ref: '#/components/schemas/Condition' },
            priority: { type: 'number' }
          },
          required: ['id', 'source', 'target']
        },
        WorkflowInstance: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workflowId: { type: 'string' },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled']
            },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            context: { $ref: '#/components/schemas/WorkflowContext' },
            tasks: {
              type: 'array',
              items: { $ref: '#/components/schemas/TaskInstance' }
            },
            error: { $ref: '#/components/schemas/WorkflowError' }
          },
          required: ['id', 'workflowId', 'status', 'startTime', 'context', 'tasks']
        },
        AgentInfo: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: {
              type: 'string',
              enum: ['researcher', 'coder', 'analyst', 'tester', 'coordinator', 'financial']
            },
            status: {
              type: 'string',
              enum: ['idle', 'busy', 'offline']
            },
            capabilities: { type: 'array', items: { type: 'string' } },
            currentTask: { type: 'string' },
            metrics: { $ref: '#/components/schemas/AgentMetrics' }
          },
          required: ['id', 'type', 'status', 'capabilities', 'metrics']
        },
        AgentMetrics: {
          type: 'object',
          properties: {
            tasksCompleted: { type: 'number' },
            successRate: { type: 'number', minimum: 0, maximum: 1 },
            avgExecutionTime: { type: 'number' },
            lastActive: { type: 'string', format: 'date-time' }
          },
          required: ['tasksCompleted', 'successRate', 'avgExecutionTime', 'lastActive']
        },
        WalletInfo: {
          type: 'object',
          properties: {
            address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
            balances: {
              type: 'array',
              items: { $ref: '#/components/schemas/TokenBalance' }
            },
            transactions: {
              type: 'array',
              items: { $ref: '#/components/schemas/Transaction' }
            },
            totalValue: { type: 'number' }
          },
          required: ['address', 'balances', 'transactions', 'totalValue']
        },
        TokenBalance: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            balance: { type: 'number' },
            value: { type: 'number' },
            change24h: { type: 'number' }
          },
          required: ['token', 'balance', 'value', 'change24h']
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: {
              type: 'string',
              enum: ['send', 'receive', 'swap', 'stake']
            },
            amount: { type: 'number' },
            token: { type: 'string' },
            from: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
            to: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
            timestamp: { type: 'string', format: 'date-time' },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'failed']
            },
            fee: { type: 'number' }
          },
          required: ['id', 'type', 'amount', 'token', 'from', 'to', 'timestamp', 'status']
        },
        PaymentRequest: {
          type: 'object',
          properties: {
            amount: { type: 'number', minimum: 0 },
            token: { type: 'string' },
            recipient: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
            memo: { type: 'string', maxLength: 200 },
            urgency: {
              type: 'string',
              enum: ['normal', 'high'],
              default: 'normal'
            }
          },
          required: ['amount', 'token', 'recipient']
        },
        QuDAGStatus: {
          type: 'object',
          properties: {
            connected: { type: 'boolean' },
            peers: { type: 'number' },
            latency: { type: 'number' },
            darkDomainActive: { type: 'boolean' },
            resources: {
              type: 'array',
              items: { $ref: '#/components/schemas/ResourceBalance' }
            }
          },
          required: ['connected', 'peers', 'latency', 'darkDomainActive', 'resources']
        },
        ResourceBalance: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['CPU', 'Storage', 'Bandwidth', 'Model', 'Memory']
            },
            available: { type: 'number' },
            allocated: { type: 'number' },
            unit: { type: 'string' }
          },
          required: ['type', 'available', 'allocated', 'unit']
        },
        HealthStatus: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy']
            },
            services: {
              type: 'array',
              items: { $ref: '#/components/schemas/ServiceHealth' }
            },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' }
          },
          required: ['status', 'services', 'timestamp', 'uptime']
        },
        ServiceHealth: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            status: { type: 'boolean' },
            latency: { type: 'number' },
            error: { type: 'string' }
          },
          required: ['name', 'status']
        }
      },
      responses: {
        BadRequest: {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
              example: {
                success: false,
                error: {
                  code: 'INVALID_REQUEST',
                  message: 'Validation failed',
                  details: {
                    errors: [
                      {
                        field: 'body.amount',
                        message: 'Expected number, received string',
                        code: 'invalid_type'
                      }
                    ]
                  }
                },
                meta: {
                  timestamp: 1634567890123,
                  version: '1.0.0',
                  requestId: 'req_1634567890123_abc123'
                }
              }
            }
          }
        },
        Unauthorized: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
              example: {
                success: false,
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Authentication required. Please provide a valid API key or JWT token.'
                },
                meta: {
                  timestamp: 1634567890123,
                  version: '1.0.0',
                  requestId: 'req_1634567890123_abc123'
                }
              }
            }
          }
        },
        Forbidden: {
          description: 'Forbidden',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
              example: {
                success: false,
                error: {
                  code: 'FORBIDDEN',
                  message: 'Access denied. Required permission: write:workflows'
                },
                meta: {
                  timestamp: 1634567890123,
                  version: '1.0.0',
                  requestId: 'req_1634567890123_abc123'
                }
              }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
              example: {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'Workflow wf_123 not found'
                },
                meta: {
                  timestamp: 1634567890123,
                  version: '1.0.0',
                  requestId: 'req_1634567890123_abc123'
                }
              }
            }
          }
        },
        TooManyRequests: {
          description: 'Rate limit exceeded',
          headers: {
            'X-RateLimit-Limit': {
              schema: { type: 'integer' },
              description: 'Request limit per time window'
            },
            'X-RateLimit-Remaining': {
              schema: { type: 'integer' },
              description: 'Remaining requests in current window'
            },
            'X-RateLimit-Reset': {
              schema: { type: 'string', format: 'date-time' },
              description: 'Time when the rate limit resets'
            },
            'Retry-After': {
              schema: { type: 'integer' },
              description: 'Seconds to wait before retrying'
            }
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
              example: {
                success: false,
                error: {
                  code: 'RATE_LIMITED',
                  message: 'Too many requests'
                },
                meta: {
                  timestamp: 1634567890123,
                  version: '1.0.0',
                  requestId: 'req_1634567890123_abc123'
                }
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
              example: {
                success: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'An internal error occurred'
                },
                meta: {
                  timestamp: 1634567890123,
                  version: '1.0.0',
                  requestId: 'req_1634567890123_abc123'
                }
              }
            }
          }
        }
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: 'Page number (1-based)',
          schema: { type: 'integer', minimum: 1, default: 1 }
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
        },
        SortParam: {
          name: 'sort',
          in: 'query',
          description: 'Field to sort by',
          schema: { type: 'string' }
        },
        OrderParam: {
          name: 'order',
          in: 'query',
          description: 'Sort order',
          schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      }
    },
    security: [
      { ApiKeyAuth: [] },
      { BearerAuth: [] }
    ],
    tags: [
      {
        name: 'Workflows',
        description: 'Workflow management operations'
      },
      {
        name: 'Agents',
        description: 'Agent coordination and management'
      },
      {
        name: 'Financial',
        description: 'Financial operations and wallet management'
      },
      {
        name: 'QuDAG',
        description: 'QuDAG network integration'
      },
      {
        name: 'Health',
        description: 'System health and monitoring'
      }
    ]
  },
  apis: ['./src/agentflow/api/routes/*.ts'] // Paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(swaggerOptions);

export function setupSwagger(app: Express): void {
  // Swagger UI options
  const swaggerUiOptions = {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
      requestInterceptor: (req: any) => {
        // Add custom headers or modify requests
        return req;
      },
      responseInterceptor: (res: any) => {
        // Process responses
        return res;
      }
    },
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2563eb }
      .swagger-ui .scheme-container { background: #f8fafc; padding: 1rem; border-radius: 0.5rem; }
    `,
    customSiteTitle: 'AgentFlow API Documentation',
    customfavIcon: '/favicon.ico'
  };

  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));

  // Serve JSON spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // Serve YAML spec
  app.get('/api-docs.yaml', (req, res) => {
    res.setHeader('Content-Type', 'text/yaml');
    res.send(JSON.stringify(specs)); // Would convert to YAML in production
  });
}

export { specs as swaggerSpecs };