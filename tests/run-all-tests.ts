process.env.NODE_ENV = 'test';
import http from 'http';
import { db } from '../server/db/database';

let server: http.Server;
const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function apiRequest(endpoint: string, options: any = {}) {
  const headers: any = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING STROOM E2E VERIFICATION TEST SUITE');
  console.log('======================================================\n');

  // Dynamically import app so NODE_ENV=test is already active
  const { default: app } = await import('../server/index');
  server = app.listen(TEST_PORT);
  await new Promise((r) => setTimeout(r, 600));

  let passedCount = 0;
  let failedCount = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      process.stdout.write(`• Testing: ${name}... `);
      await fn();
      console.log('✅ PASS');
      passedCount++;
    } catch (err: any) {
      console.log('❌ FAIL');
      console.error(`  Error: ${err.message}`);
      failedCount++;
    }
  }

  // --- SUITE 1: AUTHENTICATION & ROLE-BASED ACCESS ---
  console.log('\n--- SUITE 1: AUTHENTICATION & ROLE-BASED ACCESS ---');

  let adminToken = '';
  let userToken = '';
  let testUserId = '';

  await test('Admin login returns valid JWT token and admin role', async () => {
    const { status, data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'admin@stroom.app', password: 'Admin@123' },
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(!!data.token, 'Token must be present');
    assert(data.user.role === 'admin', 'User must have role admin');
    adminToken = data.token;
  });

  await test('Regular user registration creates account with NOT_STARTED onboarding status', async () => {
    const randomEmail = `test_${Date.now()}@stroom.app`;
    const { status, data } = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: randomEmail,
        password: 'Password@123',
        full_name: 'Jordan Smith',
      },
    });
    assert(status === 201, `Expected 201, got ${status}`);
    assert(data.user.onboarding_status === 'NOT_STARTED', 'New user must start with NOT_STARTED onboarding');
    assert(data.user.role === 'user', 'New user must have role user');
    userToken = data.token;
    testUserId = data.user.id;
  });

  await test('Non-admin user is rejected from admin endpoints with 403 Forbidden', async () => {
    const { status } = await apiRequest('/admin/overview', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(status === 403, `Expected 403, got ${status}`);
  });

  await test('Unauthenticated request to admin endpoints is rejected with 401 Unauthorized', async () => {
    const { status } = await apiRequest('/admin/overview');
    assert(status === 401, `Expected 401, got ${status}`);
  });

  await test('Authorized administrator can access admin overview', async () => {
    const { status, data } = await apiRequest('/admin/overview', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.stats !== undefined, 'Stats object must exist');
    assert(data.published_version !== undefined, 'Published version must exist');
  });

  // --- SUITE 2: DYNAMIC ONBOARDING QUIZ & SESSION PERSISTENCE ---
  console.log('\n--- SUITE 2: DYNAMIC ONBOARDING QUIZ & SESSION PERSISTENCE ---');

  let activeQuiz: any = null;
  let sessionId = '';

  await test('Public can fetch active published quiz structure (no draft questions leaked)', async () => {
    const { status, data } = await apiRequest('/onboarding/quiz');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.questions.length >= 4, `Expected at least 4 seeded questions, got ${data.questions.length}`);
    activeQuiz = data;
  });

  await test('User creates onboarding session and transitions to IN_PROGRESS', async () => {
    const { status, data } = await apiRequest('/onboarding/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(status === 201 || status === 200, `Expected 200/201, got ${status}`);
    assert(data.session.status === 'IN_PROGRESS', 'Session status must be IN_PROGRESS');
    sessionId = data.session.id;

    // Check user profile onboarding_status
    const me = await apiRequest('/auth/me', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(me.data.user.onboarding_status === 'IN_PROGRESS', 'User status must be IN_PROGRESS');
  });

  await test('Calling create session again resumes the existing session seamlessly', async () => {
    const { status, data } = await apiRequest('/onboarding/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.session.id === sessionId, 'Must resume exact same session ID');
    assert(data.resumed === true, 'resumed flag must be true');
  });

  await test('Saving answer to single-choice question works and persists', async () => {
    const q1 = activeQuiz.questions[0]; // single choice
    const optId = q1.options[0].id;

    const { status, data } = await apiRequest(`/onboarding/sessions/${sessionId}/responses`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        question_id: q1.id,
        option_ids: [optId],
      },
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.responses[q1.id]?.includes(optId), 'Option ID must be in saved responses');
  });

  await test('Rejecting invalid multiple selections for a single-choice question', async () => {
    const q1 = activeQuiz.questions[0];
    const opt1 = q1.options[0].id;
    const opt2 = q1.options[1].id;

    const { status } = await apiRequest(`/onboarding/sessions/${sessionId}/responses`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        question_id: q1.id,
        option_ids: [opt1, opt2],
      },
    });

    assert(status === 400, `Expected 400 for multiple answers on single choice, got ${status}`);
  });

  await test('Saving multiple-choice question respecting max_selections constraint', async () => {
    const q2 = activeQuiz.questions[1]; // multi-choice (max 3)
    const opt1 = q2.options[0].id;
    const opt2 = q2.options[1].id;

    const { status, data } = await apiRequest(`/onboarding/sessions/${sessionId}/responses`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        question_id: q2.id,
        option_ids: [opt1, opt2],
      },
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.responses[q2.id]?.length === 2, 'Must have 2 selected options saved');
  });

  await test('User cannot access or modify another user session (ownership check)', async () => {
    // Generate second user
    const secondUser = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: `intruder_${Date.now()}@stroom.app`,
        password: 'Password@123',
        full_name: 'Intruder',
      },
    });

    const { status } = await apiRequest(`/onboarding/sessions/${sessionId}/responses`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${secondUser.data.token}` },
      body: {
        question_id: activeQuiz.questions[0].id,
        option_ids: [activeQuiz.questions[0].options[0].id],
      },
    });

    assert(status === 403, `Expected 403 Unauthorized ownership check, got ${status}`);
  });

  // --- SUITE 3: COMPLETION, PREFERENCES & SOCIAL DISCOVERY PERSONALIZATION ---
  console.log('\n--- SUITE 3: COMPLETION, PREFERENCES & DISCOVERY ---');

  await test('Completing quiz fails if required questions are not answered', async () => {
    // We only answered q1 and q2, q3 is required and still unanswered
    const { status, data } = await apiRequest(`/onboarding/sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(status === 400, `Expected 400 when required question missing, got ${status}`);
    assert(data.error.includes('Required question unanswered'), `Error message mismatch: ${data.error}`);
  });

  await test('Completing quiz succeeds once required questions are answered', async () => {
    // Answer all required questions in this quiz session
    for (const q of activeQuiz.questions) {
      if (q.is_required) {
        const opt = q.options[0];
        await apiRequest(`/onboarding/sessions/${sessionId}/responses`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${userToken}` },
          body: {
            question_id: q.id,
            option_ids: [opt.id],
          },
        });
      }
    }

    const { status, data } = await apiRequest(`/onboarding/sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.status === 'COMPLETED', 'Status must be COMPLETED');
    assert(data.preferences.length > 0, 'Normalized preference tags must be returned');

    // Verify user onboarding_status is COMPLETED
    const me = await apiRequest('/auth/me', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(me.data.user.onboarding_status === 'COMPLETED', 'User status in DB must be COMPLETED');
  });

  await test('Discovery feed returns personalized recommendations matching user preferences', async () => {
    const { status, data } = await apiRequest('/discovery', {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.is_personalized === true, 'Feed must be marked is_personalized');
    assert(data.items.length > 0, 'Discovery items must be present');
    assert(data.items[0].is_vibe_match === true, 'Top item should be a vibe match');
    assert(data.items[0].match_percentage > 0, 'Top item should have match percentage');
  });

  // --- SUITE 4: SKIP EXPERIENCE ---
  console.log('\n--- SUITE 4: SKIP EXPERIENCE ---');

  await test('Skipping quiz records SKIPPED status without fabricating responses', async () => {
    // Register fresh user
    const skipUser = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: `skip_user_${Date.now()}@stroom.app`,
        password: 'Password@123',
        full_name: 'Taylor Skip',
      },
    });

    const sess = await apiRequest('/onboarding/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${skipUser.data.token}` },
    });

    const { status, data } = await apiRequest(`/onboarding/sessions/${sess.data.session.id}/skip`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${skipUser.data.token}` },
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.status === 'SKIPPED', 'Status must be SKIPPED');

    // Check user profile
    const me = await apiRequest('/auth/me', {
      headers: { Authorization: `Bearer ${skipUser.data.token}` },
    });
    assert(me.data.user.onboarding_status === 'SKIPPED', 'User status must be SKIPPED');

    // Verify preferences were NOT fabricated
    const prefs = await apiRequest('/users/me/preferences', {
      headers: { Authorization: `Bearer ${skipUser.data.token}` },
    });
    assert(prefs.data.tags.length === 0, 'No preferences should be fabricated for skipped user');

    // Discovery feed for skipped user is general/unpersonalized
    const disc = await apiRequest('/discovery', {
      headers: { Authorization: `Bearer ${skipUser.data.token}` },
    });
    assert(disc.data.is_personalized === false, 'Discovery feed should be unpersonalized for skipped user');
  });

  // --- SUITE 5: ADMIN QUIZ CMS, VERSIONING & PUBLICATION ---
  console.log('\n--- SUITE 5: ADMIN QUIZ CMS, VERSIONING & PUBLICATION ---');

  let draftVersionId = '';

  await test('Admin can create an editable draft version without mutating published version', async () => {
    const { status, data } = await apiRequest('/admin/quizzes/quiz_vibe_001/create-draft', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(status === 200 || status === 201, `Expected 200/201, got ${status}`);
    draftVersionId = data.draft_version_id;
    assert(!!draftVersionId, 'Draft version ID must be returned');
  });

  let createdQuestionId = '';

  await test('Admin can add a new question with options to draft version', async () => {
    const { status, data } = await apiRequest('/admin/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        quiz_version_id: draftVersionId,
        question_text: 'What music energizes your social soul?',
        description: 'Choose your favorite sounds when hanging out.',
        question_type: 'single',
        is_required: 1,
        min_selections: 1,
        max_selections: 1,
        options: [
          { label: 'Deep House & Electronic', stable_value: 'electronic_music' },
          { label: 'Indie Rock & Acoustic', stable_value: 'indie_music' },
          { label: 'Jazz & Lo-fi Chill', stable_value: 'jazz_lofi' },
        ],
      },
    });

    assert(status === 201, `Expected 201, got ${status}`);
    assert(data.question.question_text === 'What music energizes your social soul?', 'Question text match');
    assert(data.question.options.length === 3, 'Must have 3 options');
    createdQuestionId = data.question.id;
  });

  await test('Publishing fails if any active question has fewer than 2 options (validation safety)', async () => {
    // Add invalid question with only 1 option
    const invalidQ = await apiRequest('/admin/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        quiz_version_id: draftVersionId,
        question_text: 'Invalid Question',
        options: [{ label: 'Only 1 option' }],
      },
    });

    const { status, data } = await apiRequest(`/admin/versions/${draftVersionId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert(status === 400, `Expected 400 for invalid publication, got ${status}`);
    assert(data.error.includes('must have at least 2 active options'), 'Validation error check');

    // Clean up invalid question
    await apiRequest(`/admin/questions/${invalidQ.data.question.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  });

  await test('Publishing draft succeeds, archiving old version and making new version active', async () => {
    const { status, data } = await apiRequest(`/admin/versions/${draftVersionId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.version.publication_status === 'published', 'Version must now be published');

    // Verify public API now serves the newly published version with the new music question!
    const publicQuiz = await apiRequest('/onboarding/quiz');
    assert(publicQuiz.data.version.id === draftVersionId, 'Public quiz version must match newly published version');
    const musicQ = publicQuiz.data.questions.find((q: any) => q.question_text.includes('music'));
    assert(!!musicQ, 'Newly added question must now be present in active published quiz');
  });

  // Close server
  server.close();

  console.log('\n======================================================');
  console.log(`🏁 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  if (server) server.close();
  process.exit(1);
});
