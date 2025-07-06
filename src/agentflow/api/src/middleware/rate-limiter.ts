import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { ApiErrorBuilder } from './error-handler';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (_req, res) => {
    const error = ApiErrorBuilder.badRequest(
      'Too many requests from this IP, please try again later.',
      {
        retryAfter: res.getHeader('Retry-After'),
        limit: config.rateLimitMax,
        windowMs: config.rateLimitWindowMs
      }
    );
    error.statusCode = 429;
    res.status(429).json({
      error: {
        message: error.message,
        statusCode: 429,
        timestamp: new Date().toISOString(),
        retryAfter: res.getHeader('Retry-After')
      }
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/health/live';
  },
  keyGenerator: (req) => {
    // Use IP address as the key for rate limiting
    return req.ip || 'unknown';
  }
});

// Create specialized rate limiters for different endpoints
export const strictRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests to this endpoint, please try again later.'
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true // Don't count successful requests
});