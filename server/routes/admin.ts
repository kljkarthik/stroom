import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabaseAdapter } from '../db/adapter';
import { requireAuth, requireAdmin, requirePermission, AuthRequest } from '../middleware/auth';
import { QuizQuestion, QuizOption, QuizVersion } from '../types';
import adminHubRouter from './adminHub';
import { recordAuditLog } from '../services/auditService';

const router = Router();

// Apply auth and admin check to all admin routes
router.use(requireAuth);
router.use(requireAdmin);

// Mount centralized Phase 6 Admin Control Center routes
router.use('/', adminHubRouter);

// 1. GET /api/admin/overview
// Quiz statistics, completion rates, and version status
router.get('/overview', requirePermission('overview.view'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const totalSessions = (await adapter.queryOne<{ count: number }>('SELECT count(*) as count FROM quiz_sessions')) || { count: 0 };
    const completedSessions = (await adapter.queryOne<{ count: number }>("SELECT count(*) as count FROM quiz_sessions WHERE status = 'COMPLETED'")) || { count: 0 };
    const skippedSessions = (await adapter.queryOne<{ count: number }>("SELECT count(*) as count FROM quiz_sessions WHERE status = 'SKIPPED'")) || { count: 0 };
    const inProgressSessions = (await adapter.queryOne<{ count: number }>("SELECT count(*) as count FROM quiz_sessions WHERE status = 'IN_PROGRESS'")) || { count: 0 };
    const totalUsers = (await adapter.queryOne<{ count: number }>('SELECT count(*) as count FROM users')) || { count: 0 };

    const completionRate = totalSessions.count > 0
      ? Math.round((completedSessions.count / totalSessions.count) * 100)
      : 0;
    const skipRate = totalSessions.count > 0
      ? Math.round((skippedSessions.count / totalSessions.count) * 100)
      : 0;

    // Active published version
    const publishedVersion = await adapter.queryOne<any>(`
      SELECT qv.id, qv.version_number, qv.published_at, count(q.id) as question_count
      FROM quiz_versions qv
      LEFT JOIN questions q ON q.quiz_version_id = qv.id AND q.is_active = 1
      WHERE qv.publication_status = 'published'
      GROUP BY qv.id, qv.version_number, qv.published_at
      ORDER BY qv.version_number DESC
      LIMIT 1
    `);

    // Draft version (if any)
    const draftVersion = await adapter.queryOne<any>(`
      SELECT qv.id, qv.version_number, qv.created_at, count(q.id) as question_count
      FROM quiz_versions qv
      LEFT JOIN questions q ON q.quiz_version_id = qv.id
      WHERE qv.publication_status = 'draft'
      GROUP BY qv.id, qv.version_number, qv.created_at
      ORDER BY qv.version_number DESC
      LIMIT 1
    `);

    return res.json({
      stats: {
        total_sessions: totalSessions.count,
        completed_sessions: completedSessions.count,
        skipped_sessions: skippedSessions.count,
        in_progress_sessions: inProgressSessions.count,
        total_users: totalUsers.count,
        completion_rate: completionRate,
        skip_rate: skipRate,
      },
      published_version: publishedVersion || null,
      draft_version: draftVersion || null,
    });
  } catch (err: any) {
    console.error('Error fetching admin overview:', err);
    return res.status(500).json({ error: 'Failed to fetch admin overview' });
  }
});

// 2. GET /api/admin/quizzes
// Lists quizzes and their version history
router.get('/quizzes', requirePermission('quiz.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const quizzes = await adapter.query<any>('SELECT * FROM quizzes ORDER BY created_at DESC');

    for (const quiz of quizzes) {
      quiz.versions = await adapter.query<any>(`
        SELECT qv.*,
          (SELECT count(*) FROM questions WHERE quiz_version_id = qv.id) as total_questions,
          (SELECT count(*) FROM questions WHERE quiz_version_id = qv.id AND is_active = 1) as active_questions,
          (SELECT count(*) FROM quiz_sessions WHERE quiz_version_id = qv.id) as sessions_count
        FROM quiz_versions qv
        WHERE qv.quiz_id = ?
        ORDER BY qv.version_number DESC
      `, [quiz.id]);
    }

    return res.json({ quizzes });
  } catch (err: any) {
    console.error('Error fetching quizzes:', err);
    return res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// 3. GET /api/admin/versions/:id
// Gets full tree for a specific quiz version
router.get('/versions/:id', requirePermission('quiz.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const versionId = req.params.id;

    const version = await adapter.queryOne<any>(`
      SELECT qv.*, q.title as quiz_title, q.description as quiz_description
      FROM quiz_versions qv
      JOIN quizzes q ON q.id = qv.quiz_id
      WHERE qv.id = ?
    `, [versionId]);

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const questions = await adapter.query<QuizQuestion>(`
      SELECT * FROM questions
      WHERE quiz_version_id = ?
      ORDER BY display_order ASC
    `, [versionId]);

    for (const q of questions) {
      q.options = await adapter.query<QuizOption>(`
        SELECT * FROM options
        WHERE question_id = ?
        ORDER BY display_order ASC
      `, [q.id]);
    }

    version.questions = questions;

    return res.json({ version });
  } catch (err: any) {
    console.error('Error fetching version tree:', err);
    return res.status(500).json({ error: 'Failed to fetch version tree' });
  }
});

// 4. POST /api/admin/quizzes/:quizId/versions & /api/admin/quizzes/:quizId/create-draft
// Clones active published version (or latest version) into a new editable 'draft' version
router.post(['/quizzes/:quizId/versions', '/quizzes/:quizId/create-draft'], requirePermission('quiz.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const { quizId } = req.params;

    // Check if there is already an existing draft for this quiz
    const existingDraft = await adapter.queryOne<any>(`
      SELECT id FROM quiz_versions WHERE quiz_id = ? AND publication_status = 'draft'
    `, [quizId]);

    if (existingDraft) {
      const existing = await adapter.queryOne('SELECT * FROM quiz_versions WHERE id = ?', [existingDraft.id]);
      return res.status(200).json({
        message: 'Draft version already exists',
        draft_version_id: existingDraft.id,
        draft_id: existingDraft.id,
        version: existing,
      });
    }

    // Get max version number
    const maxVer = (await adapter.queryOne<{ max_ver: number }>(`
      SELECT coalesce(max(version_number), 0) as max_ver FROM quiz_versions WHERE quiz_id = ?
    `, [quizId])) || { max_ver: 0 };
    const newVersionNumber = maxVer.max_ver + 1;
    const newVersionId = 'qv_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    // Latest published version to clone
    const latestPublished = await adapter.queryOne<{ id: string }>(`
      SELECT id FROM quiz_versions
      WHERE quiz_id = ? AND publication_status = 'published'
      ORDER BY version_number DESC
      LIMIT 1
    `, [quizId]);

    await adapter.transaction(async (tx) => {
      await tx.execute(`
        INSERT INTO quiz_versions (id, quiz_id, version_number, publication_status, created_by)
        VALUES (?, ?, ?, 'draft', ?)
      `, [newVersionId, quizId, newVersionNumber, req.user?.full_name || req.user?.email || 'Administrator']);

      if (latestPublished) {
        // Clone questions & options
        const questions = await tx.query<any>('SELECT * FROM questions WHERE quiz_version_id = ?', [latestPublished.id]);

        for (const q of questions) {
          const newQId = 'q_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
          await tx.execute(`
            INSERT INTO questions (id, quiz_version_id, question_text, description, question_type, is_required, min_selections, max_selections, display_order, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            newQId,
            newVersionId,
            q.question_text,
            q.description,
            q.question_type,
            q.is_required,
            q.min_selections,
            q.max_selections,
            q.display_order,
            q.is_active
          ]);

          const options = await tx.query<any>('SELECT * FROM options WHERE question_id = ?', [q.id]);
          for (const opt of options) {
            const newOptId = 'opt_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
            await tx.execute(`
              INSERT INTO options (id, question_id, label, stable_value, display_order, is_active)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [newOptId, newQId, opt.label, opt.stable_value, opt.display_order, opt.is_active]);
          }
        }
      }
    });

    const created = await adapter.queryOne('SELECT * FROM quiz_versions WHERE id = ?', [newVersionId]);

    return res.status(201).json({
      message: `Draft version ${newVersionNumber} created successfully`,
      version: created,
      draft_version_id: newVersionId,
    });
  } catch (err: any) {
    console.error('Error creating draft version:', err);
    return res.status(500).json({ error: 'Failed to create draft version' });
  }
});

// 5. POST /api/admin/questions
// Adds question to draft version
router.post('/questions', requirePermission('quiz.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const question_type = req.body.question_type || 'single';
    const {
      quiz_version_id,
      question_text,
      description,
      is_required,
      min_selections,
      max_selections,
      options
    } = req.body;

    if (!quiz_version_id || !question_text) {
      return res.status(400).json({ error: 'quiz_version_id and question_text are required' });
    }

    const version = await adapter.queryOne<any>('SELECT publication_status FROM quiz_versions WHERE id = ?', [quiz_version_id]);
    if (!version) {
      return res.status(404).json({ error: 'Quiz version not found' });
    }
    if (version.publication_status !== 'draft') {
      return res.status(400).json({ error: 'Cannot add questions to a published or archived version. Create a draft first.' });
    }

    // Determine display order
    const maxOrder = (await adapter.queryOne<{ max_ord: number }>(`
      SELECT coalesce(max(display_order), 0) as max_ord FROM questions WHERE quiz_version_id = ?
    `, [quiz_version_id])) || { max_ord: 0 };
    const display_order = maxOrder.max_ord + 1;
    const questionId = 'q_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    await adapter.transaction(async (tx) => {
      await tx.execute(`
        INSERT INTO questions (id, quiz_version_id, question_text, description, question_type, is_required, min_selections, max_selections, display_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        questionId,
        quiz_version_id,
        question_text,
        description,
        question_type,
        is_required ? 1 : 0,
        Number(min_selections) || 1,
        question_type === 'single' ? 1 : (Number(max_selections) || 1),
        display_order
      ]);

      // Add options if provided
      if (Array.isArray(options)) {
        for (let idx = 0; idx < options.length; idx++) {
          const opt = options[idx];
          const optId = 'opt_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
          const safeLabel = opt && opt.label ? String(opt.label).trim() : `Option ${idx + 1}`;
          const stableValue = (opt && opt.stable_value
            ? String(opt.stable_value)
            : safeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `opt_${idx + 1}`
          ).slice(0, 50);
          await tx.execute(`
            INSERT INTO options (id, question_id, label, stable_value, display_order, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
          `, [optId, questionId, safeLabel, stableValue, idx + 1]);
        }
      }
    });

    const createdQuestion = await adapter.queryOne<any>('SELECT * FROM questions WHERE id = ?', [questionId]);
    createdQuestion.options = await adapter.query<QuizOption>('SELECT * FROM options WHERE question_id = ? ORDER BY display_order ASC', [questionId]);

    return res.status(201).json({
      message: 'Question created successfully',
      question: createdQuestion,
    });
  } catch (err: any) {
    console.error('Error creating question:', err);
    return res.status(500).json({ error: 'Failed to create question' });
  }
});

// 6. PATCH /api/admin/questions/:id
// Updates question in draft version
router.patch('/questions/:id', requirePermission('quiz.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const questionId = req.params.id;
    const question = await adapter.queryOne<any>(`
      SELECT q.*, qv.publication_status
      FROM questions q
      JOIN quiz_versions qv ON qv.id = q.quiz_version_id
      WHERE q.id = ?
    `, [questionId]);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.publication_status !== 'draft') {
      return res.status(400).json({ error: 'Cannot modify questions in a published version. Create a draft version first.' });
    }

    const {
      question_text,
      description,
      question_type,
      is_required,
      min_selections,
      max_selections,
      display_order,
      is_active
    } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (question_text !== undefined) { updates.push('question_text = ?'); params.push(question_text); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (question_type !== undefined) { updates.push('question_type = ?'); params.push(question_type); }
    if (is_required !== undefined) { updates.push('is_required = ?'); params.push(is_required ? 1 : 0); }
    if (min_selections !== undefined) { updates.push('min_selections = ?'); params.push(Number(min_selections)); }
    if (max_selections !== undefined) { updates.push('max_selections = ?'); params.push(Number(max_selections)); }
    if (display_order !== undefined) { updates.push('display_order = ?'); params.push(Number(display_order)); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (updates.length > 0) {
      params.push(questionId);
      await adapter.execute(`UPDATE questions SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updated = await adapter.queryOne<any>('SELECT * FROM questions WHERE id = ?', [questionId]);
    updated.options = await adapter.query<QuizOption>('SELECT * FROM options WHERE question_id = ? ORDER BY display_order ASC', [questionId]);

    return res.json({
      message: 'Question updated successfully',
      question: updated,
    });
  } catch (err: any) {
    console.error('Error updating question:', err);
    return res.status(500).json({ error: 'Failed to update question' });
  }
});

// 7. DELETE /api/admin/questions/:id
// Deletes question from draft
router.delete('/questions/:id', requirePermission('quiz.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const questionId = req.params.id;
    const question = await adapter.queryOne<any>(`
      SELECT q.*, qv.publication_status
      FROM questions q
      JOIN quiz_versions qv ON qv.id = q.quiz_version_id
      WHERE q.id = ?
    `, [questionId]);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.publication_status !== 'draft') {
      return res.status(400).json({ error: 'Cannot delete questions in a published version. You can deactivate them instead.' });
    }

    await adapter.transaction(async (tx) => {
      await tx.execute('DELETE FROM options WHERE question_id = ?', [questionId]);
      await tx.execute('DELETE FROM questions WHERE id = ?', [questionId]);
    });

    return res.json({ message: 'Question deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting question:', err);
    return res.status(500).json({ error: 'Failed to delete question' });
  }
});

// 8. Reorder questions
router.post('/questions/reorder', requirePermission('quiz.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const { question_ids } = req.body;
    if (!Array.isArray(question_ids)) {
      return res.status(400).json({ error: 'question_ids array is required' });
    }

    await adapter.transaction(async (tx) => {
      for (let index = 0; index < question_ids.length; index++) {
        const id = question_ids[index];
        await tx.execute('UPDATE questions SET display_order = ? WHERE id = ?', [index + 1, id]);
      }
    });

    return res.json({ message: 'Questions reordered successfully' });
  } catch (err: any) {
    console.error('Error reordering questions:', err);
    return res.status(500).json({ error: 'Failed to reorder questions' });
  }
});

// 9. POST /api/admin/questions/:questionId/options
router.post('/questions/:questionId/options', requirePermission('quiz.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const { questionId } = req.params;
    const { label, stable_value } = req.body;

    if (!label) {
      return res.status(400).json({ error: 'Option label is required' });
    }

    const question = await adapter.queryOne<any>(`
      SELECT q.*, qv.publication_status
      FROM questions q
      JOIN quiz_versions qv ON qv.id = q.quiz_version_id
      WHERE q.id = ?
    `, [questionId]);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.publication_status !== 'draft') {
      return res.status(400).json({ error: 'Cannot add options to a published version question' });
    }

    const maxOrder = (await adapter.queryOne<{ max_ord: number }>(`
      SELECT coalesce(max(display_order), 0) as max_ord FROM options WHERE question_id = ?
    `, [questionId])) || { max_ord: 0 };
    const display_order = maxOrder.max_ord + 1;
    const optId = 'opt_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const safeLabel = String(label).trim();
    const resolvedValue = (stable_value
      ? String(stable_value)
      : safeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `opt_${Date.now()}`
    ).slice(0, 50);

    await adapter.execute(`
      INSERT INTO options (id, question_id, label, stable_value, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [optId, questionId, safeLabel, resolvedValue, display_order]);

    const option = await adapter.queryOne('SELECT * FROM options WHERE id = ?', [optId]);
    return res.status(201).json({ message: 'Option added', option });
  } catch (err: any) {
    console.error('Error adding option:', err);
    return res.status(500).json({ error: 'Failed to add option' });
  }
});

// 10. PATCH /api/admin/options/:id
router.patch('/options/:id', requirePermission('quiz.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const optId = req.params.id;
    const { label, stable_value, display_order, is_active } = req.body;

    const opt = await adapter.queryOne<any>(`
      SELECT o.*, qv.publication_status
      FROM options o
      JOIN questions q ON q.id = o.question_id
      JOIN quiz_versions qv ON qv.id = q.quiz_version_id
      WHERE o.id = ?
    `, [optId]);

    if (!opt) {
      return res.status(404).json({ error: 'Option not found' });
    }

    if (opt.publication_status !== 'draft') {
      return res.status(400).json({ error: 'Cannot modify option of a published version' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (label !== undefined) { updates.push('label = ?'); params.push(label); }
    if (stable_value !== undefined) { updates.push('stable_value = ?'); params.push(stable_value); }
    if (display_order !== undefined) { updates.push('display_order = ?'); params.push(Number(display_order)); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (updates.length > 0) {
      params.push(optId);
      await adapter.execute(`UPDATE options SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updated = await adapter.queryOne('SELECT * FROM options WHERE id = ?', [optId]);
    return res.json({ message: 'Option updated', option: updated });
  } catch (err: any) {
    console.error('Error updating option:', err);
    return res.status(500).json({ error: 'Failed to update option' });
  }
});

// 11. DELETE /api/admin/options/:id
router.delete('/options/:id', requirePermission('quiz.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const optId = req.params.id;
    const opt = await adapter.queryOne<any>(`
      SELECT o.*, qv.publication_status
      FROM options o
      JOIN questions q ON q.id = o.question_id
      JOIN quiz_versions qv ON qv.id = q.quiz_version_id
      WHERE o.id = ?
    `, [optId]);

    if (!opt) {
      return res.status(404).json({ error: 'Option not found' });
    }

    if (opt.publication_status !== 'draft') {
      return res.status(400).json({ error: 'Cannot delete option of a published version' });
    }

    await adapter.execute('DELETE FROM options WHERE id = ?', [optId]);
    return res.json({ message: 'Option deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting option:', err);
    return res.status(500).json({ error: 'Failed to delete option' });
  }
});

// 12. POST /api/admin/versions/:versionId/publish
// Validates draft configuration and publishes new immutable version
router.post('/versions/:versionId/publish', requirePermission('quiz.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const { versionId } = req.params;
    const version = await adapter.queryOne<QuizVersion>('SELECT * FROM quiz_versions WHERE id = ?', [versionId]);

    if (!version) {
      return res.status(404).json({ error: 'Quiz version not found' });
    }

    if (version.publication_status === 'published') {
      return res.status(400).json({ error: 'This version is already published.' });
    }

    // Validation checks
    const activeQuestions = await adapter.query<QuizQuestion>(`
      SELECT * FROM questions WHERE quiz_version_id = ? AND is_active = 1
    `, [versionId]);

    if (activeQuestions.length === 0) {
      return res.status(400).json({ error: 'Cannot publish quiz: At least 1 active question is required.' });
    }

    for (const q of activeQuestions) {
      const activeOptions = await adapter.query<QuizOption>(`
        SELECT * FROM options WHERE question_id = ? AND is_active = 1
      `, [q.id]);

      if (activeOptions.length < 2) {
        return res.status(400).json({
          error: `Cannot publish quiz: Question "${q.question_text}" must have at least 2 active options. Currently has ${activeOptions.length}.`
        });
      }

      if (q.question_type === 'multiple') {
        if (q.min_selections > q.max_selections) {
          return res.status(400).json({
            error: `Cannot publish quiz: Question "${q.question_text}" min_selections (${q.min_selections}) cannot exceed max_selections (${q.max_selections}).`
          });
        }
        if (q.max_selections > activeOptions.length) {
          return res.status(400).json({
            error: `Cannot publish quiz: Question "${q.question_text}" max_selections (${q.max_selections}) exceeds available options (${activeOptions.length}).`
          });
        }
      }
    }

    // Execute publication transaction:
    // 1. Archive previous published version
    // 2. Publish this version
    await adapter.transaction(async (tx) => {
      await tx.execute(`
        UPDATE quiz_versions
        SET publication_status = 'archived', updated_at = CURRENT_TIMESTAMP
        WHERE quiz_id = ? AND publication_status = 'published'
      `, [version.quiz_id]);

      await tx.execute(`
        UPDATE quiz_versions
        SET publication_status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [versionId]);
    });

    const updated = await adapter.queryOne<QuizVersion>('SELECT * FROM quiz_versions WHERE id = ?', [versionId]);

    await recordAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.role,
      action: 'QUIZ_VERSION_PUBLISHED',
      entityType: 'quiz_version',
      entityId: versionId,
      afterData: { version_number: version.version_number, quiz_id: version.quiz_id },
    });

    return res.json({
      message: `Version ${version.version_number} successfully published! It is now the active quiz for all new onboarding sessions.`,
      version: updated,
    });
  } catch (err: any) {
    console.error('Error publishing version:', err);
    return res.status(500).json({ error: 'Failed to publish quiz version' });
  }
});

export default router;
