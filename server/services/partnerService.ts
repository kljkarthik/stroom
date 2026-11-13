import crypto from 'crypto';
import { db } from '../db/database';
import { User } from '../types';

export function isAdminOrPartnerManager(role?: string): boolean {
  return ['admin', 'super_admin', 'partner_manager', 'event_manager'].includes(role || '');
}

/**
 * Verifies that the authenticated user is either an authorized administrator
 * or owns / belongs to the requested partner account.
 * Returns the partner account and the user's effective partner_role, or throws an error with HTTP status.
 */
export function assertPartnerAccess(user: User, partnerId: string, requiredPartnerRoles?: string[]) {
  const partner = db.prepare('SELECT * FROM partner_accounts WHERE id = ?').get(partnerId) as any;
  if (!partner) {
    const err: any = new Error('Partner account not found');
    err.status = 404;
    throw err;
  }

  if (isAdminOrPartnerManager(user.role)) {
    return { partner, partnerRole: 'admin' };
  }

  if (partner.owner_user_id === user.id) {
    return { partner, partnerRole: 'owner' };
  }

  const membership = db.prepare(`
    SELECT partner_role FROM partner_users WHERE partner_id = ? AND user_id = ?
  `).get(partnerId, user.id) as { partner_role: string } | undefined;

  if (!membership) {
    const err: any = new Error('Forbidden: You do not have permission to access this partner account');
    err.status = 403;
    throw err;
  }

  if (requiredPartnerRoles && !requiredPartnerRoles.includes(membership.partner_role)) {
    const err: any = new Error(`Forbidden: Requires partner role (${requiredPartnerRoles.join(', ')})`);
    err.status = 403;
    throw err;
  }

  return { partner, partnerRole: membership.partner_role };
}

export function logPartnerAudit(
  partnerId: string,
  userId: string | null,
  actorName: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: any
) {
  try {
    const id = 'paud_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    db.prepare(`
      INSERT INTO partner_audit_logs (id, partner_id, user_id, actor_name, action, entity_type, entity_id, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, partnerId, userId, actorName, action, entityType, entityId || null, details ? JSON.stringify(details) : null);
  } catch (err) {
    console.warn('[partnerService.logPartnerAudit]', err);
  }
}

export function notifyPartner(
  partnerId: string,
  type: 'coordinator_message' | 'announcement' | 'operational_note' | 'verification_update',
  subject: string,
  message: string,
  senderName: string,
  senderRole: 'partner' | 'coordinator' | 'admin',
  eventId?: string | null,
  collaborationId?: string | null,
  senderUserId?: string | null
) {
  try {
    const id = 'pcomm_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    db.prepare(`
      INSERT INTO partner_communications (
        id, partner_id, event_id, collaboration_id, sender_user_id, sender_name, sender_role, subject, message, type, is_read, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `).run(id, partnerId, eventId || null, collaborationId || null, senderUserId || null, senderName, senderRole, subject, message, type);
    return id;
  } catch (err) {
    console.warn('[partnerService.notifyPartner]', err);
    return null;
  }
}

function getDateWindow(range?: string, from?: string, to?: string): { fromDate: string | null; toDate: string | null } {
  const now = new Date();
  if (range === 'custom' && (from || to)) {
    return { fromDate: from || null, toDate: to || null };
  }
  const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '30d' ? 30 : null;
  if (!days) {
    return { fromDate: null, toDate: null };
  }
  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { fromDate: past.toISOString().split('T')[0], toDate: now.toISOString().split('T')[0] };
}

export function getPartnerAnalytics(
  partnerId: string,
  filters: { range?: string; from?: string; to?: string; venueId?: string } = {}
) {
  const venues = db.prepare(`
    SELECT v.*, c.name as city_name
    FROM venues v
    JOIN cities c ON v.city_id = c.id
    WHERE v.partner_id = ?
  `).all(partnerId) as any[];

  const venueIds = filters.venueId ? [filters.venueId] : venues.map((v) => v.id);
  const { fromDate, toDate } = getDateWindow(filters.range, filters.from, filters.to);

  if (venueIds.length === 0) {
    return {
      summary: {
        totalCollaborations: 0,
        upcomingHostedEvents: 0,
        completedEvents: 0,
        expectedAttendance: 0,
        confirmedRegistrations: 0,
        actualVerifiedCheckins: 0,
        attendanceRate: null,
        activeCampaigns: 0,
        couponsIssued: 0,
        couponRedemptions: 0,
        redemptionRate: null,
        verifiedPurchasesCount: 0,
        verifiedPurchaseTotal: null,
      },
      eventsPerformance: [],
      campaignsPerformance: [],
      checkinsByDate: [],
      redemptionsHistory: [],
    };
  }

  const placeholders = venueIds.map(() => '?').join(',');

  // Events hosted at partner venues (strictly no PII)
  let eventsQuery = `
    SELECT 
      e.id,
      e.title,
      e.category,
      e.event_date,
      e.event_time,
      e.status,
      e.venue_id,
      v.name as venue_name,
      c.name as city_name,
      e.seats_total as expected_attendance,
      (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status != 'cancelled') as confirmed_registrations,
      (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status = 'checked_in') as actual_checkins,
      (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status = 'cancelled') as cancelled_count
    FROM events e
    JOIN venues v ON e.venue_id = v.id
    JOIN cities c ON e.city_id = c.id
    WHERE e.venue_id IN (${placeholders})
  `;
  const eventParams: any[] = [...venueIds];
  if (fromDate) {
    eventsQuery += ` AND date(e.created_at) >= date(?)`;
    eventParams.push(fromDate);
  }
  if (toDate) {
    eventsQuery += ` AND date(e.created_at) <= date(?)`;
    eventParams.push(toDate);
  }
  eventsQuery += ` ORDER BY e.created_at DESC`;

  const eventsPerformance = db.prepare(eventsQuery).all(...eventParams) as any[];

  // Enrich attendance rate per event
  for (const ev of eventsPerformance) {
    ev.attendance_rate = ev.confirmed_registrations > 0
      ? Math.round((ev.actual_checkins / ev.confirmed_registrations) * 100)
      : null;
  }

  // Collaborations count
  const totalCollaborations = (db.prepare(`SELECT COUNT(*) as c FROM partner_collaborations WHERE partner_id = ?`).get(partnerId) as any)?.c || 0;

  const upcomingHostedEvents = eventsPerformance.filter((e) => ['published', 'live'].includes(e.status)).length;
  const completedEvents = eventsPerformance.filter((e) => e.status === 'completed').length;

  const expectedAttendance = eventsPerformance.reduce((sum, e) => sum + (e.expected_attendance || 0), 0);
  const confirmedRegistrations = eventsPerformance.reduce((sum, e) => sum + (e.confirmed_registrations || 0), 0);
  const actualVerifiedCheckins = eventsPerformance.reduce((sum, e) => sum + (e.actual_checkins || 0), 0);
  const attendanceRate = confirmedRegistrations > 0 ? Math.round((actualVerifiedCheckins / confirmedRegistrations) * 100) : null;

  // Campaigns & Coupons scoped to partner
  const campaignsPerformance = db.prepare(`
    SELECT 
      c.id,
      c.venue_id,
      v.name as venue_name,
      c.code,
      c.title,
      c.description,
      c.offer_category,
      c.discount_type,
      c.discount_value,
      c.min_purchase,
      c.max_redemptions,
      c.actual_redemptions,
      c.status,
      c.approval_status,
      c.valid_from,
      c.valid_until,
      c.impressions,
      (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id ${fromDate ? "AND date(cr.redeemed_at) >= date('" + fromDate + "')" : ''} ${toDate ? "AND date(cr.redeemed_at) <= date('" + toDate + "')" : ''}) as period_redemptions,
      (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id AND cr.order_amount IS NOT NULL AND cr.order_amount > 0 ${fromDate ? "AND date(cr.redeemed_at) >= date('" + fromDate + "')" : ''} ${toDate ? "AND date(cr.redeemed_at) <= date('" + toDate + "')" : ''}) as verified_purchases_count,
      (SELECT COALESCE(SUM(cr.order_amount), 0) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id AND cr.order_amount IS NOT NULL AND cr.order_amount > 0 ${fromDate ? "AND date(cr.redeemed_at) >= date('" + fromDate + "')" : ''} ${toDate ? "AND date(cr.redeemed_at) <= date('" + toDate + "')" : ''}) as verified_purchase_total
    FROM coupons c
    JOIN venues v ON c.venue_id = v.id
    WHERE c.partner_id = ? OR c.venue_id IN (${placeholders})
    ORDER BY c.created_at DESC
  `).all(partnerId, ...venueIds) as any[];

  for (const camp of campaignsPerformance) {
    camp.redemption_rate = camp.max_redemptions > 0
      ? Math.round(((camp.actual_redemptions || 0) / camp.max_redemptions) * 100)
      : null;
  }

  const activeCampaigns = campaignsPerformance.filter((c) => c.approval_status === 'Active' && c.status === 'active').length;
  const couponsIssued = campaignsPerformance.reduce((sum, c) => sum + (c.max_redemptions || 0), 0);
  const couponRedemptions = campaignsPerformance.reduce((sum, c) => sum + (c.period_redemptions || 0), 0);
  const redemptionRate = couponsIssued > 0 ? Math.round((couponRedemptions / couponsIssued) * 100) : null;
  const verifiedPurchasesCount = campaignsPerformance.reduce((sum, c) => sum + (c.verified_purchases_count || 0), 0);
  const verifiedPurchaseSum = campaignsPerformance.reduce((sum, c) => sum + (c.verified_purchase_total || 0), 0);

  // Check-ins grouped by date (for time series chart)
  let checkinsByDateQuery = `
    SELECT date(r.checked_in_at) as date, COUNT(*) as checkins
    FROM event_registrations r
    JOIN events e ON r.event_id = e.id
    WHERE e.venue_id IN (${placeholders}) AND r.checkin_status = 'checked_in' AND r.checked_in_at IS NOT NULL
  `;
  const checkinsParams: any[] = [...venueIds];
  if (fromDate) {
    checkinsByDateQuery += ` AND date(r.checked_in_at) >= date(?)`;
    checkinsParams.push(fromDate);
  }
  if (toDate) {
    checkinsByDateQuery += ` AND date(r.checked_in_at) <= date(?)`;
    checkinsParams.push(toDate);
  }
  checkinsByDateQuery += ` GROUP BY date(r.checked_in_at) ORDER BY date ASC`;
  const checkinsByDate = db.prepare(checkinsByDateQuery).all(...checkinsParams) as any[];

  // Audited coupon redemptions log (anonymized pass reference, no member email/phone!)
  let redQuery = `
    SELECT 
      cr.id,
      cr.coupon_id,
      c.code as coupon_code,
      c.title as coupon_title,
      v.name as venue_name,
      cr.pass_code,
      cr.order_amount,
      cr.purchase_verified,
      cr.notes,
      cr.redeemed_at,
      staff.full_name as verified_by_staff
    FROM coupon_redemptions cr
    JOIN coupons c ON cr.coupon_id = c.id
    JOIN venues v ON cr.venue_id = v.id
    LEFT JOIN users staff ON cr.verified_by_user_id = staff.id
    WHERE (cr.partner_id = ? OR cr.venue_id IN (${placeholders}))
  `;
  const redParams: any[] = [partnerId, ...venueIds];
  if (fromDate) {
    redQuery += ` AND date(cr.redeemed_at) >= date(?)`;
    redParams.push(fromDate);
  }
  if (toDate) {
    redQuery += ` AND date(cr.redeemed_at) <= date(?)`;
    redParams.push(toDate);
  }
  redQuery += ` ORDER BY cr.redeemed_at DESC LIMIT 100`;
  const redemptionsHistory = db.prepare(redQuery).all(...redParams) as any[];

  return {
    summary: {
      totalCollaborations,
      upcomingHostedEvents,
      completedEvents,
      expectedAttendance,
      confirmedRegistrations,
      actualVerifiedCheckins,
      attendanceRate,
      activeCampaigns,
      couponsIssued,
      couponRedemptions,
      redemptionRate,
      verifiedPurchasesCount,
      verifiedPurchaseTotal: verifiedPurchasesCount > 0 ? verifiedPurchaseSum : null,
    },
    eventsPerformance,
    campaignsPerformance,
    checkinsByDate,
    redemptionsHistory,
  };
}

export function buildCsvExport(partnerId: string, reportType: 'events' | 'redemptions' | 'campaigns', filters: { range?: string; from?: string; to?: string } = {}): { filename: string; csv: string } {
  const analytics = getPartnerAnalytics(partnerId, filters);
  const esc = (val: any) => {
    const s = val === null || val === undefined ? '' : String(val);
    return `"${s.replace(/"/g, '""')}"`;
  };

  if (reportType === 'redemptions') {
    const header = ['Redemption ID', 'Coupon Code', 'Offer Title', 'Venue', 'Pass Code', 'Verified Purchase Amount (INR)', 'Purchase Verified', 'Verified By Staff', 'Redeemed At', 'Notes'];
    const rows = analytics.redemptionsHistory.map((r: any) => [
      esc(r.id),
      esc(r.coupon_code),
      esc(r.coupon_title),
      esc(r.venue_name),
      esc(r.pass_code || 'N/A'),
      esc(r.order_amount ?? 'Not recorded'),
      esc(r.purchase_verified ? 'Yes' : 'No'),
      esc(r.verified_by_staff || 'Authorized Staff'),
      esc(r.redeemed_at),
      esc(r.notes || ''),
    ].join(','));
    return {
      filename: `stroom-partner-redemptions-${partnerId}.csv`,
      csv: [header.join(','), ...rows].join('\n'),
    };
  }

  if (reportType === 'campaigns') {
    const header = ['Campaign ID', 'Coupon Code', 'Title', 'Venue', 'Offer Category', 'Discount Value', 'Approval Status', 'Issued Cap', 'Actual Redemptions', 'Redemption %', 'Verified Purchases', 'Verified Purchase Total (INR)', 'Valid Until'];
    const rows = analytics.campaignsPerformance.map((c: any) => [
      esc(c.id),
      esc(c.code),
      esc(c.title),
      esc(c.venue_name),
      esc(c.offer_category || c.discount_type),
      esc(c.discount_value),
      esc(c.approval_status),
      esc(c.max_redemptions),
      esc(c.actual_redemptions),
      esc(c.redemption_rate !== null ? `${c.redemption_rate}%` : 'Not available'),
      esc(c.verified_purchases_count || 0),
      esc(c.verified_purchases_count > 0 ? c.verified_purchase_total : 'Not available'),
      esc(c.valid_until),
    ].join(','));
    return {
      filename: `stroom-partner-campaigns-${partnerId}.csv`,
      csv: [header.join(','), ...rows].join('\n'),
    };
  }

  const header = ['Event ID', 'Event Title', 'Category', 'Venue', 'City', 'Date', 'Status', 'Expected Capacity', 'Confirmed Registrations', 'Actual Verified Check-ins', 'Attendance Rate'];
  const rows = analytics.eventsPerformance.map((e: any) => [
    esc(e.id),
    esc(e.title),
    esc(e.category),
    esc(e.venue_name),
    esc(e.city_name),
    esc(e.event_date),
    esc(e.status),
    esc(e.expected_attendance),
    esc(e.confirmed_registrations),
    esc(e.actual_checkins),
    esc(e.attendance_rate !== null ? `${e.attendance_rate}%` : 'Not available'),
  ].join(','));
  return {
    filename: `stroom-partner-events-${partnerId}.csv`,
    csv: [header.join(','), ...rows].join('\n'),
  };
}
