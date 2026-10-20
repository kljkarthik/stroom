"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../db/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Apply auth and admin check to all admin routes
router.use(auth_1.requireAuth);
router.use(auth_1.requireAdmin);
// 1. GET /api/admin/overview
// Quiz statistics, completion rates, and version status
router.get('/overview', (req, res) => {
    try {
        const totalSessions = database_1.db.prepare('SELECT count(*) as count FROM quiz_sessions').get();
        const completedSessions = database_1.db.prepare("SELECT count(*) as count FROM quiz_sessions WHERE status = 'COMPLETED'").get();
        const skippedSessions = database_1.db.prepare("SELECT count(*) as count FROM quiz_sessions WHERE status = 'SKIPPED'").get();
        const inProgressSessions = database_1.db.prepare("SELECT count(*) as count FROM quiz_sessions WHERE status = 'IN_PROGRESS'").get();
        const totalUsers = database_1.db.prepare('SELECT count(*) as count FROM users').get();
        const completionRate = totalSessions.count > 0
            ? Math.round((completedSessions.count / totalSessions.count) * 100)
            : 0;
        const skipRate = totalSessions.count > 0
            ? Math.round((skippedSessions.count / totalSessions.count) * 100)
            : 0;
        // Active published version
        const publishedVersion = database_1.db.prepare(`
      SELECT qv.id, qv.version_number, qv.published_at, count(q.id) as question_count
      FROM quiz_versions qv
      LEFT JOIN questions q ON q.quiz_version_id = qv.id AND q.is_active = 1
      WHERE qv.publication_status = 'published'
      GROUP BY qv.id
      ORDER BY qv.version_number DESC
      LIMIT 1
    `).get();
        // Draft version (if any)
        const draftVersion = database_1.db.prepare(`
      SELECT qv.id, qv.version_number, qv.created_at, count(q.id) as question_count
      FROM quiz_versions qv
      LEFT JOIN questions q ON q.quiz_version_id = qv.id
      WHERE qv.publication_status = 'draft'
      GROUP BY qv.id
      ORDER BY qv.version_number DESC
      LIMIT 1
    `).get();
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
    }
    catch (err) {
        console.error('Error fetching admin overview:', err);
        return res.status(500).json({ error: 'Failed to fetch admin overview' });
    }
});
// 2. GET /api/admin/quizzes
// Lists quizzes and their version history
router.get('/quizzes', (req, res) => {
    try {
        const quizzes = database_1.db.prepare('SELECT * FROM quizzes ORDER BY created_at DESC').all();
        for (const quiz of quizzes) {
            quiz.versions = database_1.db.prepare(`
        SELECT qv.*, 
          (SELECT count(*) FROM questions WHERE quiz_version_id = qv.id) as total_questions,
          (SELECT count(*) FROM questions WHERE quiz_version_id = qv.id AND is_active = 1) as active_questions,
          (SELECT count(*) FROM quiz_sessions WHERE quiz_version_id = qv.id) as sessions_count
        FROM quiz_versions qv
        WHERE qv.quiz_id = ?
        ORDER BY qv.version_number DESC
      `).all(quiz.id);
        }
        return res.json({ quizzes });
    }
    catch (err) {
        console.error('Error fetching quizzes:', err);
        return res.status(500).json({ error: 'Failed to fetch quizzes' });
    }
});
// 3. GET /api/admin/versions/:versionId
// Full question & options tree for a version
router.get('/versions/:versionId', (req, res) => {
    try {
        const { versionId } = req.params;
        const version = database_1.db.prepare(`
      SELECT qv.*, q.title as quiz_title, q.description as quiz_description
      FROM quiz_versions qv
      JOIN quizzes q ON q.id = qv.quiz_id
      WHERE qv.id = ?
    `).get(versionId);
        if (!version) {
            return res.status(404).json({ error: 'Version not found' });
        }
        const questions = database_1.db.prepare(`
      SELECT * FROM questions
      WHERE quiz_version_id = ?
      ORDER BY display_order ASC
    `).all(versionId);
        for (const q of questions) {
            q.options = database_1.db.prepare(`
        SELECT * FROM options
        WHERE question_id = ?
        ORDER BY display_order ASC
      `).all(q.id);
        }
        version.questions = questions;
        return res.json({ version });
    }
    catch (err) {
        console.error('Error fetching version:', err);
        return res.status(500).json({ error: 'Failed to fetch version tree' });
    }
});
// 4. POST /api/admin/quizzes/:quizId/create-draft
// Clones active published version into a draft (or creates blank draft)
router.post('/quizzes/:quizId/create-draft', (req, res) => {
    try {
        const { quizId } = req.params;
        // Check if a draft already exists for this quiz
        const existingDraft = database_1.db.prepare(`
      SELECT id FROM quiz_versions WHERE quiz_id = ? AND publication_status = 'draft'
    `).get(quizId);
        if (existingDraft) {
            return res.json({
                message: 'Draft already exists',
                draft_version_id: existingDraft.id,
            });
        }
        // Find highest version number
        const maxVer = database_1.db.prepare(`
      SELECT coalesce(max(version_number), 0) as max_v FROM quiz_versions WHERE quiz_id = ?
    `).get(quizId);
        const newVersionNumber = maxVer.max_v + 1;
        const newVersionId = 'qver_' + crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16);
        // Latest published version to clone
        const latestPublished = database_1.db.prepare(`
      SELECT id FROM quiz_versions
      WHERE quiz_id = ? AND publication_status = 'published'
      ORDER BY version_number DESC
      LIMIT 1
    `).get(quizId);
        database_1.db.transaction(() => {
            database_1.db.prepare(`
        INSERT INTO quiz_versions (id, quiz_id, version_number, publication_status, created_by)
        VALUES (?, ?, ?, 'draft', ?)
      `).run(newVersionId, quizId, newVersionNumber, req.user.full_name);
            if (latestPublished) {
                // Clone questions & options
                const questions = database_1.db.prepare('SELECT * FROM questions WHERE quiz_version_id = ?').all(latestPublished.id);
                const insertQ = database_1.db.prepare(`
          INSERT INTO questions (id, quiz_version_id, question_text, description, question_type, is_required, min_selections, max_selections, display_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
                const insertOpt = database_1.db.prepare(`
          INSERT INTO options (id, question_id, label, stable_value, display_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
                for (const q of questions) {
                    const newQId = 'q_' + crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16);
                    insertQ.run(newQId, newVersionId, q.question_text, q.description, q.question_type, q.is_required, q.min_selections, q.max_selections, q.display_order, q.is_active);
                    const options = database_1.db.prepare('SELECT * FROM options WHERE question_id = ?').all(q.id);
                    for (const opt of options) {
                        const newOptId = 'opt_' + crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16);
                        insertOpt.run(newOptId, newQId, opt.label, opt.stable_value, opt.display_order, opt.is_active);
                    }
                }
            }
        })();
        return res.status(201).json({
            message: 'Draft version created successfully',
            draft_version_id: newVersionId,
            version_number: newVersionNumber,
        });
    }
    catch (err) {
        console.error('Error creating draft:', err);
        return res.status(500).json({ error: 'Failed to create draft' });
    }
});
// 5. POST /api/admin/questions
// Adds a question to a draft version
router.post('/questions', (req, res) => {
    try {
        const { quiz_version_id, question_text, description = '', question_type = 'single', is_required = 1, min_selections = 1, max_selections = 1, options = [] } = req.body;
        if (!quiz_version_id || !question_text) {
            return res.status(400).json({ error: 'quiz_version_id and question_text are required' });
        }
        // Verify version is in draft
        const version = database_1.db.prepare('SELECT * FROM quiz_versions WHERE id = ?').get(quiz_version_id);
        if (!version) {
            return res.status(404).json({ error: 'Quiz version not found' });
        }
        if (version.publication_status !== 'draft') {
            return res.status(400).json({ error: 'Cannot modify a published or archived version. Create a new draft first.' });
        }
        // Determine display order
        const maxOrder = database_1.db.prepare('SELECT coalesce(max(display_order), 0) as max_ord FROM questions WHERE quiz_version_id = ?').get(quiz_version_id);
        const display_order = maxOrder.max_ord + 1;
        const questionId = 'q_' + crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16);
        database_1.db.transaction(() => {
            database_1.db.prepare(`
        INSERT INTO questions (id, quiz_version_id, question_text, description, question_type, is_required, min_selections, max_selections, display_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(questionId, quiz_version_id, question_text, description, question_type, is_required ? 1 : 0, Number(min_selections) || 1, question_type === 'single' ? 1 : (Number(max_selections) || 1), display_order);
            // Add options if provided
            if (Array.isArray(options)) {
                const insertOpt = database_1.db.prepare(`
          INSERT INTO options (id, question_id, label, stable_value, display_order, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `);
                options.forEach((opt, idx) => {
                    const optId = 'opt_' + crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16);
                    const stableValue = (opt.stable_value || opt.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')).slice(0, 50);
                    insertOpt.run(optId, questionId, opt.label, stableValue, idx + 1);
                });
            }
        })();
        const createdQuestion = database_1.db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
        createdQuestion.options = database_1.db.prepare('SELECT * FROM options WHERE question_id = ? ORDER BY display_order ASC').all(questionId);
        return res.status(201).json({
            message: 'Question created successfully',
            question: createdQuestion,
        });
    }
    catch (err) {
        console.error('Error creating question:', err);
        return res.status(500).json({ error: 'Failed to create question' });
    }
});
// 6. PATCH /api/admin/questions/:id
// Updates question in draft version
router.patch('/questions/:id', (req, res) => {
    try {
        const questionId = req.params.id;
        const question = database_1.db.prepare(`
      SELECT q.*, qv.publication_status
      FROM questions q
      JOIN quiz_versions qv ON qv.id = q.quiz_version_id
      WHERE q.id = ?
    `).get(questionId);
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }
        if (question.publication_status !== 'draft') {
            return res.status(400).json({ error: 'Cannot modify questions in a published version. Create a draft version first.' });
        }
        const { question_text, description, question_type, is_required, min_selections, max_selections, display_order, is_active } = req.body;
        const updates = [];
        const params = [];
        if (question_text !== undefined) {
            updates.push('question_text = ?');
            params.push(question_text);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (question_type !== undefined) {
            updates.push('question_type = ?');
            params.push(question_type);
        }
        if (is_required !== undefined) {
            updates.push('is_required = ?');
            params.push(is_required ? 1 : 0);
        }
        if (min_selections !== undefined) {
            updates.push('min_selections = ?');
            params.push(Number(min_selections));
        }
        if (max_selections !== undefined) {
            updates.push('max_selections = ?');
            params.push(Number(max_selections));
        }
        if (display_order !== undefined) {
            updates.push('display_order = ?');
            params.push(Number(display_order));
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }
        if (updates.length > 0) {
            params.push(questionId);
            database_1.db.prepare(`UPDATE questions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        }
        const updated = database_1.db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
        updated.options = database_1.db.prepare('SELECT * FROM options WHERE question_id = ? ORDER BY display_order ASC').all(questionId);
        return res.json({
            message: 'Question updated successfully',
            question: updated,
        });
    }
    catch (err) {
        console.error('Error updating question:', err);
        return res.status(500).json({ error: 'Failed to update question' });
    }
});
// 7. DELETE /api/admin/questions/:id
// Deletes question from draft
router.delete('/questions/:id', (req, res) => {
    try {
        const questionId = req.params.id;
        const question = database_1.db.prepare(`
      SELECT q.*, qv.publication_status
      FROM questions q
      JOIN quiz_versions qv ON qv.id = q.quiz_version_id
      WHERE q.id = ?
    `).get(questionId);
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }
        if (question.publication_status !== 'draft') {
            return res.status(400).json({ error: 'Cannot delete questions in a published version. You can deactivate them instead.' });
        }
        database_1.db.transaction(() => {
            database_1.db.prepare('DELETE FROM options WHERE question_id = ?').run(questionId);
            database_1.db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
        })();
        return res.json({ message: 'Question deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting question:', err);
        return res.status(500).json({ error: 'Failed to delete question' });
    }
});
// 8. Reorder questions
router.post('/questions/reorder', (req, res) => {
    try {
        const { question_ids } = req.body;
        if (!Array.isArray(question_ids)) {
            return res.status(400).json({ error: 'question_ids array is required' });
        }
        database_1.db.transaction(() => {
            const updateOrder = database_1.db.prepare('UPDATE questions SET display_order = ? WHERE id = ?');
            question_ids.forEach((id, index) => {
                updateOrder.run(index + 1, id);
            });
        })();
        return res.json({ message: 'Questions reordered successfully' });
    }
    catch (err) {
        console.error('Error reordering questions:', err);
        return res.status(500).json({ error: 'Failed to reorder questions' });
    }
});
// 9. POST /api/admin/questions/:questionId/options
router.post('/questions/:questionId/options', (req, res) => {
    try {
        const { questionId } = req.params;
        const { label, stable_value } = req.body;
        if (!label) {
            return res.status(400).json({ error: 'Option label is required' });
        }
        const question = database_1.db.prepare(`
      SELECT q.*, qv.publication_status
      FROM questions q
      JOIN quiz_versions qv ON qv.id = q.quiz_version_id
      WHERE q.id = ?
    `).get(questionId);
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }
        if (question.publication_status !== 'draft') {
            return res.status(400).json({ error: 'Cannot add options to a published version question' });
        }
        const maxOrder = database_1.db.prepare('SELECT coalesce(max(display_order), 0) as max_ord FROM options WHERE question_id = ?').get(questionId);
        const display_order = maxOrder.max_ord + 1;
        const optId = 'opt_' + crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16);
        const resolvedValue = (stable_value || label.toLowerCase().replace(/[^a-z0-9]+/g, '_')).slice(0, 50);
        database_1.db.prepare(`
      INSERT INTO options (id, question_id, label, stable_value, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(optId, questionId, label, resolvedValue, display_order);
        const option = database_1.db.prepare('SELECT * FROM options WHERE id = ?').get(optId);
        return res.status(201).json({ message: 'Option added', option });
    }
    catch (err) {
        console.error('Error adding option:', err);
        return res.status(500).json({ error: 'Failed to add option' });
    }
});
// 10. PATCH /api/admin/options/:id
router.patch('/options/:id', (req, res) => {
    try {
        const optId = req.params.id;
        const { label, stable_value, display_order, is_active } = req.body;
        const opt = database_1.db.prepare(`
      SELECT o.*, qv.publication_status
      FROM options o
      JOIN questions q ON q.id = o.question_id
      JOIN quiz_versions qv ON qv.id = q.quiz_version_id
      WHERE o.id = ?
    `).get(optId);
        if (!opt) {
            return res.status(404).json({ error: 'Option not found' });
        }
        if (opt.publication_status !== 'draft') {
            return res.status(400).json({ error: 'Cannot modify option of a published version' });
        }
        const updates = [];
        const params = [];
        if (label !== undefined) {
            updates.push('label = ?');
            params.push(label);
        }
        if (stable_value !== undefined) {
            updates.push('stable_value = ?');
            params.push(stable_value);
        }
        if (display_order !== undefined) {
            updates.push('display_order = ?');
            params.push(Number(display_order));
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }
        if (updates.length > 0) {
            params.push(optId);
            database_1.db.prepare(`UPDATE options SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        }
        const updated = database_1.db.prepare('SELECT * FROM options WHERE id = ?').get(optId);
        return res.json({ message: 'Option updated', option: updated });
    }
    catch (err) {
        console.error('Error updating option:', err);
        return res.status(500).json({ error: 'Failed to update option' });
    }
});
// 11. DELETE /api/admin/options/:id
router.delete('/options/:id', (req, res) => {
    try {
        const optId = req.params.id;
        const opt = database_1.db.prepare(`
      SELECT o.*, qv.publication_status
      FROM options o
      JOIN questions q ON q.id = o.question_id
      JOIN quiz_versions qv ON qv.id = q.quiz_version_id
      WHERE o.id = ?
    `).get(optId);
        if (!opt) {
            return res.status(404).json({ error: 'Option not found' });
        }
        if (opt.publication_status !== 'draft') {
            return res.status(400).json({ error: 'Cannot delete option of a published version' });
        }
        database_1.db.prepare('DELETE FROM options WHERE id = ?').run(optId);
        return res.json({ message: 'Option deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting option:', err);
        return res.status(500).json({ error: 'Failed to delete option' });
    }
});
// 12. POST /api/admin/versions/:versionId/publish
// Validates draft configuration and publishes new immutable version
router.post('/versions/:versionId/publish', (req, res) => {
    try {
        const { versionId } = req.params;
        const version = database_1.db.prepare('SELECT * FROM quiz_versions WHERE id = ?').get(versionId);
        if (!version) {
            return res.status(404).json({ error: 'Quiz version not found' });
        }
        if (version.publication_status === 'published') {
            return res.status(400).json({ error: 'This version is already published.' });
        }
        // Validation checks
        const activeQuestions = database_1.db.prepare(`
      SELECT * FROM questions WHERE quiz_version_id = ? AND is_active = 1
    `).all(versionId);
        if (activeQuestions.length === 0) {
            return res.status(400).json({ error: 'Cannot publish quiz: At least 1 active question is required.' });
        }
        for (const q of activeQuestions) {
            const activeOptions = database_1.db.prepare(`
        SELECT * FROM options WHERE question_id = ? AND is_active = 1
      `).all(q.id);
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
        database_1.db.transaction(() => {
            database_1.db.prepare(`
        UPDATE quiz_versions
        SET publication_status = 'archived', updated_at = datetime('now')
        WHERE quiz_id = ? AND publication_status = 'published'
      `).run(version.quiz_id);
            database_1.db.prepare(`
        UPDATE quiz_versions
        SET publication_status = 'published', published_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(versionId);
        })();
        const updated = database_1.db.prepare('SELECT * FROM quiz_versions WHERE id = ?').get(versionId);
        return res.json({
            message: `Version ${version.version_number} successfully published! It is now the active quiz for all new onboarding sessions.`,
            version: updated,
        });
    }
    catch (err) {
        console.error('Error publishing version:', err);
        return res.status(500).json({ error: 'Failed to publish quiz version' });
    }
});
exports.default = router;
