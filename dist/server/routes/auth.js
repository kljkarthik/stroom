"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const database_1 = require("../db/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters long'),
    full_name: zod_1.z.string().min(2, 'Name must be at least 2 characters long'),
    avatar_url: zod_1.z.string().url().optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
router.post('/register', (req, res) => {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors[0].message });
        }
        const { email, password, full_name, avatar_url } = parsed.data;
        // Check existing email
        const existing = database_1.db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }
        const id = 'usr_' + crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16);
        const password_hash = (0, database_1.hashPassword)(password);
        const defaultAvatar = avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(full_name)}`;
        database_1.db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, onboarding_status)
      VALUES (?, ?, ?, ?, ?, 'user', 'NOT_STARTED')
    `).run(id, email.toLowerCase(), password_hash, full_name, defaultAvatar);
        const user = database_1.db.prepare('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?').get(id);
        const token = (0, auth_1.generateToken)(user);
        return res.status(201).json({
            message: 'Registration successful',
            token,
            user
        });
    }
    catch (err) {
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
        const password_hash = (0, database_1.hashPassword)(password);
        const user = database_1.db.prepare(`
      SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at
      FROM users
      WHERE lower(email) = lower(?) AND password_hash = ?
    `).get(email, password_hash);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = (0, auth_1.generateToken)(user);
        return res.json({
            message: 'Login successful',
            token,
            user
        });
    }
    catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Login failed' });
    }
});
router.get('/me', auth_1.requireAuth, (req, res) => {
    // Fetch fresh preferences count and tags
    const prefs = database_1.db.prepare(`
    SELECT preference_key, preference_value FROM user_preferences WHERE user_id = ?
  `).all(req.user.id);
    return res.json({
        user: req.user,
        preferences: prefs
    });
});
// Utility endpoint to reset demo user state for testing
router.post('/reset-demo', auth_1.requireAuth, (req, res) => {
    const userId = req.user.id;
    const { status = 'NOT_STARTED' } = req.body;
    database_1.db.transaction(() => {
        // Delete any active sessions and preferences if resetting to NOT_STARTED
        if (status === 'NOT_STARTED') {
            database_1.db.prepare('DELETE FROM quiz_sessions WHERE user_id = ?').run(userId);
            database_1.db.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(userId);
        }
        database_1.db.prepare("UPDATE users SET onboarding_status = ?, updated_at = datetime('now') WHERE id = ?")
            .run(status, userId);
    })();
    const updatedUser = database_1.db.prepare('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?').get(userId);
    return res.json({ message: 'User status reset', user: updatedUser });
});
exports.default = router;
