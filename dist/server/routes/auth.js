"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const database_1 = require("../db/database");
const adapter_1 = require("../db/adapter");
const auth_1 = require("../middleware/auth");
const rbacService_1 = require("../services/rbacService");
const auditService_1 = require("../services/auditService");
const env_1 = require("../config/env");
const rateLimit_1 = require("../middleware/rateLimit");
const securityService_1 = require("../services/securityService");
const d1BridgeClient_1 = require("../services/d1BridgeClient");
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
router.post('/register', authRateLimiter, async (req, res) => {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration details' });
        }
        const { email, password, full_name, avatar_url } = parsed.data;
        const avatarCheck = (0, securityService_1.validateSafeMediaUrl)(avatar_url, 'Avatar URL');
        if (!avatarCheck.valid) {
            return res.status(400).json({ error: avatarCheck.error });
        }
        const id = 'usr_' + crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16);
        const password_hash = (0, database_1.hashPassword)(password);
        const defaultAvatar = avatarCheck.value || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(full_name.trim())}`;
        // Conditional path: Cloudflare D1 Auth Bridge
        if (env_1.config.useD1AuthBridge) {
            const bridgeRes = await d1BridgeClient_1.d1BridgeClient.createUser({
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
                return (0, securityService_1.sendSafeServerError)(res, new Error(bridgeRes.error), 'Failed to create user account');
            }
            const user = {
                id,
                email: email.trim().toLowerCase(),
                full_name: full_name.trim(),
                avatar_url: defaultAvatar,
                role: 'user',
                onboarding_status: 'NOT_STARTED',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const token = (0, auth_1.generateToken)(user);
            return res.status(201).json({
                message: 'Registration successful',
                token,
                user,
            });
        }
        // Default path: Existing Database via Adapter (SQLite & PostgreSQL)
        const adapter = (0, adapter_1.getDatabaseAdapter)();
        const existing = await adapter.queryOne('SELECT id FROM users WHERE lower(email) = lower(?)', [email.trim()]);
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }
        await adapter.execute(`
      INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, onboarding_status)
      VALUES (?, ?, ?, ?, ?, 'user', 'NOT_STARTED')
    `, [id, email.trim().toLowerCase(), password_hash, full_name.trim(), defaultAvatar]);
        const user = await adapter.queryOne('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?', [id]);
        if (!user) {
            return (0, securityService_1.sendSafeServerError)(res, new Error('Failed to retrieve newly created user'), 'Failed to create user account');
        }
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
router.post('/login', authRateLimiter, async (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid login credentials' });
        }
        const { email, password } = parsed.data;
        let userRecord;
        // Conditional path: Cloudflare D1 Auth Bridge
        if (env_1.config.useD1AuthBridge) {
            const bridgeRes = await d1BridgeClient_1.d1BridgeClient.getUserForLogin(email.trim().toLowerCase());
            if (!bridgeRes.success) {
                return (0, securityService_1.sendSafeServerError)(res, new Error(bridgeRes.error), 'Login failed');
            }
            userRecord = bridgeRes.user || undefined;
        }
        else {
            // Default path: Existing Database via Adapter (SQLite & PostgreSQL)
            const adapter = (0, adapter_1.getDatabaseAdapter)();
            userRecord = await adapter.queryOne(`
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
        const pwCheck = (0, database_1.verifyPassword)(password, userRecord.password_hash);
        if (!pwCheck.valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        // Transparently upgrade legacy SHA-256 hashes to per-user salted scrypt on login
        if (pwCheck.needsRehash) {
            const newHash = (0, database_1.hashPassword)(password);
            if (env_1.config.useD1AuthBridge) {
                // Soft-fail transparent upgrade on D1 bridge
                d1BridgeClient_1.d1BridgeClient.updatePasswordHash(userRecord.id, newHash).catch(() => { });
            }
            else {
                const adapter = (0, adapter_1.getDatabaseAdapter)();
                await adapter.execute("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newHash, userRecord.id]);
            }
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
router.post('/logout', auth_1.requireAuth, async (req, res) => {
    if ((0, rbacService_1.hasAnyAdminAccess)(req.user.role)) {
        await (0, auditService_1.recordAuditLog)({
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
router.get('/me', auth_1.requireAuth, async (req, res) => {
    // Fetch fresh preferences count and tags
    const adapter = (0, adapter_1.getDatabaseAdapter)();
    const prefs = await adapter.query(`
    SELECT preference_key, preference_value FROM user_preferences WHERE user_id = ?
  `, [req.user.id]);
    return res.json({
        user: req.user,
        preferences: prefs
    });
});
// Utility endpoint to reset demo user state for testing (disabled in production)
router.post('/reset-demo', auth_1.requireAuth, async (req, res) => {
    if (env_1.config.isProduction) {
        return res.status(403).json({ error: 'Demo reset endpoint is disabled in production.' });
    }
    const userId = req.user.id;
    const { status = 'NOT_STARTED' } = req.body;
    const adapter = (0, adapter_1.getDatabaseAdapter)();
    await adapter.transaction(async (tx) => {
        // Delete any active sessions and preferences if resetting to NOT_STARTED
        if (status === 'NOT_STARTED') {
            await tx.execute('DELETE FROM quiz_sessions WHERE user_id = ?', [userId]);
            await tx.execute('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
        }
        await tx.execute("UPDATE users SET onboarding_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, userId]);
    });
    const updatedUser = await adapter.queryOne('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?', [userId]);
    return res.json({ message: 'User status reset', user: updatedUser });
});
exports.default = router;
