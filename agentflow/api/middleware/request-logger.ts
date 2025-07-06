/**
 * Request Logger Middleware
 * Comprehensive request/response logging with performance metrics
 */

import { Response, NextFunction } from 'express';
import winston from 'winston';
import { ApiRequest } from '../types';

interface RequestLogData {
  method: string;
  url: string;
  userAgent?: string;
  ip: string;
  userId?: string;
  requestId: string;
  headers?: Record<string, any>;
  query?: any;
  body?: any;
  startTime: number;
  endTime?: number;
  responseTime?: number;
  statusCode?: number;
  responseSize?: number;
  error?: any;
}

export function requestLogger(logger: winston.Logger) {
  return (req: ApiRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    
    // Attach request ID to request
    req.requestId = requestId;
    req.startTime = startTime;

    // Prepare log data
    const logData: RequestLogData = {
      method: req.method,
      url: req.originalUrl || req.url,
      userAgent: req.get('User-Agent'),
      ip: getClientIp(req),
      userId: req.user?.id,
      requestId,
      startTime,
      headers: sanitizeHeaders(req.headers),
      query: req.query,
      body: sanitizeBody(req.body)
    };

    // Log request start
    logger.info('Request started', {
      type: 'request_start',
      ...logData
    });

    // Intercept response
    const originalSend = res.send;
    const originalJson = res.json;

    let responseBody: any;
    let responseSize = 0;

    res.send = function(data: any) {
      responseBody = data;
      responseSize = Buffer.byteLength(data || '', 'utf8');
      return originalSend.call(this, data);
    };

    res.json = function(data: any) {
      responseBody = data;
      responseSize = Buffer.byteLength(JSON.stringify(data || {}), 'utf8');
      return originalJson.call(this, data);
    };

    // Log response when finished
    res.on('finish', () => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const finalLogData: RequestLogData = {
        ...logData,
        endTime,
        responseTime,
        statusCode: res.statusCode,
        responseSize
      };

      // Determine log level based on status code and response time
      let level = 'info';
      if (res.statusCode >= 500) {
        level = 'error';
      } else if (res.statusCode >= 400) {
        level = 'warn';
      } else if (responseTime > 1000) { // Slow requests
        level = 'warn';
      }

      logger.log(level, 'Request completed', {
        type: 'request_complete',
        ...finalLogData,
        ...(process.env.LOG_RESPONSE_BODY === 'true' && { responseBody: sanitizeResponseBody(responseBody) })
      });

      // Log performance warning for slow requests
      if (responseTime > 5000) {
        logger.warn('Slow request detected', {
          type: 'performance_warning',
          requestId,
          responseTime,
          url: req.originalUrl,
          method: req.method
        });
      }
    });

    // Log response errors
    res.on('error', (error) => {
      logger.error('Response error', {
        type: 'response_error',
        requestId,
        error: error.message,
        stack: error.stack
      });
    });

    next();
  };
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getClientIp(req: ApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const realIp = req.headers['x-real-ip'] as string;
  const cfConnectingIp = req.headers['cf-connecting-ip'] as string;
  
  return (
    cfConnectingIp ||
    realIp ||
    (forwarded ? forwarded.split(',')[0].trim() : '') ||
    req.ip ||
    req.connection.remoteAddress ||
    'unknown'
  );
}

function sanitizeHeaders(headers: any): Record<string, any> {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
    'authentication'
  ];

  const sanitized: Record<string, any> = {};
  
  Object.entries(headers).forEach(([key, value]) => {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'private',
    'privateKey',
    'apiKey',
    'accessToken',
    'refreshToken',
    'signature',
    'seed',
    'mnemonic'
  ];

  const sanitized = { ...body };

  function sanitizeRecursive(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeRecursive(item));
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      Object.entries(obj).forEach(([key, value]) => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitizeRecursive(value);
        }
      });
      return result;
    }

    return obj;
  }

  return sanitizeRecursive(sanitized);
}

function sanitizeResponseBody(body: any): any {
  if (!body) return body;

  // Limit response body size in logs
  const maxSize = 1000; // 1KB
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  
  if (bodyStr.length > maxSize) {
    return `${bodyStr.substring(0, maxSize)}... [TRUNCATED]`;
  }

  return body;
}

// Structured logging utilities
export class RequestLogger {
  constructor(private logger: winston.Logger) {}

  logApiCall(req: ApiRequest, action: string, details?: any): void {
    this.logger.info('API call', {
      type: 'api_call',
      requestId: req.requestId,
      userId: req.user?.id,
      action,
      details,
      timestamp: Date.now()
    });
  }

  logBusinessEvent(req: ApiRequest, event: string, data?: any): void {
    this.logger.info('Business event', {
      type: 'business_event',
      requestId: req.requestId,
      userId: req.user?.id,
      event,
      data,
      timestamp: Date.now()
    });
  }

  logSecurityEvent(req: ApiRequest, event: string, details?: any): void {
    this.logger.warn('Security event', {
      type: 'security_event',
      requestId: req.requestId,
      userId: req.user?.id,
      ip: getClientIp(req),
      userAgent: req.get('User-Agent'),
      event,
      details,
      timestamp: Date.now()
    });
  }

  logPerformanceMetric(req: ApiRequest, metric: string, value: number, unit?: string): void {
    this.logger.info('Performance metric', {
      type: 'performance_metric',
      requestId: req.requestId,
      metric,
      value,
      unit,
      timestamp: Date.now()
    });
  }

  logDataAccess(req: ApiRequest, resource: string, action: string, recordCount?: number): void {
    this.logger.info('Data access', {
      type: 'data_access',
      requestId: req.requestId,
      userId: req.user?.id,
      resource,
      action,
      recordCount,
      timestamp: Date.now()
    });
  }

  logExternalCall(req: ApiRequest, service: string, endpoint: string, responseTime: number, success: boolean): void {
    this.logger.info('External service call', {
      type: 'external_call',
      requestId: req.requestId,
      service,
      endpoint,
      responseTime,
      success,
      timestamp: Date.now()
    });
  }
}

// Performance monitoring middleware
export function performanceMonitor(metricsCollector?: any) {
  return (req: ApiRequest, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();

      const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

      // Record metrics if collector is provided
      if (metricsCollector) {
        metricsCollector.recordRequest(req.method, req.route?.path || req.path, res.statusCode, responseTime);
        
        if (memoryDelta > 1024 * 1024) { // Log if memory usage increased by more than 1MB
          metricsCollector.recordMemorySpike(req.path, memoryDelta);
        }
      }

      // Add performance headers
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      res.set('X-Memory-Delta', `${Math.round(memoryDelta / 1024)}KB`);
    });

    next();
  };
}

// Request correlation middleware
export function correlationId() {
  return (req: ApiRequest, res: Response, next: NextFunction) => {
    // Use existing correlation ID or generate new one
    const correlationId = req.headers['x-correlation-id'] as string || generateRequestId();
    
    req.requestId = req.requestId || correlationId;
    res.set('X-Correlation-ID', correlationId);
    
    next();
  };
}

export { generateRequestId, getClientIp };