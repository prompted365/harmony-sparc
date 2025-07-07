/**
 * Rate Limiting Middleware
 * High-performance rate limiting with multiple strategies
 */

import { Response, NextFunction } from 'express';
import { ApiRequest, ApiResponse, RateLimitOptions, RateLimitInfo, ApiErrorCode } from '../types';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface SlidingWindowEntry {
  timestamps: number[];
}

class RateLimiter {
  private fixedWindows: Map<string, RateLimitEntry> = new Map();
  private slidingWindows: Map<string, SlidingWindowEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();

    // Clean up fixed windows
    for (const [key, entry] of this.fixedWindows.entries()) {
      if (now > entry.resetTime) {
        this.fixedWindows.delete(key);
      }
    }

    // Clean up sliding windows (remove timestamps older than 1 hour)
    for (const [key, entry] of this.slidingWindows.entries()) {
      entry.timestamps = entry.timestamps.filter(ts => now - ts < 3600000);
      if (entry.timestamps.length === 0) {
        this.slidingWindows.delete(key);
      }
    }
  }

  fixedWindow(key: string, limit: number, windowMs: number): RateLimitInfo {
    const now = Date.now();
    let entry = this.fixedWindows.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new window or reset expired window
      entry = {
        count: 1,
        resetTime: now + windowMs,
        firstRequest: now
      };
      this.fixedWindows.set(key, entry);
    } else {
      entry.count++;
    }

    const remaining = Math.max(0, limit - entry.count);
    const reset = new Date(entry.resetTime);
    const retryAfter = entry.count > limit ? Math.ceil((entry.resetTime - now) / 1000) : undefined;

    return {
      limit,
      remaining,
      reset,
      retryAfter
    };
  }

  slidingWindow(key: string, limit: number, windowMs: number): RateLimitInfo {
    const now = Date.now();
    let entry = this.slidingWindows.get(key);

    if (!entry) {
      entry = { timestamps: [] };
      this.slidingWindows.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);
    
    // Add current timestamp
    entry.timestamps.push(now);

    const count = entry.timestamps.length;
    const remaining = Math.max(0, limit - count);
    
    // Calculate when the oldest timestamp in the window will expire
    const oldestTimestamp = entry.timestamps[0] || now;
    const reset = new Date(oldestTimestamp + windowMs);
    
    const retryAfter = count > limit ? Math.ceil((oldestTimestamp + windowMs - now) / 1000) : undefined;

    return {
      limit,
      remaining,
      reset,
      retryAfter
    };
  }

  tokenBucket(key: string, limit: number, refillRate: number, refillPeriod: number = 1000): RateLimitInfo {
    // Simplified token bucket implementation
    const now = Date.now();
    let entry = this.fixedWindows.get(key);

    if (!entry) {
      entry = {
        count: limit - 1, // Start with limit-1 tokens
        resetTime: now,
        firstRequest: now
      };
      this.fixedWindows.set(key, entry);
    } else {
      // Refill tokens based on elapsed time
      const elapsed = now - entry.resetTime;
      const tokensToAdd = Math.floor(elapsed / refillPeriod) * refillRate;
      entry.count = Math.min(limit, entry.count + tokensToAdd);
      entry.resetTime = now;
      entry.count = Math.max(0, entry.count - 1); // Consume one token
    }

    const remaining = entry.count;
    const reset = new Date(now + refillPeriod);
    const retryAfter = remaining <= 0 ? Math.ceil(refillPeriod / 1000) : undefined;

    return {
      limit,
      remaining,
      reset,
      retryAfter
    };
  }

  leakyBucket(key: string, limit: number, leakRate: number, leakPeriod: number = 1000): RateLimitInfo {
    // Simplified leaky bucket implementation
    const now = Date.now();
    let entry = this.fixedWindows.get(key);

    if (!entry) {
      entry = {
        count: 1,
        resetTime: now,
        firstRequest: now
      };
      this.fixedWindows.set(key, entry);
    } else {
      // Leak requests based on elapsed time
      const elapsed = now - entry.resetTime;
      const requestsToLeak = Math.floor(elapsed / leakPeriod) * leakRate;
      entry.count = Math.max(0, entry.count - requestsToLeak);
      entry.resetTime = now;
      entry.count++; // Add current request
    }

    const remaining = Math.max(0, limit - entry.count);
    const reset = new Date(now + leakPeriod);
    const retryAfter = entry.count > limit ? Math.ceil(leakPeriod / 1000) : undefined;

    return {
      limit,
      remaining,
      reset,
      retryAfter
    };
  }

  clear(key?: string): void {
    if (key) {
      this.fixedWindows.delete(key);
      this.slidingWindows.delete(key);
    } else {
      this.fixedWindows.clear();
      this.slidingWindows.clear();
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.fixedWindows.clear();
    this.slidingWindows.clear();
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

// Default key generator
function defaultKeyGenerator(req: ApiRequest): string {
  // Use API key if available, otherwise IP address
  if (req.user?.apiKey) {
    return `api_key:${req.user.apiKey}`;
  }
  
  // Get IP address (considering proxy headers)
  const forwarded = req.headers['x-forwarded-for'] as string;
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || req.connection.remoteAddress || 'unknown';
  
  return `ip:${ip}`;
}

// Rate limit middleware factory
export function rateLimitMiddleware(options: RateLimitOptions & {
  strategy?: 'fixed' | 'sliding' | 'token' | 'leaky';
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: ApiRequest, res: Response) => void;
} = {} as any) {
  const {
    windowMs = 60000, // 1 minute
    max = 100,
    message = 'Too many requests',
    strategy = 'fixed',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
    onLimitReached
  } = options;

  return (req: ApiRequest, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    
    let rateLimitInfo: RateLimitInfo;

    switch (strategy) {
      case 'sliding':
        rateLimitInfo = rateLimiter.slidingWindow(key, max, windowMs);
        break;
      case 'token':
        rateLimitInfo = rateLimiter.tokenBucket(key, max, Math.ceil(max / 10), windowMs / 10);
        break;
      case 'leaky':
        rateLimitInfo = rateLimiter.leakyBucket(key, max, Math.ceil(max / 10), windowMs / 10);
        break;
      case 'fixed':
      default:
        rateLimitInfo = rateLimiter.fixedWindow(key, max, windowMs);
        break;
    }

    // Add rate limit headers
    res.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
    res.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    res.set('X-RateLimit-Reset', rateLimitInfo.reset.toISOString());

    if (rateLimitInfo.retryAfter) {
      res.set('Retry-After', rateLimitInfo.retryAfter.toString());
    }

    // Check if limit exceeded
    if (rateLimitInfo.remaining < 0) {
      if (onLimitReached) {
        onLimitReached(req, res);
      }

      res.status(429).json({
        success: false,
        error: {
          code: ApiErrorCode.RATE_LIMITED,
          message,
          details: {
            limit: rateLimitInfo.limit,
            remaining: rateLimitInfo.remaining,
            reset: rateLimitInfo.reset,
            retryAfter: rateLimitInfo.retryAfter
          }
        }
      } as ApiResponse);
      return;
    }

    // Handle skip conditions
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalSend = res.json;
      res.json = function(body: any) {
        const shouldSkip = (skipSuccessfulRequests && res.statusCode < 400) ||
                          (skipFailedRequests && res.statusCode >= 400);
        
        if (shouldSkip) {
          // Revert the rate limit count
          // This is a simplified approach - in production, you might want more sophisticated logic
        }
        
        return originalSend.call(this, body);
      };
    }

    next();
  };
}

// Specific rate limiters for different endpoints
export const strictRateLimit = rateLimitMiddleware({
  windowMs: 60000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests to this endpoint'
});

export const moderateRateLimit = rateLimitMiddleware({
  windowMs: 60000, // 1 minute
  max: 50, // 50 requests per minute
  strategy: 'sliding'
});

export const generousRateLimit = rateLimitMiddleware({
  windowMs: 60000, // 1 minute
  max: 200, // 200 requests per minute
  strategy: 'token'
});

// API key specific rate limiting
export function apiKeyRateLimit(baseLimit: number = 100) {
  return rateLimitMiddleware({
    windowMs: 60000,
    max: baseLimit,
    keyGenerator: (req: ApiRequest) => {
      if (req.user?.apiKey) {
        // Could implement different limits based on API key tier
        return `api_key:${req.user.apiKey}`;
      }
      return defaultKeyGenerator(req);
    }
  });
}

// User-specific rate limiting
export function userRateLimit(limit: number = 1000) {
  return rateLimitMiddleware({
    windowMs: 3600000, // 1 hour
    max: limit,
    keyGenerator: (req: ApiRequest) => {
      if (req.user?.id) {
        return `user:${req.user.id}`;
      }
      return defaultKeyGenerator(req);
    }
  });
}

// Endpoint-specific rate limiting
export function endpointRateLimit(endpoint: string, limit: number = 50) {
  return rateLimitMiddleware({
    windowMs: 60000,
    max: limit,
    keyGenerator: (req: ApiRequest) => {
      const baseKey = defaultKeyGenerator(req);
      return `${baseKey}:${endpoint}`;
    }
  });
}

// Progressive rate limiting (increases penalty for repeat offenders)
export function progressiveRateLimit() {
  const penalties = new Map<string, number>();

  return rateLimitMiddleware({
    windowMs: 60000,
    max: 100,
    onLimitReached: (req: ApiRequest, _res: Response) => {
      const key = defaultKeyGenerator(req);
      const currentPenalty = penalties.get(key) || 1;
      penalties.set(key, currentPenalty * 2);
      
      // Clean up penalties after some time
      setTimeout(() => {
        penalties.delete(key);
      }, 300000); // 5 minutes
    },
    keyGenerator: (req: ApiRequest) => {
      const baseKey = defaultKeyGenerator(req);
      const penalty = penalties.get(baseKey) || 1;
      return `${baseKey}:penalty:${penalty}`;
    }
  });
}

// Export rate limiter for testing and manual operations
export { rateLimiter, RateLimiter };