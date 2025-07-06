/**
 * Caching Middleware
 * High-performance in-memory and Redis caching for API responses
 */

import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ApiRequest, CacheOptions, ApiResponse } from '../types';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  hits: number;
  headers?: Record<string, string>;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  memoryUsage: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: 0,
    memoryUsage: 0
  };
  private cleanupInterval: NodeJS.Timeout;
  private maxSize: number;
  private maxMemory: number; // in bytes

  constructor(options: { maxSize?: number; maxMemory?: number; cleanupInterval?: number } = {}) {
    this.maxSize = options.maxSize || 10000;
    this.maxMemory = options.maxMemory || 100 * 1024 * 1024; // 100MB
    
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, options.cleanupInterval || 300000);
  }

  private calculateSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.updateStats();
    
    // If we're still over limits, remove least recently used items
    if (this.cache.size > this.maxSize || this.stats.memoryUsage > this.maxMemory) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    // Sort by hits (LRU approximation) and remove entries
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.hits - b.hits);

    while ((this.cache.size > this.maxSize || this.stats.memoryUsage > this.maxMemory) && entries.length > 0) {
      const [key] = entries.shift()!;
      this.cache.delete(key);
    }

    this.updateStats();
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;
    this.stats.memoryUsage = 0;

    for (const entry of this.cache.values()) {
      this.stats.memoryUsage += this.calculateSize(entry.data);
    }
  }

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update hit count and stats
    entry.hits++;
    this.stats.hits++;
    return entry;
  }

  set(key: string, data: any, ttl: number, headers?: Record<string, string>): void {
    const size = this.calculateSize(data);
    
    // Check if this single entry would exceed memory limit
    if (size > this.maxMemory * 0.1) { // Don't cache items larger than 10% of max memory
      return;
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      headers
    };

    this.cache.set(key, entry);
    this.stats.sets++;
    this.updateStats();

    // Check limits and evict if necessary
    if (this.cache.size > this.maxSize || this.stats.memoryUsage > this.maxMemory) {
      this.evictLRU();
    }
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.updateStats();
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0,
      memoryUsage: 0
    };
  }

  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  keys(): string[] {
    const now = Date.now();
    const validKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now <= entry.timestamp + entry.ttl) {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Global cache instance
const memoryCache = new MemoryCache({
  maxSize: parseInt(process.env.CACHE_MAX_SIZE || '10000'),
  maxMemory: parseInt(process.env.CACHE_MAX_MEMORY || '104857600'), // 100MB
  cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '300000') // 5 minutes
});

// Default key generator
function defaultKeyGenerator(req: ApiRequest): string {
  const { method, originalUrl, query, user } = req;
  
  // Include user ID in cache key for user-specific caching
  const userId = user?.id || 'anonymous';
  
  // Create a hash of the query parameters for consistent key generation
  const queryString = JSON.stringify(query);
  const queryHash = crypto.createHash('md5').update(queryString).digest('hex');
  
  return `${method}:${originalUrl}:${userId}:${queryHash}`;
}

// Cache middleware factory
export function cacheMiddleware(options: CacheOptions & {
  keyGenerator?: (req: ApiRequest) => string;
  condition?: (req: ApiRequest, res: Response) => boolean;
  onHit?: (req: ApiRequest, res: Response, data: any) => void;
  onMiss?: (req: ApiRequest, res: Response) => void;
  tags?: string[];
} = {}) {
  const {
    ttl = 60, // 60 seconds default
    keyGenerator = defaultKeyGenerator,
    condition = () => true,
    onHit,
    onMiss,
    tags = []
  } = options;

  return (req: ApiRequest, res: Response, next: NextFunction) => {
    // Only cache GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    // Check if caching condition is met
    if (!condition(req, res)) {
      return next();
    }

    const key = keyGenerator(req);
    const cached = memoryCache.get(key);

    if (cached) {
      // Cache hit
      if (onHit) {
        onHit(req, res, cached.data);
      }

      // Set cache headers
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', key);
      
      if (cached.headers) {
        res.set(cached.headers);
      }

      return res.json(cached.data);
    }

    // Cache miss - intercept response
    if (onMiss) {
      onMiss(req, res);
    }

    res.set('X-Cache', 'MISS');
    res.set('X-Cache-Key', key);

    // Store original json method
    const originalJson = res.json;
    
    res.json = function(data: any) {
      // Only cache successful responses
      if (res.statusCode === 200) {
        const headers: Record<string, string> = {};
        
        // Preserve important headers
        const headersToPreserve = ['content-type', 'etag', 'last-modified'];
        headersToPreserve.forEach(header => {
          const value = res.get(header);
          if (value) {
            headers[header] = value;
          }
        });

        memoryCache.set(key, data, ttl * 1000, headers);
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

// Specific cache configurations
export const shortCache = cacheMiddleware({
  ttl: 30, // 30 seconds
  condition: (req) => req.method === 'GET'
});

export const mediumCache = cacheMiddleware({
  ttl: 300, // 5 minutes
  condition: (req) => req.method === 'GET'
});

export const longCache = cacheMiddleware({
  ttl: 3600, // 1 hour
  condition: (req) => req.method === 'GET'
});

// User-specific caching
export function userCache(ttl: number = 60) {
  return cacheMiddleware({
    ttl,
    keyGenerator: (req: ApiRequest) => {
      const userId = req.user?.id || 'anonymous';
      return `user:${userId}:${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
    }
  });
}

// Tag-based caching for cache invalidation
export function taggedCache(tags: string[], ttl: number = 60) {
  return cacheMiddleware({
    ttl,
    tags,
    keyGenerator: (req: ApiRequest) => {
      const baseKey = defaultKeyGenerator(req);
      return `tagged:${tags.join(',')}:${baseKey}`;
    }
  });
}

// Conditional caching based on response data
export function conditionalCache(condition: (data: any) => boolean, ttl: number = 60) {
  return cacheMiddleware({
    ttl,
    condition: (req, res) => {
      // Override the json method to check condition
      const originalJson = res.json;
      res.json = function(data: any) {
        if (condition(data)) {
          // Cache this response
          const key = defaultKeyGenerator(req);
          memoryCache.set(key, data, ttl * 1000);
        }
        return originalJson.call(this, data);
      };
      return false; // Don't use default caching logic
    }
  });
}

// Cache invalidation middleware
export function invalidateCache(pattern?: string) {
  return (req: ApiRequest, res: Response, next: NextFunction) => {
    if (pattern) {
      // Invalidate specific pattern
      const keys = memoryCache.keys();
      const regex = new RegExp(pattern);
      
      keys.forEach(key => {
        if (regex.test(key)) {
          memoryCache.delete(key);
        }
      });
    } else {
      // Invalidate all cache
      memoryCache.clear();
    }

    next();
  };
}

// Cache warming (pre-populate cache)
export async function warmCache(routes: Array<{ method: string; url: string; data: any }>) {
  routes.forEach(route => {
    const key = `${route.method}:${route.url}:anonymous:d41d8cd98f00b204e9800998ecf8427e`;
    memoryCache.set(key, route.data, 3600000); // 1 hour
  });
}

// Cache statistics endpoint data
export function getCacheStats() {
  const stats = memoryCache.getStats();
  const hitRate = stats.hits + stats.misses > 0 ? 
    (stats.hits / (stats.hits + stats.misses)) * 100 : 0;

  return {
    ...stats,
    hitRate: Math.round(hitRate * 100) / 100,
    memoryUsageMB: Math.round(stats.memoryUsage / 1024 / 1024 * 100) / 100
  };
}

// Export cache instance for manual operations
export { memoryCache, MemoryCache };