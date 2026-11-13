import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database';
import { AuthRequest, requirePermission } from '../middleware/auth';
import {
  ROLE_PERMISSIONS,
  PRIVILEGED_ROLES,
  getRolePermissions,
  getAllowedSidebarSections,
  hasPermission,
} from '../services/rbacService';
import { recordAuditLog } from '../services/auditService';
import { createNotification, evaluateUserAchievements, logActivity } from '../services/memberService';
import { notifyPartner } from '../services/partnerService';
import { validateSafeMediaUrl } from '../services/securityService';

const router = Router();

// =========================================================================
// 0. ADMIN PERMISSIONS PROFILE & GLOBAL SEARCH
// =========================================================================

router.get('/me/permissions', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  return res.json({
    success: true,
    role: user.role,
    permissions: getRolePermissions(user.role),
    allowedSections: getAllowedSidebarSections(user.role),
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    },
  });
});

router.get('/global-search', requirePermission('overview.view'), (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ success: true, results: { members: [], events: [], communities: [], partners: [], venues: [], auctions: [] } });
    }
    const like = `%${q}%`;
    const role = req.user!.role;

    const members = hasPermission(role, 'members.view')
      ? db.prepare(`
          SELECT id, full_name, member_id, role, city
          FROM users
          WHERE full_name LIKE ? OR email LIKE ? OR member_id LIKE ?
          LIMIT 6
        `).all(like, like, like)
      : [];

    const events = hasPermission(role, 'events.view')
      ? db.prepare(`SELECT id, title, category, status, event_date FROM events WHERE title LIKE ? OR category LIKE ? LIMIT 6`).all(like, like)
      : [];

    const communities = hasPermission(role, 'communities.manage')
      ? db.prepare(`SELECT id, name, category, status FROM communities WHERE name LIKE ? OR category LIKE ? LIMIT 6`).all(like, like)
      : [];

    const partners = hasPermission(role, 'partners.verify')
      ? db.prepare(`SELECT id, business_name, city, verification_status FROM partner_accounts WHERE business_name LIKE ? OR contact_email LIKE ? LIMIT 6`).all(like, like)
      : [];

    const venues = hasPermission(role, 'venues.manage')
      ? db.prepare(`SELECT id, name, area, is_verified FROM venues WHERE name LIKE ? OR area LIKE ? LIMIT 6`).all(like, like)
      : [];

    const auctions = hasPermission(role, 'auctions.view')
      ? db.prepare(`SELECT id, title, status FROM auction_rooms WHERE title LIKE ? LIMIT 6`).all(like)
      : [];

    return res.json({
      success: true,
      results: { members, events, communities, partners, venues, auctions },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 1. CENTRALIZED PLATFORM OVERVIEW
// =========================================================================

router.get('/dashboard-overview', requirePermission('overview.view'), (req: AuthRequest, res: Response) => {
  try {
    const totalMembers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
    // Active members explicitly defined: users updated or registered in last 30 days or participating in events/communities
    const activeMembers30d = (db.prepare(`
      SELECT COUNT(DISTINCT id) as c FROM (
        SELECT id FROM users WHERE account_status = 'active' AND datetime(updated_at) >= datetime('now', '-30 days')
        UNION
        SELECT user_id as id FROM event_registrations WHERE datetime(created_at) >= datetime('now', '-30 days')
        UNION
        SELECT user_id as id FROM activity_logs WHERE datetime(created_at) >= datetime('now', '-30 days')
      )
    `).get() as any).c;

    const totalEvents = (db.prepare('SELECT COUNT(*) as c FROM events WHERE COALESCE(is_archived, 0) = 0').get() as any).c;
    const upcomingEventsCount = (db.prepare("SELECT COUNT(*) as c FROM events WHERE status IN ('published', 'live', 'Scheduled') AND COALESCE(is_archived, 0) = 0").get() as any).c;
    const completedEventsCount = (db.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'completed'").get() as any).c;
    const totalRegistrations = (db.prepare("SELECT COUNT(*) as c FROM event_registrations WHERE checkin_status != 'cancelled'").get() as any).c;
    const totalVerifiedAttendance = (db.prepare("SELECT COUNT(*) as c FROM event_registrations WHERE checkin_status = 'checked_in'").get() as any).c;
    const totalCommunities = (db.prepare("SELECT COUNT(*) as c FROM communities WHERE COALESCE(status, 'published') != 'archived'").get() as any).c;
    const verifiedPartners = (db.prepare("SELECT COUNT(*) as c FROM partner_accounts WHERE verification_status = 'Verified'").get() as any).c;
    const pendingPartnersCount = (db.prepare("SELECT COUNT(*) as c FROM partner_accounts WHERE verification_status IN ('Submitted', 'Under Review')").get() as any).c;
    const activeVenues = (db.prepare('SELECT COUNT(*) as c FROM venues WHERE is_verified = 1').get() as any).c;
    const liveAuctions = (db.prepare("SELECT COUNT(*) as c FROM auction_rooms WHERE status = 'LIVE'").get() as any).c;

    const recentRegistrations = db.prepare(`
      SELECT r.id, r.pass_code, r.checkin_status, r.created_at, u.full_name as member_name, e.title as event_title
      FROM event_registrations r
      JOIN users u ON r.user_id = u.id
      JOIN events e ON r.event_id = e.id
      ORDER BY r.created_at DESC
      LIMIT 6
    `).all();

    const recentEvents = db.prepare(`
      SELECT e.id, e.title, e.category, e.status, e.event_date, c.name as city_name, e.created_at
      FROM events e
      JOIN cities c ON e.city_id = c.id
      ORDER BY e.created_at DESC
      LIMIT 5
    `).all();

    const upcomingEvents = db.prepare(`
      SELECT e.id, e.title, e.event_date, e.event_time, e.seats_total, e.seats_booked, e.status, c.name as city_name, v.name as venue_name
      FROM events e
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE e.status IN ('published', 'live')
      ORDER BY e.is_flagship DESC, e.created_at DESC
      LIMIT 5
    `).all();

    const recentCheckins = db.prepare(`
      SELECT r.id, r.pass_code, r.checked_in_at, u.full_name as member_name, e.title as event_title
      FROM event_registrations r
      JOIN users u ON r.user_id = u.id
      JOIN events e ON r.event_id = e.id
      WHERE r.checkin_status = 'checked_in'
      ORDER BY r.checked_in_at DESC
      LIMIT 6
    `).all();

    const partnerApplications = db.prepare(`
      SELECT id, business_name, city, category, verification_status, created_at
      FROM partner_accounts
      ORDER BY verification_status = 'Submitted' DESC, created_at DESC
      LIMIT 5
    `).all();

    const pendingCollaborations = db.prepare(`
      SELECT pc.id, pc.event_name, pc.status, pc.proposed_date, p.business_name as partner_name
      FROM partner_collaborations pc
      JOIN partner_accounts p ON pc.partner_id = p.id
      WHERE pc.status IN ('Proposal Sent', 'Approved', 'Negotiation')
      ORDER BY pc.updated_at DESC
      LIMIT 5
    `).all();

    const recentAuctionActivity = db.prepare(`
      SELECT b.id, b.amount, b.placed_at, a.title as auction_title, p.name as player_name, t.name as team_name
      FROM bids b
      JOIN auction_rooms a ON b.auction_id = a.id
      JOIN auction_players p ON b.player_id = p.id
      JOIN auction_teams t ON b.team_id = t.id
      ORDER BY b.placed_at DESC
      LIMIT 5
    `).all();

    const reportedPostsCount = (db.prepare("SELECT COUNT(*) as c FROM community_posts WHERE status IN ('Reported', 'Pending')").get() as any).c;
    const pendingCampaignsCount = (db.prepare("SELECT COUNT(*) as c FROM coupons WHERE approval_status = 'Submitted'").get() as any).c;

    const systemAlerts: { severity: string; title: string; detail: string; targetSection: string }[] = [];
    if (pendingPartnersCount > 0) {
      systemAlerts.push({
        severity: 'warning',
        title: `${pendingPartnersCount} Partner Application(s) Pending Review`,
        detail: 'Business verification submissions are awaiting administrator approval.',
        targetSection: 'partners',
      });
    }
    if (pendingCampaignsCount > 0) {
      systemAlerts.push({
        severity: 'info',
        title: `${pendingCampaignsCount} Partner Offer Campaign(s) Awaiting Approval`,
        detail: 'Review discount terms before campaigns can become publicly active.',
        targetSection: 'partners',
      });
    }
    if (reportedPostsCount > 0) {
      systemAlerts.push({
        severity: 'warning',
        title: `${reportedPostsCount} Community Post(s) Require Moderation`,
        detail: 'Flagged or pending community posts await review.',
        targetSection: 'moderation',
      });
    }

    return res.json({
      success: true,
      metrics: {
        totalMembers,
        activeMembers30d,
        activePeriodLabel: 'Last 30 days (profile activity, registrations, or engagement logs)',
        totalEvents,
        upcomingEvents: upcomingEventsCount,
        completedEvents: completedEventsCount,
        totalRegistrations,
        totalVerifiedAttendance,
        totalCommunities,
        verifiedPartners,
        pendingPartners: pendingPartnersCount,
        activeVenues,
        liveAuctions,
      },
      activity: {
        recentRegistrations,
        recentEvents,
        upcomingEvents,
        recentCheckins,
        partnerApplications,
        pendingCollaborations,
        recentAuctionActivity,
        systemAlerts,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Helper to map category slugs to readable STROOM labels
function formatCategoryLabel(raw: string): string {
  const key = (raw || 'other').toLowerCase();
  const map: Record<string, string> = {
    cricket: 'Cricket & Sports',
    cricket_auction: 'Cricket & Auctions',
    auction: 'Cricket Auctions',
    sports: 'Cricket & Sports',
    gaming: 'Gaming',
    cafe: 'Café Meetups',
    cafe_meetup: 'Café Meetups',
    movies: 'Movies',
    travel: 'Travel & Getaways',
    fitness: 'Fitness & Wellness',
    social: 'Social Mixers',
    creativity: 'Arts & Creativity',
  };
  return map[key] || raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

router.get('/overview-analytics', requirePermission('overview.view'), (req: AuthRequest, res: Response) => {
  try {
    const { range = '30d', from, to } = req.query as Record<string, string>;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    let fromDate = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    let toDate = todayStr;
    let periodLabel = 'Last 30 Days';
    let groupByMonth = false;

    if (range === 'today') {
      fromDate = todayStr;
      toDate = todayStr;
      periodLabel = `Today (${todayStr})`;
    } else if (range === '7d') {
      fromDate = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      periodLabel = 'Last 7 Days';
    } else if (range === '90d') {
      fromDate = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
      periodLabel = 'Last 90 Days';
    } else if (range === 'year') {
      fromDate = `${now.getUTCFullYear()}-01-01`;
      periodLabel = `This Year (${now.getUTCFullYear()})`;
      groupByMonth = true;
    } else if (range === '12m') {
      fromDate = new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10);
      periodLabel = 'Last 12 Months';
      groupByMonth = true;
    } else if (range === 'custom') {
      fromDate = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : fromDate;
      toDate = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : todayStr;
      if (fromDate > toDate) {
        return res.status(400).json({ error: 'Start date cannot be after end date.' });
      }
      periodLabel = `${fromDate} to ${toDate}`;
      const diffDays = (new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000;
      if (diffDays > 120) groupByMonth = true;
    }

    const withPercent = <T extends { count: number }>(rows: T[]) => {
      const total = rows.reduce((s, r) => s + (r.count || 0), 0);
      return rows.map((r) => ({
        ...r,
        percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
      }));
    };

    // PIE A: Event Distribution by Category
    const rawCategories = db.prepare(`
      SELECT e.category, COUNT(*) as count
      FROM events e
      WHERE COALESCE(e.is_archived, 0) = 0
        AND date(e.created_at) BETWEEN date(?) AND date(?)
      GROUP BY e.category
      ORDER BY count DESC
    `).all(fromDate, toDate) as { category: string; count: number }[];

    const eventCategoryDistribution = withPercent(
      rawCategories.map((r) => ({
        key: r.category,
        name: formatCategoryLabel(r.category),
        count: r.count,
      }))
    );

    // PIE B: Event Distribution by City
    const rawCities = db.prepare(`
      SELECT c.id, c.name, COUNT(e.id) as count
      FROM events e
      JOIN cities c ON e.city_id = c.id
      WHERE COALESCE(e.is_archived, 0) = 0
        AND date(e.created_at) BETWEEN date(?) AND date(?)
      GROUP BY c.id
      ORDER BY count DESC
    `).all(fromDate, toDate) as { id: string; name: string; count: number }[];
    const eventCityDistribution = withPercent(rawCities);

    // PIE C: Registration Status Distribution
    const rawRegStatus = db.prepare(`
      SELECT r.checkin_status as status, COUNT(*) as count
      FROM event_registrations r
      WHERE date(r.created_at) BETWEEN date(?) AND date(?)
      GROUP BY r.checkin_status
      ORDER BY count DESC
    `).all(fromDate, toDate) as { status: string; count: number }[];

    const regStatusLabels: Record<string, string> = {
      confirmed: 'Confirmed',
      checked_in: 'Checked In',
      pending: 'Pending',
      cancelled: 'Cancelled',
    };
    const registrationStatusDistribution = withPercent(
      rawRegStatus.map((r) => ({
        key: r.status,
        name: regStatusLabels[r.status] || r.status,
        count: r.count,
      }))
    );

    // PIE D: Partner Status Distribution
    const rawPartnerStatus = db.prepare(`
      SELECT verification_status as name, COUNT(*) as count
      FROM partner_accounts
      WHERE date(created_at) BETWEEN date(?) AND date(?)
      GROUP BY verification_status
      ORDER BY count DESC
    `).all(fromDate, toDate) as { name: string; count: number }[];
    const partnerStatusDistribution = withPercent(rawPartnerStatus);

    const bucketExpr = (col: string) => (groupByMonth ? `strftime('%Y-%m', ${col})` : `date(${col})`);

    // BAR A: Event Growth over time
    const eventGrowth = db.prepare(`
      SELECT ${bucketExpr('created_at')} as period, COUNT(*) as count
      FROM events
      WHERE date(created_at) BETWEEN date(?) AND date(?)
      GROUP BY period
      ORDER BY period ASC
    `).all(fromDate, toDate) as { period: string; count: number }[];

    // BAR B: Member Growth over time
    const memberGrowth = db.prepare(`
      SELECT ${bucketExpr('created_at')} as period, COUNT(*) as count
      FROM users
      WHERE date(created_at) BETWEEN date(?) AND date(?)
      GROUP BY period
      ORDER BY period ASC
    `).all(fromDate, toDate) as { period: string; count: number }[];

    // BAR C: City-wise Event Comparison
    const cityEventComparison = db.prepare(`
      SELECT 
        c.name as city,
        COUNT(DISTINCT CASE WHEN COALESCE(e.is_archived, 0) = 0 AND date(e.created_at) BETWEEN date(?) AND date(?) THEN e.id END) as events,
        COUNT(DISTINCT CASE WHEN r.checkin_status != 'cancelled' AND date(r.created_at) BETWEEN date(?) AND date(?) THEN r.id END) as registrations,
        COUNT(DISTINCT CASE WHEN r.checkin_status = 'checked_in' AND date(r.created_at) BETWEEN date(?) AND date(?) THEN r.id END) as checkins
      FROM cities c
      LEFT JOIN events e ON e.city_id = c.id
      LEFT JOIN event_registrations r ON r.event_id = e.id
      GROUP BY c.id
      ORDER BY events DESC, registrations DESC
    `).all(fromDate, toDate, fromDate, toDate, fromDate, toDate);

    // BAR D: Event Attendance Comparison (Registrations vs Verified Check-ins)
    const attendanceComparison = db.prepare(`
      SELECT 
        e.id,
        e.title as eventTitle,
        c.name as cityName,
        COUNT(CASE WHEN r.checkin_status != 'cancelled' AND date(r.created_at) BETWEEN date(?) AND date(?) THEN 1 END) as registrations,
        COUNT(CASE WHEN r.checkin_status = 'checked_in' AND date(r.created_at) BETWEEN date(?) AND date(?) THEN 1 END) as checkedIn
      FROM events e
      JOIN cities c ON e.city_id = c.id
      LEFT JOIN event_registrations r ON r.event_id = e.id
      WHERE COALESCE(e.is_archived, 0) = 0
      GROUP BY e.id
      HAVING registrations > 0 OR checkedIn > 0
      ORDER BY registrations DESC, checkedIn DESC
      LIMIT 8
    `).all(fromDate, toDate, fromDate, toDate) as any[];

    const attendanceFormatted = attendanceComparison.map((row) => ({
      ...row,
      shortTitle: row.eventTitle.length > 22 ? row.eventTitle.slice(0, 20) + '…' : row.eventTitle,
      pendingArrival: Math.max(0, (row.registrations || 0) - (row.checkedIn || 0)),
    }));

    // BAR E: Partner Performance (Verified/Active Partners, Venues, Hosted Events, Real Coupon Redemptions)
    const partnerPerformance = db.prepare(`
      SELECT 
        p.id,
        p.business_name as partnerName,
        p.city,
        p.verification_status as status,
        (SELECT COUNT(*) FROM venues v WHERE v.partner_id = p.id) as venuesCount,
        (SELECT COUNT(DISTINCT e.id)
         FROM events e
         JOIN venues v2 ON e.venue_id = v2.id
         WHERE v2.partner_id = p.id AND COALESCE(e.is_archived, 0) = 0 AND date(e.created_at) BETWEEN date(?) AND date(?)
        ) as hostedEvents,
        (SELECT COUNT(*)
         FROM coupon_redemptions cr
         JOIN coupons cp ON cr.coupon_id = cp.id
         WHERE cp.partner_id = p.id AND date(cr.redeemed_at) BETWEEN date(?) AND date(?)
        ) as couponRedemptions
      FROM partner_accounts p
      WHERE p.verification_status IN ('Verified', 'Submitted', 'Under Review')
      ORDER BY couponRedemptions DESC, hostedEvents DESC, venuesCount DESC
      LIMIT 8
    `).all(fromDate, toDate, fromDate, toDate) as any[];

    // LINE CHART: Merged Platform Activity Over Time
    const regSeries = db.prepare(`
      SELECT ${bucketExpr('created_at')} as period,
        COUNT(CASE WHEN checkin_status != 'cancelled' THEN 1 END) as registrations,
        COUNT(CASE WHEN checkin_status = 'checked_in' THEN 1 END) as checkins
      FROM event_registrations
      WHERE date(created_at) BETWEEN date(?) AND date(?)
      GROUP BY period
    `).all(fromDate, toDate) as { period: string; registrations: number; checkins: number }[];

    const publishedSeries = db.prepare(`
      SELECT ${bucketExpr('created_at')} as period, COUNT(*) as eventsPublished
      FROM events
      WHERE status IN ('published', 'live', 'completed') AND date(created_at) BETWEEN date(?) AND date(?)
      GROUP BY period
    `).all(fromDate, toDate) as { period: string; eventsPublished: number }[];

    const timelineMap = new Map<string, { period: string; newMembers: number; registrations: number; checkins: number; eventsPublished: number }>();
    const ensureBucket = (period: string) => {
      if (!timelineMap.has(period)) {
        timelineMap.set(period, { period, newMembers: 0, registrations: 0, checkins: 0, eventsPublished: 0 });
      }
      return timelineMap.get(period)!;
    };
    for (const m of memberGrowth) ensureBucket(m.period).newMembers = m.count;
    for (const r of regSeries) {
      const b = ensureBucket(r.period);
      b.registrations = r.registrations;
      b.checkins = r.checkins;
    }
    for (const p of publishedSeries) ensureBucket(p.period).eventsPublished = p.eventsPublished;

    const activityTimeline = Array.from(timelineMap.values()).sort((a, b) => a.period.localeCompare(b.period));

    const filteredSummary = {
      eventsCreated: eventGrowth.reduce((s, r) => s + r.count, 0),
      newMembers: memberGrowth.reduce((s, r) => s + r.count, 0),
      registrations: regSeries.reduce((s, r) => s + r.registrations, 0),
      verifiedCheckins: regSeries.reduce((s, r) => s + r.checkins, 0),
      activePartners: (db.prepare("SELECT COUNT(*) as c FROM partner_accounts WHERE verification_status = 'Verified'").get() as any).c,
    };

    return res.json({
      success: true,
      period: { range, fromDate, toDate, label: periodLabel, groupByMonth },
      filteredSummary,
      charts: {
        eventCategoryDistribution,
        eventCityDistribution,
        registrationStatusDistribution,
        partnerStatusDistribution,
        eventGrowth,
        memberGrowth,
        cityEventComparison,
        attendanceComparison: attendanceFormatted,
        partnerPerformance: partnerPerformance.map((p) => ({
          ...p,
          shortName: p.partnerName.length > 18 ? p.partnerName.slice(0, 16) + '…' : p.partnerName,
        })),
        activityTimeline,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 2. EVENTS, REGISTRATIONS & CITIES MANAGEMENT
// =========================================================================

router.get('/events', requirePermission('events.view'), (req: AuthRequest, res: Response) => {
  try {
    const { status, city_id, search } = req.query as Record<string, string>;
    let query = `
      SELECT 
        e.*,
        c.name as city_name,
        v.name as venue_name,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status != 'cancelled') as confirmed_count,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status = 'checked_in') as checked_in_count,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status = 'cancelled') as cancelled_count
      FROM events e
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status && status !== 'all') {
      if (status === 'archived') {
        query += ' AND e.is_archived = 1';
      } else {
        query += ' AND e.status = ? AND COALESCE(e.is_archived, 0) = 0';
        params.push(status);
      }
    }
    if (city_id && city_id !== 'all') {
      query += ' AND e.city_id = ?';
      params.push(city_id);
    }
    if (search && search.trim()) {
      query += ' AND (e.title LIKE ? OR e.category LIKE ? OR v.name LIKE ?)';
      const like = `%${search.trim()}%`;
      params.push(like, like, like);
    }
    query += ' ORDER BY COALESCE(e.is_archived, 0) ASC, e.created_at DESC';

    const events = db.prepare(query).all(...params) as any[];
    for (const ev of events) {
      ev.attendance_rate = ev.confirmed_count > 0 ? Math.round((ev.checked_in_count / ev.confirmed_count) * 100) : null;
      ev.capacity_utilization = ev.seats_total > 0 ? Math.round((ev.confirmed_count / ev.seats_total) * 100) : 0;
    }

    return res.json({ success: true, events });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/events', requirePermission('events.create'), (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      image_url,
      category,
      city_id,
      venue_id,
      event_date,
      event_time,
      end_time,
      organizer_name,
      seats_total,
      registration_deadline,
      entry_fee,
      visibility,
      eligibility_requirements,
      status,
      is_flagship,
    } = req.body;

    if (!title || !city_id || !venue_id || !category || !event_date || !event_time) {
      return res.status(400).json({ error: 'Title, city, venue, category, date, and start time are required.' });
    }

    const imgCheck = validateSafeMediaUrl(image_url, 'Event Image URL');
    if (!imgCheck.valid) {
      return res.status(400).json({ error: imgCheck.error });
    }

    const desiredStatus = status || 'draft';
    if (['published', 'live'].includes(desiredStatus) && !hasPermission(req.user!.role, 'events.publish')) {
      return res.status(403).json({ error: 'Missing events.publish permission to publish events directly.' });
    }

    const eventId = 'evt_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
    db.prepare(`
      INSERT INTO events (
        id, city_id, venue_id, title, category, event_date, event_time, end_time,
        organizer_name, description, seats_total, registration_deadline, entry_fee,
        visibility, eligibility_requirements, status, is_flagship, image_url, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      city_id,
      venue_id,
      title.trim(),
      category,
      event_date,
      event_time,
      end_time || '',
      organizer_name || req.user!.full_name,
      description || '',
      Number(seats_total) || 60,
      registration_deadline || null,
      entry_fee || 'Free Entry',
      visibility || 'public',
      eligibility_requirements || '',
      desiredStatus,
      is_flagship ? 1 : 0,
      imgCheck.value || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800',
      req.user!.id
    );

    const created = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'EVENT_CREATED',
      entityType: 'event',
      entityId: eventId,
      afterData: { title, category, status: desiredStatus, city_id, venue_id },
    });

    return res.status(201).json({ success: true, event: created });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/events/:id', requirePermission('events.edit'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    const {
      title,
      description,
      image_url,
      category,
      city_id,
      venue_id,
      event_date,
      event_time,
      end_time,
      organizer_name,
      seats_total,
      registration_deadline,
      entry_fee,
      visibility,
      eligibility_requirements,
      status,
      is_archived,
      is_flagship,
    } = req.body;

    if (status && status !== existing.status && !hasPermission(req.user!.role, 'events.publish')) {
      return res.status(403).json({ error: 'Missing events.publish permission to change event publication status.' });
    }

    const imgCheck = validateSafeMediaUrl(image_url, 'Event Image URL');
    if (!imgCheck.valid) {
      return res.status(400).json({ error: imgCheck.error });
    }

    db.prepare(`
      UPDATE events
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          image_url = COALESCE(?, image_url),
          category = COALESCE(?, category),
          city_id = COALESCE(?, city_id),
          venue_id = COALESCE(?, venue_id),
          event_date = COALESCE(?, event_date),
          event_time = COALESCE(?, event_time),
          end_time = COALESCE(?, end_time),
          organizer_name = COALESCE(?, organizer_name),
          seats_total = COALESCE(?, seats_total),
          registration_deadline = COALESCE(?, registration_deadline),
          entry_fee = COALESCE(?, entry_fee),
          visibility = COALESCE(?, visibility),
          eligibility_requirements = COALESCE(?, eligibility_requirements),
          status = COALESCE(?, status),
          is_archived = COALESCE(?, is_archived),
          is_flagship = COALESCE(?, is_flagship)
      WHERE id = ?
    `).run(
      title,
      description,
      image_url,
      category,
      city_id,
      venue_id,
      event_date,
      event_time,
      end_time,
      organizer_name,
      seats_total !== undefined ? Number(seats_total) : null,
      registration_deadline,
      entry_fee,
      visibility,
      eligibility_requirements,
      status,
      is_archived !== undefined ? (is_archived ? 1 : 0) : null,
      is_flagship !== undefined ? (is_flagship ? 1 : 0) : null,
      id
    );

    const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as any;
    const actionName =
      status === 'cancelled' ? 'EVENT_CANCELLED' :
      status === 'published' && existing.status !== 'published' ? 'EVENT_PUBLISHED' :
      is_archived ? 'EVENT_ARCHIVED' : 'EVENT_UPDATED';

    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: actionName,
      entityType: 'event',
      entityId: id,
      beforeData: { status: existing.status, title: existing.title, seats_total: existing.seats_total },
      afterData: { status: updated.status, title: updated.title, seats_total: updated.seats_total },
    });

    return res.json({ success: true, event: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/events/:id/duplicate', requirePermission('events.create'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const src = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as any;
    if (!src) return res.status(404).json({ error: 'Source event not found' });

    const newId = 'evt_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
    db.prepare(`
      INSERT INTO events (
        id, city_id, venue_id, title, category, event_date, event_time, end_time,
        organizer_name, description, seats_total, entry_fee, visibility,
        eligibility_requirements, status, is_flagship, image_url, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?)
    `).run(
      newId,
      src.city_id,
      src.venue_id,
      `${src.title} (Copy)`,
      src.category,
      src.event_date,
      src.event_time,
      src.end_time || '',
      src.organizer_name || 'STROOM Experiences',
      src.description,
      src.seats_total,
      src.entry_fee,
      src.visibility || 'public',
      src.eligibility_requirements || '',
      src.image_url,
      req.user!.id
    );

    const dup = db.prepare('SELECT * FROM events WHERE id = ?').get(newId);
    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'EVENT_DUPLICATED',
      entityType: 'event',
      entityId: newId,
      details: { sourceEventId: id },
    });

    return res.status(201).json({ success: true, event: dup });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

function inspectEventDependencies(eventId: string) {
  const registrationsTotal = (db.prepare('SELECT COUNT(*) as c FROM event_registrations WHERE event_id = ?').get(eventId) as any).c;
  const activeRegistrations = (db.prepare("SELECT COUNT(*) as c FROM event_registrations WHERE event_id = ? AND checkin_status != 'cancelled'").get(eventId) as any).c;
  const checkedInCount = (db.prepare("SELECT COUNT(*) as c FROM event_registrations WHERE event_id = ? AND checkin_status = 'checked_in'").get(eventId) as any).c;
  const attendanceStamps = (db.prepare('SELECT COUNT(*) as c FROM passport_stamps WHERE event_id = ?').get(eventId) as any).c;
  const paymentsCount = (db.prepare('SELECT COUNT(*) as c FROM payment_transactions WHERE event_id = ?').get(eventId) as any).c;
  const auctionsCount = (db.prepare('SELECT COUNT(*) as c FROM auction_rooms WHERE event_id = ?').get(eventId) as any).c;
  const collaborationsCount = (db.prepare('SELECT COUNT(*) as c FROM partner_collaborations WHERE event_id = ?').get(eventId) as any).c;
  const venueBookingsCount = (db.prepare("SELECT COUNT(*) as c FROM venue_availability WHERE event_id = ? AND status = 'booked'").get(eventId) as any).c;

  const hasProtectedDependencies =
    registrationsTotal > 0 ||
    checkedInCount > 0 ||
    attendanceStamps > 0 ||
    paymentsCount > 0 ||
    auctionsCount > 0 ||
    collaborationsCount > 0 ||
    venueBookingsCount > 0;

  return {
    registrationsTotal,
    activeRegistrations,
    checkedInCount,
    attendanceStamps,
    paymentsCount,
    auctionsCount,
    collaborationsCount,
    venueBookingsCount,
    hasProtectedDependencies,
  };
}

router.get('/events/:id/dependencies', requirePermission('events.view'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare(`
      SELECT e.id, e.title, e.event_date, e.event_time, e.status, COALESCE(e.is_archived, 0) as is_archived, c.name as city_name
      FROM events e
      LEFT JOIN cities c ON e.city_id = c.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const deps = inspectEventDependencies(id);
    const paymentsAuthorized = hasPermission(req.user!.role, 'payments.view');

    return res.json({
      success: true,
      event: existing,
      paymentsAuthorized,
      dependencies: {
        ...deps,
        paymentsCount: paymentsAuthorized ? deps.paymentsCount : null,
      },
      canDeletePermanently: !deps.hasProtectedDependencies && hasPermission(req.user!.role, 'events.delete'),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/events/:id', requirePermission('events.delete'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const forcePermanent = req.query.forcePermanent === 'true' || req.body?.forcePermanent === true;
    const requestedMode = String(req.query.mode || req.body?.mode || '').toLowerCase(); // '', 'archive', 'cancel', 'delete'
    const reason = String(req.body?.reason || req.query.reason || '').trim() || undefined;

    const existing = db.prepare(`
      SELECT e.*, c.name as city_name
      FROM events e
      LEFT JOIN cities c ON e.city_id = c.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const dependencies = inspectEventDependencies(id);
    const { hasProtectedDependencies, registrationsTotal } = dependencies;
    const effectiveMode = forcePermanent ? 'delete' : requestedMode || (hasProtectedDependencies ? 'archive' : 'delete');

    if (effectiveMode === 'delete' && hasProtectedDependencies) {
      recordAuditLog({
        actorId: req.user!.id,
        actorName: req.user!.full_name,
        actorRole: req.user!.role,
        action: 'EVENT_PERMANENT_DELETE_BLOCKED',
        entityType: 'event',
        entityId: id,
        beforeData: { title: existing.title, status: existing.status, is_archived: existing.is_archived },
        details: { dependencies, reason },
        result: 'denied',
      });
      return res.status(409).json({
        error: 'Cannot permanently delete an event with associated registrations, attendance records, payments, or auction/partner history. Use Archive Event or Cancel Event instead.',
        dependencies,
      });
    }

    if (effectiveMode === 'cancel') {
      if (existing.status === 'cancelled') {
        return res.json({
          success: true,
          action: 'cancelled',
          idempotent: true,
          message: `Event "${existing.title}" is already cancelled (all historical records preserved).`,
          event: existing,
          dependencies,
        });
      }

      const updated = db.transaction(() => {
        db.prepare("UPDATE events SET status = 'cancelled' WHERE id = ?").run(id);
        recordAuditLog({
          actorId: req.user!.id,
          actorName: req.user!.full_name,
          actorRole: req.user!.role,
          action: 'EVENT_CANCELLED_SAFE',
          entityType: 'event',
          entityId: id,
          beforeData: { status: existing.status, is_archived: existing.is_archived },
          afterData: { status: 'cancelled', is_archived: existing.is_archived, reason, dependencies },
          result: 'success',
          throwOnError: true,
        });
        return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
      })();

      return res.json({
        success: true,
        action: 'cancelled',
        message: `Event "${existing.title}" safely cancelled (all registrations, attendance, and payment records preserved).`,
        event: updated,
        dependencies,
      });
    }

    if (effectiveMode === 'archive') {
      const nextStatus = ['completed', 'cancelled'].includes(existing.status) ? existing.status : 'cancelled';
      if (existing.is_archived === 1 && existing.status === nextStatus) {
        return res.json({
          success: true,
          action: 'archived',
          idempotent: true,
          message: `Event "${existing.title}" is already archived (all historical records preserved).`,
          event: existing,
          dependencies,
        });
      }

      const updated = db.transaction(() => {
        db.prepare(`
          UPDATE events
          SET status = ?, is_archived = 1
          WHERE id = ?
        `).run(nextStatus, id);

        recordAuditLog({
          actorId: req.user!.id,
          actorName: req.user!.full_name,
          actorRole: req.user!.role,
          action: 'EVENT_SOFT_DELETED_ARCHIVED',
          entityType: 'event',
          entityId: id,
          beforeData: { title: existing.title, status: existing.status, is_archived: existing.is_archived },
          afterData: { status: nextStatus, is_archived: 1, reason, dependencies },
          result: 'success',
          throwOnError: true,
        });
        return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
      })();

      return res.json({
        success: true,
        action: 'archived',
        message: `Event "${existing.title}" safely archived (${registrationsTotal} registration(s) & historical records preserved).`,
        event: updated,
        dependencies,
      });
    }

    // effectiveMode === 'delete' and zero dependent records exist
    db.transaction(() => {
      db.prepare('DELETE FROM events WHERE id = ?').run(id);
      recordAuditLog({
        actorId: req.user!.id,
        actorName: req.user!.full_name,
        actorRole: req.user!.role,
        action: 'EVENT_PERMANENTLY_DELETED',
        entityType: 'event',
        entityId: id,
        beforeData: {
          title: existing.title,
          city_name: existing.city_name,
          event_date: existing.event_date,
          status: existing.status,
        },
        afterData: { deleted: true, reason },
        result: 'success',
        throwOnError: true,
      });
    })();

    return res.json({
      success: true,
      action: 'deleted',
      deletedEventId: id,
      message: `Event "${existing.title}" has been permanently deleted.`,
      dependencies,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/registrations', requirePermission('events.view'), (req: AuthRequest, res: Response) => {
  try {
    const { event_id, status, search } = req.query as Record<string, string>;
    let query = `
      SELECT 
        r.*,
        u.full_name as participant_name,
        u.email as participant_email,
        u.member_id as participant_member_id,
        e.title as event_title,
        e.event_date,
        pt.status as payment_status,
        pt.amount as payment_amount
      FROM event_registrations r
      JOIN users u ON r.user_id = u.id
      JOIN events e ON r.event_id = e.id
      LEFT JOIN payment_transactions pt ON pt.registration_id = r.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (event_id && event_id !== 'all') {
      query += ' AND r.event_id = ?';
      params.push(event_id);
    }
    if (status && status !== 'all') {
      query += ' AND r.checkin_status = ?';
      params.push(status);
    }
    if (search && search.trim()) {
      const like = `%${search.trim()}%`;
      query += ' AND (u.full_name LIKE ? OR r.pass_code LIKE ? OR r.id LIKE ? OR e.title LIKE ?)';
      params.push(like, like, like, like);
    }
    query += ' ORDER BY r.created_at DESC LIMIT 200';

    const registrations = db.prepare(query).all(...params);
    return res.json({ success: true, registrations });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/registrations/:id', requirePermission('registrations.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { checkin_status, seat_tier } = req.body;
    const reg = db.prepare('SELECT * FROM event_registrations WHERE id = ?').get(id) as any;
    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    const paidTx = db.prepare("SELECT * FROM payment_transactions WHERE registration_id = ? AND status = 'Successful'").get(id);
    if (paidTx && checkin_status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot cancel a registration linked to a settled payment directly; issue a refund via Payments first.' });
    }

    db.transaction(() => {
      if (checkin_status && ['confirmed', 'cancelled'].includes(checkin_status)) {
        if (checkin_status === 'cancelled' && reg.checkin_status !== 'cancelled') {
          db.prepare('UPDATE events SET seats_booked = MAX(0, seats_booked - 1) WHERE id = ?').run(reg.event_id);
        } else if (checkin_status === 'confirmed' && reg.checkin_status === 'cancelled') {
          db.prepare('UPDATE events SET seats_booked = seats_booked + 1 WHERE id = ?').run(reg.event_id);
        }
        db.prepare('UPDATE event_registrations SET checkin_status = ? WHERE id = ?').run(checkin_status, id);
      }
      if (seat_tier) {
        db.prepare('UPDATE event_registrations SET seat_tier = ? WHERE id = ?').run(seat_tier, id);
      }
    })();

    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'REGISTRATION_UPDATED',
      entityType: 'registration',
      entityId: id,
      beforeData: { checkin_status: reg.checkin_status, seat_tier: reg.seat_tier },
      afterData: { checkin_status: checkin_status || reg.checkin_status, seat_tier: seat_tier || reg.seat_tier },
    });

    const updated = db.prepare('SELECT * FROM event_registrations WHERE id = ?').get(id);
    return res.json({ success: true, registration: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Cities CRUD
router.get('/cities', requirePermission('events.view'), (req: AuthRequest, res: Response) => {
  try {
    const cities = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM events WHERE city_id = c.id) as events_count,
        (SELECT COUNT(*) FROM communities WHERE city_id = c.id) as communities_count
      FROM cities c
      ORDER BY c.is_featured DESC, c.launch_order ASC, c.name ASC
    `).all();
    return res.json({ success: true, cities });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/cities', requirePermission('cities.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { name, state, tagline, description, image_url, is_featured, is_active } = req.body;
    if (!name || !state) return res.status(400).json({ error: 'City name and state are required' });

    const dup = db.prepare('SELECT id FROM cities WHERE LOWER(name) = LOWER(?)').get(name.trim());
    if (dup) return res.status(409).json({ error: `City ${name} already exists.` });

    const id = 'city_' + name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) + '_' + Date.now().toString().slice(-3);
    db.prepare(`
      INSERT INTO cities (id, name, state, is_active, launch_order, tagline, description, image_url, is_featured)
      VALUES (?, ?, ?, ?, 10, ?, ?, ?, ?)
    `).run(id, name.trim(), state.trim(), is_active !== false ? 1 : 0, tagline || '', description || '', image_url || '', is_featured ? 1 : 0);

    const city = db.prepare('SELECT * FROM cities WHERE id = ?').get(id);
    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'CITY_CREATED',
      entityType: 'city',
      entityId: id,
      afterData: { name, state },
    });

    return res.status(201).json({ success: true, city });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/cities/:id', requirePermission('cities.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM cities WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'City not found' });

    const { name, state, tagline, description, image_url, is_featured, is_active } = req.body;
    db.prepare(`
      UPDATE cities
      SET name = COALESCE(?, name),
          state = COALESCE(?, state),
          tagline = COALESCE(?, tagline),
          description = COALESCE(?, description),
          image_url = COALESCE(?, image_url),
          is_featured = COALESCE(?, is_featured),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      name,
      state,
      tagline,
      description,
      image_url,
      is_featured !== undefined ? (is_featured ? 1 : 0) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      id
    );

    const updated = db.prepare('SELECT * FROM cities WHERE id = ?').get(id);
    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'CITY_UPDATED',
      entityType: 'city',
      entityId: id,
      beforeData: { is_active: existing.is_active, is_featured: existing.is_featured },
      afterData: { is_active, is_featured },
    });

    return res.json({ success: true, city: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 3. MEMBERS, ROLES & GRANULAR PERMISSIONS
// =========================================================================

router.get('/members-directory', requirePermission('members.view'), (req: AuthRequest, res: Response) => {
  try {
    const { search, city, role, status, sort = 'created_at', page = '1', limit = '25' } = req.query as Record<string, string>;
    const canSeeEmail = hasPermission(req.user!.role, 'members.manage') || ['super_admin', 'admin', 'platform_admin'].includes(req.user!.role);

    let where = ' WHERE 1=1';
    const params: any[] = [];
    if (search && search.trim()) {
      const like = `%${search.trim()}%`;
      where += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.member_id LIKE ?)';
      params.push(like, like, like);
    }
    if (city && city !== 'all') {
      where += ' AND u.city = ?';
      params.push(city);
    }
    if (role && role !== 'all') {
      where += ' AND u.role = ?';
      params.push(role);
    }
    if (status && status !== 'all') {
      where += ' AND COALESCE(u.account_status, \'active\') = ?';
      params.push(status);
    }

    const total = (db.prepare(`SELECT COUNT(*) as c FROM users u ${where}`).get(...params) as any).c;
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 25));
    const offset = (p - 1) * l;

    const orderExpr = sort === 'name' ? 'u.full_name ASC' : sort === 'attendance' ? 'attended_count DESC' : 'u.created_at DESC';

    const rows = db.prepare(`
      SELECT 
        u.id, u.full_name, u.display_name, u.avatar_url, u.email, u.role, u.member_id,
        u.city, COALESCE(u.account_status, 'active') as account_status, u.onboarding_status, u.created_at,
        (SELECT COUNT(*) FROM event_registrations WHERE user_id = u.id) as registrations_count,
        (SELECT COUNT(*) FROM passport_stamps WHERE user_id = u.id) as attended_count,
        (SELECT COUNT(*) FROM community_members WHERE user_id = u.id) as communities_count
      FROM users u
      ${where}
      ORDER BY ${orderExpr}
      LIMIT ? OFFSET ?
    `).all(...params, l, offset) as any[];

    const members = rows.map((m) => ({
      ...m,
      email: canSeeEmail ? m.email : '[Restricted]',
    }));

    return res.json({ success: true, members, total, page: p, limit: l });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/members/:id/status', requirePermission('members.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { account_status, reason } = req.body;
    if (!['active', 'suspended'].includes(account_status)) {
      return res.status(400).json({ error: 'Invalid account_status (must be active or suspended)' });
    }
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot suspend or modify your own active administrator account' });
    }

    const target = db.prepare('SELECT id, full_name, role, COALESCE(account_status, \'active\') as account_status FROM users WHERE id = ?').get(id) as any;
    if (!target) return res.status(404).json({ error: 'Member not found' });

    if (PRIVILEGED_ROLES.includes(target.role) && req.user!.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a Super Admin can suspend or reactivate privileged admin accounts.' });
    }

    db.prepare("UPDATE users SET account_status = ?, updated_at = datetime('now') WHERE id = ?").run(account_status, id);

    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: account_status === 'suspended' ? 'MEMBER_SUSPENDED' : 'MEMBER_REACTIVATED',
      entityType: 'user',
      entityId: id,
      beforeData: { account_status: target.account_status },
      afterData: { account_status, reason },
    });

    return res.json({ success: true, memberId: id, account_status });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/members/:id/role', requirePermission('roles.assign'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const validRoles = Object.keys(ROLE_PERMISSIONS);
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role key' });
    }

    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot alter your own administrative role.' });
    }

    const target = db.prepare('SELECT id, full_name, role FROM users WHERE id = ?').get(id) as any;
    if (!target) return res.status(404).json({ error: 'Member not found' });

    // Strict Privilege Escalation Prevention
    if ((PRIVILEGED_ROLES.includes(role) || PRIVILEGED_ROLES.includes(target.role)) && req.user!.role !== 'super_admin') {
      recordAuditLog({
        actorId: req.user!.id,
        actorName: req.user!.full_name,
        actorRole: req.user!.role,
        action: 'PRIVILEGE_ESCALATION_BLOCKED',
        entityType: 'user',
        entityId: id,
        details: { attemptedRole: role, currentTargetRole: target.role },
        result: 'denied',
      });
      return res.status(403).json({ error: 'Forbidden: Only Super Admins can assign or modify privileged Admin roles.' });
    }

    db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(role, id);

    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'MEMBER_ROLE_CHANGED',
      entityType: 'user',
      entityId: id,
      beforeData: { role: target.role },
      afterData: { role },
    });

    return res.json({ success: true, memberId: id, role });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/roles-matrix', requirePermission('overview.view'), (req: AuthRequest, res: Response) => {
  return res.json({
    success: true,
    matrix: ROLE_PERMISSIONS,
  });
});

// =========================================================================
// 4. COMMUNITY MANAGEMENT
// =========================================================================

router.get('/communities', requirePermission('communities.manage'), (req: AuthRequest, res: Response) => {
  try {
    const communities = db.prepare(`
      SELECT 
        comm.*,
        c.name as city_name,
        (SELECT COUNT(*) FROM community_members WHERE community_id = comm.id) as real_joined_count,
        (comm.member_count + (SELECT COUNT(*) FROM community_members WHERE community_id = comm.id)) as total_members,
        (SELECT COUNT(*) FROM events e WHERE e.city_id = comm.city_id AND e.status IN ('published', 'live')) as upcoming_events_count
      FROM communities comm
      JOIN cities c ON comm.city_id = c.id
      ORDER BY comm.created_at DESC
    `).all();
    return res.json({ success: true, communities });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/communities', requirePermission('communities.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { name, city_id, category, description, image_url, organizer_name, organizer_role, meeting_schedule, guidelines, status } = req.body;
    if (!name || !city_id || !category) {
      return res.status(400).json({ error: 'Community name, city, and category are required' });
    }
    const id = 'comm_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;

    db.prepare(`
      INSERT INTO communities (
        id, name, slug, city_id, category, description, image_url,
        organizer_name, organizer_role, organizer_avatar, member_count,
        meeting_schedule, guidelines, status, manager_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      slug,
      city_id,
      category,
      description || '',
      image_url || 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800',
      organizer_name || req.user!.full_name,
      organizer_role || 'Community Manager',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      meeting_schedule || 'Every Weekend',
      guidelines || 'Respect all members and foster authentic real-world conversations.',
      status || 'published',
      req.user!.id
    );

    const community = db.prepare('SELECT * FROM communities WHERE id = ?').get(id);
    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'COMMUNITY_CREATED',
      entityType: 'community',
      entityId: id,
      afterData: { name, city_id, category },
    });

    return res.status(201).json({ success: true, community });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/communities/:id', requirePermission('communities.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM communities WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Community not found' });

    const { name, city_id, category, description, organizer_name, meeting_schedule, guidelines, status } = req.body;
    db.prepare(`
      UPDATE communities
      SET name = COALESCE(?, name),
          city_id = COALESCE(?, city_id),
          category = COALESCE(?, category),
          description = COALESCE(?, description),
          organizer_name = COALESCE(?, organizer_name),
          meeting_schedule = COALESCE(?, meeting_schedule),
          guidelines = COALESCE(?, guidelines),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(name, city_id, category, description, organizer_name, meeting_schedule, guidelines, status, id);

    const updated = db.prepare('SELECT * FROM communities WHERE id = ?').get(id);
    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'COMMUNITY_UPDATED',
      entityType: 'community',
      entityId: id,
      beforeData: { status: existing.status, name: existing.name },
      afterData: { status: status || existing.status, name: name || existing.name },
    });

    return res.json({ success: true, community: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/communities/:id/members', requirePermission('communities.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const members = db.prepare(`
      SELECT cm.id, cm.role as community_role, cm.joined_at, u.id as user_id, u.full_name, u.member_id, u.city
      FROM community_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.community_id = ?
      ORDER BY cm.joined_at DESC
    `).all(id);
    return res.json({ success: true, members });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 5. CENTRALIZED AUCTION MANAGEMENT & LIVE MONITOR
// =========================================================================

router.get('/auctions', requirePermission('auctions.view'), (req: AuthRequest, res: Response) => {
  try {
    const auctions = db.prepare(`
      SELECT 
        a.*,
        e.title as event_title,
        e.event_date,
        c.name as city_name,
        v.name as venue_name,
        cp.name as current_player_name,
        cp.current_bid as current_player_bid,
        (SELECT COUNT(*) FROM auction_teams WHERE auction_id = a.id) as teams_count,
        (SELECT COUNT(*) FROM auction_players WHERE auction_id = a.id) as total_lots,
        (SELECT COUNT(*) FROM auction_players WHERE auction_id = a.id AND status = 'SOLD') as sold_lots,
        (SELECT COUNT(*) FROM auction_players WHERE auction_id = a.id AND status = 'UNSOLD') as unsold_lots,
        (SELECT COUNT(*) FROM auction_registrations WHERE auction_id = a.id) as registered_participants
      FROM auction_rooms a
      JOIN events e ON a.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      LEFT JOIN auction_players cp ON a.current_player_id = cp.id
      ORDER BY CASE a.status WHEN 'LIVE' THEN 1 WHEN 'PAUSED' THEN 2 WHEN 'SCHEDULED' THEN 3 ELSE 4 END, a.created_at DESC
    `).all();

    const recentBids = db.prepare(`
      SELECT b.id, b.auction_id, b.amount, b.placed_at, p.name as player_name, t.name as team_name, a.title as auction_title
      FROM bids b
      JOIN auction_players p ON b.player_id = p.id
      JOIN auction_teams t ON b.team_id = t.id
      JOIN auction_rooms a ON b.auction_id = a.id
      ORDER BY b.placed_at DESC
      LIMIT 12
    `).all();

    return res.json({ success: true, auctions, recentBids });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/auctions', requirePermission('auctions.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { event_id, title, format_type, format_category, team_purse_cap, min_bid_increment, max_squad_size, overseas_limit, countdown_seconds } = req.body;
    if (!event_id || !title) return res.status(400).json({ error: 'event_id and title are required' });

    const existing = db.prepare('SELECT id FROM auction_rooms WHERE event_id = ?').get(event_id);
    if (existing) return res.status(409).json({ error: 'An auction room already exists for this event.' });

    const id = 'auc_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    db.prepare(`
      INSERT INTO auction_rooms (
        id, event_id, title, format_type, format_category, status,
        countdown_seconds, auto_extend_seconds, min_bid_increment,
        max_squad_size, min_squad_size, team_purse_cap, overseas_limit
      )
      VALUES (?, ?, ?, ?, ?, 'SCHEDULED', ?, 15, ?, ?, 5, ?, ?)
    `).run(
      id,
      event_id,
      title.trim(),
      format_type || 'stroom_premier',
      format_category || 'ipl_mock',
      Number(countdown_seconds) || 15,
      Number(min_bid_increment) || 25000,
      Number(max_squad_size) || 15,
      Number(team_purse_cap) || 10000000,
      Number(overseas_limit) || 4
    );

    const auction = db.prepare('SELECT * FROM auction_rooms WHERE id = ?').get(id);
    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'AUCTION_CREATED',
      entityType: 'auction',
      entityId: id,
      afterData: { title, event_id, format_type },
    });

    return res.status(201).json({ success: true, auction });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 6. CENTRALIZED VENUE MANAGEMENT
// =========================================================================

router.get('/venues', requirePermission('venues.manage'), (req: AuthRequest, res: Response) => {
  try {
    const venues = db.prepare(`
      SELECT 
        v.*,
        c.name as city_name,
        p.business_name as partner_name,
        p.verification_status as partner_status,
        (SELECT COUNT(*) FROM events WHERE venue_id = v.id AND status IN ('published', 'live')) as upcoming_events_count,
        (SELECT COUNT(*) FROM venue_availability WHERE venue_id = v.id AND status = 'available') as open_slots_count
      FROM venues v
      JOIN cities c ON v.city_id = c.id
      LEFT JOIN partner_accounts p ON v.partner_id = p.id
      ORDER BY v.is_verified DESC, v.created_at DESC
    `).all();
    return res.json({ success: true, venues });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/venues/:id/verify', requirePermission('venues.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_verified, status } = req.body;
    const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(id) as any;
    if (!venue) return res.status(404).json({ error: 'Venue not found' });

    db.prepare(`
      UPDATE venues
      SET is_verified = COALESCE(?, is_verified),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(is_verified !== undefined ? (is_verified ? 1 : 0) : null, status || null, id);

    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: is_verified ? 'VENUE_APPROVED' : 'VENUE_UPDATED',
      entityType: 'venue',
      entityId: id,
      beforeData: { is_verified: venue.is_verified },
      afterData: { is_verified, status },
    });

    const updated = db.prepare('SELECT * FROM venues WHERE id = ?').get(id);
    return res.json({ success: true, venue: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 7. UPGRADED DOOR CHECK-IN OPERATIONS
// =========================================================================

router.get('/checkin/events', requirePermission('checkin.access'), (req: AuthRequest, res: Response) => {
  try {
    const events = db.prepare(`
      SELECT 
        e.id, e.title, e.event_date, e.event_time, e.status, v.name as venue_name, c.name as city_name,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status != 'cancelled') as registered_count,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status = 'checked_in') as checked_in_count
      FROM events e
      JOIN venues v ON e.venue_id = v.id
      JOIN cities c ON e.city_id = c.id
      WHERE e.status IN ('published', 'live', 'completed')
      ORDER BY e.is_flagship DESC, e.created_at DESC
    `).all();

    const recentCheckins = db.prepare(`
      SELECT 
        r.id, r.pass_code, r.checkin_status, r.checked_in_at, r.seat_tier,
        u.full_name as attendee_name, u.avatar_url, e.id as event_id, e.title as event_title,
        staff.full_name as checked_in_by_name
      FROM event_registrations r
      JOIN users u ON r.user_id = u.id
      JOIN events e ON r.event_id = e.id
      LEFT JOIN users staff ON r.checked_in_by = staff.id
      WHERE r.checkin_status = 'checked_in'
      ORDER BY r.checked_in_at DESC
      LIMIT 20
    `).all();

    return res.json({ success: true, events, recentCheckins });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/checkin/search', requirePermission('checkin.access'), (req: AuthRequest, res: Response) => {
  try {
    const { eventId, q } = req.query as Record<string, string>;
    let query = `
      SELECT 
        r.id, r.event_id, r.pass_code, r.qr_token, r.seat_tier, r.role_type, r.checkin_status, r.checked_in_at,
        u.full_name as attendee_name, u.avatar_url, u.member_id, e.title as event_title
      FROM event_registrations r
      JOIN users u ON r.user_id = u.id
      JOIN events e ON r.event_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (eventId && eventId !== 'all') {
      query += ' AND r.event_id = ?';
      params.push(eventId);
    }
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      query += ' AND (u.full_name LIKE ? OR r.pass_code LIKE ? OR r.id LIKE ? OR u.member_id LIKE ?)';
      params.push(like, like, like, like);
    }
    query += ' ORDER BY r.created_at DESC LIMIT 40';
    const passes = db.prepare(query).all(...params);
    return res.json({ success: true, passes });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/checkin/scan', requirePermission('checkin.access'), (req: AuthRequest, res: Response) => {
  try {
    const { code, event_id } = req.body;
    if (!code || !String(code).trim()) {
      return res.status(400).json({ verificationStatus: 'Invalid Pass', error: 'Pass code, QR token, or Registration ID is required.' });
    }
    const clean = String(code).trim();

    const pass = db.prepare(`
      SELECT 
        r.*, e.title as event_title, e.category as event_category, c.name as city_name, v.name as venue_name,
        u.full_name as attendee_name, u.avatar_url as attendee_avatar
      FROM event_registrations r
      JOIN events e ON r.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      JOIN users u ON r.user_id = u.id
      WHERE UPPER(r.pass_code) = UPPER(?) OR r.qr_token = ? OR r.id = ?
    `).get(clean, clean, clean) as any;

    if (!pass) {
      return res.status(404).json({ verificationStatus: 'Invalid Pass', error: 'No matching event registration found for this code.' });
    }

    if (event_id && event_id !== 'all' && pass.event_id !== event_id) {
      return res.status(409).json({
        verificationStatus: 'Event Mismatch',
        error: `This pass belongs to "${pass.event_title}", not the currently selected check-in event.`,
        pass,
      });
    }

    if (pass.checkin_status === 'cancelled') {
      return res.status(400).json({ verificationStatus: 'Cancelled Registration', error: 'This registration has been cancelled and is no longer valid.', pass });
    }

    if (pass.checkin_status === 'checked_in') {
      return res.status(409).json({
        verificationStatus: 'Already Checked In',
        error: `${pass.attendee_name} already checked in at ${pass.checked_in_at}.`,
        pass,
      });
    }

    const stampId = 'stamp_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const stampIcon = pass.event_category?.includes('auction') ? 'Trophy' : pass.event_category?.includes('sport') ? 'Activity' : 'Award';

    db.transaction(() => {
      db.prepare(`
        UPDATE event_registrations
        SET checkin_status = 'checked_in', checked_in_at = datetime('now'), checked_in_by = ?
        WHERE id = ?
      `).run(req.user!.id, pass.id);

      db.prepare(`
        INSERT OR IGNORE INTO passport_stamps (id, user_id, event_id, event_title, category, city_name, venue_name, stamp_icon, verified_at, verified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(stampId, pass.user_id, pass.event_id, pass.event_title, pass.event_category, pass.city_name, pass.venue_name, stampIcon, req.user!.id);

      logActivity(pass.user_id, 'event_attended', `Attended: ${pass.event_title}`, `Verified door check-in at ${pass.venue_name}.`, pass.event_id);
      createNotification(pass.user_id, 'checkin', `Attendance Verified: ${pass.event_title}`, `Your STROOM Passport stamp has been verified at the door!`, { eventId: pass.event_id });
      recordAuditLog({
        actorId: req.user!.id,
        actorName: req.user!.full_name,
        actorRole: req.user!.role,
        action: 'DOOR_CHECKIN_VERIFIED',
        entityType: 'registration',
        entityId: pass.id,
        afterData: { pass_code: pass.pass_code, event_id: pass.event_id },
      });
    })();

    const newlyUnlocked = evaluateUserAchievements(pass.user_id);
    const updatedPass = db.prepare('SELECT checked_in_at FROM event_registrations WHERE id = ?').get(pass.id) as any;

    return res.json({
      success: true,
      verificationStatus: 'Valid',
      message: `${pass.attendee_name} checked in successfully!`,
      pass: { ...pass, checkin_status: 'checked_in', checked_in_at: updatedPass.checked_in_at },
      newAchievements: newlyUnlocked,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/checkin/override', requirePermission('checkin.override'), (req: AuthRequest, res: Response) => {
  try {
    const { registration_id, new_status, reason } = req.body;
    if (!registration_id || !['confirmed', 'checked_in'].includes(new_status) || !reason) {
      return res.status(400).json({ error: 'registration_id, new_status, and mandatory audit reason are required' });
    }
    const pass = db.prepare('SELECT * FROM event_registrations WHERE id = ?').get(registration_id) as any;
    if (!pass) return res.status(404).json({ error: 'Registration not found' });

    db.prepare(`
      UPDATE event_registrations
      SET checkin_status = ?, checked_in_at = CASE WHEN ? = 'confirmed' THEN NULL ELSE COALESCE(checked_in_at, datetime('now')) END
      WHERE id = ?
    `).run(new_status, new_status, registration_id);

    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'DOOR_CHECKIN_OVERRIDE',
      entityType: 'registration',
      entityId: registration_id,
      beforeData: { checkin_status: pass.checkin_status },
      afterData: { checkin_status: new_status, reason },
    });

    return res.json({ success: true, message: `Registration check-in status updated to ${new_status}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 8. COMMUNITY FEED MODERATION
// =========================================================================

router.get('/moderation/posts', requirePermission('moderation.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { status, search } = req.query as Record<string, string>;
    let query = `
      SELECT p.*, c.name as community_name, u.account_status as author_account_status
      FROM community_posts p
      JOIN communities c ON p.community_id = c.id
      LEFT JOIN users u ON p.author_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status && status !== 'all') {
      query += ' AND p.status = ?';
      params.push(status);
    }
    if (search && search.trim()) {
      const like = `%${search.trim()}%`;
      query += ' AND (p.title LIKE ? OR p.content LIKE ? OR p.author_name LIKE ?)';
      params.push(like, like, like);
    }
    query += " ORDER BY CASE p.status WHEN 'Reported' THEN 1 WHEN 'Pending' THEN 2 WHEN 'Under Review' THEN 3 ELSE 4 END, p.created_at DESC";

    const posts = db.prepare(query).all(...params);
    return res.json({ success: true, posts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/moderation/posts/:id', requirePermission('moderation.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, moderation_notes, suspend_author } = req.body;
    const validStatuses = ['Pending', 'Published', 'Reported', 'Under Review', 'Removed', 'Archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid post moderation status' });
    }

    const post = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(id) as any;
    if (!post) return res.status(404).json({ error: 'Post not found' });

    db.transaction(() => {
      db.prepare(`
        UPDATE community_posts
        SET status = ?, moderated_by = ?, moderation_notes = COALESCE(?, moderation_notes), updated_at = datetime('now')
        WHERE id = ?
      `).run(status, req.user!.id, moderation_notes || null, id);

      if (suspend_author && post.author_user_id) {
        if (!hasPermission(req.user!.role, 'members.manage')) {
          throw Object.assign(new Error('Missing members.manage permission to suspend post author'), { status: 403 });
        }
        db.prepare("UPDATE users SET account_status = 'suspended' WHERE id = ? AND role = 'user'").run(post.author_user_id);
      }

      recordAuditLog({
        actorId: req.user!.id,
        actorName: req.user!.full_name,
        actorRole: req.user!.role,
        action: `POST_MODERATION_${status.toUpperCase().replace(/\s+/g, '_')}`,
        entityType: 'community_post',
        entityId: id,
        beforeData: { status: post.status },
        afterData: { status, moderation_notes, suspend_author: Boolean(suspend_author) },
      });
    })();

    const updated = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(id);
    return res.json({ success: true, post: updated });
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

// =========================================================================
// 9. PAYMENTS & TRANSACTIONS (HONEST REAL LEDGER ONLY)
// =========================================================================

router.get('/payments', requirePermission('payments.view'), (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query as Record<string, string>;
    let query = `
      SELECT 
        pt.*,
        u.full_name as member_name,
        u.member_id as member_code,
        e.title as event_title
      FROM payment_transactions pt
      LEFT JOIN users u ON pt.user_id = u.id
      LEFT JOIN events e ON pt.event_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status && status !== 'all') {
      query += ' AND pt.status = ?';
      params.push(status);
    }
    query += ' ORDER BY pt.created_at DESC LIMIT 100';

    const transactions = db.prepare(query).all(...params);
    return res.json({
      success: true,
      gatewayConfigured: false,
      gatewayNotice: 'Online card/UPI payment gateway integration is not configured in this environment. Only verified payment records are displayed—no simulated transactions are generated.',
      transactions,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/payments/:id/refund', requirePermission('payments.refund'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { refund_amount, reason } = req.body;
    const tx = db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(id) as any;
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'Successful') {
      return res.status(400).json({ error: 'Only Successful transactions can be refunded.' });
    }

    const amt = refund_amount !== undefined ? Number(refund_amount) : tx.amount;
    if (amt <= 0 || amt > tx.amount) {
      return res.status(400).json({ error: `Refund amount must be between ₹1 and ₹${tx.amount}.` });
    }

    const nextStatus = amt < tx.amount ? 'Partially Refunded' : 'Refunded';
    db.prepare(`
      UPDATE payment_transactions
      SET status = ?, refund_amount = ?, refund_reason = ?, refunded_by = ?, refunded_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, amt, reason || 'Admin refund processed', req.user!.id, id);

    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'PAYMENT_REFUNDED',
      entityType: 'payment_transaction',
      entityId: id,
      beforeData: { status: tx.status, amount: tx.amount },
      afterData: { status: nextStatus, refund_amount: amt, reason },
    });

    const updated = db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(id);
    return res.json({ success: true, transaction: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 10. NOTIFICATION MANAGEMENT (RESPECTING USER PREFERENCES)
// =========================================================================

router.get('/notifications/announcements', requirePermission('notifications.manage'), (req: AuthRequest, res: Response) => {
  try {
    const announcements = db.prepare('SELECT * FROM admin_announcements ORDER BY created_at DESC LIMIT 50').all();
    return res.json({ success: true, announcements });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/notifications/broadcast', requirePermission('notifications.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { title, message, target_audience, target_filter, category } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });

    const audience = target_audience || 'all_members';
    let deliveredCount = 0;
    const dedupKey = crypto.createHash('md5').update(`${title.trim()}|${audience}|${target_filter || ''}`).digest('hex');

    // Prevent exact duplicate broadcast within same hour
    const recentDup = db.prepare(`
      SELECT id FROM admin_announcements
      WHERE title = ? AND target_audience = ? AND datetime(created_at) >= datetime('now', '-1 hour')
    `).get(title.trim(), audience);
    if (recentDup) {
      return res.status(409).json({ error: 'A duplicate announcement with the same title and audience was already sent within the last hour.' });
    }

    db.transaction(() => {
      if (audience === 'partners') {
        const partners = db.prepare("SELECT id FROM partner_accounts WHERE verification_status != 'Suspended'").all() as { id: string }[];
        for (const p of partners) {
          notifyPartner(p.id, 'announcement', title.trim(), message.trim(), req.user!.full_name, 'admin');
          deliveredCount++;
        }
      } else {
        let userQuery = "SELECT id, notification_settings_json FROM users WHERE COALESCE(account_status, 'active') = 'active'";
        const params: any[] = [];
        if (audience === 'city' && target_filter) {
          userQuery += ' AND LOWER(city) = LOWER(?)';
          params.push(target_filter);
        } else if (audience === 'community' && target_filter) {
          userQuery = `
            SELECT u.id, u.notification_settings_json
            FROM users u
            JOIN community_members cm ON u.id = cm.user_id
            WHERE cm.community_id = ? AND COALESCE(u.account_status, 'active') = 'active'
          `;
          params.push(target_filter);
        } else if (audience === 'event' && target_filter) {
          userQuery = `
            SELECT u.id, u.notification_settings_json
            FROM users u
            JOIN event_registrations r ON u.id = r.user_id
            WHERE r.event_id = ? AND r.checkin_status != 'cancelled'
          `;
          params.push(target_filter);
        }

        const users = db.prepare(userQuery).all(...params) as any[];
        for (const u of users) {
          let prefs: any = {};
          try { prefs = JSON.parse(u.notification_settings_json || '{}'); } catch {}
          if (category === 'community' && prefs.communityUpdates === false) continue;
          if (category === 'reminder' && prefs.eventReminders === false) continue;
          createNotification(u.id, category || 'system', title.trim(), message.trim(), { dedupKey });
          deliveredCount++;
        }
      }

      const annId = 'ann_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
      db.prepare(`
        INSERT INTO admin_announcements (id, title, message, target_audience, target_filter, channel, status, recipients_count, created_by, created_by_name)
        VALUES (?, ?, ?, ?, ?, 'in_app', 'sent', ?, ?, ?)
      `).run(annId, title.trim(), message.trim(), audience, target_filter || null, deliveredCount, req.user!.id, req.user!.full_name);

      recordAuditLog({
        actorId: req.user!.id,
        actorName: req.user!.full_name,
        actorRole: req.user!.role,
        action: 'ANNOUNCEMENT_SENT',
        entityType: 'announcement',
        entityId: annId,
        afterData: { title: title.trim(), target_audience: audience, deliveredCount },
      });
    })();

    return res.status(201).json({
      success: true,
      deliveredCount,
      deliveryChannel: 'In-App Notification Center (Email/SMS provider not configured)',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 11. PLATFORM ANALYTICS & CSV EXPORTS
// =========================================================================

router.get('/analytics', requirePermission('analytics.view'), (req: AuthRequest, res: Response) => {
  try {
    const { range = '30d', from, to, city, category, status } = req.query as Record<string, string>;

    let fromDate: string | null = null;
    let toDate: string | null = null;
    if (range === 'custom' && (from || to)) {
      fromDate = from || null;
      toDate = to || null;
    } else if (['7d', '30d', '90d'].includes(range)) {
      const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
      fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    }

    let eventWhere = ' WHERE 1=1';
    const eventParams: any[] = [];
    if (city && city !== 'all') {
      eventWhere += ' AND e.city_id = ?';
      eventParams.push(city);
    }
    if (category && category !== 'all') {
      eventWhere += ' AND e.category = ?';
      eventParams.push(category);
    }
    if (status && status !== 'all') {
      eventWhere += ' AND e.status = ?';
      eventParams.push(status);
    }

    const cityActivity = db.prepare(`
      SELECT 
        c.name as city_name,
        COUNT(DISTINCT e.id) as events_count,
        COUNT(DISTINCT CASE WHEN r.checkin_status != 'cancelled' THEN r.id END) as registrations_count,
        COUNT(DISTINCT CASE WHEN r.checkin_status = 'checked_in' THEN r.id END) as verified_checkins_count,
        (SELECT COUNT(*) FROM communities WHERE city_id = c.id) as communities_count
      FROM cities c
      LEFT JOIN events e ON e.city_id = c.id ${city && city !== 'all' ? 'AND e.city_id = ?' : ''}
      LEFT JOIN event_registrations r ON r.event_id = e.id
      GROUP BY c.id
      ORDER BY registrations_count DESC
    `).all(...(city && city !== 'all' ? [city] : []));

    const categoryPerformance = db.prepare(`
      SELECT 
        e.category,
        COUNT(DISTINCT e.id) as events_count,
        COUNT(DISTINCT CASE WHEN r.checkin_status != 'cancelled' THEN r.id END) as registrations_count,
        COUNT(DISTINCT CASE WHEN r.checkin_status = 'checked_in' THEN r.id END) as verified_checkins_count
      FROM events e
      LEFT JOIN event_registrations r ON r.event_id = e.id
      ${eventWhere}
      GROUP BY e.category
      ORDER BY registrations_count DESC
    `).all(...eventParams);

    const memberGrowth = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as signups
      FROM users
      ${fromDate ? "WHERE date(created_at) >= date('" + fromDate + "')" : ''}
      GROUP BY date(created_at)
      ORDER BY date ASC
      LIMIT 30
    `).all();

    const registrationTrends = db.prepare(`
      SELECT date(r.created_at) as date,
        COUNT(*) as registrations,
        SUM(CASE WHEN r.checkin_status = 'checked_in' THEN 1 ELSE 0 END) as checkins
      FROM event_registrations r
      ${fromDate ? "WHERE date(r.created_at) >= date('" + fromDate + "')" : ''}
      GROUP BY date(r.created_at)
      ORDER BY date ASC
      LIMIT 30
    `).all();

    const partnerAndCampaignStats = {
      verifiedPartners: (db.prepare("SELECT COUNT(*) as c FROM partner_accounts WHERE verification_status = 'Verified'").get() as any).c,
      activeCollaborations: (db.prepare("SELECT COUNT(*) as c FROM partner_collaborations WHERE status IN ('Approved', 'Scheduled', 'Live', 'Completed')").get() as any).c,
      totalCouponRedemptions: (db.prepare('SELECT COUNT(*) as c FROM coupon_redemptions').get() as any).c,
      totalBidsPlaced: (db.prepare('SELECT COUNT(*) as c FROM bids').get() as any).c,
    };

    return res.json({
      success: true,
      filters: { range, fromDate, toDate },
      cityActivity,
      categoryPerformance,
      memberGrowth,
      registrationTrends,
      partnerAndCampaignStats,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/reports/export', requirePermission('analytics.view'), (req: AuthRequest, res: Response) => {
  try {
    const type = String(req.query.type || 'events');
    const esc = (v: any) => `"${(v ?? '').toString().replace(/"/g, '""')}"`;

    let headers: string[] = [];
    let rows: string[] = [];

    if (type === 'members') {
      headers = ['ID', 'Member ID', 'Name', 'Role', 'City', 'Account Status', 'Joined'];
      const data = db.prepare("SELECT id, member_id, full_name, role, city, COALESCE(account_status, 'active') as account_status, created_at FROM users").all() as any[];
      rows = data.map((r) => [esc(r.id), esc(r.member_id), esc(r.full_name), esc(r.role), esc(r.city), esc(r.account_status), esc(r.created_at)].join(','));
    } else if (type === 'registrations' || type === 'attendance') {
      headers = ['Registration ID', 'Pass Code', 'Event', 'Participant', 'Seat Tier', 'Status', 'Checked In At', 'Registered At'];
      const data = db.prepare(`
        SELECT r.id, r.pass_code, e.title as event_title, u.full_name, r.seat_tier, r.checkin_status, r.checked_in_at, r.created_at
        FROM event_registrations r
        JOIN events e ON r.event_id = e.id
        JOIN users u ON r.user_id = u.id
      `).all() as any[];
      rows = data.map((r) => [esc(r.id), esc(r.pass_code), esc(r.event_title), esc(r.full_name), esc(r.seat_tier), esc(r.checkin_status), esc(r.checked_in_at), esc(r.created_at)].join(','));
    } else if (type === 'partners') {
      headers = ['Partner ID', 'Business Name', 'Category', 'City', 'Verification Status', 'Partnership Start'];
      const data = db.prepare('SELECT id, business_name, category, city, verification_status, partnership_start_date FROM partner_accounts').all() as any[];
      rows = data.map((r) => [esc(r.id), esc(r.business_name), esc(r.category), esc(r.city), esc(r.verification_status), esc(r.partnership_start_date)].join(','));
    } else if (type === 'campaigns') {
      headers = ['Coupon Code', 'Title', 'Offer Value', 'Approval Status', 'Actual Redemptions', 'Max Redemptions', 'Valid Until'];
      const data = db.prepare('SELECT code, title, discount_value, approval_status, actual_redemptions, max_redemptions, valid_until FROM coupons').all() as any[];
      rows = data.map((r) => [esc(r.code), esc(r.title), esc(r.discount_value), esc(r.approval_status), esc(r.actual_redemptions), esc(r.max_redemptions), esc(r.valid_until)].join(','));
    } else if (type === 'auctions') {
      headers = ['Auction ID', 'Title', 'Format', 'Status', 'Total Teams', 'Sold Players'];
      const data = db.prepare(`
        SELECT a.id, a.title, a.format_type, a.status,
          (SELECT COUNT(*) FROM auction_teams WHERE auction_id = a.id) as teams,
          (SELECT COUNT(*) FROM auction_players WHERE auction_id = a.id AND status = 'SOLD') as sold
        FROM auction_rooms a
      `).all() as any[];
      rows = data.map((r) => [esc(r.id), esc(r.title), esc(r.format_type), esc(r.status), esc(r.teams), esc(r.sold)].join(','));
    } else {
      headers = ['Event ID', 'Title', 'Category', 'Date', 'Status', 'Capacity', 'Confirmed', 'Verified Check-Ins'];
      const data = db.prepare(`
        SELECT e.id, e.title, e.category, e.event_date, e.status, e.seats_total,
          (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status != 'cancelled') as confirmed,
          (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status = 'checked_in') as checkins
        FROM events e
      `).all() as any[];
      rows = data.map((r) => [esc(r.id), esc(r.title), esc(r.category), esc(r.event_date), esc(r.status), esc(r.seats_total), esc(r.confirmed), esc(r.checkins)].join(','));
    }

    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'ADMIN_REPORT_EXPORTED',
      entityType: 'report',
      entityId: type,
    });

    return res.json({
      success: true,
      filename: `stroom-admin-${type}-report.csv`,
      csv: [headers.join(','), ...rows].join('\n'),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 12. PLATFORM SETTINGS & IMMUTABLE AUDIT LOGS
// =========================================================================

router.get('/settings', requirePermission('settings.manage'), (req: AuthRequest, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM platform_settings ORDER BY category ASC').all() as any[];
    const settings: Record<string, any> = {};
    for (const r of rows) {
      try {
        settings[r.key] = { ...r, value: JSON.parse(r.value_json) };
      } catch {
        settings[r.key] = { ...r, value: {} };
      }
    }
    return res.json({ success: true, settings });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/settings', requirePermission('settings.manage'), (req: AuthRequest, res: Response) => {
  try {
    const { key, value } = req.body;
    if (!key || !value || typeof value !== 'object') {
      return res.status(400).json({ error: 'Setting key and value object are required' });
    }
    const existing = db.prepare('SELECT * FROM platform_settings WHERE key = ?').get(key) as any;
    if (!existing) return res.status(404).json({ error: 'Setting category not found' });

    const beforeVal = JSON.parse(existing.value_json || '{}');
    db.prepare(`
      UPDATE platform_settings SET value_json = ?, updated_by = ?, updated_at = datetime('now') WHERE key = ?
    `).run(JSON.stringify(value), req.user!.full_name, key);

    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'PLATFORM_SETTINGS_UPDATED',
      entityType: 'platform_settings',
      entityId: key,
      beforeData: beforeVal,
      afterData: value,
    });

    return res.json({ success: true, message: `Updated ${existing.category} settings.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/audit-logs', requirePermission('auditlogs.view'), (req: AuthRequest, res: Response) => {
  try {
    const { action, entity_type, actor, limit = '100' } = req.query as Record<string, string>;
    let query = `
      SELECT a.*, COALESCE(a.actor_name, u.full_name, 'System') as resolved_actor_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (action && action !== 'all') {
      query += ' AND a.action LIKE ?';
      params.push(`%${action}%`);
    }
    if (entity_type && entity_type !== 'all') {
      query += ' AND a.entity_type = ?';
      params.push(entity_type);
    }
    if (actor && actor.trim()) {
      query += ' AND (a.actor_name LIKE ? OR u.full_name LIKE ?)';
      params.push(`%${actor.trim()}%`, `%${actor.trim()}%`);
    }
    query += ' ORDER BY a.created_at DESC LIMIT ?';
    params.push(Math.min(250, Math.max(10, Number(limit) || 100)));

    const logs = db.prepare(query).all(...params);
    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Explicitly protect audit logs from modification or deletion
router.all('/audit-logs*', (req: AuthRequest, res: Response) => {
  return res.status(403).json({ error: 'Audit logs are immutable and cannot be modified or deleted.' });
});

export default router;
