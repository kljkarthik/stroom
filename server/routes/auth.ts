import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db, hashPassword, verifyPassword } from '../db/database';
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth';
import { User } from '../types';
import { hasAnyAdminAccess } from '../services/rbacService';
import { recordAuditLog } from '../services/auditService';
import { config } from '../config/env';
import { createRateLimiter } from '../middleware/rateLimit';
import { validateSafeMediaUrl, sendSafeServerError } from '../services/securityService';

const router = Router();

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: () => config.authRateLimitMax,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please wait a few minutes and try again.',
});

const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(180),
  password: z.string().min(6, 'Password must be at least 6 characters long').max(128),
  full_name: z.string().min(2, 'Name must be at least 2 characters long').max(120),
  avatar_url: z.string().max(2048).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(180),
  password: z.string().min(1, 'Password is required').max(128),
});

router.post('/register', authRateLimiter, (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { email, password, full_name, avatar_url } = parsed.data;
    const avatarCheck = validateSafeMediaUrl(avatar_url, 'Avatar URL');
    if (!avatarCheck.valid) {
      return res.status(400).json({ error: avatarCheck.error });
    }

    // Check existing email
    const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email.trim());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const id = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const password_hash = hashPassword(password);
    const defaultAvatar = avatarCheck.value || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(full_name)}`;

    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, onboarding_status)
      VALUES (?, ?, ?, ?, ?, 'user', 'NOT_STARTED')
    `).run(id, email.trim().toLowerCase(), password_hash, full_name.trim(), defaultAvatar);

    const user = db.prepare('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?').get(id) as User;
    const token = generateToken(user);

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user
    });
  } catch (err: any) {
    return sendSafeServerError(res, err, 'Failed to create user account');
  }
});

router.post('/login', authRateLimiter, (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { email, password } = parsed.data;

    const userRecord = db.prepare(`
      SELECT id, email, password_hash, full_name, avatar_url, role, account_status, onboarding_status, created_at, updated_at
      FROM users
      WHERE lower(email) = lower(?)
    `).get(email.trim()) as (User & { password_hash: string; account_status?: string }) | undefined;

    if (!userRecord) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const pwCheck = verifyPassword(password, userRecord.password_hash);
    if (!pwCheck.valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Transparently upgrade legacy SHA-256 hashes to per-user salted scrypt on login
    if (pwCheck.needsRehash) {
      db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
        .run(hashPassword(password), userRecord.id);
    }

    if (userRecord.account_status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended by an administrator.' });
    }

    const { password_hash: _ph, ...user } = userRecord;

    if (hasAnyAdminAccess(user.role)) {
      recordAuditLog({
        actorId: user.id,
        actorName: user.full_name,
        actorRole: user.role,
        action: 'ADMIN_LOGIN',
        entityType: 'auth_session',
        entityId: user.id,
        result: 'success',
        source: 'auth_api',
      });
    }

    const token = generateToken(user);
    return res.json({
      message: 'Login successful',
      token,
      user
    });
  } catch (err: any) {
    return sendSafeServerError(res, err, 'Login failed');
  }
});

router.post('/logout', requireAuth, (req: AuthRequest, res: Response) => {
  if (hasAnyAdminAccess(req.user!.role)) {
    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'ADMIN_LOGOUT',
      entityType: 'auth_session',
      entityId: req.user!.id,
      result: 'success',
      source: 'auth_api',
    });
  }
  return res.json({ success: true, message: 'Logged out cleanly' });
});

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  // Fetch fresh preferences count and tags
  const prefs = db.prepare(`
    SELECT preference_key, preference_value FROM user_preferences WHERE user_id = ?
  `).all(req.user!.id) as { preference_key: string; preference_value: string }[];

  return res.json({
    user: req.user,
    preferences: prefs
  });
});

// Utility endpoint to reset demo user state for testing (disabled in production)
router.post('/reset-demo', requireAuth, (req: AuthRequest, res: Response) => {
  if (config.isProduction) {
    return res.status(403).json({ error: 'Demo reset endpoint is disabled in production.' });
  }
  const userId = req.user!.id;
  const { status = 'NOT_STARTED' } = req.body;

  db.transaction(() => {
    // Delete any active sessions and preferences if resetting to NOT_STARTED
    if (status === 'NOT_STARTED') {
      db.prepare('DELETE FROM quiz_sessions WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(userId);
    }
    db.prepare("UPDATE users SET onboarding_status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, userId);
  })();

  const updatedUser = db.prepare('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?').get(userId) as User;
  return res.json({ message: 'User status reset', user: updatedUser });
});

export default router;
