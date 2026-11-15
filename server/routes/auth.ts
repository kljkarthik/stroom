import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../db/database';
import { getDatabaseAdapter } from '../db/adapter';
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth';
import { User } from '../types';
import { hasAnyAdminAccess } from '../services/rbacService';
import { recordAuditLog } from '../services/auditService';
import { config } from '../config/env';
import { createRateLimiter } from '../middleware/rateLimit';
import { validateSafeMediaUrl, sendSafeServerError } from '../services/securityService';
import { d1BridgeClient } from '../services/d1BridgeClient';

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

router.post('/register', authRateLimiter, async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration details' });
    }

    const { email, password, full_name, avatar_url } = parsed.data;
    const avatarCheck = validateSafeMediaUrl(avatar_url, 'Avatar URL');
    if (!avatarCheck.valid) {
      return res.status(400).json({ error: avatarCheck.error });
    }

    const id = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const password_hash = hashPassword(password);
    const defaultAvatar = avatarCheck.value || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(full_name.trim())}`;

    // Conditional path: Cloudflare D1 Auth Bridge
    if (config.useD1AuthBridge) {
      const bridgeRes = await d1BridgeClient.createUser({
        id,
        email: email.trim().toLowerCase(),
        password_hash,
        full_name: full_name.trim(),
        avatar_url: defaultAvatar,
      });

      if (!bridgeRes.success) {
        if (bridgeRes.code === 'USER_EXISTS' || bridgeRes.error?.includes('already exists')) {
          return res.status(409).json({ error: 'An account with this email already exists' });
        }
        return sendSafeServerError(res, new Error(bridgeRes.error), 'Failed to create user account');
      }

      const user: User = {
        id,
        email: email.trim().toLowerCase(),
        full_name: full_name.trim(),
        avatar_url: defaultAvatar,
        role: 'user',
        onboarding_status: 'NOT_STARTED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const token = generateToken(user);
      return res.status(201).json({
        message: 'Registration successful',
        token,
        user,
      });
    }

    // Default path: Existing Database via Adapter (SQLite & PostgreSQL)
    const adapter = getDatabaseAdapter();
    const existing = await adapter.queryOne<{ id: string }>('SELECT id FROM users WHERE lower(email) = lower(?)', [email.trim()]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    await adapter.execute(`
      INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, onboarding_status)
      VALUES (?, ?, ?, ?, ?, 'user', 'NOT_STARTED')
    `, [id, email.trim().toLowerCase(), password_hash, full_name.trim(), defaultAvatar]);

    const user = await adapter.queryOne<User>('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?', [id]);
    if (!user) {
      return sendSafeServerError(res, new Error('Failed to retrieve newly created user'), 'Failed to create user account');
    }
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

router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid login credentials' });
    }

    const { email, password } = parsed.data;

    let userRecord: (User & { password_hash: string; account_status?: string }) | undefined;

    // Conditional path: Cloudflare D1 Auth Bridge
    if (config.useD1AuthBridge) {
      const bridgeRes = await d1BridgeClient.getUserForLogin(email.trim().toLowerCase());
      if (!bridgeRes.success) {
        return sendSafeServerError(res, new Error(bridgeRes.error), 'Login failed');
      }
      userRecord = bridgeRes.user || undefined;
    } else {
      // Default path: Existing Database via Adapter (SQLite & PostgreSQL)
      const adapter = getDatabaseAdapter();
      userRecord = await adapter.queryOne<User & { password_hash: string; account_status?: string }>(`
        SELECT id, email, password_hash, full_name, avatar_url, role, account_status, onboarding_status, created_at, updated_at
        FROM users
        WHERE lower(email) = lower(?)
      `, [email.trim()]);
    }

    if (!userRecord) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Strict credential defense: accounts without configured credentials cannot authenticate
    if (!userRecord.password_hash || typeof userRecord.password_hash !== 'string' || userRecord.password_hash.trim().length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const pwCheck = verifyPassword(password, userRecord.password_hash);
    if (!pwCheck.valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Transparently upgrade legacy SHA-256 hashes to per-user salted scrypt on login
    if (pwCheck.needsRehash) {
      const newHash = hashPassword(password);
      if (config.useD1AuthBridge) {
        // Soft-fail transparent upgrade on D1 bridge
        d1BridgeClient.updatePasswordHash(userRecord.id, newHash).catch(() => {});
      } else {
        const adapter = getDatabaseAdapter();
        await adapter.execute("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newHash, userRecord.id]);
      }
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

router.post('/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  if (hasAnyAdminAccess(req.user!.role)) {
    await recordAuditLog({
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

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  // Fetch fresh preferences count and tags
  const adapter = getDatabaseAdapter();
  const prefs = await adapter.query<{ preference_key: string; preference_value: string }>(`
    SELECT preference_key, preference_value FROM user_preferences WHERE user_id = ?
  `, [req.user!.id]);

  return res.json({
    user: req.user,
    preferences: prefs
  });
});

// Utility endpoint to reset demo user state for testing (disabled in production)
router.post('/reset-demo', requireAuth, async (req: AuthRequest, res: Response) => {
  if (config.isProduction) {
    return res.status(403).json({ error: 'Demo reset endpoint is disabled in production.' });
  }
  const userId = req.user!.id;
  const { status = 'NOT_STARTED' } = req.body;
  const adapter = getDatabaseAdapter();

  await adapter.transaction(async (tx) => {
    // Delete any active sessions and preferences if resetting to NOT_STARTED
    if (status === 'NOT_STARTED') {
      await tx.execute('DELETE FROM quiz_sessions WHERE user_id = ?', [userId]);
      await tx.execute('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
    }
    await tx.execute("UPDATE users SET onboarding_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, userId]);
  });

  const updatedUser = await adapter.queryOne<User>('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?', [userId]);
  return res.json({ message: 'User status reset', user: updatedUser });
});

export default router;
