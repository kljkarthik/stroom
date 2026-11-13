import { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number | (() => number);
  keyPrefix: string;
  message?: string;
}

const stores = new Map<string, Map<string, Bucket>>();

export function createRateLimiter(options: RateLimitOptions) {
  const store = new Map<string, Bucket>();
  stores.set(options.keyPrefix, store);

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();
    const limit = typeof options.max === 'function' ? options.max() : options.max;

    let bucket = store.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      store.set(key, bucket);
    }

    bucket.count += 1;

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));

    if (bucket.count > limit) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: options.message || 'Too many requests. Please wait before trying again.',
        retryAfterSeconds: retryAfterSec,
      });
    }

    // Periodic cleanup so memory stays bounded
    if (store.size > 5000) {
      for (const [k, b] of store.entries()) {
        if (now > b.resetAt) store.delete(k);
      }
    }

    next();
  };
}

export function resetRateLimiters() {
  for (const store of stores.values()) {
    store.clear();
  }
}
