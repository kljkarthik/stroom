import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db, hashPassword } from '../db/database';
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth';
import { User } from '../types';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  full_name: z.string().min(2, 'Name must be at least 2 characters long'),
  avatar_url: z.string().url().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { email, password, full_name, avatar_url } = parsed.data;

    // Check existing email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const id = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const password_hash = hashPassword(password);
    const defaultAvatar = avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(full_name)}`;

    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, onboarding_status)
      VALUES (?, ?, ?, ?, ?, 'user', 'NOT_STARTED')
    `).run(id, email.toLowerCase(), password_hash, full_name, defaultAvatar);

    const user = db.prepare('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?').get(id) as User;
    const token = generateToken(user);

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Failed to create user account' });
  }
});

router.post('/login', (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { email, password } = parsed.data;
    const password_hash = hashPassword(password);

    const user = db.prepare(`
      SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at
      FROM users
      WHERE lower(email) = lower(?) AND password_hash = ?
    `).get(email, password_hash) as User | undefined;

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    return res.json({
      message: 'Login successful',
      token,
      user
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
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

// Utility endpoint to reset demo user state for testing
router.post('/reset-demo', requireAuth, (req: AuthRequest, res: Response) => {
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
