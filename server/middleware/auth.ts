import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database';
import { User } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'stroom_jwt_super_secret_vibe_key_2026';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
    const user = db.prepare('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?').get(payload.id) as User | undefined;
    
    if (!user) {
      return res.status(401).json({ error: 'User not found or session expired.' });
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

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }

  next();
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
      const user = db.prepare('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?').get(payload.id) as User | undefined;
      if (user) {
        req.user = user;
      }
    } catch {
      // Ignore invalid token in optional auth
    }
  }
  next();
}
