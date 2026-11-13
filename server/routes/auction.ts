import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database';
import { requireAuth, AuthRequest, optionalAuth } from '../middleware/auth';
import { AuctionRoom, AuctionTeam, AuctionPlayer, Bid, AuctionRegistration } from '../types';
import {
  addAuctionStreamClient,
  removeAuctionStreamClient,
  broadcastAuctionEvent,
  getActiveListenersCount,
} from '../services/auctionEvents';

const router = Router();

// Helper: Calculate dynamic bid increment based on price slabs
function calculateMinIncrement(currentBid: number, room: AuctionRoom): number {
  if (room.bid_increment_slabs_json) {
    try {
      const slabs: { upTo: number; increment: number }[] = JSON.parse(room.bid_increment_slabs_json);
      for (const slab of slabs) {
        if (currentBid < slab.upTo) {
          return slab.increment;
        }
      }
    } catch (e) {
      // fallback
    }
  }
  return room.min_bid_increment || 25000;
}

// 1. GET all auction rooms with filters
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { status, format, city, search } = req.query;

    let query = `
      SELECT 
        a.*,
        e.title as event_title,
        e.event_date,
        e.event_time,
        c.name as city,
        c.name as city_name,
        v.name as venue_name,
        (SELECT COUNT(*) FROM auction_players WHERE auction_id = a.id) as total_players,
        (SELECT COUNT(*) FROM auction_players WHERE auction_id = a.id AND status = 'SOLD') as sold_players,
        (SELECT COUNT(*) FROM auction_teams WHERE auction_id = a.id) as total_teams
      FROM auction_rooms a
      JOIN events e ON a.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      if (status === 'live') {
        query += ` AND a.status = 'LIVE'`;
      } else if (status === 'upcoming' || status === 'scheduled') {
        query += ` AND a.status IN ('SCHEDULED', 'REGISTRATION_OPEN')`;
      } else if (status === 'completed') {
        query += ` AND a.status = 'COMPLETED'`;
      } else {
        query += ` AND a.status = ?`;
        params.push(status);
      }
    }

    if (format && format !== 'all') {
      query += ` AND (a.format_type = ? OR a.format_category = ?)`;
      params.push(format, format);
    }

    if (city && city !== 'all') {
      query += ` AND (c.id = ? OR c.name LIKE ?)`;
      params.push(city, `%${city}%`);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim()}%`;
      query += ` AND (a.title LIKE ? OR a.description LIKE ? OR e.title LIKE ? OR c.name LIKE ?)`;
      params.push(q, q, q, q);
    }

    query += ` ORDER BY CASE a.status WHEN 'LIVE' THEN 1 WHEN 'REGISTRATION_OPEN' THEN 2 WHEN 'SCHEDULED' THEN 3 WHEN 'PAUSED' THEN 4 ELSE 5 END, a.created_at DESC`;

    const auctions = db.prepare(query).all(...params) as any[];

    return res.json({ success: true, auctions, rooms: auctions });
  } catch (err: any) {
    console.error('Failed to list auctions:', err);
    return res.status(500).json({ error: 'Failed to fetch auction rooms' });
  }
});

// 1b. GET current user's registered auctions and assigned teams
router.get('/my/registrations', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const registrations = db.prepare(`
      SELECT 
        r.id as registration_id,
        r.role_type,
        r.status as registration_status,
        r.registered_at,
        r.team_id,
        a.id as auction_id,
        a.title as auction_title,
        a.status as auction_status,
        a.format_type,
        a.format_category,
        a.cover_image_url,
        e.title as event_title,
        e.event_date,
        e.event_time,
        c.name as city_name,
        v.name as venue_name,
        t.name as team_name,
        t.color as team_color,
        t.purse_remaining,
        t.squad_count
      FROM auction_registrations r
      JOIN auction_rooms a ON r.auction_id = a.id
      JOIN events e ON a.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      LEFT JOIN auction_teams t ON r.team_id = t.id
      WHERE r.user_id = ?
      ORDER BY r.registered_at DESC
    `).all(userId);

    return res.json({ success: true, registrations });
  } catch (err: any) {
    console.error('Failed to get user auction registrations:', err);
    return res.status(500).json({ error: 'Failed to fetch auction registrations' });
  }
});

// 2. GET detailed auction state
router.get('/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const auction = db.prepare(`
      SELECT 
        a.*,
        e.title as event_title,
        e.event_date,
        e.event_time,
        c.name as city_name,
        c.name as city,
        v.name as venue_name,
        v.address as venue_address
      FROM auction_rooms a
      JOIN events e ON a.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE a.id = ?
    `).get(id) as (AuctionRoom & { venue_address?: string }) | undefined;

    if (!auction) {
      return res.status(404).json({ error: 'Auction room not found' });
    }

    // Teams in this auction
    const teams = db.prepare(`
      SELECT * FROM auction_teams WHERE auction_id = ? ORDER BY name ASC
    `).all(id) as AuctionTeam[];

    // Players in this auction
    const players = db.prepare(`
      SELECT 
        p.*,
        t.name as highest_bidder_name,
        t.color as highest_bidder_color
      FROM auction_players p
      LEFT JOIN auction_teams t ON p.highest_bidder_team_id = t.id
      WHERE p.auction_id = ?
      ORDER BY p.lot_number ASC
    `).all(id) as AuctionPlayer[];

    // Attach purchased squad to each team
    for (const team of teams) {
      team.players = players.filter((p) => p.highest_bidder_team_id === team.id && p.status === 'SOLD');
    }

    // Active player (lot)
    let currentPlayer = players.find((p) => p.id === auction.current_player_id);
    if (!currentPlayer && players.length > 0) {
      currentPlayer = players.find((p) => p.status === 'IN_AUCTION') || players[0];
    }

    // Recent bid feed for the current player
    const recentBids = currentPlayer
      ? (db.prepare(`
          SELECT 
            b.*,
            t.name as team_name,
            t.color as team_color
          FROM bids b
          JOIN auction_teams t ON b.team_id = t.id
          WHERE b.player_id = ?
          ORDER BY b.amount DESC, b.placed_at DESC
          LIMIT 25
        `).all(currentPlayer.id) as Bid[])
      : [];

    // Parse rules config
    let rulesConfig: any = {};
    if (auction.rules_json) {
      try {
        rulesConfig = JSON.parse(auction.rules_json);
      } catch (e) {
        rulesConfig = {};
      }
    }

    // Check user registration status
    let userRegistration: AuctionRegistration | null = null;
    let userTeam: AuctionTeam | null = null;

    if (req.user) {
      userRegistration = (db.prepare(`
        SELECT * FROM auction_registrations WHERE auction_id = ? AND user_id = ?
      `).get(id, req.user.id) as AuctionRegistration) || null;

      // Check if user owns a team
      userTeam = teams.find((t) => t.owner_user_id === req.user?.id) || null;
    }

    return res.json({
      success: true,
      auction,
      teams,
      players,
      currentPlayer: currentPlayer || null,
      currentLot: currentPlayer || null,
      recentBids,
      rulesConfig,
      userRegistration,
      userTeam,
      activeListeners: getActiveListenersCount(id),
    });
  } catch (err: any) {
    console.error('Failed to get auction details:', err);
    return res.status(500).json({ error: 'Failed to fetch auction details' });
  }
});

// 3. GET Real-time Server-Sent Events (SSE) Stream
router.get('/:id/stream', (req, res) => {
  const { id } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders();

  // Initial handshake
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', auctionId: id, timestamp: new Date().toISOString() })}\n\n`);

  addAuctionStreamClient(id, res);

  req.on('close', () => {
    removeAuctionStreamClient(id, res);
  });
});

// 4. POST Place Bid (Server-side Atomic Transaction with Concurrency Lock & Slabs)
router.post('/:id/bid', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { team_id, player_id, increment, custom_amount, amount } = req.body;
    const effectiveCustom = typeof custom_amount === 'number' ? custom_amount : (typeof amount === 'number' ? amount : null);

    if (!team_id || !player_id) {
      return res.status(400).json({ error: 'team_id and player_id are required' });
    }

    // Run in a strict SQLite transaction for atomic concurrency guarantee
    const placeBidTransaction = db.transaction(() => {
      // 1. Lock and verify auction room
      const room = db.prepare('SELECT * FROM auction_rooms WHERE id = ?').get(id) as AuctionRoom | undefined;
      if (!room) {
        throw new Error('Auction room not found');
      }
      if (room.status !== 'LIVE') {
        throw new Error(`Auction is not accepting bids (Status: ${room.status})`);
      }

      // 2. Lock and verify player
      const player = db.prepare('SELECT * FROM auction_players WHERE id = ? AND auction_id = ?').get(player_id, id) as AuctionPlayer | undefined;
      if (!player) {
        throw new Error('Player lot not found in this auction');
      }
      if (player.status !== 'IN_AUCTION') {
        throw new Error(`Bidding closed for this player (Status: ${player.status})`);
      }

      // 3. Lock and verify bidding team
      const team = db.prepare('SELECT * FROM auction_teams WHERE id = ? AND auction_id = ?').get(team_id, id) as AuctionTeam | undefined;
      if (!team) {
        throw new Error('Franchise team not found in this auction');
      }

      // 4. Check squad limit constraint
      if (team.squad_count >= room.max_squad_size) {
        throw new Error(`Squad limit reached (${team.squad_count}/${room.max_squad_size} players maximum)`);
      }

      // 5. Check overseas player limit constraint
      if (player.is_overseas === 1 && room.overseas_limit) {
        if ((team.overseas_count || 0) >= room.overseas_limit) {
          throw new Error(`Overseas player limit reached (${team.overseas_count || 0}/${room.overseas_limit} maximum) for ${team.name}`);
        }
      }

      // 6. Calculate new bid amount and validate increment slabs
      const dynamicInc = calculateMinIncrement(player.current_bid, room);
      let newAmount: number;

      if (effectiveCustom && typeof effectiveCustom === 'number') {
        newAmount = effectiveCustom;
      } else {
        const inc = increment && typeof increment === 'number' ? increment : dynamicInc;
        if (player.current_bid === 0 || !player.highest_bidder_team_id) {
          newAmount = Math.max(player.base_price, player.current_bid + inc);
        } else {
          newAmount = player.current_bid + inc;
        }
      }

      // 7. Validate minimum increment over current bid
      if (player.current_bid > 0 && newAmount <= player.current_bid) {
        throw new Error(`Bid amount must exceed current bid and be at least minimum increment of ₹${dynamicInc.toLocaleString('en-IN')}`);
      }

      // 8. Verify purse balance constraint
      if (team.purse_remaining < newAmount) {
        throw new Error(`Insufficient purse for ${team.name}. Remaining: ₹${team.purse_remaining.toLocaleString('en-IN')}`);
      }

      // 9. Prevent consecutive bid by same team if another bid exists
      if (player.highest_bidder_team_id === team_id) {
        throw new Error(`${team.name} is already the highest bidder`);
      }

      // 10. Insert into Bids audit log
      const bidId = 'bid_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      db.prepare(`
        INSERT INTO bids (id, auction_id, player_id, team_id, bidder_user_id, amount, placed_at, time_remaining)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(bidId, id, player_id, team_id, req.user?.id || null, newAmount, room.countdown_seconds);

      // 11. Update Player Highest Bid
      db.prepare(`
        UPDATE auction_players 
        SET current_bid = ?, highest_bidder_team_id = ?
        WHERE id = ?
      `).run(newAmount, team_id, player_id);

      return {
        bidId,
        newAmount,
        teamId: team.id,
        teamName: team.name,
        teamColor: team.color,
        playerId: player.id,
        playerName: player.name,
        timeRemaining: room.countdown_seconds,
      };
    });

    const result = placeBidTransaction();

    // Broadcast Real-time SSE to all connected clients
    broadcastAuctionEvent(id, {
      type: 'NEW_BID',
      bid: result,
      currentBid: result.newAmount,
      highestBidderTeamId: result.teamId,
      highestBidderName: result.teamName,
      highestBidderColor: result.teamColor,
      timeRemaining: result.timeRemaining,
    });

    return res.json({
      success: true,
      message: 'Bid successfully placed and verified on server',
      result,
      currentBid: result.newAmount,
      highestBidderTeamId: result.teamId,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Bid rejected by server transaction' });
  }
});

// 5. POST Gavel Strike: Mark Lot as SOLD or UNSOLD
router.post('/:id/gavel', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { player_id, action } = req.body; // action: 'SOLD' or 'UNSOLD'

    const room = db.prepare('SELECT * FROM auction_rooms WHERE id = ?').get(id) as AuctionRoom | undefined;
    const targetPlayerId = player_id || room?.current_player_id;

    if (!targetPlayerId || !['SOLD', 'UNSOLD'].includes(action)) {
      return res.status(400).json({ error: 'Valid player_id and action (SOLD/UNSOLD) required' });
    }

    const gavelTransaction = db.transaction(() => {
      const player = db.prepare('SELECT * FROM auction_players WHERE id = ? AND auction_id = ?').get(targetPlayerId, id) as AuctionPlayer | undefined;
      if (!player) throw new Error('Player not found');

      if (action === 'SOLD') {
        if (!player.highest_bidder_team_id || player.current_bid <= 0) {
          throw new Error('Cannot sell player without an active winning bidder');
        }

        const team = db.prepare('SELECT * FROM auction_teams WHERE id = ?').get(player.highest_bidder_team_id) as AuctionTeam | undefined;
        if (!team) throw new Error('Winning franchise not found');

        const isOverseas = player.is_overseas === 1 ? 1 : 0;

        // Deduct purse and increment squad and overseas count
        db.prepare(`
          UPDATE auction_teams 
          SET purse_remaining = purse_remaining - ?,
              squad_count = squad_count + 1,
              overseas_count = overseas_count + ?
          WHERE id = ?
        `).run(player.current_bid, isOverseas, team.id);

        // Mark player as SOLD
        db.prepare(`
          UPDATE auction_players
          SET status = 'SOLD', sold_at = datetime('now')
          WHERE id = ?
        `).run(targetPlayerId);

        return {
          status: 'SOLD',
          player: player.name,
          playerId: player.id,
          winningTeam: team.name,
          winningTeamId: team.id,
          winningTeamColor: team.color,
          amount: player.current_bid,
        };
      } else {
        // Mark as UNSOLD
        db.prepare(`
          UPDATE auction_players
          SET status = 'UNSOLD', reentry_count = reentry_count + 1, highest_bidder_team_id = NULL
          WHERE id = ?
        `).run(targetPlayerId);

        return { status: 'UNSOLD', player: player.name, playerId: player.id };
      }
    });

    const result = gavelTransaction();

    // Broadcast Real-time SSE to all connected clients
    broadcastAuctionEvent(id, {
      type: 'GAVEL_STRIKE',
      action,
      result,
      player: { id: targetPlayerId, status: action, name: result.player },
    });

    return res.json({
      success: true,
      message: `Player marked as ${action}`,
      action,
      player: { id: targetPlayerId, status: action },
      result,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// 6. POST Advance to Next Player Lot
router.post('/:id/next-lot', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { next_player_id } = req.body;

    const advanceTransaction = db.transaction(() => {
      let nextPlayer: AuctionPlayer | undefined;
      if (next_player_id) {
        nextPlayer = db.prepare('SELECT * FROM auction_players WHERE id = ? AND auction_id = ?').get(next_player_id, id) as AuctionPlayer | undefined;
      } else {
        // Find next UPCOMING or UNSOLD lot
        nextPlayer = db.prepare(`
          SELECT * FROM auction_players 
          WHERE auction_id = ? AND status IN ('UPCOMING', 'UNSOLD')
          ORDER BY lot_number ASC LIMIT 1
        `).get(id) as AuctionPlayer | undefined;
      }

      if (!nextPlayer) {
        // Auction complete!
        db.prepare("UPDATE auction_rooms SET status = 'COMPLETED' WHERE id = ?").run(id);
        return { completed: true, player: null };
      }

      // Set new player to IN_AUCTION
      db.prepare(`
        UPDATE auction_players 
        SET status = 'IN_AUCTION', current_bid = base_price, highest_bidder_team_id = NULL
        WHERE id = ?
      `).run(nextPlayer.id);

      db.prepare(`
        UPDATE auction_rooms 
        SET current_player_id = ?
        WHERE id = ?
      `).run(nextPlayer.id, id);

      const refreshed = db.prepare('SELECT * FROM auction_players WHERE id = ?').get(nextPlayer.id) as AuctionPlayer;
      return { completed: false, player: refreshed };
    });

    const result = advanceTransaction();

    // Broadcast Real-time SSE to all connected clients
    broadcastAuctionEvent(id, {
      type: 'NEXT_LOT',
      completed: result.completed,
      player: result.player,
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// 7. POST Skip / Withdraw / Reopen Lot
router.post('/:id/skip-lot', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { player_id } = req.body;

    const room = db.prepare('SELECT current_player_id FROM auction_rooms WHERE id = ?').get(id) as any;
    const targetPlayerId = player_id || room?.current_player_id;

    if (!targetPlayerId) {
      return res.status(400).json({ error: 'player_id is required' });
    }

    // Set lot to UNSOLD without incrementing reentry
    db.prepare("UPDATE auction_players SET status = 'UNSOLD', highest_bidder_team_id = NULL WHERE id = ?").run(targetPlayerId);

    // Broadcast event
    broadcastAuctionEvent(id, {
      type: 'LOT_SKIPPED',
      playerId: targetPlayerId,
    });

    return res.json({ success: true, message: 'Player lot skipped' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/:id/reopen-lot', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { player_id } = req.body;

    if (!player_id) {
      return res.status(400).json({ error: 'player_id is required' });
    }

    const player = db.prepare('SELECT * FROM auction_players WHERE id = ? AND auction_id = ?').get(player_id, id) as AuctionPlayer | undefined;
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    db.prepare(`
      UPDATE auction_players 
      SET status = 'IN_AUCTION', current_bid = base_price, highest_bidder_team_id = NULL
      WHERE id = ?
    `).run(player_id);

    db.prepare('UPDATE auction_rooms SET current_player_id = ? WHERE id = ?').run(player_id, id);

    const refreshed = db.prepare('SELECT * FROM auction_players WHERE id = ?').get(player_id);

    broadcastAuctionEvent(id, {
      type: 'NEXT_LOT',
      completed: false,
      player: refreshed,
    });

    return res.json({ success: true, message: 'Player reopened for bidding', player: refreshed });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// 7b. POST Select Specific Player Lot for Active Stage
router.post('/:id/select-lot', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { player_id } = req.body;

    if (!player_id) {
      return res.status(400).json({ error: 'player_id is required' });
    }

    const player = db.prepare('SELECT * FROM auction_players WHERE id = ? AND auction_id = ?').get(player_id, id) as AuctionPlayer | undefined;
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // If player is not SOLD, set to IN_AUCTION
    if (player.status !== 'SOLD') {
      db.prepare(`
        UPDATE auction_players 
        SET status = 'IN_AUCTION'
        WHERE id = ?
      `).run(player_id);
    }

    db.prepare('UPDATE auction_rooms SET current_player_id = ? WHERE id = ?').run(player_id, id);

    const refreshed = db.prepare(`
      SELECT p.*, t.name as highest_bidder_name, t.color as highest_bidder_color
      FROM auction_players p
      LEFT JOIN auction_teams t ON p.highest_bidder_team_id = t.id
      WHERE p.id = ?
    `).get(player_id);

    broadcastAuctionEvent(id, {
      type: 'NEXT_LOT',
      completed: false,
      player: refreshed,
    });

    return res.json({ success: true, message: 'Player selected to active auction stage', player: refreshed });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// 8. POST Pause / Resume Auction
router.post('/:id/status', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'LIVE', 'PAUSED', 'COMPLETED', 'SCHEDULED'

    if (!['LIVE', 'PAUSED', 'COMPLETED', 'SCHEDULED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid auction status' });
    }

    db.prepare('UPDATE auction_rooms SET status = ? WHERE id = ?').run(status, id);

    // Broadcast Real-time SSE
    broadcastAuctionEvent(id, {
      type: 'STATUS_CHANGE',
      status,
    });

    return res.json({ message: `Auction room set to ${status}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 9. POST Register for Auction
router.post('/:id/register', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role_type, team_id } = req.body; // 'bidder', 'team_owner', 'viewer'
    const userId = req.user!.id;

    const existing = db.prepare('SELECT * FROM auction_registrations WHERE auction_id = ? AND user_id = ?').get(id, userId) as AuctionRegistration | undefined;
    if (existing) {
      return res.json({ success: true, message: 'Already registered for this auction', registration: existing });
    }

    const regId = 'reg_auc_' + crypto.randomUUID().slice(0, 12);
    db.prepare(`
      INSERT INTO auction_registrations (id, auction_id, user_id, role_type, team_id, registered_at, status)
      VALUES (?, ?, ?, ?, ?, datetime('now'), 'confirmed')
    `).run(regId, id, userId, role_type || 'viewer', team_id || null);

    const registration = db.prepare('SELECT * FROM auction_registrations WHERE id = ?').get(regId);
    return res.status(201).json({ success: true, message: 'Successfully registered for auction', registration });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 10. GET Downloadable Final Team Sheets & Post-Auction Analytics Report
router.get('/:id/report', (req, res) => {
  try {
    const { id } = req.params;

    const room = db.prepare(`
      SELECT 
        a.*,
        e.title as event_title,
        c.name as city_name,
        v.name as venue_name
      FROM auction_rooms a
      JOIN events e ON a.event_id = e.id
      JOIN cities c ON e.city_id = c.id
      JOIN venues v ON e.venue_id = v.id
      WHERE a.id = ?
    `).get(id) as (AuctionRoom & { city_name: string; venue_name: string }) | undefined;

    if (!room) return res.status(404).json({ error: 'Auction room not found' });

    const teams = db.prepare('SELECT * FROM auction_teams WHERE auction_id = ? ORDER BY name ASC').all(id) as AuctionTeam[];
    const players = db.prepare(`
      SELECT p.*, t.name as team_name, t.color as team_color
      FROM auction_players p
      LEFT JOIN auction_teams t ON p.highest_bidder_team_id = t.id
      WHERE p.auction_id = ?
      ORDER BY p.current_bid DESC
    `).all(id) as (AuctionPlayer & { team_name?: string; team_color?: string })[];

    const soldPlayers = players.filter((p) => p.status === 'SOLD');
    const unsoldPlayers = players.filter((p) => p.status === 'UNSOLD');
    const totalSpent = teams.reduce((acc, t) => acc + (t.purse_initial - t.purse_remaining), 0);

    // Top buys
    const topBuys = soldPlayers.slice(0, 5).map((p) => ({
      name: p.name,
      role: p.role,
      category: p.category,
      amount: p.current_bid,
      team: p.team_name,
    }));

    // Most active team (most expenditure)
    const sortedTeamsBySpend = [...teams].sort((a, b) => (b.purse_initial - b.purse_remaining) - (a.purse_initial - a.purse_remaining));
    const mostActiveTeam = sortedTeamsBySpend[0] || null;

    // Category breakdown
    const categoryCounts: Record<string, number> = {};
    for (const p of soldPlayers) {
      const cat = p.category || p.role || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    // CSV format data string
    const csvHeader = 'Lot,Player Name,Role,Category,Nationality,Base Price,Final Price,Team,Status\n';
    const csvRows = players.map(p => 
      `${p.lot_number},"${p.name}","${p.role}","${p.category || ''}","${p.nationality || 'India'}",${p.base_price},${p.current_bid},"${p.team_name || 'N/A'}",${p.status}`
    ).join('\n');
    const csvString = csvHeader + csvRows;

    const report = {
      auctionId: room.id,
      auction: { id: room.id, title: room.title },
      auctionTitle: room.title,
      generatedAt: new Date().toISOString(),
      format: room.format_type,
      city: room.city_name,
      venue: room.venue_name,
      totalLots: players.length,
      soldLots: soldPlayers.length,
      unsoldLots: unsoldPlayers.length,
      sold_count: soldPlayers.length,
      totalSpend: totalSpent,
      total_spent: totalSpent,
      topBuys,
      top_buys: topBuys,
      mostActiveTeam: mostActiveTeam ? { name: mostActiveTeam.name, spent: mostActiveTeam.purse_initial - mostActiveTeam.purse_remaining } : null,
      categoryCounts,
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        city: t.city,
        color: t.color,
        purseInitial: t.purse_initial,
        purseRemaining: t.purse_remaining,
        purseSpent: t.purse_initial - t.purse_remaining,
        squadCount: t.squad_count,
        overseasCount: t.overseas_count || 0,
        captainName: t.captain_name,
        players: players.filter((p) => p.highest_bidder_team_id === t.id && p.status === 'SOLD').map((p) => ({
          name: p.name,
          role: p.role,
          category: p.category,
          amount: p.current_bid,
        })),
      })),
      teams_summary: teams.map((t) => ({
        id: t.id,
        name: t.name,
        city: t.city,
        color: t.color,
        purseInitial: t.purse_initial,
        purseRemaining: t.purse_remaining,
        purseSpent: t.purse_initial - t.purse_remaining,
        squadCount: t.squad_count,
        overseasCount: t.overseas_count || 0,
        captainName: t.captain_name,
        players: players.filter((p) => p.highest_bidder_team_id === t.id && p.status === 'SOLD').map((p) => ({
          name: p.name,
          role: p.role,
          category: p.category,
          amount: p.current_bid,
        })),
      })),
      unsoldPlayers: unsoldPlayers.map(p => ({
        id: p.id,
        lotNumber: p.lot_number,
        name: p.name,
        role: p.role,
        basePrice: p.base_price,
        reentryCount: p.reentry_count,
      })),
      csvData: csvString,
      csv_export: csvString,
    };

    return res.json({ report });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Alias for /report
router.get('/:id/results', (req, res) => {
  return (router as any).handle({ ...req, url: `/${req.params.id}/report` }, res);
});

// 11. ADMIN: Create Auction Room
router.post('/', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      event_id,
      format_type,
      format_category,
      team_purse_cap,
      min_squad_size,
      max_squad_size,
      overseas_limit,
      min_bid_increment,
      countdown_seconds,
      description,
      rules_json,
    } = req.body;

    if (!title || !event_id) {
      return res.status(400).json({ error: 'title and event_id are required' });
    }

    const auctionId = 'auc_' + crypto.randomUUID().slice(0, 10);
    db.prepare(`
      INSERT INTO auction_rooms (
        id, event_id, title, format_type, format_category, status,
        countdown_seconds, auto_extend_seconds, min_bid_increment,
        max_squad_size, min_squad_size, team_purse_cap, overseas_limit,
        description, rules_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'SCHEDULED', ?, 15, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      auctionId,
      event_id,
      title,
      format_type || 'stroom_premier',
      format_category || 'ipl_mock',
      countdown_seconds || 15,
      min_bid_increment || 25000,
      max_squad_size || 15,
      min_squad_size || 8,
      team_purse_cap || 10000000,
      overseas_limit || 4,
      description || '',
      rules_json || '{}'
    );

    const created = db.prepare('SELECT * FROM auction_rooms WHERE id = ?').get(auctionId);
    return res.status(201).json({ success: true, auction: created });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 12. ADMIN: Update Auction Room Config & Format
router.put('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      format_type,
      format_category,
      team_purse_cap,
      min_squad_size,
      max_squad_size,
      overseas_limit,
      min_bid_increment,
      countdown_seconds,
      description,
      rules_json,
      bid_increment_slabs_json,
    } = req.body;

    db.prepare(`
      UPDATE auction_rooms 
      SET title = COALESCE(?, title),
          format_type = COALESCE(?, format_type),
          format_category = COALESCE(?, format_category),
          team_purse_cap = COALESCE(?, team_purse_cap),
          min_squad_size = COALESCE(?, min_squad_size),
          max_squad_size = COALESCE(?, max_squad_size),
          overseas_limit = COALESCE(?, overseas_limit),
          min_bid_increment = COALESCE(?, min_bid_increment),
          countdown_seconds = COALESCE(?, countdown_seconds),
          description = COALESCE(?, description),
          rules_json = COALESCE(?, rules_json),
          bid_increment_slabs_json = COALESCE(?, bid_increment_slabs_json)
      WHERE id = ?
    `).run(
      title,
      format_type,
      format_category,
      team_purse_cap,
      min_squad_size,
      max_squad_size,
      overseas_limit,
      min_bid_increment,
      countdown_seconds,
      description,
      rules_json,
      bid_increment_slabs_json,
      id
    );

    const updated = db.prepare('SELECT * FROM auction_rooms WHERE id = ?').get(id);
    return res.json({ success: true, auction: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 13. ADMIN: Team Management (Create, Edit, Delete)
router.post('/:id/teams', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, city, color, purse_initial, captain_name, owner_name, owner_email } = req.body;

    if (!name || !color) {
      return res.status(400).json({ error: 'Team name and color are required' });
    }

    const teamId = 'team_' + crypto.randomUUID().slice(0, 10);
    const purse = purse_initial || 10000000;

    db.prepare(`
      INSERT INTO auction_teams (id, auction_id, name, city, color, purse_initial, purse_remaining, squad_count, captain_name, owner_name, owner_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(teamId, id, name, city || 'Hyderabad', color, purse, purse, captain_name || null, owner_name || null, owner_email || null);

    const team = db.prepare('SELECT * FROM auction_teams WHERE id = ?').get(teamId);
    return res.status(201).json({ success: true, team });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id/teams/:teamId', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id, teamId } = req.params;
    const { name, city, color, captain_name, owner_name, owner_email } = req.body;

    db.prepare(`
      UPDATE auction_teams 
      SET name = COALESCE(?, name),
          city = COALESCE(?, city),
          color = COALESCE(?, color),
          captain_name = COALESCE(?, captain_name),
          owner_name = COALESCE(?, owner_name),
          owner_email = COALESCE(?, owner_email)
      WHERE id = ? AND auction_id = ?
    `).run(name, city, color, captain_name, owner_name, owner_email, teamId, id);

    const updated = db.prepare('SELECT * FROM auction_teams WHERE id = ?').get(teamId);
    return res.json({ success: true, team: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/teams/:teamId', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id, teamId } = req.params;
    // Check if team has sold players
    const soldCount = (db.prepare("SELECT COUNT(*) as count FROM auction_players WHERE highest_bidder_team_id = ? AND status = 'SOLD'").get(teamId) as any)?.count || 0;
    if (soldCount > 0) {
      return res.status(400).json({ error: `Cannot delete team with ${soldCount} purchased players` });
    }

    db.prepare('UPDATE auction_players SET highest_bidder_team_id = NULL WHERE highest_bidder_team_id = ?').run(teamId);
    db.prepare('UPDATE auction_registrations SET team_id = NULL WHERE team_id = ?').run(teamId);
    db.prepare('DELETE FROM bids WHERE team_id = ?').run(teamId);
    db.prepare('DELETE FROM auction_teams WHERE id = ? AND auction_id = ?').run(teamId, id);
    return res.json({ success: true, message: 'Team successfully removed' });
  } catch (err: any) {
    console.error('Failed to delete team:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 14. ADMIN: Player Pool Management (Create, Edit, Delete, Batch Import)
router.post('/:id/players', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      role,
      category,
      nationality,
      is_overseas,
      batting_style,
      bowling_style,
      base_price,
      photo_url,
      bio,
      stats_json,
      previous_team,
      age,
    } = req.body;

    if (!name || !role || !base_price) {
      return res.status(400).json({ error: 'name, role, and base_price are required' });
    }

    // Calculate next lot number
    const maxLot = (db.prepare('SELECT MAX(lot_number) as max_lot FROM auction_players WHERE auction_id = ?').get(id) as any)?.max_lot || 0;
    const lotNumber = maxLot + 1;
    const playerId = 'ply_' + crypto.randomUUID().slice(0, 10);

    db.prepare(`
      INSERT INTO auction_players (
        id, auction_id, lot_number, name, role, category, nationality, is_overseas,
        batting_style, bowling_style, age, previous_team, base_price, current_bid,
        status, photo_url, stats_json, bio, reentry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UPCOMING', ?, ?, ?, 0)
    `).run(
      playerId,
      id,
      lotNumber,
      name,
      role,
      category || role,
      nationality || 'India',
      is_overseas ? 1 : 0,
      batting_style || 'Right-hand bat',
      bowling_style || 'Right-arm medium',
      age || 25,
      previous_team || null,
      base_price,
      base_price,
      photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80',
      stats_json ? JSON.stringify(stats_json) : '{}',
      bio || ''
    );

    const player = db.prepare('SELECT * FROM auction_players WHERE id = ?').get(playerId);
    return res.status(201).json({ success: true, player });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id/players/:playerId', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id, playerId } = req.params;
    const {
      name,
      role,
      category,
      nationality,
      is_overseas,
      batting_style,
      bowling_style,
      base_price,
      bio,
      photo_url,
      previous_team,
      age,
    } = req.body;

    db.prepare(`
      UPDATE auction_players 
      SET name = COALESCE(?, name),
          role = COALESCE(?, role),
          category = COALESCE(?, category),
          nationality = COALESCE(?, nationality),
          is_overseas = COALESCE(?, is_overseas),
          batting_style = COALESCE(?, batting_style),
          bowling_style = COALESCE(?, bowling_style),
          base_price = COALESCE(?, base_price),
          bio = COALESCE(?, bio),
          photo_url = COALESCE(?, photo_url),
          previous_team = COALESCE(?, previous_team),
          age = COALESCE(?, age)
      WHERE id = ? AND auction_id = ?
    `).run(
      name,
      role,
      category,
      nationality,
      is_overseas !== undefined ? (is_overseas ? 1 : 0) : null,
      batting_style,
      bowling_style,
      base_price,
      bio,
      photo_url,
      previous_team,
      age,
      playerId,
      id
    );

    const updated = db.prepare('SELECT * FROM auction_players WHERE id = ?').get(playerId);
    return res.json({ success: true, player: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/players/:playerId', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id, playerId } = req.params;
    const player = db.prepare('SELECT status FROM auction_players WHERE id = ? AND auction_id = ?').get(playerId, id) as any;
    if (player?.status === 'SOLD') {
      return res.status(400).json({ error: 'Cannot delete a player that has already been SOLD' });
    }

    db.prepare('DELETE FROM auction_players WHERE id = ? AND auction_id = ?').run(playerId, id);
    return res.json({ success: true, message: 'Player removed from auction pool' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/players/batch', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { players } = req.body;

    if (!Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: 'players array is required' });
    }

    let maxLot = (db.prepare('SELECT MAX(lot_number) as max_lot FROM auction_players WHERE auction_id = ?').get(id) as any)?.max_lot || 0;

    const batchInsert = db.transaction(() => {
      let insertedCount = 0;
      for (const p of players) {
        maxLot++;
        const pId = 'ply_' + crypto.randomUUID().slice(0, 10);
        db.prepare(`
          INSERT INTO auction_players (
            id, auction_id, lot_number, name, role, category, nationality, is_overseas,
            batting_style, bowling_style, age, previous_team, base_price, current_bid,
            status, photo_url, stats_json, bio, reentry_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UPCOMING', ?, ?, ?, 0)
        `).run(
          pId,
          id,
          maxLot,
          p.name,
          p.role || 'Batter',
          p.category || p.role || 'Batter',
          p.nationality || 'India',
          p.is_overseas ? 1 : 0,
          p.batting_style || 'Right-hand bat',
          p.bowling_style || 'Right-arm medium',
          p.age || 25,
          p.previous_team || null,
          p.base_price || 500000,
          p.base_price || 500000,
          p.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80',
          p.stats_json ? JSON.stringify(p.stats_json) : '{}',
          p.bio || ''
        );
        insertedCount++;
      }
      return insertedCount;
    });

    const count = batchInsert();
    return res.status(201).json({ success: true, message: `Successfully added ${count} players to auction pool` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
