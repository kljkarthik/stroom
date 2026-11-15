import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabaseAdapter } from '../db/adapter';
import { requireAuth, requirePermission, AuthRequest } from '../middleware/auth';
import { EventRegistration } from '../types';
import { evaluateUserAchievements, createNotification, logActivity } from '../services/memberService';

const router = Router();

// 1. GET authenticated user's digital entry passes
router.get('/my-passes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const userId = req.user!.id;

    const passes = await adapter.query<EventRegistration>(`
      SELECT
        r.*,
        e.title as event_title,
        e.event_date,
        e.event_time,
        e.category as event_category,
        e.image_url as event_image,
        c.name as city_name,
        v.name as venue_name,
        v.address as venue_address,
        u.full_name as attendee_name,
        u.email as attendee_email,
        u.member_id as attendee_member_id
      FROM event_registrations r
      JOIN events e ON r.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      JOIN users u ON r.user_id = u.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `, [userId]);

    return res.json({ passes });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch passes' });
  }
});

// 2. GET Verify QR token (Door Scanner or attendee badge check)
router.get('/verify/:token', async (req, res) => {
  try {
    const adapter = getDatabaseAdapter();
    const { token } = req.params;

    const pass = await adapter.queryOne<EventRegistration>(`
      SELECT
        r.*,
        e.title as event_title,
        e.event_date,
        e.event_time,
        c.name as city_name,
        v.name as venue_name,
        u.full_name as attendee_name,
        u.member_id as attendee_member_id
      FROM event_registrations r
      JOIN events e ON r.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      JOIN users u ON r.user_id = u.id
      WHERE r.qr_token = ? OR r.pass_code = ?
    `, [token, token]);

    if (!pass) {
      return res.status(404).json({ valid: false, error: 'Invalid QR Pass or Pass Code' });
    }

    return res.json({
      success: true,
      valid: true,
      pass,
      registration: pass,
      isCheckedIn: pass.checkin_status === 'checked_in',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Pass verification failed' });
  }
});

// 3. POST Door Check-in (Checkin staff / Admin mark attendance)
router.post('/check-in', requireAuth, requirePermission('checkin.access'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const { qr_token, pass_code } = req.body;

    const pass = await adapter.queryOne<any>(`
      SELECT r.*, e.title as event_title, e.category as event_category, c.name as city_name, v.name as venue_name
      FROM event_registrations r
      JOIN events e ON r.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE r.qr_token = ? OR r.pass_code = ?
    `, [qr_token || '', pass_code || '']);

    if (!pass) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    if (pass.checkin_status === 'checked_in') {
      return res.status(409).json({
        error: 'Attendee already checked in!',
        checkedInAt: pass.checked_in_at,
      });
    }

    if (pass.checkin_status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot check in a cancelled pass.' });
    }

    const stampId = 'stamp_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const stampIcon = pass.event_category?.includes('auction')
      ? 'Trophy'
      : pass.event_category?.includes('sport')
      ? 'Activity'
      : pass.event_category?.includes('cafe')
      ? 'Coffee'
      : 'Award';

    // Execute check-in and stamp insertion atomically
    await adapter.transaction(async (tx) => {
      // 1. Mark pass as checked in
      await tx.execute(`
        UPDATE event_registrations
        SET checkin_status = 'checked_in', checked_in_at = CURRENT_TIMESTAMP, checked_in_by = ?
        WHERE id = ?
      `, [req.user!.id, pass.id]);

      // 2. Add verified attendance stamp to STROOM Passport
      await tx.execute(`
        INSERT INTO passport_stamps (id, user_id, event_id, event_title, category, city_name, venue_name, stamp_icon, verified_at, verified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT (user_id, event_id) DO NOTHING
      `, [
        stampId,
        pass.user_id,
        pass.event_id,
        pass.event_title,
        pass.event_category,
        pass.city_name,
        pass.venue_name,
        stampIcon,
        req.user!.id
      ]);
    });

    // 3. Log activity
    await logActivity(
      pass.user_id,
      'event_attended',
      `Attended: ${pass.event_title}`,
      `Verified attendance at ${pass.venue_name} (${pass.city_name}).`,
      pass.event_id
    );

    // 4. Send attendee notification
    await createNotification(
      pass.user_id,
      'checkin',
      `Attendance Verified: ${pass.event_title}`,
      `Welcome! You've been checked in. Your digital STROOM Passport stamp has been stamped!`,
      { eventId: pass.event_id, passCode: pass.pass_code }
    );

    // 5. Evaluate achievements
    const newlyUnlocked = await evaluateUserAchievements(pass.user_id);

    return res.json({
      success: true,
      message: 'Attendee successfully checked in to STROOM event! Digital stamp issued.',
      passId: pass.id,
      passCode: pass.pass_code,
      registration: { ...pass, checkin_status: 'checked_in' },
      stampIssued: true,
      newAchievements: newlyUnlocked,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. POST Cancel event pass (Adhering to existing cancellation policy)
router.post('/:id/cancel', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const { id } = req.params;
    const userId = req.user!.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);

    const pass = await adapter.queryOne<any>(`
      SELECT r.*, e.title as event_title, e.seats_booked
      FROM event_registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.id = ?
    `, [id]);

    if (!pass) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    if (!isAdmin && pass.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied: You can only cancel your own passes.' });
    }

    if (pass.checkin_status === 'checked_in') {
      return res.status(400).json({ error: 'Cannot cancel an already checked-in event pass.' });
    }

    if (pass.checkin_status === 'cancelled') {
      return res.status(400).json({ error: 'Pass has already been cancelled.' });
    }

    await adapter.transaction(async (tx) => {
      await tx.execute("UPDATE event_registrations SET checkin_status = 'cancelled' WHERE id = ?", [id]);
      await tx.execute("UPDATE events SET seats_booked = CASE WHEN seats_booked > 0 THEN seats_booked - 1 ELSE 0 END WHERE id = ?", [pass.event_id]);
    });

    await logActivity(
      pass.user_id,
      'event_cancelled',
      `Cancelled Registration: ${pass.event_title}`,
      `Registration for ${pass.event_title} was cancelled.`,
      pass.event_id
    );

    await createNotification(
      pass.user_id,
      'registration',
      `Registration Cancelled`,
      `Your pass for ${pass.event_title} has been cancelled successfully.`,
      { eventId: pass.event_id }
    );

    return res.json({ success: true, message: 'Registration cancelled successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
