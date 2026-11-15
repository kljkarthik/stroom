"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.requirePermission = requirePermission;
exports.optionalAuth = optionalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const adapter_1 = require("../db/adapter");
const rbacService_1 = require("../services/rbacService");
const env_1 = require("../config/env");
const JWT_SECRET = env_1.config.jwtSecret;
function generateToken(user) {
    return jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required. Please provide a valid Bearer token.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const adapter = (0, adapter_1.getDatabaseAdapter)();
        const user = await adapter.queryOne('SELECT id, email, full_name, avatar_url, role, account_status, onboarding_status, created_at, updated_at FROM users WHERE id = ?', [payload.id]);
        if (!user) {
            return res.status(401).json({ error: 'User not found or session expired.' });
        }
        if (user.account_status === 'suspended') {
            return res.status(403).json({ error: 'Account suspended. Please contact STROOM support.' });
        }
        req.user = user;
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!(0, rbacService_1.hasAnyAdminAccess)(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
    }
    next();
}
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required.' });
        }
        if (!(0, rbacService_1.hasPermission)(req.user.role, permission)) {
            return res.status(403).json({ error: `Forbidden: Missing required permission (${permission}).` });
        }
        next();
    };
}
async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            const adapter = (0, adapter_1.getDatabaseAdapter)();
            const user = await adapter.queryOne('SELECT id, email, full_name, avatar_url, role, account_status, onboarding_status, created_at, updated_at FROM users WHERE id = ?', [payload.id]);
            if (user && user.account_status !== 'suspended') {
                req.user = user;
            }
        }
        catch {
            // Ignore invalid token in optional auth
        }
    }
    next();
}
