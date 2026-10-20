import { Router, Response } from 'express';
import { db } from '../db/database';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { DiscoveryItem } from '../types';

const router = Router();

// GET /api/discovery
// Returns personalized discovery items if user is authenticated with vibe tags, or general popular items
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { type, search } = req.query;

    let query = 'SELECT * FROM discovery_items';
    const params: any[] = [];
    const conditions: string[] = [];

    if (type && typeof type === 'string' && type !== 'all') {
      conditions.push('type = ?');
      params.push(type);
    }

    if (search && typeof search === 'string' && search.trim()) {
      conditions.push('(title LIKE ? OR subtitle LIKE ? OR description LIKE ? OR category LIKE ?)');
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const rawItems = db.prepare(query).all(...params) as any[];

    // Parse tags JSON
    const items: DiscoveryItem[] = rawItems.map(item => ({
      ...item,
      tags: typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags,
    }));

    // If user is authenticated, check their vibe tags
    let userTags: string[] = [];
    let isPersonalized = false;

    if (req.user) {
      const prefs = db.prepare(`
        SELECT preference_value FROM user_preferences WHERE user_id = ?
      `).all(req.user.id) as { preference_value: string }[];
      userTags = prefs.map(p => p.preference_value);
      isPersonalized = userTags.length > 0;
    }

    const scoredItems = items.map(item => {
      if (!isPersonalized || userTags.length === 0) {
        return {
          ...item,
          is_vibe_match: false,
          match_percentage: 0,
          matching_tags: [],
        };
      }

      // Calculate intersection
      const matchingTags = item.tags.filter(t => userTags.includes(t));
      const matchScore = matchingTags.length;

      let matchPercentage = 0;
      if (matchScore >= 3) matchPercentage = 98;
      else if (matchScore === 2) matchPercentage = 92;
      else if (matchScore === 1) matchPercentage = 84;

      return {
        ...item,
        is_vibe_match: matchScore > 0,
        match_percentage: matchPercentage,
        matching_tags: matchingTags,
        _score: matchScore,
      };
    });

    // If personalized, sort by match score descending, then member count
    if (isPersonalized) {
      scoredItems.sort((a: any, b: any) => {
        if (b._score !== a._score) return b._score - a._score;
        return (b.member_count || 0) - (a.member_count || 0);
      });
    } else {
      // Sort by member count / popularity
      scoredItems.sort((a, b) => (b.member_count || 0) - (a.member_count || 0));
    }

    // Clean up temporary score field
    const results = scoredItems.map(({ _score, ...rest }: any) => rest);

    return res.json({
      items: results,
      total: results.length,
      is_personalized: isPersonalized,
      user_onboarding_status: req.user ? req.user.onboarding_status : null,
      matched_tag_count: userTags.length,
    });
  } catch (err: any) {
    console.error('Error fetching discovery feed:', err);
    return res.status(500).json({ error: 'Failed to fetch discovery feed' });
  }
});

export default router;
