"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.optionalAuth = optionalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../db/database");
const JWT_SECRET = process.env.JWT_SECRET || 'stroom_jwt_super_secret_vibe_key_2026';
function generateToken(user) {
    return jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required. Please provide a valid Bearer token.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = database_1.db.prepare('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?').get(payload.id);
        if (!user) {
            return res.status(401).json({ error: 'User not found or session expired.' });
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
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
    }
    next();
}
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            const user = database_1.db.prepare('SELECT id, email, full_name, avatar_url, role, onboarding_status, created_at, updated_at FROM users WHERE id = ?').get(payload.id);
            if (user) {
                req.user = user;
            }
        }
        catch {
            // Ignore invalid token in optional auth
        }
    }
    next();
}
