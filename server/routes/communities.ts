import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// 1. GET all communities with optional filters
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { city_id, category, search } = req.query;

    let query = `
      SELECT 
        comm.*,
        c.name as city_name,
        c.state as state_name,
        (comm.member_count + (SELECT COUNT(*) FROM community_members WHERE community_id = comm.id)) as total_members
      FROM communities comm
      JOIN cities c ON comm.city_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (city_id && city_id !== 'all') {
      query += ` AND comm.city_id = ?`;
      params.push(city_id);
    }

    if (category && category !== 'all') {
      query += ` AND (comm.category = ? OR comm.category LIKE ? OR ? LIKE '%' || comm.category || '%')`;
      params.push(category, `%${category}%`, category);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim()}%`;
      query += ` AND (comm.name LIKE ? OR comm.description LIKE ? OR comm.category LIKE ? OR c.name LIKE ?)`;
      params.push(q, q, q, q);
    }

    query += ` ORDER BY total_members DESC, comm.name ASC`;

    const rawCommunities = db.prepare(query).all(...params) as any[];

    // Check user membership status if authenticated
    const userId = req.user?.id;
    let userJoinedCommIds = new Set<string>();
    if (userId) {
      const memberships = db.prepare(`SELECT community_id FROM community_members WHERE user_id = ?`).all(userId) as { community_id: string }[];
      userJoinedCommIds = new Set(memberships.map(m => m.community_id));
    }

    const communities = rawCommunities.map(c => ({
      ...c,
      member_count: c.total_members,
      is_member: userJoinedCommIds.has(c.id),
    }));

    return res.json({ communities });
  } catch (err: any) {
    console.error('Error fetching communities:', err);
    return res.status(500).json({ error: 'Failed to fetch communities' });
  }
});

// 2. GET single community details
router.get('/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        comm.*,
        c.name as city_name,
        c.state as state_name,
        (comm.member_count + (SELECT COUNT(*) FROM community_members WHERE community_id = comm.id)) as total_members
      FROM communities comm
      JOIN cities c ON comm.city_id = c.id
      WHERE comm.id = ? OR comm.slug = ?
    `;

    const community = db.prepare(query).get(id, id) as any;

    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    // Check if current user is member
    let isMember = false;
    if (req.user) {
      const mem = db.prepare(`SELECT id FROM community_members WHERE community_id = ? AND user_id = ?`).get(community.id, req.user.id);
      isMember = !!mem;
    }

    // Fetch upcoming events related to this community's city or category
    const upcomingEvents = db.prepare(`
      SELECT 
        e.*,
        c.name as city_name,
        v.name as venue_name,
        v.area as venue_area,
        (e.seats_total - e.seats_booked) as seats_left
      FROM events e
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE (e.city_id = ? OR e.category = ?) AND e.status IN ('published', 'live')
      ORDER BY e.is_flagship DESC, e.event_date ASC
      LIMIT 3
    `).all(community.city_id, community.category);

    return res.json({
      community: {
        ...community,
        member_count: community.total_members,
        is_member: isMember,
        upcoming_events: upcomingEvents,
      }
    });
  } catch (err: any) {
    console.error('Error fetching community details:', err);
    return res.status(500).json({ error: 'Failed to fetch community details' });
  }
});

// 3. POST Join Community (Authenticated)
router.post('/:id/join', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const community = db.prepare(`SELECT id, name FROM communities WHERE id = ? OR slug = ?`).get(id, id) as any;
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const existing = db.prepare(`SELECT id FROM community_members WHERE community_id = ? AND user_id = ?`).get(community.id, userId);
    if (!existing) {
      const membershipId = 'cm_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      db.prepare(`
        INSERT INTO community_members (id, community_id, user_id, role)
        VALUES (?, ?, ?, 'member')
      `).run(membershipId, community.id, userId);
    }

    const updatedTotal = db.prepare(`
      SELECT (comm.member_count + (SELECT COUNT(*) FROM community_members WHERE community_id = comm.id)) as total
      FROM communities comm WHERE comm.id = ?
    `).get(community.id) as { total: number };

    return res.json({
      message: `You have joined ${community.name}!`,
      is_member: true,
      member_count: updatedTotal.total,
    });
  } catch (err: any) {
    console.error('Error joining community:', err);
    return res.status(500).json({ error: 'Failed to join community' });
  }
});

// 4. POST Leave Community (Authenticated)
router.post('/:id/leave', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const community = db.prepare(`SELECT id, name FROM communities WHERE id = ? OR slug = ?`).get(id, id) as any;
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    db.prepare(`DELETE FROM community_members WHERE community_id = ? AND user_id = ?`).run(community.id, userId);

    const updatedTotal = db.prepare(`
      SELECT (comm.member_count + (SELECT COUNT(*) FROM community_members WHERE community_id = comm.id)) as total
      FROM communities comm WHERE comm.id = ?
    `).get(community.id) as { total: number };

    return res.json({
      message: `You have left ${community.name}.`,
      is_member: false,
      member_count: updatedTotal.total,
    });
  } catch (err: any) {
    console.error('Error leaving community:', err);
    return res.status(500).json({ error: 'Failed to leave community' });
  }
});

export default router;
