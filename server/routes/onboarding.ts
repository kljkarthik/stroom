import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { QuizQuestion, QuizOption, QuizSession } from '../types';

const router = Router();

// Helper to get active published quiz version with questions & options
function getActivePublishedQuizVersion() {
  const publishedVersion = db.prepare(`
    SELECT qv.id as version_id, qv.version_number, qv.published_at, q.id as quiz_id, q.title as quiz_title, q.description as quiz_description
    FROM quiz_versions qv
    JOIN quizzes q ON q.id = qv.quiz_id
    WHERE qv.publication_status = 'published' AND q.status = 'active'
    ORDER BY qv.version_number DESC
    LIMIT 1
  `).get() as any;

  if (!publishedVersion) return null;

  const questions = db.prepare(`
    SELECT id, quiz_version_id, question_text, description, question_type, is_required, min_selections, max_selections, display_order, is_active
    FROM questions
    WHERE quiz_version_id = ? AND is_active = 1
    ORDER BY display_order ASC
  `).all(publishedVersion.version_id) as QuizQuestion[];

  for (const q of questions) {
    q.options = db.prepare(`
      SELECT id, question_id, label, stable_value, display_order, is_active
      FROM options
      WHERE question_id = ? AND is_active = 1
      ORDER BY display_order ASC
    `).all(q.id) as QuizOption[];
  }

  return {
    quiz: {
      id: publishedVersion.quiz_id,
      title: publishedVersion.quiz_title,
      description: publishedVersion.quiz_description,
    },
    version: {
      id: publishedVersion.version_id,
      version_number: publishedVersion.version_number,
      published_at: publishedVersion.published_at,
    },
    questions,
  };
}

// 1. GET /api/onboarding/quiz
// Returns the active published quiz structure
router.get('/quiz', (req, res) => {
  try {
    const activeQuiz = getActivePublishedQuizVersion();
    if (!activeQuiz) {
      return res.status(404).json({ error: 'No active quiz is currently published' });
    }
    return res.json(activeQuiz);
  } catch (err: any) {
    console.error('Error fetching active quiz:', err);
    return res.status(500).json({ error: 'Failed to retrieve active quiz' });
  }
});

// 2. POST /api/onboarding/sessions
// Creates or resumes a session for the authenticated user
router.post('/sessions', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const activeQuiz = getActivePublishedQuizVersion();
    if (!activeQuiz) {
      return res.status(404).json({ error: 'No active quiz is currently published' });
    }

    const versionId = activeQuiz.version.id;

    // Check if user already has an IN_PROGRESS session for this quiz version
    const existingSession = db.prepare(`
      SELECT id, user_id, quiz_version_id, status, started_at, updated_at
      FROM quiz_sessions
      WHERE user_id = ? AND quiz_version_id = ? AND status = 'IN_PROGRESS'
      ORDER BY started_at DESC
      LIMIT 1
    `).get(userId, versionId) as QuizSession | undefined;

    if (existingSession) {
      // Fetch saved answers
      const responses = getSessionResponses(existingSession.id);
      return res.json({
        session: existingSession,
        quiz: activeQuiz,
        responses,
        resumed: true,
      });
    }

    // Otherwise create a new session
    const sessionId = 'qs_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    db.transaction(() => {
      db.prepare(`
        INSERT INTO quiz_sessions (id, user_id, quiz_version_id, status)
        VALUES (?, ?, ?, 'IN_PROGRESS')
      `).run(sessionId, userId, versionId);

      // Update user onboarding_status to IN_PROGRESS
      db.prepare(`
        UPDATE users
        SET onboarding_status = 'IN_PROGRESS', updated_at = datetime('now')
        WHERE id = ? AND onboarding_status = 'NOT_STARTED'
      `).run(userId);
    })();

    const newSession = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId) as QuizSession;

    return res.status(201).json({
      session: newSession,
      quiz: activeQuiz,
      responses: {},
      resumed: false,
    });
  } catch (err: any) {
    console.error('Error creating quiz session:', err);
    return res.status(500).json({ error: 'Failed to initialize quiz session' });
  }
});

// Helper to get formatted responses for a session
function getSessionResponses(sessionId: string) {
  const rows = db.prepare(`
    SELECT r.id as response_id, r.question_id, ro.option_id
    FROM responses r
    LEFT JOIN response_options ro ON ro.response_id = r.id
    WHERE r.session_id = ?
  `).all(sessionId) as { response_id: string; question_id: string; option_id: string | null }[];

  const responses: Record<string, string[]> = {};
  for (const row of rows) {
    if (!responses[row.question_id]) {
      responses[row.question_id] = [];
    }
    if (row.option_id) {
      responses[row.question_id].push(row.option_id);
    }
  }
  return responses;
}

// 3. GET /api/onboarding/sessions/:id
// Returns session details and saved answers
router.get('/sessions/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId) as QuizSession | undefined;

    if (!session) {
      return res.status(404).json({ error: 'Quiz session not found' });
    }

    if (session.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access to session' });
    }

    // Get the quiz version attached to this exact session (preserves historical version integrity!)
    const version = db.prepare(`
      SELECT qv.id as version_id, qv.version_number, q.id as quiz_id, q.title as quiz_title, q.description as quiz_description
      FROM quiz_versions qv
      JOIN quizzes q ON q.id = qv.quiz_id
      WHERE qv.id = ?
    `).get(session.quiz_version_id) as any;

    const questions = db.prepare(`
      SELECT id, quiz_version_id, question_text, description, question_type, is_required, min_selections, max_selections, display_order, is_active
      FROM questions
      WHERE quiz_version_id = ? AND is_active = 1
      ORDER BY display_order ASC
    `).all(session.quiz_version_id) as QuizQuestion[];

    for (const q of questions) {
      q.options = db.prepare(`
        SELECT id, question_id, label, stable_value, display_order, is_active
        FROM options
        WHERE question_id = ? AND is_active = 1
        ORDER BY display_order ASC
      `).all(q.id) as QuizOption[];
    }

    const responses = getSessionResponses(sessionId);

    return res.json({
      session,
      quiz: {
        quiz: { id: version?.quiz_id, title: version?.quiz_title, description: version?.quiz_description },
        version: { id: version?.version_id, version_number: version?.version_number },
        questions,
      },
      responses,
    });
  } catch (err: any) {
    console.error('Error fetching session:', err);
    return res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// 4. PUT /api/onboarding/sessions/:id/responses
// Saves or updates user answers for a question in a session
router.put('/sessions/:id/responses', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const { question_id, option_ids } = req.body;

    if (!question_id || !Array.isArray(option_ids)) {
      return res.status(400).json({ error: 'Invalid payload: question_id and option_ids array are required' });
    }

    const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId) as QuizSession | undefined;
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized to modify this session' });
    }

    if (session.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: `Cannot modify responses for session with status: ${session.status}` });
    }

    // Verify question belongs to this quiz version
    const question = db.prepare(`
      SELECT * FROM questions WHERE id = ? AND quiz_version_id = ? AND is_active = 1
    `).get(question_id, session.quiz_version_id) as QuizQuestion | undefined;

    if (!question) {
      return res.status(400).json({ error: 'Question does not belong to active session quiz version or is inactive' });
    }

    // Validate option IDs belong to this question
    if (option_ids.length > 0) {
      const validOptions = db.prepare(`
        SELECT id FROM options WHERE question_id = ? AND is_active = 1
      `).all(question_id) as { id: string }[];
      const validSet = new Set(validOptions.map(o => o.id));

      for (const optId of option_ids) {
        if (!validSet.has(optId)) {
          return res.status(400).json({ error: `Option ${optId} does not belong to question ${question_id}` });
        }
      }

      // Validate single/multiple selection constraints
      if (question.question_type === 'single' && option_ids.length > 1) {
        return res.status(400).json({ error: 'Single-choice question cannot have multiple selections' });
      }

      if (question.question_type === 'multiple' && option_ids.length > question.max_selections) {
        return res.status(400).json({ error: `Selection exceeds maximum allowed (${question.max_selections})` });
      }
    }

    // Transactionally update response
    db.transaction(() => {
      // Find or create response row
      let response = db.prepare(`
        SELECT id FROM responses WHERE session_id = ? AND question_id = ?
      `).get(sessionId, question_id) as { id: string } | undefined;

      if (!response) {
        const respId = 'resp_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        db.prepare(`
          INSERT INTO responses (id, session_id, question_id)
          VALUES (?, ?, ?)
        `).run(respId, sessionId, question_id);
        response = { id: respId };
      } else {
        db.prepare("UPDATE responses SET updated_at = datetime('now') WHERE id = ?").run(response.id);
      }

      // Clear previous response_options
      db.prepare('DELETE FROM response_options WHERE response_id = ?').run(response.id);

      // Insert selected options
      const insertOption = db.prepare(`
        INSERT INTO response_options (response_id, option_id)
        VALUES (?, ?)
      `);

      for (const optId of option_ids) {
        insertOption.run(response.id, optId);
      }

      // Update session updated_at
      db.prepare("UPDATE quiz_sessions SET updated_at = datetime('now') WHERE id = ?").run(sessionId);
    })();

    const responses = getSessionResponses(sessionId);
    return res.json({
      message: 'Response saved successfully',
      responses,
    });
  } catch (err: any) {
    console.error('Error saving response:', err);
    return res.status(500).json({ error: 'Failed to save question response' });
  }
});

// 5. POST /api/onboarding/sessions/:id/complete
// Validates all required questions, records completion, and generates normalized user preferences
router.post('/sessions/:id/complete', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId) as QuizSession | undefined;

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized to complete this session' });
    }

    // Verify all required questions in this version have valid answers
    const requiredQuestions = db.prepare(`
      SELECT id, question_text, min_selections, max_selections, question_type
      FROM questions
      WHERE quiz_version_id = ? AND is_active = 1 AND is_required = 1
    `).all(session.quiz_version_id) as QuizQuestion[];

    const savedResponses = getSessionResponses(sessionId);

    for (const q of requiredQuestions) {
      const selected = savedResponses[q.id] || [];
      if (selected.length === 0) {
        return res.status(400).json({
          error: `Required question unanswered: "${q.question_text}"`,
          question_id: q.id
        });
      }
      if (q.question_type === 'multiple' && selected.length < q.min_selections) {
        return res.status(400).json({
          error: `Question "${q.question_text}" requires at least ${q.min_selections} selections`,
          question_id: q.id
        });
      }
    }

    // Fetch all selected option stable_values for this session to map to user_preferences
    const selectedOptions = db.prepare(`
      SELECT o.stable_value, o.label, q.question_text
      FROM responses r
      JOIN response_options ro ON ro.response_id = r.id
      JOIN options o ON o.id = ro.option_id
      JOIN questions q ON q.id = r.question_id
      WHERE r.session_id = ?
    `).all(sessionId) as { stable_value: string; label: string; question_text: string }[];

    // Extract unique normalized preference keys
    const stableTags = Array.from(new Set(selectedOptions.map(o => o.stable_value)));

    db.transaction(() => {
      // 1. Mark session COMPLETED
      db.prepare(`
        UPDATE quiz_sessions
        SET status = 'COMPLETED', completed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(sessionId);

      // 2. Update user status to COMPLETED
      db.prepare(`
        UPDATE users
        SET onboarding_status = 'COMPLETED', updated_at = datetime('now')
        WHERE id = ?
      `).run(session.user_id);

      // 3. Delete previous vibe preferences and insert new ones
      db.prepare(`
        DELETE FROM user_preferences WHERE user_id = ? AND source = 'vibe_quiz'
      `).run(session.user_id);

      const insertPref = db.prepare(`
        INSERT INTO user_preferences (id, user_id, preference_key, preference_value, source, updated_at)
        VALUES (?, ?, 'vibe_tag', ?, 'vibe_quiz', datetime('now'))
      `);

      for (const tag of stableTags) {
        const prefId = 'pref_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        insertPref.run(prefId, session.user_id, tag);
      }
    })();

    const updatedUser = db.prepare('SELECT id, email, full_name, role, onboarding_status FROM users WHERE id = ?').get(session.user_id);

    return res.json({
      message: 'Vibe quiz successfully completed! Preferences saved.',
      status: 'COMPLETED',
      preferences: stableTags,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('Error completing session:', err);
    return res.status(500).json({ error: 'Failed to complete quiz session' });
  }
});

// 6. POST /api/onboarding/sessions/:id/skip
// Records skipped state, leaves answers intact without fabricating answers, updates onboarding_status = 'SKIPPED'
router.post('/sessions/:id/skip', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId) as QuizSession | undefined;

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    db.transaction(() => {
      // Mark session as SKIPPED
      db.prepare(`
        UPDATE quiz_sessions
        SET status = 'SKIPPED', skipped_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(sessionId);

      // Update user status to SKIPPED
      db.prepare(`
        UPDATE users
        SET onboarding_status = 'SKIPPED', updated_at = datetime('now')
        WHERE id = ?
      `).run(session.user_id);
    })();

    const updatedUser = db.prepare('SELECT id, email, full_name, role, onboarding_status FROM users WHERE id = ?').get(session.user_id);

    return res.json({
      message: 'Onboarding quiz skipped. You can explore with default recommendations.',
      status: 'SKIPPED',
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('Error skipping session:', err);
    return res.status(500).json({ error: 'Failed to record skip' });
  }
});

// 7. POST /api/onboarding/restart
// Allows retaking or starting fresh vibe quiz from Profile/Settings
router.post('/restart', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const activeQuiz = getActivePublishedQuizVersion();
    if (!activeQuiz) {
      return res.status(404).json({ error: 'No active quiz is currently published' });
    }

    const sessionId = 'qs_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    db.transaction(() => {
      // Create new session
      db.prepare(`
        INSERT INTO quiz_sessions (id, user_id, quiz_version_id, status)
        VALUES (?, ?, ?, 'IN_PROGRESS')
      `).run(sessionId, userId, activeQuiz.version.id);

      // Update user onboarding_status to IN_PROGRESS
      db.prepare(`
        UPDATE users
        SET onboarding_status = 'IN_PROGRESS', updated_at = datetime('now')
        WHERE id = ?
      `).run(userId);
    })();

    const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId) as QuizSession;

    return res.status(201).json({
      message: 'New quiz session started',
      session,
      quiz: activeQuiz,
      responses: {},
    });
  } catch (err: any) {
    console.error('Error restarting quiz:', err);
    return res.status(500).json({ error: 'Failed to restart quiz' });
  }
});

export default router;
