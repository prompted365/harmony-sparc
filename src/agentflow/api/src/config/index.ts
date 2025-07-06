/**
 * Application configuration
 * Centralizes all environment variables and configuration settings
 */

import { z } from 'zod';

// Configuration schema
const configSchema = z.object({
  // Server configuration
  port: z.number().min(1).max(65535).default(3001),
  nodeEnv: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  
  // Database configuration
  databaseUrl: z.string().optional(),
  redisUrl: z.string().optional(),
  
  // Rate limiting
  rateLimitWindowMs: z.number().default(15 * 60 * 1000), // 15 minutes
  rateLimitMax: z.number().default(100), // 100 requests per window
  
  // Logging
  logLevel: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  logPrettyPrint: z.boolean().default(false),
  
  // Security
  jwtSecret: z.string().optional(),
  encryptionKey: z.string().optional(),
  sessionSecret: z.string().optional(),
  
  // API Keys
  apiKeyOpenai: z.string().optional(),
  apiKeyAnthropic: z.string().optional(),
  
  // Feature flags
  enableMetrics: z.boolean().default(true),
  enableHealthCheck: z.boolean().default(true),
  enableSwagger: z.boolean().default(false),
});

// Load and validate configuration
const loadConfig = () => {
  const env = process.env;
  
  return configSchema.parse({
    port: env['PORT'] ? parseInt(env['PORT'], 10) : undefined,
    nodeEnv: env['NODE_ENV'] as any,
    
    databaseUrl: env['DATABASE_URL'],
    redisUrl: env['REDIS_URL'],
    
    rateLimitWindowMs: env['RATE_LIMIT_WINDOW_MS'] ? parseInt(env['RATE_LIMIT_WINDOW_MS'], 10) : undefined,
    rateLimitMax: env['RATE_LIMIT_MAX'] ? parseInt(env['RATE_LIMIT_MAX'], 10) : undefined,
    
    logLevel: env['LOG_LEVEL'] as any,
    logPrettyPrint: env['LOG_PRETTY_PRINT'] === 'true',
    
    jwtSecret: env['JWT_SECRET'],
    encryptionKey: env['ENCRYPTION_KEY'],
    sessionSecret: env['SESSION_SECRET'],
    
    apiKeyOpenai: env['API_KEY_OPENAI'],
    apiKeyAnthropic: env['API_KEY_ANTHROPIC'],
    
    enableMetrics: env['ENABLE_METRICS'] !== 'false',
    enableHealthCheck: env['ENABLE_HEALTH_CHECK'] !== 'false',
    enableSwagger: env['ENABLE_SWAGGER'] === 'true',
  });
};

// Export configuration singleton
export const config = loadConfig();

// Export type for TypeScript
export type Config = z.infer<typeof configSchema>;

// Helper to check if we're in production
export const isProduction = () => config.nodeEnv === 'production';

// Helper to check if we're in development
export const isDevelopment = () => config.nodeEnv === 'development';

// Helper to check if we're in test
export const isTest = () => config.nodeEnv === 'test';