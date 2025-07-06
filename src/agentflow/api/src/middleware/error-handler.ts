import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  details?: any;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  // Log error details
  logger.error('Error occurred:', {
    error: {
      message: err.message,
      stack: err.stack,
      statusCode,
      details: err.details
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params
    }
  });
  
  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.url,
      ...(process.env['NODE_ENV'] === 'development' && {
        stack: err.stack,
        details: err.details
      })
    }
  });
};

export class ApiErrorBuilder {
  static badRequest(message: string, details?: any): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = 400;
    error.details = details;
    return error;
  }
  
  static unauthorized(message: string = 'Unauthorized'): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = 401;
    return error;
  }
  
  static forbidden(message: string = 'Forbidden'): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = 403;
    return error;
  }
  
  static notFound(message: string = 'Resource not found'): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = 404;
    return error;
  }
  
  static internal(message: string = 'Internal server error', details?: any): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = 500;
    error.details = details;
    return error;
  }
}