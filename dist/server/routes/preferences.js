"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../db/database");
const auth_1 = require("../middleware/auth");
const rbacService_1 = require("../services/rbacService");
const memberService_1 = require("../services/memberService");
const securityService_1 = require("../services/securityService");
const rateLimit_1 = require("../middleware/rateLimit");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
const passwordRateLimiter = (0, rateLimit_1.createRateLimiter)({
    windowMs: 15 * 60 * 1000,
    max: () => (env_1.config.isTest ? 200 : 10),
    keyPrefix: 'password_change',
    message: 'Too many password update attempts. Please try again later.',
});
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
        const tags = prefs.map((p) => p.preference_value);
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
        const detailedPreferences = tags.map((tag) => ({
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
                    insertPref.run(prefId, userId, tag.trim().toLowerCase());
                }
            }
            // Also sync into users.interests_json
            database_1.db.prepare("UPDATE users SET interests_json = ? WHERE id = ?").run(JSON.stringify(tags), userId);
        })();
        // Evaluate potential Pioneer Member badge
        (0, memberService_1.evaluateUserAchievements)(userId);
        return res.json({
            message: 'Preferences updated successfully',
            tags,
        });
    }
    catch (err) {
        console.error('Error updating preferences:', err);
        return res.status(500).json({ error: 'Failed to update preferences' });
    }
});
// GET /api/users/me/profile (Comprehensive Authenticated User Profile & Phase 4 Ecosystem)
router.get('/me/profile', auth_1.requireAuth, (req, res) => {
    try {
        const userId = req.user.id;
        let user = database_1.db.prepare(`
      SELECT 
        id, email, full_name, display_name, first_name, last_name, avatar_url, cover_url,
        role, member_id, phone, city, bio, interests_json, is_public,
        privacy_settings_json, notification_settings_json, onboarding_status, created_at
      FROM users WHERE id = ?
    `).get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Ensure member_id exists
        if (!user.member_id) {
            const cityCode = user.city?.toLowerCase().includes('pune') ? 'PUN' : 'HYD';
            const randomCode = Math.floor(1000 + Math.random() * 9000);
            const generatedMemberId = `STR-${cityCode}-${randomCode}`;
            database_1.db.prepare('UPDATE users SET member_id = ? WHERE id = ?').run(generatedMemberId, userId);
            user.member_id = generatedMemberId;
        }
        // Parse JSON fields safely
        try {
            user.interests = JSON.parse(user.interests_json || '[]');
        }
        catch {
            user.interests = [];
        }
        try {
            user.privacySettings = JSON.parse(user.privacy_settings_json || '{}');
        }
        catch {
            user.privacySettings = { showCommunities: true, showAchievements: true, showStamps: true, showCity: true };
        }
        try {
            user.notificationSettings = JSON.parse(user.notification_settings_json || '{}');
        }
        catch {
            user.notificationSettings = { eventReminders: true, communityUpdates: true, achievementAlerts: true, marketing: false };
        }
        // Evaluate any pending achievements on profile load
        (0, memberService_1.evaluateUserAchievements)(userId);
        // Unlocked achievements
        const achievements = database_1.db.prepare(`
      SELECT * FROM user_achievements WHERE user_id = ? ORDER BY unlocked_at DESC
    `).all(userId);
        // Passport Stamps (Verified past event check-ins from passport_stamps table)
        const passportStamps = database_1.db.prepare(`
      SELECT id, event_id, event_title, category as event_category, city_name, venue_name, stamp_icon, verified_at
      FROM passport_stamps
      WHERE user_id = ?
      ORDER BY verified_at DESC
    `).all(userId);
        // Real upcoming events (not cancelled, event_date >= current date)
        const upcomingEvents = database_1.db.prepare(`
      SELECT 
        r.id as pass_id,
        r.pass_code,
        r.qr_token,
        r.seat_tier,
        r.role_type,
        r.checkin_status,
        e.id as event_id,
        e.title,
        e.category,
        e.event_date,
        e.event_time,
        e.image_url,
        e.entry_fee,
        c.name as city_name,
        v.name as venue_name,
        v.address as venue_address
      FROM event_registrations r
      JOIN events e ON r.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE r.user_id = ? AND r.checkin_status != 'cancelled' AND e.event_date >= date('now')
      ORDER BY e.event_date ASC
    `).all(userId);
        // Real event history (completed or past)
        const eventHistory = database_1.db.prepare(`
      SELECT 
        r.id as pass_id,
        r.pass_code,
        r.checkin_status,
        r.checked_in_at,
        e.id as event_id,
        e.title,
        e.category,
        e.event_date,
        e.event_time,
        e.image_url,
        c.name as city_name,
        v.name as venue_name
      FROM event_registrations r
      JOIN events e ON r.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE r.user_id = ?
      ORDER BY e.event_date DESC
    `).all(userId);
        // Joined communities
        const joinedCommunities = database_1.db.prepare(`
      SELECT 
        c.id, c.name, c.slug, c.category, c.description, c.image_url, c.member_count,
        ci.name as city_name, cm.joined_at, cm.role as member_role
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      JOIN cities ci ON c.city_id = ci.id
      WHERE cm.user_id = ?
      ORDER BY cm.joined_at DESC
    `).all(userId);
        // Activity timeline
        const activityTimeline = database_1.db.prepare(`
      SELECT id, activity_type, title, description, reference_id, created_at
      FROM activity_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 15
    `).all(userId);
        // Unread notifications count
        const unreadNotifs = database_1.db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(userId)?.c || 0;
        // Aggregated real statistics
        const profileCompletion = (0, memberService_1.calculateProfileCompletion)(user);
        const stats = {
            totalRegistered: eventHistory.length,
            totalAttended: passportStamps.length,
            upcomingCount: upcomingEvents.length,
            communitiesCount: joinedCommunities.length,
            achievementsCount: achievements.length,
            passportStampsCount: passportStamps.length,
            passportStamps: passportStamps.length,
            eventsAttended: passportStamps.length,
            totalEventsAttended: passportStamps.length,
            upcomingBookings: upcomingEvents.length,
            joinedCommunities: joinedCommunities.length,
            completionPercentage: profileCompletion,
            unreadNotificationsCount: unreadNotifs,
        };
        return res.json({
            success: true,
            user,
            profileCompletion,
            stats,
            achievements,
            passportStamps,
            upcomingEvents,
            upcomingPasses: upcomingEvents,
            eventHistory,
            joinedCommunities,
            activityTimeline,
        });
    }
    catch (err) {
        console.error('Error fetching user profile:', err);
        return res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});
// PUT /api/users/me/profile (Update Profile Studio)
router.put('/me/profile', auth_1.requireAuth, (req, res) => {
    try {
        const userId = req.user.id;
        const { full_name, display_name, first_name, last_name, phone, city, bio, avatar_url, cover_url, interests, is_public, privacy_settings, notification_settings, } = req.body;
        const avatarCheck = (0, securityService_1.validateSafeMediaUrl)(avatar_url, 'Avatar URL');
        if (!avatarCheck.valid) {
            return res.status(400).json({ error: avatarCheck.error });
        }
        const coverCheck = (0, securityService_1.validateSafeMediaUrl)(cover_url, 'Cover URL');
        if (!coverCheck.valid) {
            return res.status(400).json({ error: coverCheck.error });
        }
        const interestsJson = Array.isArray(interests) ? JSON.stringify(interests) : undefined;
        const privacyJson = privacy_settings ? JSON.stringify(privacy_settings) : undefined;
        const notifJson = notification_settings ? JSON.stringify(notification_settings) : undefined;
        database_1.db.prepare(`
      UPDATE users 
      SET full_name = COALESCE(?, full_name),
          display_name = COALESCE(?, display_name, full_name),
          first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          phone = COALESCE(?, phone),
          city = COALESCE(?, city),
          bio = COALESCE(?, bio),
          avatar_url = COALESCE(?, avatar_url),
          cover_url = COALESCE(?, cover_url),
          interests_json = COALESCE(?, interests_json),
          is_public = COALESCE(?, is_public),
          privacy_settings_json = COALESCE(?, privacy_settings_json),
          notification_settings_json = COALESCE(?, notification_settings_json),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(full_name, display_name, first_name, last_name, phone, city, bio, avatarCheck.value, coverCheck.value, interestsJson, is_public !== undefined ? (is_public ? 1 : 0) : undefined, privacyJson, notifJson, userId);
        // If interests were updated, also update user_preferences for recommendations
        if (Array.isArray(interests)) {
            database_1.db.transaction(() => {
                database_1.db.prepare("DELETE FROM user_preferences WHERE user_id = ? AND source = 'manual_profile'").run(userId);
                const ins = database_1.db.prepare(`
          INSERT INTO user_preferences (id, user_id, preference_key, preference_value, source, updated_at)
          VALUES (?, ?, 'interest', ?, 'manual_profile', datetime('now'))
        `);
                for (const item of interests) {
                    const prefId = 'pref_' + crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16);
                    ins.run(prefId, userId, String(item).toLowerCase());
                }
            })();
        }
        (0, memberService_1.logActivity)(userId, 'profile_updated', 'Profile Studio Updated', 'Updated profile information and preferences.');
        (0, memberService_1.evaluateUserAchievements)(userId);
        const updatedUser = database_1.db.prepare(`
      SELECT 
        id, email, full_name, display_name, first_name, last_name, avatar_url, cover_url,
        role, member_id, phone, city, bio, interests_json, is_public,
        privacy_settings_json, notification_settings_json, onboarding_status
      FROM users WHERE id = ?
    `).get(userId);
        try {
            updatedUser.interests = JSON.parse(updatedUser.interests_json || '[]');
        }
        catch {
            updatedUser.interests = [];
        }
        const profileCompletion = (0, memberService_1.calculateProfileCompletion)(updatedUser);
        return res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser,
            completionPercentage: profileCompletion,
            profileCompletion,
        });
    }
    catch (err) {
        return (0, securityService_1.sendSafeServerError)(res, err, 'Failed to update profile');
    }
});
// POST /api/users/me/change-password
router.post('/me/change-password', auth_1.requireAuth, passwordRateLimiter, (req, res) => {
    try {
        const userId = req.user.id;
        const current_password = req.body.current_password || req.body.currentPassword;
        const new_password = req.body.new_password || req.body.newPassword;
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }
        if (typeof new_password !== 'string' || new_password.length < 6 || new_password.length > 128) {
            return res.status(400).json({ error: 'New password must be between 6 and 128 characters' });
        }
        const user = database_1.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
        if (!user || !(0, database_1.verifyPassword)(current_password, user.password_hash).valid) {
            return res.status(400).json({ error: 'Incorrect current password' });
        }
        database_1.db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run((0, database_1.hashPassword)(new_password), userId);
        (0, memberService_1.logActivity)(userId, 'password_changed', 'Security Update', 'Account password was changed successfully.');
        return res.json({ success: true, message: 'Password updated successfully' });
    }
    catch (err) {
        return (0, securityService_1.sendSafeServerError)(res, err, 'Failed to change password');
    }
});
// GET /api/users/me/passport (Dedicated STROOM Passport)
router.get('/me/passport', auth_1.requireAuth, (req, res) => {
    try {
        const userId = req.user.id;
        const user = database_1.db.prepare(`
      SELECT id, full_name, display_name, avatar_url, member_id, city, role, created_at, is_public
      FROM users WHERE id = ?
    `).get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Verified Passport Stamps
        const stamps = database_1.db.prepare(`
      SELECT id, event_id, event_title, category, city_name, venue_name, stamp_icon, verified_at
      FROM passport_stamps
      WHERE user_id = ?
      ORDER BY verified_at DESC
    `).all(userId);
        // All available master achievements with unlocked status
        const masterAchievements = database_1.db.prepare(`
      SELECT m.*, u.unlocked_at, CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END as is_unlocked
      FROM achievements_master m
      LEFT JOIN user_achievements u ON m.badge_key = u.badge_key AND u.user_id = ?
      WHERE m.is_active = 1
      ORDER BY is_unlocked DESC, m.points DESC
    `).all(userId);
        // Distinct metrics
        const categoriesSet = new Set(stamps.map((s) => s.category));
        const citiesSet = new Set(stamps.map((s) => s.city_name));
        const communitiesCount = database_1.db.prepare('SELECT COUNT(*) as c FROM community_members WHERE user_id = ?').get(userId)?.c || 0;
        const totalPoints = masterAchievements
            .filter((a) => a.is_unlocked === 1)
            .reduce((acc, a) => acc + (a.points || 0), 0);
        const passportData = {
            card: {
                memberId: user.member_id || `STR-HYD-${user.id.slice(0, 4).toUpperCase()}`,
                displayName: user.display_name || user.full_name,
                avatarUrl: user.avatar_url,
                memberSince: user.created_at,
                homeCity: user.city || 'Hyderabad',
                status: 'Pioneer Member',
                qrVerificationToken: `stroom_verify_${user.id}`,
            },
            stats: {
                totalVerifiedExperiences: stamps.length,
                categoriesExplored: categoriesSet.size,
                citiesExplored: citiesSet.size,
                communitiesJoined: communitiesCount,
                achievementsEarned: masterAchievements.filter((a) => a.is_unlocked === 1).length,
                totalPoints,
            },
            stamps,
            achievements: masterAchievements,
        };
        return res.json({ success: true, passport: passportData });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to fetch passport' });
    }
});
// GET /api/users/me/notifications (In-App Notification Center)
router.get('/me/notifications', auth_1.requireAuth, (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = database_1.db.prepare(`
      SELECT id, type, title, message, data_json, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 40
    `).all(userId);
        const unreadCount = database_1.db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(userId)?.c || 0;
        return res.json({ success: true, notifications, unreadCount });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});
// PATCH /api/users/me/notifications/:id/read
router.patch('/me/notifications/:id/read', auth_1.requireAuth, (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        database_1.db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
        return res.json({ success: true, message: 'Notification marked as read' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /api/users/me/notifications/mark-all-read
router.post('/me/notifications/mark-all-read', auth_1.requireAuth, (req, res) => {
    try {
        const userId = req.user.id;
        database_1.db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
        return res.json({ success: true, message: 'All notifications marked as read' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/users/public/:memberIdOrId (Public Member Profile with Privacy Controls)
router.get('/public/:memberIdOrId', (req, res) => {
    try {
        const { memberIdOrId } = req.params;
        const user = database_1.db.prepare(`
      SELECT 
        id, full_name, display_name, avatar_url, cover_url, member_id, city, bio,
        interests_json, is_public, privacy_settings_json, created_at
      FROM users
      WHERE member_id = ? OR id = ?
    `).get(memberIdOrId, memberIdOrId);
        if (!user) {
            return res.status(404).json({ error: 'Member not found' });
        }
        if (!user.is_public) {
            return res.status(403).json({
                isPrivate: true,
                displayName: user.display_name || user.full_name,
                memberId: user.member_id,
                message: 'This STROOM member has set their profile to private.',
            });
        }
        let privacy = { showCommunities: true, showAchievements: true, showStamps: true, showCity: true };
        try {
            privacy = JSON.parse(user.privacy_settings_json || '{}');
        }
        catch { }
        let interests = [];
        try {
            interests = JSON.parse(user.interests_json || '[]');
        }
        catch { }
        const publicStamps = privacy.showStamps
            ? database_1.db.prepare('SELECT id, event_title, category, city_name, venue_name, stamp_icon, verified_at FROM passport_stamps WHERE user_id = ? ORDER BY verified_at DESC').all(user.id)
            : [];
        const publicAchievements = privacy.showAchievements
            ? database_1.db.prepare('SELECT id, badge_key, title, description, icon_name, category, unlocked_at FROM user_achievements WHERE user_id = ? ORDER BY unlocked_at DESC').all(user.id)
            : [];
        const publicCommunities = privacy.showCommunities
            ? database_1.db.prepare(`
          SELECT c.id, c.name, c.category, c.image_url, ci.name as city_name, cm.joined_at
          FROM community_members cm
          JOIN communities c ON cm.community_id = c.id
          JOIN cities ci ON c.city_id = ci.id
          WHERE cm.user_id = ?
        `).all(user.id)
            : [];
        return res.json({
            success: true,
            profile: {
                memberId: user.member_id,
                displayName: user.display_name || user.full_name,
                avatarUrl: user.avatar_url,
                coverUrl: user.cover_url,
                bio: user.bio,
                city: privacy.showCity ? user.city : undefined,
                memberSince: user.created_at,
                interests,
                stamps: publicStamps,
                achievements: publicAchievements,
                communities: publicCommunities,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to fetch public profile' });
    }
});
// GET /api/users/admin/members (Admin Member Directory)
router.get('/admin/members', auth_1.requireAuth, (req, res) => {
    try {
        if (!['admin', 'super_admin', 'event_manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
        }
        const { search, city, role } = req.query;
        let query = `
      SELECT 
        u.id, u.email, u.full_name, u.display_name, u.role, u.member_id, u.city, u.phone, u.onboarding_status, u.created_at,
        (SELECT COUNT(*) FROM event_registrations WHERE user_id = u.id) as registrations_count,
        (SELECT COUNT(*) FROM passport_stamps WHERE user_id = u.id) as attended_count,
        (SELECT COUNT(*) FROM user_achievements WHERE user_id = u.id) as achievements_count
      FROM users u
      WHERE 1=1
    `;
        const params = [];
        if (search && typeof search === 'string' && search.trim()) {
            query += ` AND (u.full_name LIKE ? OR u.email LIKE ? OR u.member_id LIKE ?)`;
            params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
        }
        if (city && city !== 'all') {
            query += ` AND u.city = ?`;
            params.push(city);
        }
        if (role && role !== 'all') {
            query += ` AND u.role = ?`;
            params.push(role);
        }
        query += ` ORDER BY u.created_at DESC`;
        const members = database_1.db.prepare(query).all(...params);
        return res.json({ members });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/users/admin/members/:id/details (Admin single member inspection)
router.get('/admin/members/:id/details', auth_1.requireAuth, (req, res) => {
    try {
        if (!['admin', 'super_admin', 'event_manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { id } = req.params;
        const member = database_1.db.prepare(`
      SELECT id, email, full_name, display_name, role, member_id, city, phone, bio, avatar_url, onboarding_status, created_at
      FROM users WHERE id = ?
    `).get(id);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        const registrations = database_1.db.prepare(`
      SELECT r.*, e.title as event_title, e.category, e.event_date, c.name as city_name, v.name as venue_name
      FROM event_registrations r
      JOIN events e ON r.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `).all(id);
        const stamps = database_1.db.prepare('SELECT * FROM passport_stamps WHERE user_id = ? ORDER BY verified_at DESC').all(id);
        const achievements = database_1.db.prepare('SELECT * FROM user_achievements WHERE user_id = ? ORDER BY unlocked_at DESC').all(id);
        const activity = database_1.db.prepare('SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(id);
        return res.json({
            success: true,
            member,
            registrations,
            stamps,
            achievements,
            activity,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /api/users/admin/members/:id/award-achievement (Admin manually award badge)
router.post('/admin/members/:id/award-achievement', auth_1.requireAuth, (req, res) => {
    try {
        if (!['admin', 'super_admin'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { id } = req.params;
        const { badge_key } = req.body;
        const master = database_1.db.prepare('SELECT * FROM achievements_master WHERE badge_key = ?').get(badge_key);
        if (!master) {
            return res.status(404).json({ error: 'Achievement badge not found in master catalog' });
        }
        const achId = 'uach_' + crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16);
        database_1.db.prepare(`
      INSERT OR REPLACE INTO user_achievements (id, user_id, badge_key, title, description, icon_name, category, unlocked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(achId, id, master.badge_key, master.title, master.description, master.icon_name, master.category);
        (0, memberService_1.createNotification)(id, 'achievement', `Official Badge Awarded: ${master.title}`, `The STROOM community team has officially granted you the ${master.title} badge!`, { badgeKey: master.badge_key });
        (0, memberService_1.logActivity)(id, 'achievement_unlocked', `Badge Awarded: ${master.title}`, 'Granted by community administrator.', master.badge_key);
        return res.json({ success: true, message: `Awarded ${master.title} to member.` });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// PUT /api/users/admin/members/:id/role (Super Admin updates member role)
router.put('/admin/members/:id/role', auth_1.requireAuth, (0, auth_1.requirePermission)('roles.assign'), (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const validRoles = ['super_admin', 'admin', 'platform_admin', 'event_manager', 'auctioneer', 'auction_manager', 'community_manager', 'partner_manager', 'checkin_staff', 'support_staff', 'venue_partner', 'participant', 'user'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid user role' });
        }
        const target = database_1.db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
        if (!target)
            return res.status(404).json({ error: 'Member not found' });
        if ((rbacService_1.PRIVILEGED_ROLES.includes(role) || rbacService_1.PRIVILEGED_ROLES.includes(target.role)) && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Forbidden: Only Super Administrators can assign or modify privileged Admin roles.' });
        }
        database_1.db.prepare('UPDATE users SET role = ?, updated_at = datetime(\'now\') WHERE id = ?').run(role, id);
        return res.json({ message: `User role updated to ${role}`, memberId: id, newRole: role });
    }
    catch (err) {
        return (0, securityService_1.sendSafeServerError)(res, err, 'Failed to update role');
    }
});
exports.default = router;
