import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabaseAdapter } from '../db/adapter';
import { requireAuth, requirePermission, AuthRequest, optionalAuth } from '../middleware/auth';
import { Event, City, EventRegistration } from '../types';

const router = Router();

// 1. GET all launch cities
router.get('/cities', async (req, res) => {
  try {
    const adapter = getDatabaseAdapter();
    const cities = await adapter.query<City>(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM events WHERE city_id = c.id AND status IN ('published', 'live')) as active_events_count
      FROM cities c
      WHERE c.is_active = 1
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
      WHERE 1=1
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

    return res.json({ events });
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
router.post('/:id/register', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const { id } = req.params;
    const { role_type, seat_tier, attendee_name, email, phone, role } = req.body;
    let userId = req.user?.id;

    if (!userId) {
      // Find or create user for this attendee
      const attendeeEmail = email || `attendee_${Date.now()}@stroom.club`;
      const existingUser = await adapter.queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [attendeeEmail]);
      if (!existingUser) {
        const newId = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        const memberId = `STR-HYD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        await adapter.execute(`
          INSERT INTO users (id, email, password_hash, full_name, phone, role, member_id, onboarding_status)
          VALUES (?, ?, '', ?, ?, 'user', ?, 'NOT_STARTED')
        `, [newId, attendeeEmail, attendee_name || 'STROOM Attendee', phone || '', memberId]);
        userId = newId;
      } else {
        userId = existingUser.id;
      }
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
      `, [regId, id, userId, passCode, qrToken, seat_tier || 'Table Seat', role || role_type || 'Bidder']);

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
