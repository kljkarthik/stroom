import crypto from 'crypto';
import { getDatabaseAdapter } from '../db/adapter';

export async function logActivity(
  userId: string,
  activityType: string,
  title: string,
  description?: string,
  referenceId?: string
) {
  try {
    const actId = 'act_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const adapter = getDatabaseAdapter();
    await adapter.execute(`
      INSERT INTO activity_logs (id, user_id, activity_type, title, description, reference_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [actId, userId, activityType, title, description || null, referenceId || null]);
  } catch (err) {
    console.warn('[memberService.logActivity] Failed to write activity log:', err);
  }
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: any
) {
  try {
    const notifId = 'notif_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const adapter = getDatabaseAdapter();
    await adapter.execute(`
      INSERT INTO notifications (id, user_id, type, title, message, data_json, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `, [notifId, userId, type, title, message, data ? JSON.stringify(data) : null]);
  } catch (err) {
    console.warn('[memberService.createNotification] Failed to create notification:', err);
  }
}

export function calculateProfileCompletion(user: any): number {
  if (!user) return 0;
  let score = 0;
  if (user.full_name) score += 20;
  if (user.avatar_url && !user.avatar_url.includes('placeholder')) score += 20;
  if (user.bio && user.bio.trim().length > 10) score += 20;
  if (user.city) score += 20;
  let interests: any[] = [];
  try {
    interests = typeof user.interests_json === 'string' ? JSON.parse(user.interests_json) : (user.interests_json || []);
  } catch {
    interests = [];
  }
  if (interests.length > 0) score += 20;
  return Math.min(100, Math.max(20, score));
}

export async function evaluateUserAchievements(userId: string): Promise<string[]> {
  const newlyUnlocked: string[] = [];

  try {
    const adapter = getDatabaseAdapter();
    const user = await adapter.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return [];

    // 1. Attendance & category counts
    const attendanceStats = await adapter.queryOne(`
      SELECT
        COUNT(DISTINCT r.id) as attended_count,
        COUNT(DISTINCT e.category) as distinct_categories,
        COUNT(DISTINCT c.name) as distinct_cities,
        SUM(CASE WHEN e.category IN ('sports', 'cricket_auction', 'fitness') THEN 1 ELSE 0 END) as sports_count
      FROM event_registrations r
      JOIN events e ON r.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      WHERE r.user_id = ? AND r.checkin_status = 'checked_in'
    `, [userId]);

    const attendedCount = Number(attendanceStats?.attended_count) || 0;
    const distinctCategories = Number(attendanceStats?.distinct_categories) || 0;
    const distinctCities = Number(attendanceStats?.distinct_cities) || 0;
    const sportsCount = Number(attendanceStats?.sports_count) || 0;

    // 2. Communities count
    const commRow = await adapter.queryOne('SELECT COUNT(*) as c FROM community_members WHERE user_id = ?', [userId]);
    const commCount = Number(commRow?.c) || 0;

    // 3. Auction activity count
    const bidRow = await adapter.queryOne('SELECT COUNT(*) as c FROM bids WHERE bidder_user_id = ?', [userId]);
    const bidCount = Number(bidRow?.c) || 0;
    const auctionRegRow = await adapter.queryOne('SELECT COUNT(*) as c FROM auction_registrations WHERE user_id = ?', [userId]);
    const auctionRegCount = Number(auctionRegRow?.c) || 0;
    const auctionActivity = bidCount + auctionRegCount;

    // 4. Profile completion
    const profilePct = calculateProfileCompletion(user);

    // Get all master achievements
    const masters = await adapter.query('SELECT * FROM achievements_master WHERE is_active = 1');

    // Get already unlocked badge keys
    const unlockedRows = await adapter.query('SELECT badge_key FROM user_achievements WHERE user_id = ?', [userId]);
    const existingKeys = new Set(unlockedRows.map((a: any) => a.badge_key));

    for (const ach of masters) {
      if (existingKeys.has(ach.badge_key)) continue;

      let qualified = false;

      switch (ach.requirement_type) {
        case 'min_attendance':
          qualified = attendedCount >= ach.requirement_threshold;
          break;
        case 'distinct_categories':
          qualified = distinctCategories >= ach.requirement_threshold;
          break;
        case 'communities_joined':
          qualified = commCount >= ach.requirement_threshold;
          break;
        case 'auction_participation':
          qualified = auctionActivity >= ach.requirement_threshold;
          break;
        case 'sports_events':
          qualified = sportsCount >= ach.requirement_threshold;
          break;
        case 'cities_visited':
          qualified = distinctCities >= ach.requirement_threshold;
          break;
        case 'profile_completed':
          qualified = profilePct >= 80;
          break;
        default:
          break;
      }

      if (qualified) {
        const achId = 'uach_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        await adapter.execute(`
          INSERT INTO user_achievements (id, user_id, badge_key, title, description, icon_name, category, unlocked_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO NOTHING
        `, [
          achId,
          userId,
          ach.badge_key,
          ach.title,
          ach.description,
          ach.icon_name,
          ach.category
        ]);

        newlyUnlocked.push(ach.badge_key);
        existingKeys.add(ach.badge_key);

        await createNotification(
          userId,
          'achievement',
          `Badge Unlocked: ${ach.title}`,
          `Congratulations! You earned the official STROOM "${ach.title}" badge: ${ach.description}`,
          { badgeKey: ach.badge_key, points: ach.points }
        );

        await logActivity(
          userId,
          'achievement_unlocked',
          `Unlocked Achievement: ${ach.title}`,
          ach.description,
          ach.badge_key
        );
      }
    }
  } catch (err) {
    console.warn('[memberService.evaluateUserAchievements] Error evaluating achievements:', err);
  }

  return newlyUnlocked;
}
