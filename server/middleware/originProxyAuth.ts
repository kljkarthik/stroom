import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { isCanonicalBase64Url32Node } from '../utils/crypto';
import { config } from '../config/env';

/**
 * Origin Proxy Authentication Guard (Trust Path B: Worker -> Express)
 * Enforces X-STROOM-Origin-Secret on /api/auth/* routes to prevent direct origin bypass.
 */
export function originProxyAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Pass through if neither origin proxy auth is required nor originProxySecret is configured
  if (!config.requireOriginProxyAuth && !config.originProxySecret) {
    return next();
  }

  const primarySecret = config.originProxySecret;
  if (!primarySecret || !isCanonicalBase64Url32Node(primarySecret)) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Origin proxy secret configuration is invalid or missing.',
    });
  }

  // Validate previous rotation secret configuration if provided
  const prevSecret = config.originProxySecretPrevious;
  const prevExpiresAt = config.originProxySecretPreviousExpiresAt;
  if (prevSecret) {
    if (!isCanonicalBase64Url32Node(prevSecret)) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Previous origin proxy secret configuration is non-canonical.',
      });
    }
    if (!prevExpiresAt || isNaN(prevExpiresAt) || prevExpiresAt <= 0) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Previous origin proxy secret expiry is missing or invalid.',
      });
    }
  }

  const clientSecret = req.headers['x-stroom-origin-secret'];
  if (typeof clientSecret !== 'string' || !isCanonicalBase64Url32Node(clientSecret)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Forbidden: Direct origin access prohibited without valid proxy secret.',
    });
  }

  // Timing-safe constant-time comparison using double-hash
  const clientHash = crypto.createHash('sha256').update(clientSecret, 'utf8').digest();
  const primaryHash = crypto.createHash('sha256').update(primarySecret, 'utf8').digest();

  if (crypto.timingSafeEqual(clientHash, primaryHash)) {
    return next();
  }

  // Check previous secret if rotation overlap is active
  if (prevSecret && prevExpiresAt) {
    const now = Date.now();
    // Expiry boundary: now >= prevExpiresAt is strictly rejected
    if (now < prevExpiresAt) {
      const prevHash = crypto.createHash('sha256').update(prevSecret, 'utf8').digest();
      if (crypto.timingSafeEqual(clientHash, prevHash)) {
        return next();
      }
    }
  }

  return res.status(403).json({
    error: 'Forbidden',
    message: 'Forbidden: Direct origin access prohibited without valid proxy secret.',
  });
}
