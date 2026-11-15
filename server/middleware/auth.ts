import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabaseAdapter } from '../db/adapter';
import { User } from '../types';
import { AdminPermission, hasPermission, hasAnyAdminAccess } from '../services/rbacService';
import { config } from '../config/env';

const JWT_SECRET = config.jwtSecret;

export interface AuthRequest extends Request {
  user?: User & { account_status?: string };
}

export function generateToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
    const adapter = getDatabaseAdapter();
    const user = await adapter.queryOne<User & { account_status?: string }>(
      'SELECT id, email, full_name, avatar_url, role, account_status, onboarding_status, created_at, updated_at FROM users WHERE id = ?',
      [payload.id]
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found or session expired.' });
    }

    if (user.account_status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Please contact STROOM support.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (!hasAnyAdminAccess(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }

  next();
}

export function requirePermission(permission: AdminPermission) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: `Forbidden: Missing required permission (${permission}).` });
    }

    next();
  };
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
      const adapter = getDatabaseAdapter();
      const user = await adapter.queryOne<User & { account_status?: string }>(
        'SELECT id, email, full_name, avatar_url, role, account_status, onboarding_status, created_at, updated_at FROM users WHERE id = ?',
        [payload.id]
      );
      if (user && user.account_status !== 'suspended') {
        req.user = user;
      }
    } catch {
      // Ignore invalid token in optional auth
    }
  }
  next();
}
