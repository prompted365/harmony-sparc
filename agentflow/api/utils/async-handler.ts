/**
 * Async Handler Utility
 * Wrapper for async route handlers to catch and forward errors
 */

import { Request, Response, NextFunction } from 'express';
import { ApiRequest } from '../types';

/**
 * Wraps async route handlers to catch Promise rejections
 * and forward them to Express error handlers
 */
export function asyncHandler<T extends Request = ApiRequest>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Creates a typed async handler with additional error context
 */
export function typedAsyncHandler<TReq extends Request = ApiRequest, TRes = any>(
  fn: (req: TReq, res: Response, next: NextFunction) => Promise<TRes>
) {
  return asyncHandler(fn);
}

/**
 * Async handler with timeout support
 */
export function asyncHandlerWithTimeout<T extends Request = ApiRequest>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>,
  timeoutMs: number = 30000
) {
  return (req: T, res: Response, next: NextFunction) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    Promise.race([
      Promise.resolve(fn(req, res, next)),
      timeoutPromise
    ]).catch(next);
  };
}

/**
 * Async handler with retry logic
 */
export function asyncHandlerWithRetry<T extends Request = ApiRequest>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>,
  maxRetries: number = 3,
  retryDelay: number = 1000
) {
  return async (req: T, res: Response, next: NextFunction) => {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await fn(req, res, next);
        return; // Success, exit
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          // Last attempt failed, forward error
          next(lastError);
          return;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  };
}

/**
 * Async handler with circuit breaker pattern
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private maxFailures: number = 5,
    private resetTimeout: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      
      if (this.state === 'half-open') {
        this.reset();
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.maxFailures) {
      this.state = 'open';
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  getState(): string {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }
}

export function asyncHandlerWithCircuitBreaker<T extends Request = ApiRequest>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>,
  circuitBreaker: CircuitBreaker
) {
  return asyncHandler(async (req: T, res: Response, next: NextFunction) => {
    await circuitBreaker.execute(() => fn(req, res, next));
  });
}

/**
 * Async handler with performance monitoring
 */
export function asyncHandlerWithMetrics<T extends Request = ApiRequest>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>,
  metricsCollector?: (duration: number, success: boolean, req: T) => void
) {
  return asyncHandler(async (req: T, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    let success = true;

    try {
      await fn(req, res, next);
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      if (metricsCollector) {
        metricsCollector(duration, success, req);
      }
    }
  });
}

/**
 * Compose multiple async handlers
 */
export function composeAsyncHandlers<T extends Request = ApiRequest>(
  ...handlers: Array<(req: T, res: Response, next: NextFunction) => Promise<any>>
) {
  return asyncHandler(async (req: T, res: Response, next: NextFunction) => {
    for (const handler of handlers) {
      await handler(req, res, next);
    }
  });
}

/**
 * Conditional async handler
 */
export function conditionalAsyncHandler<T extends Request = ApiRequest>(
  condition: (req: T) => boolean,
  handler: (req: T, res: Response, next: NextFunction) => Promise<any>
) {
  return asyncHandler(async (req: T, res: Response, next: NextFunction) => {
    if (condition(req)) {
      await handler(req, res, next);
    } else {
      next();
    }
  });
}

/**
 * Async handler with validation
 */
export function asyncHandlerWithValidation<T extends Request = ApiRequest>(
  validator: (req: T) => Promise<boolean> | boolean,
  handler: (req: T, res: Response, next: NextFunction) => Promise<any>,
  onValidationError?: (req: T, res: Response) => void
) {
  return asyncHandler(async (req: T, res: Response, next: NextFunction) => {
    const isValid = await validator(req);
    
    if (!isValid) {
      if (onValidationError) {
        onValidationError(req, res);
      } else {
        res.status(400).json({ error: 'Validation failed' });
      }
      return;
    }

    await handler(req, res, next);
  });
}

/**
 * Batch async handler for processing multiple items
 */
export function batchAsyncHandler<T extends Request = ApiRequest, TItem = any>(
  itemExtractor: (req: T) => TItem[],
  itemHandler: (item: TItem, req: T, res: Response) => Promise<any>,
  options: {
    concurrency?: number;
    failFast?: boolean;
  } = {}
) {
  const { concurrency = 5, failFast = true } = options;

  return asyncHandler(async (req: T, res: Response, next: NextFunction) => {
    const items = itemExtractor(req);
    const results: any[] = [];
    const errors: Error[] = [];

    // Process items in batches
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (item, index) => {
        try {
          const result = await itemHandler(item, req, res);
          return { index: i + index, result, error: null };
        } catch (error) {
          if (failFast) {
            throw error;
          }
          return { index: i + index, result: null, error };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(({ index, result, error }) => {
        if (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        } else {
          results[index] = result;
        }
      });
    }

    // Attach results to request for further processing
    (req as any).batchResults = results;
    (req as any).batchErrors = errors;

    if (errors.length > 0 && failFast) {
      throw errors[0];
    }

    next();
  });
}

/**
 * Rate-limited async handler
 */
export function rateLimitedAsyncHandler<T extends Request = ApiRequest>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<any>,
  rateLimit: {
    requests: number;
    windowMs: number;
    keyGenerator?: (req: T) => string;
  }
) {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  
  return asyncHandler(async (req: T, res: Response, next: NextFunction) => {
    const key = rateLimit.keyGenerator ? rateLimit.keyGenerator(req) : req.ip || 'default';
    const now = Date.now();
    
    let record = requestCounts.get(key);
    
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + rateLimit.windowMs };
      requestCounts.set(key, record);
    }
    
    if (record.count >= rateLimit.requests) {
      res.status(429).json({ error: 'Rate limit exceeded' });
      return;
    }
    
    record.count++;
    await handler(req, res, next);
  });
}