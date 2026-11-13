import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

/**
 * Sets hardened HTTP security headers across all API and static responses.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

/**
 * Final Express error handler preventing uncaught stack traces from leaking to clients.
 */
export function globalErrorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error('[STROOM Unhandled Error]', {
    method: req.method,
    path: req.path,
    message: err?.message,
    stack: config.isProduction ? undefined : err?.stack,
  });

  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload exceeds maximum allowed size (2 MB).' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON request body.' });
  }

  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  return res.status(status).json({
    error: config.isProduction && status >= 500 ? 'Internal server error' : err?.message || 'Internal server error',
  });
}
