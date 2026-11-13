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
const rbacService_1 = require("../services/rbacService");
const auditService_1 = require("../services/auditService");
const env_1 = require("../config/env");
const rateLimit_1 = require("../middleware/rateLimit");
const securityService_1 = require("../services/securityService");
const router = (0, express_1.Router)();
const authRateLimiter = (0, rateLimit_1.createRateLimiter)({
    windowMs: 15 * 60 * 1000,
    max: () => env_1.config.authRateLimitMax,
    keyPrefix: 'auth',
    message: 'Too many authentication attempts. Please wait a few minutes and try again.',
});
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').max(180),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters long').max(128),
    full_name: zod_1.z.string().min(2, 'Name must be at least 2 characters long').max(120),
    avatar_url: zod_1.z.string().max(2048).optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').max(180),
    password: zod_1.z.string().min(1, 'Password is required').max(128),
});
router.post('/register', authRateLimiter, (req, res) => {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors[0].message });
        }
        const { email, password, full_name, avatar_url } = parsed.data;
        const avatarCheck = (0, securityService_1.validateSafeMediaUrl)(avatar_url, 'Avatar URL');
        if (!avatarCheck.valid) {
            return res.status(400).json({ error: avatarCheck.error });
        }
        // Check existing email
        const existing = database_1.db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email.trim());
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }
        const id = 'usr_' + crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16);
        const password_hash = (0, database_1.hashPassword)(password);
        const defaultAvatar = avatarCheck.value || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(full_name)}`;
        database_1.db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, onboarding_status)
      VALUES (?, ?, ?, ?, ?, 'user', 'NOT_STARTED')
    `).run(id, email.trim().toLowerCase(), password_hash, full_name.trim(), defaultAvatar);
        const user = database_1.db.prepare('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?').get(id);
        const token = (0, auth_1.generateToken)(user);
        return res.status(201).json({
            message: 'Registration successful',
            token,
            user
        });
    }
    catch (err) {
        return (0, securityService_1.sendSafeServerError)(res, err, 'Failed to create user account');
    }
});
router.post('/login', authRateLimiter, (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors[0].message });
        }
        const { email, password } = parsed.data;
        const userRecord = database_1.db.prepare(`
      SELECT id, email, password_hash, full_name, avatar_url, role, account_status, onboarding_status, created_at, updated_at
      FROM users
      WHERE lower(email) = lower(?)
    `).get(email.trim());
        if (!userRecord) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const pwCheck = (0, database_1.verifyPassword)(password, userRecord.password_hash);
        if (!pwCheck.valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        // Transparently upgrade legacy SHA-256 hashes to per-user salted scrypt on login
        if (pwCheck.needsRehash) {
            database_1.db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
                .run((0, database_1.hashPassword)(password), userRecord.id);
        }
        if (userRecord.account_status === 'suspended') {
            return res.status(403).json({ error: 'This account has been suspended by an administrator.' });
        }
        const { password_hash: _ph, ...user } = userRecord;
        if ((0, rbacService_1.hasAnyAdminAccess)(user.role)) {
            (0, auditService_1.recordAuditLog)({
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
        const token = (0, auth_1.generateToken)(user);
        return res.json({
            message: 'Login successful',
            token,
            user
        });
    }
    catch (err) {
        return (0, securityService_1.sendSafeServerError)(res, err, 'Login failed');
    }
});
router.post('/logout', auth_1.requireAuth, (req, res) => {
    if ((0, rbacService_1.hasAnyAdminAccess)(req.user.role)) {
        (0, auditService_1.recordAuditLog)({
            actorId: req.user.id,
            actorName: req.user.full_name,
            actorRole: req.user.role,
            action: 'ADMIN_LOGOUT',
            entityType: 'auth_session',
            entityId: req.user.id,
            result: 'success',
            source: 'auth_api',
        });
    }
    return res.json({ success: true, message: 'Logged out cleanly' });
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
// Utility endpoint to reset demo user state for testing (disabled in production)
router.post('/reset-demo', auth_1.requireAuth, (req, res) => {
    if (env_1.config.isProduction) {
        return res.status(403).json({ error: 'Demo reset endpoint is disabled in production.' });
    }
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
