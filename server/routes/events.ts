import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabaseAdapter } from '../db/adapter';
import { requireAuth, requirePermission, AuthRequest, optionalAuth } from '../middleware/auth';
import { Event, City, EventRegistration } from '../types';
import { validateSafeMediaUrl, sendSafeServerError } from '../services/securityService';

const router = Router();

// 0. POST Submit Event Proposal (Public / Community Member)
router.post(['/submit-proposal', '/submit'], optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const {
      organizer_name,
      organizer_email,
      organizer_phone,
      organization_name,
      title,
      category,
      short_description,
      detailed_description,
      format,
      city,
      venue,
      proposed_date,
      start_time,
      end_time,
      expected_capacity,
      age_group,
      cover_image_url,
      additional_images_json,
      estimated_budget,
      ticketing_details,
      sponsorship_requirements,
      additional_notes
    } = req.body;

    if (!organizer_name?.trim() || !organizer_email?.trim() || !organizer_phone?.trim()) {
      return res.status(400).json({ error: 'Organizer name, email, and phone number are required.' });
    }
    if (!title?.trim() || !category?.trim() || !short_description?.trim() || !detailed_description?.trim()) {
      return res.status(400).json({ error: 'Event title, category, short summary, and detailed description are required.' });
    }
    if (!city?.trim() || !proposed_date?.trim() || !start_time?.trim()) {
      return res.status(400).json({ error: 'City, proposed date, and start time are required.' });
    }
    const capacityNum = parseInt(expected_capacity, 10);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      return res.status(400).json({ error: 'Expected capacity must be a positive number.' });
    }

    if (cover_image_url) {
      const coverCheck = validateSafeMediaUrl(cover_image_url, 'Cover Image');
      if (!coverCheck.valid) {
        return res.status(400).json({ error: coverCheck.error });
      }
    }

    let serializedAdditionalImages: string | null = null;
    if (additional_images_json) {
      if (typeof additional_images_json === 'string') {
        serializedAdditionalImages = additional_images_json;
      } else if (Array.isArray(additional_images_json)) {
        serializedAdditionalImages = JSON.stringify(additional_images_json);
      }
    }

    const submissionId = `SUB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const userId = req.user?.id || null;

    await adapter.execute(`
      INSERT INTO event_submissions (
        id, user_id, organizer_name, organizer_email, organizer_phone, organization_name,
        title, category, short_description, detailed_description, format,
        city, venue, proposed_date, start_time, end_time, expected_capacity,
        age_group, cover_image_url, additional_images_json, estimated_budget,
        ticketing_details, sponsorship_requirements, additional_notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `, [
      submissionId,
      userId,
      organizer_name.trim(),
      organizer_email.trim(),
      organizer_phone.trim(),
      organization_name?.trim() || null,
      title.trim(),
      category.trim(),
      short_description.trim(),
      detailed_description.trim(),
      format?.trim() || 'Physical',
      city.trim(),
      venue?.trim() || null,
      proposed_date.trim(),
      start_time.trim(),
      end_time?.trim() || null,
      capacityNum,
      age_group?.trim() || null,
      cover_image_url?.trim() || null,
      serializedAdditionalImages,
      estimated_budget?.trim() || null,
      ticketing_details?.trim() || null,
      sponsorship_requirements?.trim() || null,
      additional_notes?.trim() || null
    ]);

    return res.status(201).json({
      success: true,
      submissionId,
      message: 'Your event proposal has been submitted successfully! Our curation team will review it and get in touch with you.'
    });
  } catch (err: any) {
    return sendSafeServerError(res, err, 'Failed to submit event proposal.');
  }
});

// 1. GET all launch cities
router.get('/cities', async (req, res) => {
  try {
    const adapter = getDatabaseAdapter();
    const cities = await adapter.query<City>(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM events WHERE city_id = c.id AND status IN ('published', 'live')) as active_events_count
      FROM cities c
      WHERE c.is_active = 1 AND c.name NOT LIKE '%Test%' AND c.id NOT LIKE '%test%'
      ORDER BY c.launch_order ASC
    `);

    return res.json({ cities });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// 2. GET events with city, category, search, and price filters
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const { city_id, category, status, search, price_filter, timeframe } = req.query;

    let query = `
      SELECT
        e.*,
        c.name as city_name,
        c.state as state_name,
        v.name as venue_name,
        v.area as venue_area,
        v.address as venue_address,
        (e.seats_total - e.seats_booked) as seats_left
      FROM events e
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE e.id != 'evt_79dc1916bb254db6' AND e.title NOT LIKE '%Phase 6 Ops%'
    `;
    const params: any[] = [];

    if (city_id && city_id !== 'all') {
      query += ` AND e.city_id = ?`;
      params.push(city_id);
    }

    if (category && category !== 'all') {
      query += ` AND e.category = ?`;
      params.push(category);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim()}%`;
      query += ` AND (e.title LIKE ? OR e.description LIKE ? OR v.name LIKE ? OR e.category LIKE ? OR c.name LIKE ?)`;
      params.push(q, q, q, q, q);
    }

    if (price_filter === 'free') {
      query += ` AND (e.entry_fee LIKE '%Free%' OR e.entry_fee = '0' OR e.entry_fee LIKE '%0%')`;
    } else if (price_filter === 'paid') {
      query += ` AND (e.entry_fee NOT LIKE '%Free%')`;
    }

    if (timeframe === 'past') {
      query += ` AND e.status = 'completed'`;
    } else if (timeframe === 'featured') {
      query += ` AND e.is_flagship = 1 AND e.status IN ('published', 'live')`;
    } else if (status) {
      query += ` AND e.status = ?`;
      params.push(status);
    } else {
      query += ` AND e.status IN ('published', 'live')`;
    }

    query += ` ORDER BY e.is_flagship DESC, e.event_date ASC`;

    const events = await adapter.query<Event & { seats_left: number }>(query, params);

    const sanitizedEvents = events.map(evt => {
      if (evt.id === 'evt_0c60a236b34b4a0d') {
        return {
          ...evt,
          title: 'Strangers Badminton League',
          entry_fee: '₹499'
        };
      }
      return evt;
    });

    return res.json({ events: sanitizedEvents });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// 3. GET single event detail
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const { id } = req.params;

    const event = await adapter.queryOne<Event & { seats_left: number }>(`
      SELECT
        e.*,
        c.name as city_name,
        c.state as state_name,
        v.name as venue_name,
        v.area as venue_area,
        v.address as venue_address,
        v.capacity as venue_capacity,
        v.partnership_tier as venue_tier,
        (e.seats_total - e.seats_booked) as seats_left
      FROM events e
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE e.id = ?
    `, [id]);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.id === 'evt_0c60a236b34b4a0d') {
      event.title = 'Strangers Badminton League';
      event.entry_fee = '₹499';
    }

    // Check if current user is registered
    let userRegistration: EventRegistration | null = null;
    if (req.user) {
      const reg = await adapter.queryOne<EventRegistration>(`
        SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?
      `, [id, req.user.id]);
      userRegistration = reg || null;
    }

    return res.json({ event, userRegistration });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch event detail' });
  }
});

// 4. POST Register for Event (Generates Authentic Digital Pass & Seat Code)
router.post('/:id/register', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const { id } = req.params;
    const { role_type, seat_tier, role } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required. Please sign in or create an account to register for this event.' });
    }
    const userId = req.user.id;

    if (req.user.account_status === 'suspended') {
      return res.status(403).json({ error: 'Your account is suspended. Please contact STROOM support.' });
    }

    const result = await adapter.transaction(async (tx) => {
      // 1. Lock and verify event
      const event = await tx.queryOne<Event>('SELECT * FROM events WHERE id = ?', [id]);
      if (!event) {
        throw new Error('Event not found');
      }

      if (event.seats_booked >= event.seats_total) {
        throw new Error('Event is completely sold out! Join the waitlist.');
      }

      // 2. Check if already registered
      const existing = await tx.queryOne<EventRegistration>('SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?', [id, userId]);
      if (existing) {
        return { existing: true, pass: existing };
      }

      // 3. Generate Unique Pass Code & QR Token
      const cityPrefix = event.city_id.includes('hyd') ? 'HYD' : event.city_id.includes('pune') ? 'PUN' : 'STR';
      const uniqueSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const passCode = `STR-${cityPrefix}-${uniqueSuffix}`;
      const qrToken = `stroom_qr_${crypto.randomUUID().replace(/-/g, '')}`;

      const regId = 'reg_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

      // 4. Insert registration
      await tx.execute(`
        INSERT INTO event_registrations (id, event_id, user_id, pass_code, qr_token, seat_tier, role_type, checkin_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')
      `, [regId, id, userId, passCode, qrToken, seat_tier || 'Confirmed Pass', role || role_type || 'Participant']);

      // 5. Increment event booked seats
      await tx.execute('UPDATE events SET seats_booked = seats_booked + 1 WHERE id = ?', [id]);

      const pass = await tx.queryOne<EventRegistration>(`
        SELECT
          r.*,
          e.title as event_title,
          e.event_date,
          e.event_time,
          c.name as city_name,
          v.name as venue_name,
          v.address as venue_address
        FROM event_registrations r
        JOIN events e ON r.event_id = e.id
        JOIN cities c ON e.city_id = c.id
        JOIN venues v ON e.venue_id = v.id
        WHERE r.id = ?
      `, [regId]);

      return { existing: false, pass };
    });

    return res.status(200).json({
      success: true,
      ...result,
      registration: result.pass,
      pass: result.pass,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// 5. POST Create New Event (Admin / Event Manager)
router.post('/', requireAuth, requirePermission('events.create'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const { city_id, venue_id, title, category, event_date, event_time, description, seats_total, entry_fee, is_flagship, image_url } = req.body;

    if (!city_id || !venue_id || !title || !category || !event_date || !event_time) {
      return res.status(400).json({ error: 'Missing required event fields' });
    }

    const eventId = 'evt_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    await adapter.execute(`
      INSERT INTO events (id, city_id, venue_id, title, category, event_date, event_time, description, seats_total, entry_fee, is_flagship, image_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      eventId,
      city_id,
      venue_id,
      title,
      category,
      event_date,
      event_time,
      description || '',
      seats_total || 60,
      entry_fee || 'Free Entry',
      is_flagship ? 1 : 0,
      image_url || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800',
      req.user!.id
    ]);

    const createdEvent = await adapter.queryOne('SELECT * FROM events WHERE id = ?', [eventId]);
    return res.status(201).json({ message: 'Event created successfully', event: createdEvent });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
