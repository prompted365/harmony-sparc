// Import for internal use
import { Server } from './server';
import { config } from './config';

// Re-export for external use
export { Server } from './server';
export { config } from './config';
export { logger } from './utils/logger';
export { errorHandler, asyncHandler } from './middleware/error-handler';
export type { ApiError } from './middleware/error-handler';
export type { Config } from './config';

// Re-export important types
export type { Request, Response, NextFunction } from 'express';

// Factory functions for creating servers
export function createApiServer(options?: Partial<typeof config>) {
  return new Server({ ...config, ...options });
}

export function createProductionApiServer() {
  return new Server({
    ...config,
    env: 'production',
    logLevel: 'info'
  });
}

export function createDevelopmentApiServer() {
  return new Server({
    ...config,
    env: 'development',
    logLevel: 'debug'
  });
}