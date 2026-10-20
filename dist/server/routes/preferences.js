"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../db/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/users/me/preferences
router.get('/me/preferences', auth_1.requireAuth, (req, res) => {
    try {
        const userId = req.user.id;
        const prefs = database_1.db.prepare(`
      SELECT p.id, p.preference_key, p.preference_value, p.source, p.updated_at
      FROM user_preferences p
      WHERE p.user_id = ?
    `).all(userId);
        // Extract tags
        const tags = prefs.map(p => p.preference_value);
        // Map tags to friendly option labels if possible
        const options = database_1.db.prepare(`
      SELECT DISTINCT stable_value, label FROM options WHERE is_active = 1
    `).all();
        const labelMap = {};
        for (const opt of options) {
            if (!labelMap[opt.stable_value]) {
                labelMap[opt.stable_value] = opt.label;
            }
        }
        const detailedPreferences = tags.map(tag => ({
            tag,
            label: labelMap[tag] || tag.replace(/_/g, ' '),
        }));
        return res.json({
            user_id: userId,
            tags,
            preferences: detailedPreferences,
            onboarding_status: req.user.onboarding_status,
        });
    }
    catch (err) {
        console.error('Error fetching preferences:', err);
        return res.status(500).json({ error: 'Failed to fetch user preferences' });
    }
});
// PUT /api/users/me/preferences
router.put('/me/preferences', auth_1.requireAuth, (req, res) => {
    try {
        const userId = req.user.id;
        const { tags } = req.body;
        if (!Array.isArray(tags)) {
            return res.status(400).json({ error: 'Tags array is required' });
        }
        database_1.db.transaction(() => {
            // Clear existing preferences
            database_1.db.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(userId);
            const insertPref = database_1.db.prepare(`
        INSERT INTO user_preferences (id, user_id, preference_key, preference_value, source, updated_at)
        VALUES (?, ?, 'vibe_tag', ?, 'manual_profile', datetime('now'))
      `);
            for (const tag of tags) {
                if (typeof tag === 'string' && tag.trim()) {
                    const prefId = 'pref_' + crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16);
                    insertPref.run(prefId, userId, tag.trim());
                }
            }
            // If user had SKIPPED or NOT_STARTED, updating preferences can set onboarding_status to COMPLETED
            if (tags.length > 0 && req.user.onboarding_status !== 'COMPLETED') {
                database_1.db.prepare("UPDATE users SET onboarding_status = 'COMPLETED', updated_at = datetime('now') WHERE id = ?").run(userId);
            }
        })();
        return res.json({
            message: 'Preferences successfully updated',
            tags,
        });
    }
    catch (err) {
        console.error('Error updating preferences:', err);
        return res.status(500).json({ error: 'Failed to update preferences' });
    }
});
exports.default = router;
