/**
 * Error Handler Middleware
 * Centralized error handling with logging and monitoring
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { ApiRequest, ApiResponse, ApiErrorCode } from '../types';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

class ErrorHandler {
  constructor(private logger: winston.Logger) {}

  handleError(error: Error | ApiError, req?: ApiRequest): {
    statusCode: number;
    response: ApiResponse;
  } {
    const apiError = error as ApiError;
    
    // Determine status code
    let statusCode = apiError.statusCode || 500;
    
    // Determine error code
    let errorCode = apiError.code || ApiErrorCode.INTERNAL_ERROR;
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorCode = ApiErrorCode.INVALID_REQUEST;
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
      errorCode = ApiErrorCode.UNAUTHORIZED;
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403;
      errorCode = ApiErrorCode.FORBIDDEN;
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
      errorCode = ApiErrorCode.NOT_FOUND;
    } else if (error.name === 'ConflictError') {
      statusCode = 409;
      errorCode = ApiErrorCode.CONFLICT;
    } else if (error.name === 'TooManyRequestsError') {
      statusCode = 429;
      errorCode = ApiErrorCode.RATE_LIMITED;
    }

    // Create response
    const response: ApiResponse = {
      success: false,
      error: {
        code: errorCode,
        message: error.message || 'An error occurred',
        details: apiError.details,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req?.requestId || 'unknown'
      }
    };

    // Log error
    this.logError(error, req, statusCode);

    return { statusCode, response };
  }

  private logError(error: Error | ApiError, req?: ApiRequest, statusCode?: number): void {
    const apiError = error as ApiError;
    const level = statusCode && statusCode >= 500 ? 'error' : 'warn';
    
    const logData: any = {
      error: {
        name: error.name,
        message: error.message,
        code: apiError.code,
        statusCode,
        stack: error.stack,
        isOperational: apiError.isOperational
      }
    };

    if (req) {
      logData.request = {
        method: req.method,
        url: req.originalUrl,
        headers: this.sanitizeHeaders(req.headers),
        user: req.user?.id,
        requestId: req.requestId,
        ip: req.ip
      };
    }

    this.logger.log(level, 'API Error', logData);
  }

  private sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    const sanitized = { ...headers };
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  isOperationalError(error: Error | ApiError): boolean {
    const apiError = error as ApiError;
    return apiError.isOperational === true;
  }
}

// Error handler middleware
export function errorHandler(logger: winston.Logger) {
  const handler = new ErrorHandler(logger);

  return (error: Error | ApiError, req: ApiRequest, res: Response, next: NextFunction) => {
    // If response already sent, delegate to default Express error handler
    if (res.headersSent) {
      return next(error);
    }

    const { statusCode, response } = handler.handleError(error, req);
    
    res.status(statusCode).json(response);
  };
}

// Async error wrapper
export function asyncHandler<T extends Request = ApiRequest>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Custom error classes
export class ValidationError extends Error {
  statusCode = 400;
  code = ApiErrorCode.INVALID_REQUEST;
  isOperational = true;

  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  code = ApiErrorCode.UNAUTHORIZED;
  isOperational = true;

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  code = ApiErrorCode.FORBIDDEN;
  isOperational = true;

  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  code = ApiErrorCode.NOT_FOUND;
  isOperational = true;

  constructor(message: string = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  code = ApiErrorCode.CONFLICT;
  isOperational = true;

  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends Error {
  statusCode = 429;
  code = ApiErrorCode.RATE_LIMITED;
  isOperational = true;

  constructor(message: string = 'Too many requests', public details?: any) {
    super(message);
    this.name = 'TooManyRequestsError';
  }
}

export class ServiceUnavailableError extends Error {
  statusCode = 503;
  code = ApiErrorCode.SERVICE_UNAVAILABLE;
  isOperational = true;

  constructor(message: string = 'Service unavailable', public details?: any) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

// 404 handler for unmatched routes
export function notFoundHandler(req: ApiRequest, _res: Response, next: NextFunction) {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
}

// Unhandled promise rejection handler
export function setupGlobalErrorHandlers(logger: winston.Logger) {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', {
      promise,
      reason: reason?.stack || reason
    });
    
    // In production, you might want to exit the process
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      error: error.message,
      stack: error.stack
    });
    
    // Exit the process for uncaught exceptions
    process.exit(1);
  });
}

// Error metrics collector
class ErrorMetrics {
  private errorCounts: Map<string, number> = new Map();
  private statusCounts: Map<number, number> = new Map();
  private hourlyErrors: Map<string, number> = new Map();

  recordError(errorCode: string, statusCode: number): void {
    // Count by error code
    this.errorCounts.set(errorCode, (this.errorCounts.get(errorCode) || 0) + 1);
    
    // Count by status code
    this.statusCounts.set(statusCode, (this.statusCounts.get(statusCode) || 0) + 1);
    
    // Count by hour
    const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    this.hourlyErrors.set(hour, (this.hourlyErrors.get(hour) || 0) + 1);
  }

  getMetrics(): {
    errorCounts: Record<string, number>;
    statusCounts: Record<number, number>;
    hourlyErrors: Record<string, number>;
    totalErrors: number;
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    
    return {
      errorCounts: Object.fromEntries(this.errorCounts),
      statusCounts: Object.fromEntries(this.statusCounts),
      hourlyErrors: Object.fromEntries(this.hourlyErrors),
      totalErrors
    };
  }

  reset(): void {
    this.errorCounts.clear();
    this.statusCounts.clear();
    this.hourlyErrors.clear();
  }
}

const errorMetrics = new ErrorMetrics();

// Enhanced error handler with metrics
export function errorHandlerWithMetrics(logger: winston.Logger) {
  const handler = new ErrorHandler(logger);

  return (error: Error | ApiError, req: ApiRequest, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(error);
    }

    const { statusCode, response } = handler.handleError(error, req);
    
    // Record metrics
    if (response.error) {
      errorMetrics.recordError(response.error.code, statusCode);
    }
    
    res.status(statusCode).json(response);
  };
}

export { errorMetrics, ErrorMetrics };