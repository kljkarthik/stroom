import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database';
import { requireAuth, AuthRequest, optionalAuth } from '../middleware/auth';
import { Venue, Coupon, PartnerProposal } from '../types';
import {
  assertPartnerAccess,
  isAdminOrPartnerManager,
  logPartnerAudit,
  notifyPartner,
  getPartnerAnalytics,
  buildCsvExport,
} from '../services/partnerService';
import { recordAuditLog } from '../services/auditService';

const router = Router();

function requirePartnerAdmin(req: AuthRequest, res: Response): boolean {
  if (!req.user || !isAdminOrPartnerManager(req.user.role)) {
    res.status(403).json({ error: 'Forbidden: Administrator or Partner Manager privileges required.' });
    return false;
  }
  return true;
}

function handlePartnerErr(res: Response, err: any) {
  const status = err.status || 400;
  return res.status(status).json({ error: err.message || 'Partner operation failed' });
}

// =========================================================================
// LEGACY & PUBLIC PARTNER ENDPOINTS (PRESERVED FOR COMPATIBILITY)
// =========================================================================

// 1. GET all verified partner venues (Public directory - strictly no private calendars)
router.get('/venues', (req, res) => {
  try {
    const venues = db.prepare(`
      SELECT 
        v.*,
        c.name as city_name,
        c.state as state_name,
        (SELECT COUNT(*) FROM events WHERE venue_id = v.id) as total_events_hosted,
        (SELECT COUNT(*) FROM coupons WHERE venue_id = v.id AND status = 'active' AND COALESCE(approval_status, 'Active') = 'Active') as active_coupons_count
      FROM venues v
      JOIN cities c ON v.city_id = c.id
      WHERE v.is_verified = 1
      ORDER BY v.partnership_tier DESC, v.name ASC
    `).all() as Venue[];

    return res.json({ venues });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch partner venues' });
  }
});

// 2. GET Real Partner Metrics for a Venue (No fabricated data, no PII)
router.get('/stats/:venueId', (req, res) => {
  try {
    const { venueId } = req.params;

    const venue = db.prepare(`
      SELECT v.*, c.name as city_name 
      FROM venues v
      JOIN cities c ON v.city_id = c.id
      WHERE v.id = ?
    `).get(venueId) as Venue | undefined;

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    const events = db.prepare(`
      SELECT 
        e.id,
        e.title,
        e.event_date,
        e.event_time,
        e.status,
        e.seats_total as expected_attendees,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status != 'cancelled') as registered_attendees,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status = 'checked_in') as actual_attendees
      FROM events e
      WHERE e.venue_id = ?
      ORDER BY e.event_date DESC
    `).all(venueId);

    const coupons = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = c.id) as verified_redemptions,
        (SELECT COALESCE(SUM(order_amount), 0) FROM coupon_redemptions WHERE coupon_id = c.id AND order_amount IS NOT NULL) as verified_order_total
      FROM coupons c
      WHERE c.venue_id = ?
    `).all(venueId);

    const aggregate = {
      venueName: venue.name,
      cityName: (venue as any).city_name,
      partnershipTier: venue.partnership_tier,
      totalEventsScheduled: events.length,
      totalExpectedAttendees: events.reduce((acc: number, e: any) => acc + (e.expected_attendees || 0), 0),
      totalRegisteredAttendees: events.reduce((acc: number, e: any) => acc + (e.registered_attendees || 0), 0),
      totalActualCheckins: events.reduce((acc: number, e: any) => acc + (e.actual_attendees || 0), 0),
      totalVerifiedRedemptions: coupons.reduce((acc: number, c: any) => acc + (c.verified_redemptions || 0), 0),
      totalVerifiedPartnerSales: coupons.reduce((acc: number, c: any) => acc + (c.verified_order_total || 0), 0),
    };

    return res.json({
      success: true,
      venue,
      aggregate,
      stats: {
        expected_attendees: aggregate.totalExpectedAttendees,
        registered_attendees: aggregate.totalRegisteredAttendees,
        actual_checkins: aggregate.totalActualCheckins,
        actual_coupon_redemptions: aggregate.totalVerifiedRedemptions,
        verified_partner_sales: aggregate.totalVerifiedPartnerSales,
      },
      events,
      coupons,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch partner stats' });
  }
});

// 3. POST Submit Public Collaboration Proposal (Partner With Us page)
router.post('/proposals', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const {
      venue_id,
      proposer_name,
      proposer_email,
      proposer_phone,
      venue_name,
      city,
      event_type,
      proposed_date,
      expected_attendees,
      perks_offered,
    } = req.body;

    if (!proposer_name || !proposer_email || !venue_name || !city || !event_type || !proposed_date) {
      return res.status(400).json({ error: 'Missing required proposal fields' });
    }

    const proposalId = 'prop_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    const proposalData = JSON.stringify({
      proposalId,
      submittedDate: new Date().toISOString(),
      venueName: venue_name,
      city,
      proposer: { name: proposer_name, email: proposer_email, phone: proposer_phone },
      eventDetails: {
        eventType: event_type,
        proposedDate: proposed_date,
        expectedAttendees: expected_attendees || 50,
        perksOffered: perks_offered || 'Reserved seating and welcome beverage discount',
      },
      stroomCommitment: [
        'Dedicated on-site STROOM event director',
        'Pre-registered community footfall with digital QR verification',
        'Official co-branded social promotion and venue tagging',
        'Digital coupon redemption engine for post-event retention tracking',
      ],
    });

    db.prepare(`
      INSERT INTO partner_proposals (id, venue_id, proposer_name, proposer_email, proposer_phone, venue_name, city, event_type, proposed_date, expected_attendees, perks_offered, status, proposal_pdf_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)
    `).run(
      proposalId,
      venue_id || null,
      proposer_name,
      proposer_email,
      proposer_phone || '',
      venue_name,
      city,
      event_type,
      proposed_date,
      expected_attendees || 50,
      perks_offered || '',
      proposalData
    );

    return res.status(201).json({
      message: 'Collaboration proposal successfully submitted to STROOM Partnerships',
      proposalId,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. GET Proposals list (Admin or authenticated inquiries)
router.get('/proposals', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    if (isAdminOrPartnerManager(req.user!.role)) {
      const proposals = db.prepare(`SELECT * FROM partner_proposals ORDER BY created_at DESC`).all() as PartnerProposal[];
      return res.json({ proposals });
    }
    const proposals = db.prepare(`
      SELECT * FROM partner_proposals WHERE proposer_email = ? ORDER BY created_at DESC
    `).all(req.user!.email) as PartnerProposal[];
    return res.json({ proposals });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// 5. POST Create Coupon (Maintains compatibility while enforcing approval rules for partners)
router.post('/coupons', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const {
      venue_id,
      code,
      title,
      description,
      discount_type,
      discount_value,
      max_redemptions,
      valid_until,
      min_purchase,
      valid_from,
      eligible_event_id,
      eligible_audience,
      terms_conditions,
      offer_category,
    } = req.body;

    if (!venue_id || !code || !title || !discount_value || !valid_until) {
      return res.status(400).json({ error: 'Missing required coupon details' });
    }

    const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(venue_id) as any;
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    if (!isAdminOrPartnerManager(req.user!.role)) {
      if (!venue.partner_id) {
        return res.status(403).json({ error: 'Forbidden: Venue is not linked to your partner account' });
      }
      assertPartnerAccess(req.user!, venue.partner_id, ['owner', 'manager']);
    }

    const isAdmin = isAdminOrPartnerManager(req.user!.role);
    const approvalStatus = isAdmin ? 'Active' : 'Submitted';
    const status = isAdmin ? 'active' : 'paused';

    const couponId = 'cpn_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    db.prepare(`
      INSERT INTO coupons (
        id, venue_id, partner_id, code, title, description, discount_type, discount_value,
        offer_category, min_purchase, valid_from, valid_until, max_redemptions,
        eligible_event_id, eligible_audience, terms_conditions, status, approval_status, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      couponId,
      venue_id,
      venue.partner_id || null,
      code.toUpperCase().trim(),
      title,
      description || '',
      discount_type || 'percentage',
      String(discount_value),
      offer_category || discount_type || 'percentage',
      Number(min_purchase) || 0,
      valid_from || new Date().toISOString().split('T')[0],
      valid_until,
      Number(max_redemptions) || 500,
      eligible_event_id || null,
      eligible_audience || 'all_members',
      terms_conditions || '',
      status,
      approvalStatus,
      req.user!.id
    );

    return res.status(201).json({
      message: isAdmin ? 'Coupon created and activated' : 'Campaign submitted for admin approval',
      couponId,
      approval_status: approvalStatus,
    });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// =========================================================================
// PHASE 5 PARTNER ONBOARDING & ACCOUNT MANAGEMENT
// =========================================================================

// GET authenticated user's partner accounts (or all for admin)
router.get('/my-accounts', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let accounts: any[] = [];

    if (isAdminOrPartnerManager(user.role)) {
      accounts = db.prepare(`SELECT * FROM partner_accounts ORDER BY verification_status = 'Verified' DESC, created_at DESC`).all();
    } else {
      accounts = db.prepare(`
        SELECT DISTINCT p.*, COALESCE(pu.partner_role, 'owner') as user_partner_role
        FROM partner_accounts p
        LEFT JOIN partner_users pu ON p.id = pu.partner_id AND pu.user_id = ?
        WHERE p.owner_user_id = ? OR pu.user_id = ?
        ORDER BY p.created_at DESC
      `).all(user.id, user.id, user.id);
    }

    return res.json({ success: true, accounts });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load partner accounts' });
  }
});

// POST Save Partner Onboarding Draft (Steps 1-4)
router.post('/onboarding/save', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const {
      partner_id,
      business_name,
      category,
      city,
      address,
      description,
      contact_person,
      contact_email,
      contact_phone,
      website,
      maps_url,
      capacity,
      facilities,
      operating_hours,
      collaboration_interests,
      business_logo,
      cover_url,
      onboarding_step,
    } = req.body;

    if (!business_name || !category || !city) {
      return res.status(400).json({ error: 'Business name, category, and city are required' });
    }

    const facilitiesJson = JSON.stringify(Array.isArray(facilities) ? facilities : []);
    const hoursJson = JSON.stringify(operating_hours || {});
    const interestsJson = JSON.stringify(Array.isArray(collaboration_interests) ? collaboration_interests : []);

    if (partner_id) {
      const { partner } = assertPartnerAccess(user, partner_id, ['owner', 'manager']);
      db.prepare(`
        UPDATE partner_accounts
        SET business_name = ?,
            category = ?,
            city = ?,
            address = COALESCE(?, address),
            description = COALESCE(?, description),
            contact_person = COALESCE(?, contact_person),
            contact_email = COALESCE(?, contact_email),
            contact_phone = COALESCE(?, contact_phone),
            website = COALESCE(?, website),
            maps_url = COALESCE(?, maps_url),
            capacity = COALESCE(?, capacity),
            facilities_json = ?,
            operating_hours_json = ?,
            collaboration_interests_json = ?,
            business_logo = COALESCE(?, business_logo),
            cover_url = COALESCE(?, cover_url),
            onboarding_step = MAX(onboarding_step, ?),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        business_name.trim(),
        category,
        city,
        address,
        description,
        contact_person,
        contact_email,
        contact_phone,
        website,
        maps_url,
        capacity ? Number(capacity) : null,
        facilitiesJson,
        hoursJson,
        interestsJson,
        business_logo,
        cover_url,
        Number(onboarding_step) || 1,
        partner.id
      );

      const updated = db.prepare('SELECT * FROM partner_accounts WHERE id = ?').get(partner.id);
      return res.json({ success: true, partner: updated, message: 'Onboarding progress saved.' });
    }

    const newPartnerId = 'ptr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
    db.transaction(() => {
      db.prepare(`
        INSERT INTO partner_accounts (
          id, owner_user_id, business_name, business_logo, cover_url, category, description,
          contact_person, contact_email, contact_phone, website, city, address, maps_url,
          capacity, facilities_json, operating_hours_json, collaboration_interests_json,
          verification_status, onboarding_step
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)
      `).run(
        newPartnerId,
        user.id,
        business_name.trim(),
        business_logo || null,
        cover_url || null,
        category,
        description || '',
        contact_person || user.full_name,
        contact_email || user.email,
        contact_phone || '',
        website || '',
        city,
        address || '',
        maps_url || '',
        Number(capacity) || 50,
        facilitiesJson,
        hoursJson,
        interestsJson,
        Number(onboarding_step) || 1
      );

      const puId = 'pu_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
      db.prepare(`
        INSERT INTO partner_users (id, partner_id, user_id, partner_role)
        VALUES (?, ?, ?, 'owner')
      `).run(puId, newPartnerId, user.id);

      logPartnerAudit(newPartnerId, user.id, user.full_name, 'ONBOARDING_DRAFT_CREATED', 'partner_account', newPartnerId, { business_name });
    })();

    const created = db.prepare('SELECT * FROM partner_accounts WHERE id = ?').get(newPartnerId);
    return res.status(201).json({ success: true, partner: created, message: 'Partner draft created.' });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// POST Submit Partner Account for Admin Verification (Never auto-verifies!)
router.post('/onboarding/submit', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { partner_id } = req.body;
    if (!partner_id) {
      return res.status(400).json({ error: 'partner_id is required' });
    }

    const { partner } = assertPartnerAccess(user, partner_id, ['owner', 'manager']);

    if (!partner.business_name || !partner.contact_email || !partner.city) {
      return res.status(400).json({ error: 'Please complete business name, contact email, and city before submitting.' });
    }

    if (partner.verification_status === 'Verified') {
      return res.status(400).json({ error: 'Partner account is already verified.' });
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE partner_accounts
        SET verification_status = 'Submitted',
            onboarding_step = 5,
            verification_notes = 'Application submitted for STROOM Partnerships verification review.',
            updated_at = datetime('now')
        WHERE id = ?
      `).run(partner_id);

      // Auto-create initial venue record if partner has none yet
      const venueCount = (db.prepare('SELECT COUNT(*) as c FROM venues WHERE partner_id = ?').get(partner_id) as any)?.c || 0;
      if (venueCount === 0 && partner.address) {
        const cityRow = db.prepare('SELECT id FROM cities WHERE LOWER(name) = LOWER(?)').get(partner.city) as { id: string } | undefined;
        const cityId = cityRow?.id || 'city_hyd';
        const venueId = 'ven_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        db.prepare(`
          INSERT INTO venues (
            id, city_id, partner_id, name, area, address, capacity, partner_type,
            contact_name, contact_email, contact_phone, is_verified, partnership_tier,
            facilities_json, maps_url
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Pending Verification', ?, ?)
        `).run(
          venueId,
          cityId,
          partner_id,
          partner.business_name,
          partner.city,
          partner.address,
          partner.capacity || 50,
          (partner.category || 'cafe').toLowerCase().includes('sport') ? 'sports_turf' : 'cafe',
          partner.contact_person,
          partner.contact_email,
          partner.contact_phone || '',
          partner.facilities_json || '[]',
          partner.maps_url || ''
        );
      }

      logPartnerAudit(partner_id, user.id, user.full_name, 'PARTNER_SUBMITTED_FOR_VERIFICATION', 'partner_account', partner_id);
      notifyPartner(
        partner_id,
        'verification_update',
        'Verification Submission Received',
        `Your application for ${partner.business_name} has been submitted and is awaiting review by the STROOM Partnerships team.`,
        'STROOM Partnerships',
        'admin'
      );
    })();

    const updated = db.prepare('SELECT * FROM partner_accounts WHERE id = ?').get(partner_id);
    return res.json({ success: true, partner: updated, message: 'Business submitted for verification review!' });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// PUT Update Business Profile (Strictly rejects unauthorized status elevation)
router.put('/accounts/:partnerId/profile', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { partnerId } = req.params;
    const { partner } = assertPartnerAccess(user, partnerId, ['owner', 'manager']);

    const {
      business_name,
      business_logo,
      cover_url,
      category,
      description,
      contact_person,
      contact_email,
      contact_phone,
      website,
      social_links,
      city,
      address,
      maps_url,
      capacity,
      facilities,
      operating_hours,
      collaboration_interests,
    } = req.body;

    db.prepare(`
      UPDATE partner_accounts
      SET business_name = COALESCE(?, business_name),
          business_logo = COALESCE(?, business_logo),
          cover_url = COALESCE(?, cover_url),
          category = COALESCE(?, category),
          description = COALESCE(?, description),
          contact_person = COALESCE(?, contact_person),
          contact_email = COALESCE(?, contact_email),
          contact_phone = COALESCE(?, contact_phone),
          website = COALESCE(?, website),
          social_links_json = COALESCE(?, social_links_json),
          city = COALESCE(?, city),
          address = COALESCE(?, address),
          maps_url = COALESCE(?, maps_url),
          capacity = COALESCE(?, capacity),
          facilities_json = COALESCE(?, facilities_json),
          operating_hours_json = COALESCE(?, operating_hours_json),
          collaboration_interests_json = COALESCE(?, collaboration_interests_json),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      business_name,
      business_logo,
      cover_url,
      category,
      description,
      contact_person,
      contact_email,
      contact_phone,
      website,
      social_links ? JSON.stringify(social_links) : null,
      city,
      address,
      maps_url,
      capacity !== undefined ? Number(capacity) : null,
      Array.isArray(facilities) ? JSON.stringify(facilities) : null,
      operating_hours ? JSON.stringify(operating_hours) : null,
      Array.isArray(collaboration_interests) ? JSON.stringify(collaboration_interests) : null,
      partner.id
    );

    logPartnerAudit(partnerId, user.id, user.full_name, 'BUSINESS_PROFILE_UPDATED', 'partner_account', partnerId);

    const updated = db.prepare('SELECT * FROM partner_accounts WHERE id = ?').get(partnerId);
    return res.json({ success: true, partner: updated, message: 'Business profile updated successfully.' });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// =========================================================================
// PARTNER DASHBOARD OVERVIEW
// =========================================================================

router.get('/accounts/:partnerId/dashboard', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;
    const { partner, partnerRole } = assertPartnerAccess(req.user!, partnerId);

    const venues = db.prepare(`
      SELECT v.*, c.name as city_name
      FROM venues v
      JOIN cities c ON v.city_id = c.id
      WHERE v.partner_id = ?
      ORDER BY v.name ASC
    `).all(partnerId);

    const analytics = getPartnerAnalytics(partnerId);

    const collaborations = db.prepare(`
      SELECT pc.*, v.name as venue_name
      FROM partner_collaborations pc
      JOIN venues v ON pc.venue_id = v.id
      WHERE pc.partner_id = ?
      ORDER BY pc.created_at DESC
      LIMIT 10
    `).all(partnerId);

    const communications = db.prepare(`
      SELECT * FROM partner_communications
      WHERE partner_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(partnerId);

    const unreadCommsCount = (db.prepare(`
      SELECT COUNT(*) as c FROM partner_communications WHERE partner_id = ? AND is_read = 0
    `).get(partnerId) as any)?.c || 0;

    return res.json({
      success: true,
      partner,
      partnerRole,
      venues,
      summary: analytics.summary,
      recentEvents: analytics.eventsPerformance.slice(0, 5),
      collaborations,
      recentCampaigns: analytics.campaignsPerformance.slice(0, 5),
      recentRedemptions: analytics.redemptionsHistory.slice(0, 6),
      communications,
      unreadCommsCount,
    });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// =========================================================================
// VENUE MANAGEMENT & AVAILABILITY CALENDAR
// =========================================================================

router.get('/accounts/:partnerId/venues', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;
    assertPartnerAccess(req.user!, partnerId);

    const venues = db.prepare(`
      SELECT 
        v.*,
        c.name as city_name,
        (SELECT COUNT(*) FROM events e WHERE e.venue_id = v.id AND e.status IN ('published', 'live')) as upcoming_events_count,
        (SELECT COUNT(*) FROM venue_availability va WHERE va.venue_id = v.id AND va.status = 'booked') as booked_slots_count
      FROM venues v
      JOIN cities c ON v.city_id = c.id
      WHERE v.partner_id = ?
      ORDER BY v.created_at DESC
    `).all(partnerId);

    return res.json({ success: true, venues });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

router.post('/accounts/:partnerId/venues', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;
    const { partner } = assertPartnerAccess(req.user!, partnerId, ['owner', 'manager']);

    const {
      name,
      city,
      area,
      address,
      partner_type,
      capacity,
      facilities,
      event_spaces,
      operating_hours,
      accessibility_info,
      contact_name,
      contact_email,
      contact_phone,
      maps_url,
      photos,
    } = req.body;

    if (!name || !address || !city) {
      return res.status(400).json({ error: 'Venue name, city, and address are required' });
    }

    const cityRow = db.prepare('SELECT id FROM cities WHERE LOWER(name) = LOWER(?) OR id = ?').get(city, city) as { id: string } | undefined;
    const cityId = cityRow?.id || 'city_hyd';
    const venueId = 'ven_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);

    db.prepare(`
      INSERT INTO venues (
        id, city_id, partner_id, name, area, address, capacity, partner_type,
        contact_name, contact_email, contact_phone, is_verified, partnership_tier,
        photos_json, facilities_json, event_spaces_json, operating_hours, accessibility_info, maps_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      venueId,
      cityId,
      partnerId,
      name.trim(),
      area || city,
      address.trim(),
      Number(capacity) || 60,
      partner_type || 'cafe',
      contact_name || partner.contact_person,
      contact_email || partner.contact_email,
      contact_phone || partner.contact_phone || '',
      partner.verification_status === 'Verified' ? 1 : 0,
      partner.partnership_tier || 'Community Partner',
      JSON.stringify(Array.isArray(photos) ? photos : []),
      JSON.stringify(Array.isArray(facilities) ? facilities : []),
      JSON.stringify(Array.isArray(event_spaces) ? event_spaces : []),
      operating_hours || '09:00 AM - 11:00 PM',
      accessibility_info || 'Standard entrance',
      maps_url || ''
    );

    logPartnerAudit(partnerId, req.user!.id, req.user!.full_name, 'VENUE_CREATED', 'venue', venueId, { name });
    const venue = db.prepare('SELECT v.*, c.name as city_name FROM venues v JOIN cities c ON v.city_id = c.id WHERE v.id = ?').get(venueId);
    return res.status(201).json({ success: true, venue });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

router.put('/accounts/:partnerId/venues/:venueId', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId, venueId } = req.params;
    assertPartnerAccess(req.user!, partnerId, ['owner', 'manager']);

    const venue = db.prepare('SELECT * FROM venues WHERE id = ? AND partner_id = ?').get(venueId, partnerId) as any;
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found under this partner account' });
    }

    const {
      name,
      area,
      address,
      partner_type,
      capacity,
      facilities,
      event_spaces,
      operating_hours,
      accessibility_info,
      contact_name,
      contact_email,
      contact_phone,
      maps_url,
      photos,
    } = req.body;

    db.prepare(`
      UPDATE venues
      SET name = COALESCE(?, name),
          area = COALESCE(?, area),
          address = COALESCE(?, address),
          partner_type = COALESCE(?, partner_type),
          capacity = COALESCE(?, capacity),
          facilities_json = COALESCE(?, facilities_json),
          event_spaces_json = COALESCE(?, event_spaces_json),
          operating_hours = COALESCE(?, operating_hours),
          accessibility_info = COALESCE(?, accessibility_info),
          contact_name = COALESCE(?, contact_name),
          contact_email = COALESCE(?, contact_email),
          contact_phone = COALESCE(?, contact_phone),
          maps_url = COALESCE(?, maps_url),
          photos_json = COALESCE(?, photos_json)
      WHERE id = ? AND partner_id = ?
    `).run(
      name,
      area,
      address,
      partner_type,
      capacity !== undefined ? Number(capacity) : null,
      Array.isArray(facilities) ? JSON.stringify(facilities) : null,
      Array.isArray(event_spaces) ? JSON.stringify(event_spaces) : null,
      operating_hours,
      accessibility_info,
      contact_name,
      contact_email,
      contact_phone,
      maps_url,
      Array.isArray(photos) ? JSON.stringify(photos) : null,
      venueId,
      partnerId
    );

    logPartnerAudit(partnerId, req.user!.id, req.user!.full_name, 'VENUE_UPDATED', 'venue', venueId);
    const updated = db.prepare('SELECT v.*, c.name as city_name FROM venues v JOIN cities c ON v.city_id = c.id WHERE v.id = ?').get(venueId);
    return res.json({ success: true, venue: updated });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// Private Partner Venue Availability Calendar
router.get('/accounts/:partnerId/venues/:venueId/availability', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId, venueId } = req.params;
    assertPartnerAccess(req.user!, partnerId);

    const venue = db.prepare('SELECT * FROM venues WHERE id = ? AND partner_id = ?').get(venueId, partnerId);
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found under this partner account' });
    }

    const slots = db.prepare(`
      SELECT va.*, pc.event_name as collaboration_event_name, e.title as event_title
      FROM venue_availability va
      LEFT JOIN partner_collaborations pc ON va.collaboration_id = pc.id
      LEFT JOIN events e ON va.event_id = e.id
      WHERE va.venue_id = ?
      ORDER BY va.date ASC, va.time_slot ASC
    `).all(venueId);

    return res.json({ success: true, availability: slots });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// Set Venue Availability with Double-Booking Prevention
router.post('/accounts/:partnerId/venues/:venueId/availability', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId, venueId } = req.params;
    assertPartnerAccess(req.user!, partnerId, ['owner', 'manager']);

    const venue = db.prepare('SELECT * FROM venues WHERE id = ? AND partner_id = ?').get(venueId, partnerId);
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found under this partner account' });
    }

    const { date, time_slot, status, notes } = req.body;
    if (!date || !status) {
      return res.status(400).json({ error: 'Date and status are required' });
    }

    const slot = time_slot || 'full_day';
    if (!['available', 'unavailable'].includes(status)) {
      return res.status(400).json({ error: 'Partners can only set slots to available or unavailable' });
    }

    // Check double-booking conflicts across exact slot or full_day overlap
    const conflict = db.prepare(`
      SELECT * FROM venue_availability
      WHERE venue_id = ? AND date = ? AND status IN ('booked', 'proposed')
      AND (time_slot = ? OR time_slot = 'full_day' OR ? = 'full_day')
    `).get(venueId, date, slot, slot) as any;

    if (conflict) {
      return res.status(409).json({
        error: `Conflict: This venue already has a ${conflict.status} collaboration (${conflict.notes || conflict.time_slot}) on ${date}.`,
      });
    }

    const existing = db.prepare(`
      SELECT id FROM venue_availability WHERE venue_id = ? AND date = ? AND time_slot = ?
    `).get(venueId, date, slot) as { id: string } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE venue_availability SET status = ?, notes = ? WHERE id = ?
      `).run(status, notes || '', existing.id);
    } else {
      const id = 'va_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
      db.prepare(`
        INSERT INTO venue_availability (id, venue_id, partner_id, date, time_slot, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, venueId, partnerId, date, slot, status, notes || '');
    }

    logPartnerAudit(partnerId, req.user!.id, req.user!.full_name, 'VENUE_AVAILABILITY_UPDATED', 'venue_availability', venueId, { date, slot, status });
    const slots = db.prepare('SELECT * FROM venue_availability WHERE venue_id = ? ORDER BY date ASC').all(venueId);
    return res.json({ success: true, availability: slots });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// =========================================================================
// EVENT COLLABORATIONS & PARTNER HOSTED EVENTS
// =========================================================================

router.get('/accounts/:partnerId/collaborations', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;
    assertPartnerAccess(req.user!, partnerId);

    const collaborations = db.prepare(`
      SELECT pc.*, v.name as venue_name, v.address as venue_address, e.seats_booked, e.seats_total
      FROM partner_collaborations pc
      JOIN venues v ON pc.venue_id = v.id
      LEFT JOIN events e ON pc.event_id = e.id
      WHERE pc.partner_id = ?
      ORDER BY pc.created_at DESC
    `).all(partnerId) as any[];

    for (const col of collaborations) {
      col.comments = db.prepare(`
        SELECT * FROM collaboration_comments WHERE collaboration_id = ? ORDER BY created_at ASC
      `).all(col.id);
      try {
        col.timeline = JSON.parse(col.timeline_json || '[]');
      } catch {
        col.timeline = [];
      }
    }

    return res.json({ success: true, collaborations });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// Partner responds to collaboration proposal (Accept, Reject, Request Changes, Suggest Date, Comment)
router.post('/accounts/:partnerId/collaborations/:collabId/respond', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId, collabId } = req.params;
    const { partner } = assertPartnerAccess(req.user!, partnerId, ['owner', 'manager']);

    const collab = db.prepare(`
      SELECT * FROM partner_collaborations WHERE id = ? AND partner_id = ?
    `).get(collabId, partnerId) as any;

    if (!collab) {
      return res.status(404).json({ error: 'Collaboration proposal not found' });
    }

    const { action, message, suggested_date, suggested_time } = req.body;
    const validActions = ['accept', 'reject', 'request_changes', 'suggest_date', 'comment'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid response action' });
    }

    let nextStatus = collab.status;
    let timeline: any[] = [];
    try {
      timeline = JSON.parse(collab.timeline_json || '[]');
    } catch {
      timeline = [];
    }

    const today = new Date().toISOString().split('T')[0];

    db.transaction(() => {
      if (action === 'accept') {
        if (partner.verification_status !== 'Verified') {
          throw Object.assign(new Error('Your business must be Verified before accepting event collaborations.'), { status: 403 });
        }
        nextStatus = 'Approved';
        timeline.push({ step: 'Accepted by Partner', date: today, completed: true });
      } else if (action === 'reject') {
        nextStatus = 'Rejected';
        timeline.push({ step: 'Declined by Partner', date: today, completed: true });
        db.prepare(`DELETE FROM venue_availability WHERE collaboration_id = ? AND status = 'proposed'`).run(collabId);
      } else if (action === 'request_changes') {
        nextStatus = 'Negotiation';
        timeline.push({ step: 'Partner Requested Changes', date: today, completed: true });
      } else if (action === 'suggest_date') {
        if (!suggested_date) {
          throw Object.assign(new Error('Please specify a suggested alternate date'), { status: 400 });
        }
        nextStatus = 'Negotiation';
        timeline.push({ step: `Alternate Date Suggested (${suggested_date})`, date: today, completed: true });
      }

      db.prepare(`
        UPDATE partner_collaborations
        SET status = ?,
            suggested_date = COALESCE(?, suggested_date),
            suggested_time = COALESCE(?, suggested_time),
            timeline_json = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        nextStatus,
        suggested_date || null,
        suggested_time || null,
        JSON.stringify(timeline),
        collabId
      );

      const commentText = message || (
        action === 'accept' ? 'Partner accepted the collaboration proposal.' :
        action === 'reject' ? 'Partner declined the collaboration proposal.' :
        action === 'suggest_date' ? `Partner suggested alternate date: ${suggested_date} ${suggested_time || ''}` :
        'Partner added a comment.'
      );

      const commentId = 'cc_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
      db.prepare(`
        INSERT INTO collaboration_comments (id, collaboration_id, partner_id, user_id, sender_name, sender_role, message, action_type)
        VALUES (?, ?, ?, ?, ?, 'partner', ?, ?)
      `).run(commentId, collabId, partnerId, req.user!.id, req.user!.full_name, commentText, action);

      logPartnerAudit(partnerId, req.user!.id, req.user!.full_name, `COLLABORATION_${action.toUpperCase()}`, 'collaboration', collabId, { nextStatus, suggested_date });
    })();

    const updated = db.prepare('SELECT * FROM partner_collaborations WHERE id = ?').get(collabId) as any;
    updated.comments = db.prepare('SELECT * FROM collaboration_comments WHERE collaboration_id = ? ORDER BY created_at ASC').all(collabId);

    return res.json({ success: true, collaboration: updated });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// Partner Hosted & Approved Events (Strictly scoped & no PII)
router.get('/accounts/:partnerId/events', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;
    assertPartnerAccess(req.user!, partnerId);

    const events = db.prepare(`
      SELECT 
        e.id, e.title, e.category, e.event_date, e.event_time, e.description,
        e.seats_total, e.seats_booked, e.status, e.image_url, e.partner_operational_notes,
        v.id as venue_id, v.name as venue_name, v.address as venue_address, c.name as city_name,
        pc.id as collaboration_id, pc.organizer_name, pc.partner_responsibilities, pc.stroom_responsibilities,
        pc.special_requirements, pc.timeline_json,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status != 'cancelled') as confirmed_registrations,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND checkin_status = 'checked_in') as actual_checkins
      FROM events e
      JOIN venues v ON e.venue_id = v.id
      JOIN cities c ON e.city_id = c.id
      LEFT JOIN partner_collaborations pc ON pc.event_id = e.id
      WHERE v.partner_id = ?
      ORDER BY e.created_at DESC
    `).all(partnerId) as any[];

    for (const ev of events) {
      try {
        ev.timeline = ev.timeline_json ? JSON.parse(ev.timeline_json) : [];
      } catch {
        ev.timeline = [];
      }
      if (ev.timeline.length === 0) {
        ev.timeline = [
          { step: 'Collaboration Approved', completed: true },
          { step: 'Event Published', completed: ev.status !== 'draft' },
          { step: 'Registrations Opened', completed: ev.confirmed_registrations > 0 || ev.status === 'live' || ev.status === 'completed' },
          { step: 'Event Started', completed: ev.status === 'live' || ev.status === 'completed' },
          { step: 'Check-in Completed', completed: ev.actual_checkins > 0 && ev.status === 'completed' },
          { step: 'Event Closed', completed: ev.status === 'completed' },
        ];
      }
    }

    return res.json({ success: true, events });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// Partner Operational Notes Update (Authorized partners cannot alter publication status or capacity)
router.patch('/accounts/:partnerId/events/:eventId/operations', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId, eventId } = req.params;
    assertPartnerAccess(req.user!, partnerId, ['owner', 'manager']);

    const { partner_operational_notes } = req.body;
    const event = db.prepare(`
      SELECT e.* FROM events e JOIN venues v ON e.venue_id = v.id WHERE e.id = ? AND v.partner_id = ?
    `).get(eventId, partnerId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found at your venues' });
    }

    db.prepare(`UPDATE events SET partner_operational_notes = ? WHERE id = ?`).run(partner_operational_notes || '', eventId);
    logPartnerAudit(partnerId, req.user!.id, req.user!.full_name, 'EVENT_OPERATIONAL_NOTES_UPDATED', 'event', eventId);

    return res.json({ success: true, message: 'Operational logistics updated.' });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// =========================================================================
// OFFERS, CAMPAIGNS & QR COUPON REDEMPTION
// =========================================================================

router.get('/accounts/:partnerId/campaigns', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;
    assertPartnerAccess(req.user!, partnerId);

    const campaigns = db.prepare(`
      SELECT 
        c.*,
        v.name as venue_name,
        e.title as eligible_event_title,
        (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id AND cr.order_amount > 0) as verified_purchases_count,
        (SELECT COALESCE(SUM(cr.order_amount), 0) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id AND cr.order_amount > 0) as verified_purchase_total
      FROM coupons c
      JOIN venues v ON c.venue_id = v.id
      LEFT JOIN events e ON c.eligible_event_id = e.id
      WHERE c.partner_id = ? OR v.partner_id = ?
      ORDER BY c.created_at DESC
    `).all(partnerId, partnerId);

    return res.json({ success: true, campaigns });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

router.post('/accounts/:partnerId/campaigns', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;
    const { partner } = assertPartnerAccess(req.user!, partnerId, ['owner', 'manager']);

    const {
      venue_id,
      code,
      title,
      description,
      offer_category,
      discount_type,
      discount_value,
      min_purchase,
      valid_from,
      valid_until,
      max_redemptions,
      eligible_event_id,
      eligible_audience,
      terms_conditions,
      image_url,
      submit_for_approval,
    } = req.body;

    if (!venue_id || !code || !title || !discount_value || !valid_until) {
      return res.status(400).json({ error: 'Venue, code, title, discount value, and validity end date are required' });
    }

    const venue = db.prepare('SELECT id FROM venues WHERE id = ? AND partner_id = ?').get(venue_id, partnerId);
    if (!venue) {
      return res.status(403).json({ error: 'Selected venue does not belong to this partner account' });
    }

    const cleanCode = code.toUpperCase().trim();
    const existingCode = db.prepare('SELECT id FROM coupons WHERE code = ?').get(cleanCode);
    if (existingCode) {
      return res.status(409).json({ error: `Coupon code ${cleanCode} already exists. Please use a unique code.` });
    }

    const isAdmin = isAdminOrPartnerManager(req.user!.role);
    // Security requirement: partner campaigns cannot go publicly Active before admin approval!
    const approvalStatus = isAdmin ? 'Active' : submit_for_approval ? 'Submitted' : 'Draft';
    const status = isAdmin ? 'active' : 'paused';
    const campaignId = 'cpn_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);

    db.prepare(`
      INSERT INTO coupons (
        id, venue_id, partner_id, code, title, description, discount_type, discount_value,
        offer_category, min_purchase, valid_from, valid_until, max_redemptions,
        eligible_event_id, eligible_audience, terms_conditions, image_url, status, approval_status, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      campaignId,
      venue_id,
      partnerId,
      cleanCode,
      title.trim(),
      description || '',
      discount_type || offer_category || 'percentage',
      String(discount_value),
      offer_category || discount_type || 'percentage',
      Number(min_purchase) || 0,
      valid_from || new Date().toISOString().split('T')[0],
      valid_until,
      Number(max_redemptions) || 100,
      eligible_event_id || null,
      eligible_audience || 'all_members',
      terms_conditions || '',
      image_url || null,
      status,
      approvalStatus,
      req.user!.id
    );

    logPartnerAudit(partnerId, req.user!.id, req.user!.full_name, 'CAMPAIGN_CREATED', 'coupon', campaignId, { code: cleanCode, approvalStatus });

    const campaign = db.prepare('SELECT * FROM coupons WHERE id = ?').get(campaignId);
    return res.status(201).json({
      success: true,
      campaign,
      message: approvalStatus === 'Submitted' ? 'Campaign submitted to STROOM Admin for approval.' : `Campaign saved as ${approvalStatus}.`,
    });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// Partner edits Draft or toggles Pause on already Approved campaign
router.patch('/accounts/:partnerId/campaigns/:campaignId', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId, campaignId } = req.params;
    assertPartnerAccess(req.user!, partnerId, ['owner', 'manager']);

    const campaign = db.prepare('SELECT * FROM coupons WHERE id = ? AND partner_id = ?').get(campaignId, partnerId) as any;
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found under this partner account' });
    }

    const { action, title, description, max_redemptions, valid_until } = req.body;

    if (action === 'submit') {
      if (!['Draft', 'Rejected'].includes(campaign.approval_status)) {
        return res.status(400).json({ error: 'Only Draft or Rejected campaigns can be submitted for review' });
      }
      db.prepare(`UPDATE coupons SET approval_status = 'Submitted' WHERE id = ?`).run(campaignId);
    } else if (action === 'pause') {
      if (campaign.approval_status !== 'Active' && campaign.approval_status !== 'Approved') {
        return res.status(400).json({ error: 'Only approved campaigns can be paused' });
      }
      db.prepare(`UPDATE coupons SET status = 'paused', approval_status = 'Paused' WHERE id = ?`).run(campaignId);
    } else if (action === 'resume') {
      if (campaign.approval_status !== 'Paused') {
        return res.status(400).json({ error: 'Only paused previously-approved campaigns can be resumed' });
      }
      db.prepare(`UPDATE coupons SET status = 'active', approval_status = 'Active' WHERE id = ?`).run(campaignId);
    } else {
      db.prepare(`
        UPDATE coupons
        SET title = COALESCE(?, title),
            description = COALESCE(?, description),
            max_redemptions = COALESCE(?, max_redemptions),
            valid_until = COALESCE(?, valid_until)
        WHERE id = ?
      `).run(title, description, max_redemptions ? Number(max_redemptions) : null, valid_until, campaignId);
    }

    logPartnerAudit(partnerId, req.user!.id, req.user!.full_name, 'CAMPAIGN_UPDATED', 'coupon', campaignId, { action });
    const updated = db.prepare('SELECT * FROM coupons WHERE id = ?').get(campaignId);
    return res.json({ success: true, campaign: updated });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// Pre-flight Verification of Coupon Eligibility (BEFORE Redemption!)
router.post('/coupons/verify', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { coupon_code, venue_id, pass_code, order_amount } = req.body;
    if (!coupon_code) {
      return res.status(400).json({ valid: false, error: 'Coupon code is required' });
    }

    const coupon = db.prepare(`
      SELECT c.*, v.name as venue_name, p.business_name as partner_name
      FROM coupons c
      JOIN venues v ON c.venue_id = v.id
      LEFT JOIN partner_accounts p ON c.partner_id = p.id
      WHERE c.code = ?
    `).get(coupon_code.toUpperCase().trim()) as any;

    if (!coupon) {
      return res.status(404).json({ valid: false, error: 'Coupon code not found' });
    }

    if (coupon.partner_id && !isAdminOrPartnerManager(req.user!.role)) {
      assertPartnerAccess(req.user!, coupon.partner_id);
    }

    if (venue_id && coupon.venue_id !== venue_id) {
      return res.status(400).json({ valid: false, error: `Coupon ${coupon.code} is only valid at ${coupon.venue_name}.` });
    }

    if (coupon.status !== 'active' || (coupon.approval_status && coupon.approval_status !== 'Active' && coupon.approval_status !== 'Approved')) {
      return res.status(400).json({ valid: false, error: `Coupon is currently ${coupon.approval_status || coupon.status} and cannot be redeemed.` });
    }

    const today = new Date().toISOString().split('T')[0];
    if (coupon.valid_until && coupon.valid_until < today) {
      return res.status(400).json({ valid: false, error: `Coupon expired on ${coupon.valid_until}.` });
    }
    if (coupon.valid_from && coupon.valid_from > today) {
      return res.status(400).json({ valid: false, error: `Coupon is not valid until ${coupon.valid_from}.` });
    }

    if (coupon.actual_redemptions >= coupon.max_redemptions) {
      return res.status(400).json({ valid: false, error: 'Coupon maximum redemption limit reached.' });
    }

    if (coupon.min_purchase && order_amount !== undefined && Number(order_amount) < Number(coupon.min_purchase)) {
      return res.status(400).json({ valid: false, error: `Minimum purchase of ₹${coupon.min_purchase} required for this offer.` });
    }

    if (pass_code && pass_code.trim()) {
      const cleanPass = pass_code.trim().toUpperCase();
      const dup = db.prepare(`SELECT id FROM coupon_redemptions WHERE coupon_id = ? AND pass_code = ?`).get(coupon.id, cleanPass);
      if (dup) {
        return res.status(409).json({ valid: false, error: `Pass ${cleanPass} has already redeemed coupon ${coupon.code}.` });
      }
      if (coupon.eligible_event_id) {
        const reg = db.prepare(`SELECT * FROM event_registrations WHERE pass_code = ?`).get(cleanPass) as any;
        if (!reg || reg.event_id !== coupon.eligible_event_id || reg.checkin_status === 'cancelled') {
          return res.status(400).json({ valid: false, error: `Pass ${cleanPass} is not eligible for this event-specific campaign.` });
        }
      }
    }

    return res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        min_purchase: coupon.min_purchase || 0,
        remaining_redemptions: coupon.max_redemptions - coupon.actual_redemptions,
        venue_name: coupon.venue_name,
        valid_until: coupon.valid_until,
        terms_conditions: coupon.terms_conditions,
      },
    });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// 6. POST QR Coupon Redemption Scanner (Atomic, Validated, Duplicate-Safe)
router.post('/coupons/redeem', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { coupon_code, venue_id, pass_code, order_amount, notes } = req.body;
    const userId = req.user!.id;

    if (!coupon_code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    const redeemTransaction = db.transaction(() => {
      const coupon = db.prepare(`
        SELECT * FROM coupons WHERE code = ?
      `).get(coupon_code.toUpperCase().trim()) as any;

      if (!coupon) {
        throw new Error('Invalid coupon code');
      }

      if (coupon.partner_id && !isAdminOrPartnerManager(req.user!.role)) {
        assertPartnerAccess(req.user!, coupon.partner_id);
      }

      if (venue_id && coupon.venue_id !== venue_id) {
        throw new Error('Coupon is not valid at the selected business location');
      }

      if (coupon.status !== 'active' || (coupon.approval_status && coupon.approval_status !== 'Active' && coupon.approval_status !== 'Approved')) {
        throw new Error(`Coupon is ${coupon.approval_status || coupon.status} and cannot be redeemed`);
      }

      const today = new Date().toISOString().split('T')[0];
      if (coupon.valid_until && coupon.valid_until < today) {
        throw new Error(`Expired coupon code (valid until ${coupon.valid_until})`);
      }

      if (coupon.actual_redemptions >= coupon.max_redemptions) {
        throw new Error('Coupon redemption cap reached');
      }

      const numericAmount = order_amount !== undefined && order_amount !== '' ? Number(order_amount) : null;
      if (coupon.min_purchase && Number(coupon.min_purchase) > 0 && (!numericAmount || numericAmount < Number(coupon.min_purchase))) {
        throw new Error(`Minimum purchase amount of ₹${coupon.min_purchase} is required`);
      }

      const cleanPass = pass_code && pass_code.trim() ? pass_code.trim().toUpperCase() : null;
      if (cleanPass) {
        const dup = db.prepare(`SELECT id FROM coupon_redemptions WHERE coupon_id = ? AND pass_code = ?`).get(coupon.id, cleanPass);
        if (dup) {
          throw new Error(`Duplicate redemption blocked: Pass ${cleanPass} already redeemed this coupon.`);
        }
        if (coupon.eligible_event_id) {
          const reg = db.prepare(`SELECT * FROM event_registrations WHERE pass_code = ?`).get(cleanPass) as any;
          if (!reg || reg.event_id !== coupon.eligible_event_id || reg.checkin_status === 'cancelled') {
            throw new Error(`Pass ${cleanPass} is not valid for the eligible event.`);
          }
        }
      }

      const redemptionId = 'red_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const purchaseVerified = numericAmount !== null && numericAmount > 0 ? 1 : 0;

      db.prepare(`
        INSERT INTO coupon_redemptions (
          id, coupon_id, venue_id, partner_id, event_id, user_id, verified_by_user_id, pass_code, order_amount, purchase_verified, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        redemptionId,
        coupon.id,
        coupon.venue_id,
        coupon.partner_id || null,
        coupon.eligible_event_id || null,
        userId,
        userId,
        cleanPass,
        numericAmount,
        purchaseVerified,
        notes || 'Verified at partner cashier terminal'
      );

      db.prepare(`
        UPDATE coupons SET actual_redemptions = actual_redemptions + 1 WHERE id = ?
      `).run(coupon.id);

      if (coupon.partner_id) {
        logPartnerAudit(coupon.partner_id, userId, req.user!.full_name, 'COUPON_REDEEMED', 'coupon_redemption', redemptionId, {
          code: coupon.code,
          pass_code: cleanPass,
          order_amount: numericAmount,
        });
      }

      return {
        redemptionId,
        code: coupon.code,
        discount: coupon.discount_value,
        title: coupon.title,
        passCode: cleanPass,
        purchaseVerified: purchaseVerified === 1,
        redeemedAt: new Date().toISOString(),
      };
    });

    const result = redeemTransaction();
    return res.json({ message: 'Coupon verified and redeemed successfully', result });
  } catch (err: any) {
    return res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/accounts/:partnerId/redemptions', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;
    assertPartnerAccess(req.user!, partnerId);
    const analytics = getPartnerAnalytics(partnerId);
    return res.json({ success: true, redemptions: analytics.redemptionsHistory });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// =========================================================================
// PARTNER ANALYTICS & CSV EXPORTS
// =========================================================================

router.get('/accounts/:partnerId/analytics', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;
    assertPartnerAccess(req.user!, partnerId);

    const { range, from, to, venueId } = req.query as { range?: string; from?: string; to?: string; venueId?: string };
    const analytics = getPartnerAnalytics(partnerId, { range, from, to, venueId });
    return res.json({ success: true, ...analytics });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

router.get('/accounts/:partnerId/reports/export', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;
    assertPartnerAccess(req.user!, partnerId);

    const { type = 'events', range, from, to } = req.query as { type?: 'events' | 'redemptions' | 'campaigns'; range?: string; from?: string; to?: string };
    const reportType = ['events', 'redemptions', 'campaigns'].includes(type) ? type : 'events';
    const { filename, csv } = buildCsvExport(partnerId, reportType, { range, from, to });

    logPartnerAudit(partnerId, req.user!.id, req.user!.full_name, 'REPORT_EXPORTED', 'report', reportType);
    return res.json({ success: true, filename, csv });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// =========================================================================
// PARTNER COMMUNICATION CENTER
// =========================================================================

router.get('/accounts/:partnerId/communications', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;
    assertPartnerAccess(req.user!, partnerId);

    const communications = db.prepare(`
      SELECT pc.*, e.title as event_title, c.event_name as collaboration_title
      FROM partner_communications pc
      LEFT JOIN events e ON pc.event_id = e.id
      LEFT JOIN partner_collaborations c ON pc.collaboration_id = c.id
      WHERE pc.partner_id = ?
      ORDER BY pc.created_at DESC
    `).all(partnerId);

    return res.json({ success: true, communications });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

router.post('/accounts/:partnerId/communications', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;
    assertPartnerAccess(req.user!, partnerId);

    const { subject, message, event_id, collaboration_id, type } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    const senderRole = isAdminOrPartnerManager(req.user!.role) ? 'coordinator' : 'partner';
    const msgId = notifyPartner(
      partnerId,
      type || 'coordinator_message',
      subject.trim(),
      message.trim(),
      req.user!.full_name,
      senderRole,
      event_id || null,
      collaboration_id || null,
      req.user!.id
    );

    const created = db.prepare('SELECT * FROM partner_communications WHERE id = ?').get(msgId);
    return res.status(201).json({ success: true, communication: created });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

router.patch('/accounts/:partnerId/communications/:msgId/read', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { partnerId, msgId } = req.params;
    assertPartnerAccess(req.user!, partnerId);
    db.prepare(`UPDATE partner_communications SET is_read = 1 WHERE id = ? AND partner_id = ?`).run(msgId, partnerId);
    return res.json({ success: true });
  } catch (err: any) {
    return handlePartnerErr(res, err);
  }
});

// =========================================================================
// ADMIN PARTNER MANAGEMENT ENDPOINTS
// =========================================================================

router.get('/admin/overview', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    if (!requirePartnerAdmin(req, res)) return;

    const { status, city, category, search } = req.query as Record<string, string>;
    let query = `
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM venues WHERE partner_id = p.id) as venues_count,
        (SELECT COUNT(*) FROM partner_collaborations WHERE partner_id = p.id) as collaborations_count,
        (SELECT COUNT(*) FROM coupons WHERE partner_id = p.id AND approval_status = 'Submitted') as pending_campaigns_count
      FROM partner_accounts p
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status && status !== 'all') {
      query += ` AND p.verification_status = ?`;
      params.push(status);
    }
    if (city && city !== 'all') {
      query += ` AND LOWER(p.city) = LOWER(?)`;
      params.push(city);
    }
    if (category && category !== 'all') {
      query += ` AND p.category = ?`;
      params.push(category);
    }
    if (search && search.trim()) {
      query += ` AND (p.business_name LIKE ? OR p.contact_person LIKE ? OR p.contact_email LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }
    query += ` ORDER BY p.verification_status = 'Submitted' DESC, p.created_at DESC`;

    const partners = db.prepare(query).all(...params);

    const pendingCampaigns = db.prepare(`
      SELECT c.*, p.business_name as partner_name, v.name as venue_name
      FROM coupons c
      JOIN venues v ON c.venue_id = v.id
      LEFT JOIN partner_accounts p ON c.partner_id = p.id
      WHERE c.approval_status IN ('Submitted', 'Draft')
      ORDER BY c.created_at DESC
    `).all();

    const collaborations = db.prepare(`
      SELECT pc.*, p.business_name as partner_name, v.name as venue_name
      FROM partner_collaborations pc
      JOIN partner_accounts p ON pc.partner_id = p.id
      JOIN venues v ON pc.venue_id = v.id
      ORDER BY pc.updated_at DESC
    `).all();

    const publicProposals = db.prepare(`SELECT * FROM partner_proposals ORDER BY created_at DESC LIMIT 30`).all();

    return res.json({
      success: true,
      partners,
      pendingCampaigns,
      collaborations,
      publicProposals,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/admin/:partnerId/details', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    if (!requirePartnerAdmin(req, res)) return;
    const { partnerId } = req.params;

    const partner = db.prepare('SELECT * FROM partner_accounts WHERE id = ?').get(partnerId);
    if (!partner) return res.status(404).json({ error: 'Partner account not found' });

    const venues = db.prepare('SELECT v.*, c.name as city_name FROM venues v JOIN cities c ON v.city_id = c.id WHERE v.partner_id = ?').all(partnerId);
    const collaborations = db.prepare('SELECT pc.*, v.name as venue_name FROM partner_collaborations pc JOIN venues v ON pc.venue_id = v.id WHERE pc.partner_id = ? ORDER BY pc.created_at DESC').all(partnerId);
    const campaigns = db.prepare('SELECT c.*, v.name as venue_name FROM coupons c JOIN venues v ON c.venue_id = v.id WHERE c.partner_id = ? ORDER BY c.created_at DESC').all(partnerId);
    const analytics = getPartnerAnalytics(partnerId);
    const auditLogs = db.prepare('SELECT * FROM partner_audit_logs WHERE partner_id = ? ORDER BY created_at DESC LIMIT 40').all(partnerId);

    return res.json({
      success: true,
      partner,
      venues,
      collaborations,
      campaigns,
      analytics,
      auditLogs,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/admin/:partnerId/verify', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    if (!requirePartnerAdmin(req, res)) return;
    const { partnerId } = req.params;
    const { status, notes, partnership_tier } = req.body;

    const allowedStatuses = ['Under Review', 'Verified', 'Rejected', 'Suspended'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid verification status' });
    }

    const partner = db.prepare('SELECT * FROM partner_accounts WHERE id = ?').get(partnerId) as any;
    if (!partner) return res.status(404).json({ error: 'Partner not found' });

    db.transaction(() => {
      db.prepare(`
        UPDATE partner_accounts
        SET verification_status = ?,
            verification_notes = COALESCE(?, verification_notes),
            partnership_tier = COALESCE(?, partnership_tier),
            partnership_start_date = CASE WHEN ? = 'Verified' AND partnership_start_date IS NULL THEN date('now') ELSE partnership_start_date END,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(status, notes || null, partnership_tier || null, status, partnerId);

      // Update venue verification flag & owner role upon approval
      db.prepare(`UPDATE venues SET is_verified = ? WHERE partner_id = ?`).run(status === 'Verified' ? 1 : 0, partnerId);
      if (status === 'Verified') {
        db.prepare(`UPDATE users SET role = 'venue_partner' WHERE id = ? AND role = 'user'`).run(partner.owner_user_id);
      }

      logPartnerAudit(partnerId, req.user!.id, req.user!.full_name, `PARTNER_STATUS_${status.toUpperCase().replace(/\s+/g, '_')}`, 'partner_account', partnerId, { notes });
      recordAuditLog({
        actorId: req.user!.id,
        actorName: req.user!.full_name,
        actorRole: req.user!.role,
        action: `PARTNER_${status.toUpperCase().replace(/\s+/g, '_')}`,
        entityType: 'partner_account',
        entityId: partnerId,
        beforeData: { verification_status: partner.verification_status },
        afterData: { verification_status: status, notes },
      });
      notifyPartner(
        partnerId,
        'verification_update',
        `Partner Account Status: ${status}`,
        notes || `Your STROOM business partner status has been updated to ${status}.`,
        req.user!.full_name,
        'admin'
      );
    })();

    const updated = db.prepare('SELECT * FROM partner_accounts WHERE id = ?').get(partnerId);
    return res.json({ success: true, partner: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin creates Collaboration Proposal to a Partner Venue
router.post('/admin/collaborations', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    if (!requirePartnerAdmin(req, res)) return;

    const {
      partner_id,
      venue_id,
      event_name,
      event_category,
      description,
      proposed_date,
      proposed_time,
      expected_attendance,
      target_audience,
      partner_responsibilities,
      stroom_responsibilities,
      marketing_plan,
      commercial_arrangement,
      special_requirements,
    } = req.body;

    if (!partner_id || !venue_id || !event_name || !proposed_date) {
      return res.status(400).json({ error: 'partner_id, venue_id, event_name, and proposed_date are required' });
    }

    // Check venue availability conflicts (prevents double-booking / proposing over unavailable dates)
    const conflict = db.prepare(`
      SELECT * FROM venue_availability
      WHERE venue_id = ? AND date = ? AND status IN ('booked', 'unavailable')
    `).get(venue_id, proposed_date) as any;

    if (conflict) {
      return res.status(409).json({
        error: `Venue is marked ${conflict.status} on ${proposed_date}. Please choose an open date.`,
      });
    }

    const collabId = 'collab_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
    const today = new Date().toISOString().split('T')[0];
    const timeline = JSON.stringify([{ step: 'Proposal Sent by STROOM', date: today, completed: true }]);

    db.transaction(() => {
      db.prepare(`
        INSERT INTO partner_collaborations (
          id, partner_id, venue_id, initiated_by, organizer_user_id, organizer_name,
          event_name, event_category, description, proposed_date, proposed_time,
          expected_attendance, target_audience, partner_responsibilities,
          stroom_responsibilities, marketing_plan, commercial_arrangement,
          special_requirements, status, timeline_json
        )
        VALUES (?, ?, ?, 'admin', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Proposal Sent', ?)
      `).run(
        collabId,
        partner_id,
        venue_id,
        req.user!.id,
        req.user!.full_name,
        event_name.trim(),
        event_category || 'cafe_meetup',
        description || '',
        proposed_date,
        proposed_time || '6:00 PM IST',
        Number(expected_attendance) || 50,
        target_audience || 'STROOM Community Members',
        partner_responsibilities || 'Provide dedicated event seating and coordinate check-in zone.',
        stroom_responsibilities || 'Manage ticketing, community promotion, and on-ground host.',
        marketing_plan || 'Featured in STROOM Discover feed & city circles.',
        commercial_arrangement || 'Mutually agreed partnership terms.',
        special_requirements || '',
        timeline
      );

      // Mark proposed slot on venue calendar
      const vaId = 'va_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
      db.prepare(`
        INSERT OR REPLACE INTO venue_availability (id, venue_id, partner_id, date, time_slot, status, collaboration_id, notes)
        VALUES (?, ?, ?, ?, 'evening', 'proposed', ?, ?)
      `).run(vaId, venue_id, partner_id, proposed_date, collabId, `Proposed: ${event_name}`);

      logPartnerAudit(partner_id, req.user!.id, req.user!.full_name, 'COLLABORATION_PROPOSAL_SENT', 'collaboration', collabId, { event_name, proposed_date });
      notifyPartner(
        partner_id,
        'announcement',
        `New Event Collaboration Proposal: ${event_name}`,
        `STROOM proposed hosting "${event_name}" on ${proposed_date} (${proposed_time || '6:00 PM IST'}). Review and respond inside Collaborations.`,
        req.user!.full_name,
        'admin',
        null,
        collabId
      );
    })();

    const collaboration = db.prepare('SELECT * FROM partner_collaborations WHERE id = ?').get(collabId);
    return res.status(201).json({ success: true, collaboration });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin confirms an Approved collaboration & publishes linked Event
router.post('/admin/collaborations/:collabId/confirm', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    if (!requirePartnerAdmin(req, res)) return;
    const { collabId } = req.params;

    const collab = db.prepare(`
      SELECT pc.*, v.city_id
      FROM partner_collaborations pc
      JOIN venues v ON pc.venue_id = v.id
      WHERE pc.id = ?
    `).get(collabId) as any;

    if (!collab) return res.status(404).json({ error: 'Collaboration not found' });
    if (collab.status === 'Rejected' || collab.status === 'Cancelled') {
      return res.status(400).json({ error: 'Cannot confirm a rejected or cancelled collaboration' });
    }

    const eventDate = collab.suggested_date || collab.proposed_date;
    const eventTime = collab.suggested_time || collab.proposed_time;
    const today = new Date().toISOString().split('T')[0];

    let timeline: any[] = [];
    try {
      timeline = JSON.parse(collab.timeline_json || '[]');
    } catch {
      timeline = [];
    }
    timeline.push({ step: 'Event Published & Scheduled', date: today, completed: true });

    let eventId = collab.event_id;

    db.transaction(() => {
      if (!eventId) {
        eventId = 'evt_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
        db.prepare(`
          INSERT INTO events (
            id, city_id, venue_id, title, category, event_date, event_time, description,
            seats_total, seats_booked, entry_fee, status, is_flagship, image_url, created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Free Entry', 'published', 0, ?, ?)
        `).run(
          eventId,
          collab.city_id,
          collab.venue_id,
          collab.event_name,
          collab.event_category,
          eventDate,
          eventTime,
          collab.description || 'Official STROOM Partner Experience',
          collab.expected_attendance || 50,
          'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
          req.user!.id
        );
      }

      db.prepare(`
        UPDATE partner_collaborations
        SET status = 'Scheduled', event_id = ?, timeline_json = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(eventId, JSON.stringify(timeline), collabId);

      // Mark venue slot booked
      db.prepare(`
        UPDATE venue_availability
        SET status = 'booked', event_id = ?, notes = ?
        WHERE collaboration_id = ?
      `).run(eventId, `Confirmed: ${collab.event_name}`, collabId);

      logPartnerAudit(collab.partner_id, req.user!.id, req.user!.full_name, 'COLLABORATION_CONFIRMED_EVENT_CREATED', 'event', eventId, { collabId });
      notifyPartner(
        collab.partner_id,
        'operational_note',
        `Event Confirmed & Published: ${collab.event_name}`,
        `The collaboration for "${collab.event_name}" on ${eventDate} is now confirmed and live for participant registrations.`,
        req.user!.full_name,
        'admin',
        eventId,
        collabId
      );
    })();

    const updated = db.prepare('SELECT * FROM partner_collaborations WHERE id = ?').get(collabId);
    return res.json({ success: true, collaboration: updated, eventId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin approves/rejects/pauses partner campaign
router.post('/admin/campaigns/:campaignId/review', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    if (!requirePartnerAdmin(req, res)) return;
    const { campaignId } = req.params;
    const { decision, notes } = req.body; // 'approve' | 'reject' | 'pause'

    const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(campaignId) as any;
    if (!coupon) return res.status(404).json({ error: 'Campaign not found' });

    const newApprovalStatus = decision === 'approve' ? 'Active' : decision === 'reject' ? 'Rejected' : 'Paused';
    const newStatus = decision === 'approve' ? 'active' : 'paused';

    db.prepare(`UPDATE coupons SET approval_status = ?, status = ? WHERE id = ?`).run(newApprovalStatus, newStatus, campaignId);

    if (coupon.partner_id) {
      logPartnerAudit(coupon.partner_id, req.user!.id, req.user!.full_name, `CAMPAIGN_${newApprovalStatus.toUpperCase()}`, 'coupon', campaignId, { notes });
      notifyPartner(
        coupon.partner_id,
        'announcement',
        `Campaign ${newApprovalStatus}: ${coupon.code}`,
        notes || `Your promotional campaign "${coupon.title}" (${coupon.code}) has been marked as ${newApprovalStatus}.`,
        req.user!.full_name,
        'admin'
      );
    }
    recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: `CAMPAIGN_${newApprovalStatus.toUpperCase()}`,
      entityType: 'coupon',
      entityId: campaignId,
      afterData: { code: coupon.code, approval_status: newApprovalStatus, notes },
    });

    const updated = db.prepare('SELECT * FROM coupons WHERE id = ?').get(campaignId);
    return res.json({ success: true, campaign: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
