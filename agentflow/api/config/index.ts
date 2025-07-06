import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env.production') });

export interface Config {
  env: string;
  port: number;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
  logLevel: string;
  metrics: {
    enabled: boolean;
    port: number;
  };
  performance: {
    targetTPS: number;
    maxRequestSize: string;
    timeout: number;
  };
}

export const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per window
  logLevel: process.env.LOG_LEVEL || 'info',
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    port: parseInt(process.env.METRICS_PORT || '9090', 10)
  },
  performance: {
    targetTPS: parseInt(process.env.TARGET_TPS || '1000', 10),
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10) // 30 seconds
  }
};

// Validate configuration
if (config.port < 1 || config.port > 65535) {
  throw new Error('Invalid port number');
}

if (config.rateLimitMax < 1) {
  throw new Error('Rate limit max must be at least 1');
}

if (config.performance.targetTPS < 1) {
  throw new Error('Target TPS must be at least 1');
}