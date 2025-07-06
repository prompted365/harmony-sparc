import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Assign unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    },
    query: req.query,
    ip: req.ip
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);
    
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length') || 0
    });
    
    // Log performance warning if response time > 1000ms
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        requestId: req.requestId,
        url: req.url,
        duration: `${duration}ms`
      });
    }
  });
  
  next();
};