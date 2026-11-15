process.env.NODE_ENV = 'test';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { db, createDatabaseBackup, verifyPassword } from '../server/db/database';
import { config } from '../server/config/env';
import { resetRateLimiters } from '../server/middleware/rateLimit';

let server: http.Server;
const TEST_PORT = 5055;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

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

  await test('Empty-password account cannot authenticate with arbitrary credentials (401)', async () => {
    const { status, data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'karan@stroom.club', password: 'AttemptedPassword123!' },
    });
    assert(status === 401, `Expected 401 for empty-password account login attempt, got ${status}`);
    assert(data.error === 'Invalid email or password', 'Must return standard invalid credential error');
  });

  await test('Empty-password login payload is rejected with 400 validation error', async () => {
    const { status, data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'karan@stroom.club', password: '' },
    });
    assert(status === 400, `Expected 400 for empty password string, got ${status}`);
    assert(data.error === 'Password is required', 'Must reject empty password string');
  });

  await test('Unauthenticated request to protected member endpoint /auth/me is rejected with 401', async () => {
    const { status } = await apiRequest('/auth/me');
    assert(status === 401, `Expected 401, got ${status}`);
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

  // --- SUITE 6: REAL AUCTION ENGINE, ATOMIC BIDDING & GAVEL ---
  console.log('\n--- SUITE 6: REAL AUCTION ENGINE, ATOMIC BIDDING & GAVEL ---');

  await test('Fetch live auctions list returns Hyderabad and Pune rooms', async () => {
    const { status, data } = await apiRequest('/auctions');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.rooms), 'Rooms must be an array');
    const hydRoom = data.rooms.find((r: any) => r.id === 'auc_hyd_001');
    assert(!!hydRoom, 'Hyderabad room auc_hyd_001 must exist');
    assert(hydRoom.city === 'Hyderabad', 'Room city must be Hyderabad');
  });

  let currentHydLot: any = null;
  let testTeam: any = null;

  await test('Fetch single auction room details with lots and franchise teams', async () => {
    // Reset test lot and teams to ensure test idempotency across runs
    db.prepare("UPDATE auction_teams SET purse_remaining = purse_initial, squad_count = 0 WHERE auction_id = 'auc_hyd_001'").run();
    db.prepare("UPDATE auction_players SET status = 'IN_AUCTION', current_bid = base_price, highest_bidder_team_id = NULL WHERE id = 'ply_hyd_001'").run();
    db.prepare("UPDATE auction_rooms SET status = 'LIVE', current_player_id = 'ply_hyd_001' WHERE id = 'auc_hyd_001'").run();

    const { status, data } = await apiRequest('/auctions/auc_hyd_001');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(!!data.currentLot, 'Current lot must exist');
    assert(Array.isArray(data.teams) && data.teams.length >= 4, 'Must have at least 4 franchise teams');
    currentHydLot = data.currentLot;
    testTeam = data.teams[0];
  });

  await test('Server validates and records atomic bid, updating current bid and bid log', async () => {
    const openingBid = currentHydLot.current_bid || currentHydLot.base_price;
    const bidIncrement = 50000;
    const newBid = openingBid + bidIncrement;

    const { status, data } = await apiRequest('/auctions/auc_hyd_001/bid', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        player_id: currentHydLot.id,
        team_id: testTeam.id,
        amount: newBid,
      },
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Bid must succeed');
    assert(data.currentBid === newBid, `Current bid must be ${newBid}, got ${data.currentBid}`);
    assert(data.highestBidderTeamId === testTeam.id, 'Highest bidder must be updated');
  });

  await test('Server rejects bid below minimum increment or current bid', async () => {
    const { status, data } = await apiRequest('/auctions/auc_hyd_001/bid', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        player_id: currentHydLot.id,
        team_id: testTeam.id,
        custom_amount: 100, // way below current bid
      },
    });

    assert(status === 400, `Expected 400 for low bid, got ${status}`);
    assert(data.error.includes('must exceed current bid') || data.error.includes('must be at least'), 'Error must specify minimum increment');
  });

  await test('Auctioneer strikes gavel (SOLD) deducting team purse and updating lot status', async () => {
    const { status, data } = await apiRequest('/auctions/auc_hyd_001/gavel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        action: 'SOLD',
      },
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Gavel action must succeed');
    assert(data.player.status === 'SOLD', 'Player status must be SOLD');
  });

  // --- SUITE 7: EVENT REGISTRATION, DIGITAL PASSES & DOOR CHECK-IN ---
  console.log('\n--- SUITE 7: EVENT REGISTRATION, DIGITAL PASSES & DOOR CHECK-IN ---');

  let generatedPassCode = '';
  let generatedQrToken = '';

  await test('Register for event creates real database pass and updates attendee count', async () => {
    // Reset event registration capacity for test idempotency
    db.prepare("UPDATE events SET seats_booked = 0, seats_total = 60 WHERE id = 'evt_hyd_auction_01'").run();
    db.prepare("DELETE FROM event_registrations WHERE event_id = 'evt_hyd_auction_01'").run();

    const { status, data } = await apiRequest('/events/evt_hyd_auction_01/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        attendee_name: 'Ananya Deshpande',
        email: 'ananya@example.com',
        phone: '+91 99887 76655',
        role: 'Live Bidder / Team Owner',
      },
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Registration must succeed');
    assert(!!data.registration.pass_code, 'Pass code must be generated');
    assert(data.registration.pass_code.startsWith('STR-HYD'), 'Pass code must follow STR-HYD format');
    generatedPassCode = data.registration.pass_code;
    generatedQrToken = data.registration.qr_token;
  });

  await test('Pass verification endpoint verifies valid active pass', async () => {
    const { status, data } = await apiRequest(`/passes/verify/${generatedQrToken}`);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.valid === true, 'Pass must be valid');
    assert(data.registration.pass_code === generatedPassCode, 'Pass code must match');
  });

  await test('Door check-in terminal stamps pass as checked in with timestamp', async () => {
    const { status, data } = await apiRequest('/passes/check-in', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        pass_code: generatedPassCode,
      },
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Check-in must succeed');
    assert(data.registration.checkin_status === 'checked_in', 'Status must be checked_in');
  });

  await test('Door check-in rejects duplicate check-in with informative error', async () => {
    const { status, data } = await apiRequest('/passes/check-in', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        pass_code: generatedPassCode,
      },
    });

    assert(status === 409, `Expected 409, got ${status}`);
    assert(data.error.includes('already checked in'), 'Must reject already checked-in pass');
  });

  // --- SUITE 8: PARTNER VENUES, AUDITED LEDGER & CASHIER COUPONS ---
  console.log('\n--- SUITE 8: PARTNER VENUES, AUDITED LEDGER & CASHIER COUPONS ---');

  await test('Fetch partner venues returns verified venues with city metadata', async () => {
    const { status, data } = await apiRequest('/partners/venues');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.venues) && data.venues.length >= 4, 'Must have at least 4 verified partner venues');
    const thirdWave = data.venues.find((v: any) => v.id === 'ven_hyd_thirdwave');
    assert(!!thirdWave, 'Third Wave Jubilee Hills must exist');
    assert(thirdWave.city_name === 'Hyderabad', 'City must be Hyderabad');
  });

  await test('Fetch partner stats calculates audited ledger without fake analytics', async () => {
    const { status, data } = await apiRequest('/partners/stats/ven_hyd_thirdwave');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Stats must succeed');
    assert(typeof data.stats.expected_attendees === 'number', 'Expected attendees must be number');
    assert(typeof data.stats.actual_checkins === 'number', 'Actual checkins must be number');
    assert(typeof data.stats.actual_coupon_redemptions === 'number', 'Actual coupon redemptions must be number');
  });

  await test('Cashier redeems valid venue coupon code', async () => {
    const { status, data } = await apiRequest('/partners/coupons/redeem', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        coupon_code: 'STROOMJUBILEE20',
        order_amount: 850,
      },
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.result.code === 'STROOMJUBILEE20', 'Coupon code match');
  });

  await test('Submit partner venue collaboration proposal', async () => {
    const { status, data } = await apiRequest('/partners/proposals', {
      method: 'POST',
      body: {
        proposer_name: 'Nishant Rao',
        proposer_email: 'nishant@roastery.in',
        proposer_phone: '+91 98491 22334',
        venue_name: 'Roastery Coffee House',
        city: 'Hyderabad',
        event_type: 'Artisanal Cafe Meetup',
        proposed_date: '2026-12-15',
        expected_attendees: 90,
        perks_offered: 'Spacious outdoor lawn with projector screen ready for cricket auctions.',
      },
    });

    assert(status === 201, `Expected 201, got ${status}`);
    assert(!!data.proposalId, 'Proposal ID must be returned');
  });

  // --- SUITE 9: USER PASSPORT, MEMBER ID & ACHIEVEMENTS ---
  console.log('\n--- SUITE 9: USER PASSPORT, MEMBER ID & ACHIEVEMENTS ---');

  await test('User profile returns official member ID, passport stamps and verified achievements', async () => {
    const { status, data } = await apiRequest('/users/me/profile', {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Profile must succeed');
    assert(!!data.user.member_id, 'Member ID must exist');
    assert(data.user.member_id.startsWith('STR-'), 'Member ID must start with STR-');
    assert(typeof data.stats.passportStamps === 'number', 'Passport stamps must be number');
    assert(Array.isArray(data.achievements), 'Achievements must be array');
  });

  // --- SUITE 10: PHASE 2 PUBLIC EXPERIENCE (COMMUNITIES, FAQS, CONTACT & ADVANCED FILTERS) ---
  console.log('\n--- SUITE 10: PHASE 2 PUBLIC EXPERIENCE (COMMUNITIES, FAQS, CONTACT & FILTERS) ---');

  await test('Fetch communities returns active communities with category & city filtering', async () => {
    const { status, data } = await apiRequest('/communities?city_id=city_hyd');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.communities) && data.communities.length >= 2, 'Must have at least 2 Hyderabad communities');
    const cricketComm = data.communities.find((c: any) => c.category.toLowerCase().includes('cricket'));
    assert(!!cricketComm, 'Hyderabad Cricket Circle must be present');
    assert(cricketComm.member_count > 0, 'Member count must be positive');
  });

  await test('Fetch single community details returns guidelines, organizer and upcoming events', async () => {
    const { status, data } = await apiRequest('/communities/comm_hyd_cricket');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.community.id === 'comm_hyd_cricket', 'Community ID match');
    assert(!!data.community.guidelines, 'Guidelines must be defined');
    assert(!!data.community.organizer_name, 'Organizer name must be present');
    assert(Array.isArray(data.community.upcoming_events), 'Upcoming events must be array');
  });

  await test('Authenticated user can join and leave a community with real member count updates', async () => {
    // Join
    const joinRes = await apiRequest('/communities/comm_hyd_cricket/join', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(joinRes.status === 200, `Expected 200 on join, got ${joinRes.status}`);
    assert(joinRes.data.is_member === true, 'is_member must be true');
    const joinedCount = joinRes.data.member_count;

    // Leave
    const leaveRes = await apiRequest('/communities/comm_hyd_cricket/leave', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(leaveRes.status === 200, `Expected 200 on leave, got ${leaveRes.status}`);
    assert(leaveRes.data.is_member === false, 'is_member must be false');
    assert(leaveRes.data.member_count === joinedCount - 1, 'Member count must decrement by 1');
  });

  await test('Fetch FAQs returns 6 authentic categories with verified answers', async () => {
    const { status, data } = await apiRequest('/contact/faqs');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.faqs) && data.faqs.length === 6, 'Must return exactly 6 FAQ categories');
    const generalCat = data.faqs.find((f: any) => f.category.includes('STROOM'));
    assert(!!generalCat && generalCat.items.length >= 2, 'General FAQ category must have items');
  });

  await test('Submit contact inquiry stores entry and returns reference inquiry ID', async () => {
    const { status, data } = await apiRequest('/contact', {
      method: 'POST',
      body: {
        name: 'Sneha Patel',
        email: 'sneha@example.com',
        subject: 'Solo Attendance Question',
        message: 'Is it completely normal to attend the Hyderabad Box Cricket Auction solo?',
      },
    });
    assert(status === 201, `Expected 201, got ${status}`);
    assert(data.success === true, 'Success flag must be true');
    assert(data.inquiryId.startsWith('inq_'), 'Inquiry ID must start with inq_');
  });

  await test('Filter events by price (free/paid) and timeframe (upcoming/featured/past)', async () => {
    // Price filter: free
    const freeRes = await apiRequest('/events?price_filter=free');
    assert(freeRes.status === 200, `Expected 200, got ${freeRes.status}`);
    assert(freeRes.data.events.every((e: any) => e.entry_fee.toLowerCase().includes('free')), 'All events must be free');

    // Timeframe: past
    const pastRes = await apiRequest('/events?timeframe=past');
    assert(pastRes.status === 200, `Expected 200, got ${pastRes.status}`);
    assert(pastRes.data.events.every((e: any) => e.status === 'completed'), 'All events must be completed');

    // Timeframe: featured
    const featRes = await apiRequest('/events?timeframe=featured');
    assert(featRes.status === 200, `Expected 200, got ${featRes.status}`);
    assert(featRes.data.events.every((e: any) => e.is_flagship === 1), 'All events must be flagship');
  });

  // --- SUITE 11: PHASE 3 COMPLETE AUCTION EXPERIENCE ---
  console.log('\n--- SUITE 11: PHASE 3 COMPLETE AUCTION EXPERIENCE ---');

  await test('Filter auction rooms by format category, status, and city', async () => {
    // Format: all_time_mega
    const megaRes = await apiRequest('/auctions?format=all_time_mega');
    assert(megaRes.status === 200, `Expected 200, got ${megaRes.status}`);
    assert(megaRes.data.auctions.some((a: any) => a.id === 'auc_pune_002'), 'Must include Pune All-Time Mega auction');

    // Status: completed
    const pastRes = await apiRequest('/auctions?status=completed');
    assert(pastRes.status === 200, `Expected 200, got ${pastRes.status}`);
    assert(pastRes.data.auctions.some((a: any) => a.id === 'auc_hyd_past'), 'Must include completed historical auction');

    // City: Bangalore
    const blrRes = await apiRequest('/auctions?city=city_blr');
    assert(blrRes.status === 200, `Expected 200, got ${blrRes.status}`);
    assert(blrRes.data.auctions.some((a: any) => a.id === 'auc_blr_003'), 'Must include Bangalore auction');
  });

  await test('Fetch detailed auction state with format configuration, teams, and categorized player pool', async () => {
    const { status, data } = await apiRequest('/auctions/auc_pune_002');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.auction.format_category === 'all_time_mega', 'Format must be all_time_mega');
    assert(Array.isArray(data.teams) && data.teams.length >= 4, 'Must have at least 4 Pune franchise teams');
    assert(Array.isArray(data.players) && data.players.length >= 4, 'Must have at least 4 legend players in pool');
    assert(!!data.rulesConfig && typeof data.rulesConfig.overseasLimit === 'number', 'Rules config must include overseasLimit');
  });

  await test('Register participant for auction and fetch user registrations', async () => {
    // 1. Register user as bidder with assigned franchise team
    const regRes = await apiRequest('/auctions/auc_pune_002/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        role_type: 'bidder',
        team_id: 'team_pune_1',
      },
    });
    assert(regRes.status === 200 || regRes.status === 201, `Expected 200 or 201, got ${regRes.status}`);
    assert(regRes.data.success === true, 'Auction registration must succeed');

    // 2. Fetch user auction registrations
    const myRegsRes = await apiRequest('/auctions/my/registrations', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(myRegsRes.status === 200, `Expected 200, got ${myRegsRes.status}`);
    assert(Array.isArray(myRegsRes.data.registrations), 'Registrations must be an array');
    const puneReg = myRegsRes.data.registrations.find((r: any) => r.auction_id === 'auc_pune_002');
    assert(!!puneReg, 'User must be registered for Pune auction');
    assert(puneReg.team_name === 'Pune Warriors Elite', 'Team name must match team_pune_1');
    assert(puneReg.role_type === 'bidder', 'Role must be bidder');
  });

  await test('Dynamic bid increments and overseas player limit constraints in live bidding', async () => {
    // Set Pune auction room to LIVE and lot 3 (AB de Villiers - overseas) to IN_AUCTION
    db.prepare("UPDATE auction_rooms SET status = 'LIVE', current_player_id = 'ply_pune_003' WHERE id = 'auc_pune_002'").run();
    db.prepare("UPDATE auction_players SET status = 'IN_AUCTION', current_bid = 1800000, highest_bidder_team_id = NULL WHERE id = 'ply_pune_003'").run();
    db.prepare("UPDATE auction_teams SET overseas_count = 0, purse_remaining = 20000000, squad_count = 0 WHERE id = 'team_pune_1'").run();

    // 1. Successful bid with dynamic increment
    const bidRes = await apiRequest('/auctions/auc_pune_002/bid', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        player_id: 'ply_pune_003',
        team_id: 'team_pune_1',
        amount: 1900000,
      },
    });
    assert(bidRes.status === 200, `Expected 200, got ${bidRes.status}`);
    assert(bidRes.data.currentBid === 1900000, 'Bid amount must be recorded as 1900000');

    // 2. Overseas limit constraint enforcement
    // Set overseas count of team_pune_2 to 4 (overseas_limit for Pune room is 4)
    db.prepare("UPDATE auction_teams SET overseas_count = 4 WHERE id = 'team_pune_2'").run();
    const overseasBlockRes = await apiRequest('/auctions/auc_pune_002/bid', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        player_id: 'ply_pune_003',
        team_id: 'team_pune_2',
        amount: 2000000,
      },
    });
    assert(overseasBlockRes.status === 400, `Expected 400 when overseas limit reached, got ${overseasBlockRes.status}`);
    assert(overseasBlockRes.data.error.includes('Overseas player limit reached'), 'Must inform about overseas player limit');

    // Reset overseas count
    db.prepare("UPDATE auction_teams SET overseas_count = 0 WHERE id = 'team_pune_2'").run();
  });

  await test('Operator gavel strike updates franchise purse and squad counts atomically', async () => {
    // Current highest bidder on ply_pune_003 is team_pune_1 at 1900000
    const gavelRes = await apiRequest('/auctions/auc_pune_002/gavel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        player_id: 'ply_pune_003',
        action: 'SOLD',
      },
    });
    assert(gavelRes.status === 200, `Expected 200, got ${gavelRes.status}`);
    assert(gavelRes.data.action === 'SOLD', 'Action must be SOLD');
    assert(gavelRes.data.player.status === 'SOLD', 'Player status must be SOLD');

    // Check team_pune_1 purse deducted by 1900000 and overseas count incremented
    const team = db.prepare("SELECT * FROM auction_teams WHERE id = 'team_pune_1'").get() as any;
    assert(team.purse_remaining === 20000000 - 1900000, `Purse remaining must be 18100000, got ${team.purse_remaining}`);
    assert(team.squad_count === 1, `Squad count must be 1, got ${team.squad_count}`);
    assert(team.overseas_count === 1, `Overseas count must be 1, got ${team.overseas_count}`);
  });

  await test('Operator can advance next lot, skip lot, and reopen lot for bidding', async () => {
    // 1. Advance to next lot (ply_pune_004)
    const nextRes = await apiRequest('/auctions/auc_pune_002/next-lot', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { next_player_id: 'ply_pune_004' },
    });
    assert(nextRes.status === 200, `Expected 200, got ${nextRes.status}`);
    assert(nextRes.data.player.id === 'ply_pune_004', 'Next lot must be ply_pune_004 (Malinga)');
    assert(nextRes.data.player.status === 'IN_AUCTION', 'Status must be IN_AUCTION');

    // 2. Skip lot (marks UNSOLD)
    const skipRes = await apiRequest('/auctions/auc_pune_002/skip-lot', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { player_id: 'ply_pune_004' },
    });
    assert(skipRes.status === 200, `Expected 200, got ${skipRes.status}`);
    const skippedPlayer = db.prepare("SELECT status FROM auction_players WHERE id = 'ply_pune_004'").get() as any;
    assert(skippedPlayer.status === 'UNSOLD', 'Status must be UNSOLD');

    // 3. Reopen lot for bidding
    const reopenRes = await apiRequest('/auctions/auc_pune_002/reopen-lot', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { player_id: 'ply_pune_004' },
    });
    assert(reopenRes.status === 200, `Expected 200, got ${reopenRes.status}`);
    assert(reopenRes.data.player.status === 'IN_AUCTION', 'Status must be back to IN_AUCTION');
  });

  await test('Generate post-auction analytical report with top buys and CSV export', async () => {
    const { status, data } = await apiRequest('/auctions/auc_hyd_past/report');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.report.auction.id === 'auc_hyd_past', 'Auction ID must match');
    assert(Array.isArray(data.report.top_buys) && data.report.top_buys.length >= 1, 'Must have at least 1 top buy');
    assert(Array.isArray(data.report.teams_summary) && data.report.teams_summary.length >= 2, 'Must summarize at least 2 teams');
    assert(typeof data.report.csv_export === 'string' && data.report.csv_export.includes('Lot,Player Name'), 'CSV export must include CSV headers');
  });

  let createdTeamId = '';
  await test('Admin franchise team management and player pool batch import', async () => {
    // 1. Create franchise team
    const teamRes = await apiRequest('/auctions/auc_blr_003/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Koramangala Titans',
        city: 'Bangalore',
        color: '#8B5CF6',
        purse_initial: 5000000,
        captain_name: 'Rohit Kulkarni',
        owner_name: 'Suresh Bhat',
      },
    });
    assert(teamRes.status === 201, `Expected 201 on team create, got ${teamRes.status}`);
    assert(teamRes.data.success === true, 'Team creation must succeed');
    createdTeamId = teamRes.data.team.id;

    // 2. Batch import 2 players
    const batchRes = await apiRequest('/auctions/auc_blr_003/players/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        players: [
          {
            name: 'Akash Nair',
            role: 'Batter',
            base_price: 200000,
            lot_number: 10,
            nationality: 'India',
            is_overseas: 0,
            category: 'Batter',
          },
          {
            name: 'David Miller Jr',
            role: 'All-Rounder',
            base_price: 350000,
            lot_number: 11,
            nationality: 'South Africa',
            is_overseas: 1,
            category: 'Overseas',
          },
        ],
      },
    });
    assert(batchRes.status === 200 || batchRes.status === 201, `Expected 200 or 201 on batch import, got ${batchRes.status}`);
    assert(batchRes.data.success === true, 'Batch import must succeed');

    // 3. Delete created team
    const delRes = await apiRequest(`/auctions/auc_blr_003/teams/${createdTeamId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(delRes.status === 200, `Expected 200 on team delete, got ${delRes.status}`);
  });

  // --- SUITE 12: COMPLETE MEMBER EXPERIENCE (PHASE 4) ---
  console.log('\n--- SUITE 12: COMPLETE MEMBER EXPERIENCE (PHASE 4) ---');

  let memberToken = '';
  let memberId = '';
  let memberPassCode = '';
  let memberPassId = '';
  let cancelPassId = '';
  let notificationId = '';

  await test('Create fresh authenticated member for Phase 4 tests', async () => {
    const email = `phase4_member_${Date.now()}@stroom.club`;
    const { status, data } = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email,
        password: 'Password@123',
        full_name: 'Ananya Sharma',
      },
    });
    assert(status === 201, `Expected 201, got ${status}`);
    memberToken = data.token;
    memberId = data.user.id;
  });

  await test('GET /api/users/me/profile returns profile, completion % and real stats', async () => {
    const { status, data } = await apiRequest('/users/me/profile', {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Success flag must be true');
    assert(typeof data.profileCompletion === 'number', 'Profile completion must be a number');
    assert(typeof data.stats.totalEventsAttended === 'number', 'Total events attended must be a number');
    assert(typeof data.stats.upcomingBookings === 'number', 'Upcoming bookings must be a number');
    assert(typeof data.stats.joinedCommunities === 'number', 'Joined communities must be a number');
    assert(Array.isArray(data.upcomingPasses), 'Upcoming passes must be an array');
    assert(Array.isArray(data.eventHistory), 'Event history must be an array');
    assert(Array.isArray(data.joinedCommunities), 'Joined communities must be an array');
    assert(Array.isArray(data.passportStamps), 'Passport stamps must be an array');
    assert(Array.isArray(data.achievements), 'Achievements must be an array');
  });

  await test('PUT /api/users/me/profile updates bio, city, phone, interests, and privacy', async () => {
    const updateRes = await apiRequest('/users/me/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${memberToken}` },
      body: {
        display_name: 'Ananya S.',
        bio: 'Tech lead & cricket enthusiast exploring weekend mixer events.',
        city: 'Hyderabad',
        phone: '+91 98765 43210',
        interests: ['Cricket & Live Sports', 'Coffee & Conversations', 'Board Games & Trivia'],
        is_public: true,
        privacy_settings: {
          showCommunities: true,
          showAchievements: true,
          showStamps: true,
          showCity: true,
        },
      },
    });
    assert(updateRes.status === 200, `Expected 200, got ${updateRes.status}`);
    assert(updateRes.data.user.display_name === 'Ananya S.', 'Display name must be updated');
    assert(updateRes.data.user.bio.includes('cricket enthusiast'), 'Bio must be updated');
    assert(updateRes.data.user.city === 'Hyderabad', 'City must be Hyderabad');
    assert(updateRes.data.profileCompletion >= 70, `Completion should be >= 70%, got ${updateRes.data.profileCompletion}%`);
  });

  await test('POST /api/users/me/change-password validates current and updates password', async () => {
    // 1. Wrong current password fails
    const failRes = await apiRequest('/users/me/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}` },
      body: {
        currentPassword: 'WrongPassword',
        newPassword: 'NewSecurePassword@123',
      },
    });
    assert(failRes.status === 400, `Expected 400 for wrong password, got ${failRes.status}`);

    // 2. Correct current password succeeds
    const successRes = await apiRequest('/users/me/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}` },
      body: {
        currentPassword: 'Password@123',
        newPassword: 'NewSecurePassword@123',
      },
    });
    assert(successRes.status === 200, `Expected 200, got ${successRes.status}`);

    // 3. Can login with new password
    const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(memberId) as any;
    const loginCheck = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: userRow.email, password: 'NewSecurePassword@123' },
    });
    assert(loginCheck.status === 200, 'Must be able to login with new password');
    memberToken = loginCheck.data.token;
  });

  await test('GET /api/users/me/passport returns verified identity card and achievement rules', async () => {
    const { status, data } = await apiRequest('/users/me/passport', {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Passport success must be true');
    assert(!!data.passport.card.memberId, 'Passport must have memberId');
    assert(data.passport.card.homeCity === 'Hyderabad', 'Home city must match profile city');
    assert(Array.isArray(data.passport.achievements), 'Achievements catalog must be returned');
    assert(data.passport.achievements.length >= 7, 'Must have at least 7 master achievements');
  });

  await test('Event booking, door check-in, stamp issuance and achievement evaluation', async () => {
    // 1. Register for an event
    const regRes = await apiRequest('/events/evt_hyd_auction_01/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}` },
      body: { seat_tier: 'General', attendee_name: 'Ananya S.' },
    });
    assert(regRes.status === 200 || regRes.status === 201, `Expected 200 or 201 for registration, got ${regRes.status}`);
    memberPassCode = regRes.data.pass.pass_code;
    memberPassId = regRes.data.pass.id;
    assert(!!memberPassCode, 'Pass code must be generated');

    // 2. Door check-in execution (Admin checks in the attendee)
    const checkinRes = await apiRequest('/passes/check-in', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { pass_code: memberPassCode },
    });
    assert(checkinRes.status === 200, `Expected 200 on check-in, got ${checkinRes.status}`);
    assert(checkinRes.data.stampIssued === true, 'Passport stamp must be issued on door check-in');

    // 3. Verify stamp exists in passport
    const stamp = db.prepare('SELECT * FROM passport_stamps WHERE user_id = ? AND event_id = ?').get(memberId, 'evt_hyd_auction_01') as any;
    assert(!!stamp, 'Passport stamp record must exist in database');
    assert(stamp.category.toLowerCase().includes('cricket') || stamp.category.toLowerCase().includes('auction'), 'Stamp category must be cricket/auction');

    // 4. Verify First Experience achievement was unlocked automatically
    const ach = db.prepare("SELECT * FROM user_achievements WHERE user_id = ? AND badge_key = 'FIRST_EXPERIENCE'").get(memberId) as any;
    assert(!!ach, 'FIRST_EXPERIENCE achievement should be automatically unlocked after 1st event check-in');
  });

  await test('GET /api/users/me/notifications returns check-in notification and supports read tracking', async () => {
    const { status, data } = await apiRequest('/users/me/notifications', {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Success must be true');
    assert(Array.isArray(data.notifications) && data.notifications.length >= 1, 'Should have at least 1 notification from check-in');
    assert(data.unreadCount >= 1, 'Unread count should be >= 1');
    notificationId = data.notifications[0].id;

    // Mark single notification as read
    const readRes = await apiRequest(`/users/me/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(readRes.status === 200, `Expected 200 on mark read, got ${readRes.status}`);

    // Mark all as read
    const markAllRes = await apiRequest('/users/me/notifications/mark-all-read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(markAllRes.status === 200, `Expected 200 on mark all read, got ${markAllRes.status}`);

    const verifyRes = await apiRequest('/users/me/notifications', {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(verifyRes.data.unreadCount === 0, 'Unread count must now be 0');
  });

  await test('Pass cancellation decrements event seat count and updates pass status', async () => {
    // 1. Register for Pune event
    const regRes = await apiRequest('/events/evt_pune_draft_02/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}` },
      body: { seat_tier: 'General', attendee_name: 'Ananya S.' },
    });
    assert(regRes.status === 200 || regRes.status === 201, `Expected 200 or 201, got ${regRes.status}`);
    cancelPassId = regRes.data.pass.id;

    const eventBefore = db.prepare('SELECT seats_booked FROM events WHERE id = ?').get('evt_pune_draft_02') as any;

    // 2. Cancel the pass
    const cancelRes = await apiRequest(`/passes/${cancelPassId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(cancelRes.status === 200, `Expected 200 on pass cancellation, got ${cancelRes.status}`);

    const eventAfter = db.prepare('SELECT seats_booked FROM events WHERE id = ?').get('evt_pune_draft_02') as any;
    assert(eventAfter.seats_booked === eventBefore.seats_booked - 1, 'Event seats_booked must decrement by 1');

    const passRow = db.prepare('SELECT checkin_status FROM event_registrations WHERE id = ?').get(cancelPassId) as any;
    assert(passRow.checkin_status === 'cancelled', 'Pass status must be cancelled');
  });

  await test('Public member profile enforcement and privacy lockout', async () => {
    const userRow = db.prepare('SELECT member_id FROM users WHERE id = ?').get(memberId) as any;
    const pubMemberId = userRow.member_id;

    // 1. Public profile returns masked public info
    const pubRes = await apiRequest(`/users/public/${pubMemberId}`);
    assert(pubRes.status === 200, `Expected 200, got ${pubRes.status}`);
    assert(pubRes.data.profile.displayName === 'Ananya S.', 'Public display name must match');
    assert(pubRes.data.profile.city === 'Hyderabad', 'City should be visible');
    assert(pubRes.data.profile.email === undefined, 'Private email must not be exposed');
    assert(pubRes.data.profile.phone === undefined, 'Private phone must not be exposed');

    // 2. Set profile to private
    await apiRequest('/users/me/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${memberToken}` },
      body: { is_public: false },
    });

    // 3. Public request now returns 403 / isPrivate
    const privateRes = await apiRequest(`/users/public/${pubMemberId}`);
    assert(privateRes.status === 403, `Expected 403 for private profile, got ${privateRes.status}`);
    assert(privateRes.data.isPrivate === true, 'isPrivate must be true');
  });

  await test('Admin member directory, detailed inspection, and manual badge award', async () => {
    // 1. Admin searches for the member
    const searchRes = await apiRequest(`/users/admin/members?search=Ananya`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(searchRes.status === 200, `Expected 200, got ${searchRes.status}`);
    assert(searchRes.data.members.length >= 1, 'Should find at least 1 member matching Ananya');

    // 2. Admin inspects member details
    const detailRes = await apiRequest(`/users/admin/members/${memberId}/details`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(detailRes.status === 200, `Expected 200, got ${detailRes.status}`);
    assert(detailRes.data.success === true, 'Detail success must be true');
    assert(detailRes.data.member.id === memberId, 'Member ID must match');
    assert(Array.isArray(detailRes.data.stamps) && detailRes.data.stamps.length >= 1, 'Stamps must be present');
    assert(Array.isArray(detailRes.data.registrations), 'Registrations must be present');
    assert(Array.isArray(detailRes.data.achievements), 'Achievements must be present');
    assert(Array.isArray(detailRes.data.activity), 'Activity logs must be present');

    // 3. Admin manually awards PIONEER_MEMBER badge
    const awardRes = await apiRequest(`/users/admin/members/${memberId}/award-achievement`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { badge_key: 'PIONEER_MEMBER' },
    });
    assert(awardRes.status === 200, `Expected 200 on manual badge award, got ${awardRes.status}`);
    assert(awardRes.data.success === true, 'Award success must be true');

    // Verify badge exists in DB
    const awardedBadge = db.prepare("SELECT * FROM user_achievements WHERE user_id = ? AND badge_key = 'PIONEER_MEMBER'").get(memberId) as any;
    assert(!!awardedBadge, 'PIONEER_MEMBER badge must be recorded in user_achievements');
  });

  // --- SUITE 13: COMPLETE BUSINESS PARTNER EXPERIENCE (PHASE 5) ---
  console.log('\n--- SUITE 13: COMPLETE BUSINESS PARTNER EXPERIENCE (PHASE 5) ---');

  let newPartnerOwnerToken = '';
  let newPartnerId = '';
  let newVenueId = '';
  let collabId = '';
  let createdCampaignId = '';
  const uniqueCouponCode = `BREW${Date.now().toString().slice(-6)}`;
  const expiredCouponCode = `OLD${Date.now().toString().slice(-6)}`;
  let hydPartnerToken = '';
  let punePartnerToken = '';

  await test('Partner onboarding draft saves progress without auto-verifying and submits for admin approval', async () => {
    const email = `partner_owner_${Date.now()}@stroom.club`;
    const reg = await apiRequest('/auth/register', {
      method: 'POST',
      body: { email, password: 'PartnerPassword@123', full_name: 'Kiran Rao' },
    });
    assert(reg.status === 201, `Expected 201, got ${reg.status}`);
    newPartnerOwnerToken = reg.data.token;

    // Step 1-4 Draft save
    const draftRes = await apiRequest('/partners/onboarding/save', {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: {
        business_name: 'Roastery Coffee Studio Banjara',
        category: 'Café & Restaurant',
        city: 'Hyderabad',
        address: 'Road No. 12, Banjara Hills, Hyderabad',
        description: 'Open-courtyard specialty coffee roastery ideal for weekend storytelling circles.',
        contact_person: 'Kiran Rao',
        contact_email: email,
        contact_phone: '+91 98491 55555',
        capacity: 55,
        facilities: ['High-Speed Wi-Fi', 'Acoustic Mic Setup'],
        collaboration_interests: ['Café meetups', 'Host community events'],
        onboarding_step: 4,
      },
    });
    assert(draftRes.status === 201, `Expected 201 on draft save, got ${draftRes.status}`);
    assert(draftRes.data.partner.verification_status === 'Draft', 'Draft must not be auto-verified');
    newPartnerId = draftRes.data.partner.id;

    // Submit for admin verification
    const subRes = await apiRequest('/partners/onboarding/submit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { partner_id: newPartnerId },
    });
    assert(subRes.status === 200, `Expected 200 on submit, got ${subRes.status}`);
    assert(subRes.data.partner.verification_status === 'Submitted', 'Status must transition to Submitted');
  });

  await test('Regular user cannot access admin verification endpoints and cross-partner isolation is enforced', async () => {
    // Non-admin partner tries to verify themselves -> 403
    const selfVerify = await apiRequest(`/partners/admin/${newPartnerId}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { status: 'Verified' },
    });
    assert(selfVerify.status === 403, `Self-verification must fail with 403, got ${selfVerify.status}`);

    // Login as Hyderabad Partner and Pune Partner
    const hydLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'partner@stroom.app', password: 'Partner@123' },
    });
    assert(hydLogin.status === 200, 'Seeded Hyderabad partner login must succeed');
    hydPartnerToken = hydLogin.data.token;

    const puneLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'partner.pune@stroom.app', password: 'Partner@123' },
    });
    assert(puneLogin.status === 200, 'Seeded Pune partner login must succeed');
    punePartnerToken = puneLogin.data.token;

    // Cross-partner isolation check: Pune partner tries to read Hyderabad partner dashboard -> 403
    const crossRead = await apiRequest('/partners/accounts/ptr_thirdwave_hyd/dashboard', {
      headers: { Authorization: `Bearer ${punePartnerToken}` },
    });
    assert(crossRead.status === 403, `Cross-partner dashboard access must return 403, got ${crossRead.status}`);
  });

  await test('Admin verifies submitted partner, unlocking verified venue & profile management', async () => {
    const verifyRes = await apiRequest(`/partners/admin/${newPartnerId}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: 'Verified',
        notes: 'Verified site visit & hospitality partnership.',
        partnership_tier: 'Gold Venue Partner',
      },
    });
    assert(verifyRes.status === 200, `Expected 200 on admin verify, got ${verifyRes.status}`);
    assert(verifyRes.data.partner.verification_status === 'Verified', 'Status must be Verified');
    assert(!!verifyRes.data.partner.partnership_start_date, 'Partnership start date must be set');

    // Partner updates business profile
    const profRes = await apiRequest(`/partners/accounts/${newPartnerId}/profile`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { website: 'https://roasterycoffee.co.in', capacity: 65 },
    });
    assert(profRes.status === 200, `Expected 200 on profile update, got ${profRes.status}`);
    assert(profRes.data.partner.capacity === 65, 'Updated capacity must persist');
  });

  await test('Venue creation, availability calendar & double-booking prevention', async () => {
    // 1. Add a new venue under partner
    const venRes = await apiRequest(`/partners/accounts/${newPartnerId}/venues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: {
        name: 'Roastery Courtyard Deck',
        city: 'Hyderabad',
        area: 'Banjara Hills',
        address: 'Road No. 12, Banjara Hills',
        partner_type: 'cafe',
        capacity: 60,
        facilities: ['Wi-Fi', 'Projector'],
        event_spaces: ['Courtyard Lawn (60 pax)'],
      },
    });
    assert(venRes.status === 201, `Expected 201 creating venue, got ${venRes.status}`);
    newVenueId = venRes.data.venue.id;

    // 2. Partner marks Dec 19 available
    const availRes = await apiRequest(`/partners/accounts/${newPartnerId}/venues/${newVenueId}/availability`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { date: '2026-12-19', time_slot: 'evening', status: 'available', notes: 'Open for meetup' },
    });
    assert(availRes.status === 200, `Expected 200 setting availability, got ${availRes.status}`);

    // 3. Partner blocks Dec 20 as unavailable -> Admin proposal on Dec 20 must be blocked with 409
    await apiRequest(`/partners/accounts/${newPartnerId}/venues/${newVenueId}/availability`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { date: '2026-12-20', time_slot: 'evening', status: 'unavailable', notes: 'Private family booking' },
    });
    const blockedProp = await apiRequest('/partners/admin/collaborations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        partner_id: newPartnerId,
        venue_id: newVenueId,
        event_name: 'Blocked Date Test Mixer',
        proposed_date: '2026-12-20',
      },
    });
    assert(blockedProp.status === 409, `Proposing over unavailable slot must return 409, got ${blockedProp.status}`);
  });

  await test('End-to-end event collaboration workflow: propose -> suggest date -> accept -> confirm -> published event', async () => {
    // 1. Admin proposes collaboration on available date Dec 19
    const propRes = await apiRequest('/partners/admin/collaborations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        partner_id: newPartnerId,
        venue_id: newVenueId,
        event_name: 'Banjara Hills Acoustic Coffee & Founders Night',
        event_category: 'cafe_meetup',
        description: 'Interactive evening networking and acoustic coffee session.',
        proposed_date: '2026-12-19',
        proposed_time: '6:30 PM IST',
        expected_attendance: 50,
      },
    });
    assert(propRes.status === 201, `Expected 201 proposing collab, got ${propRes.status}`);
    assert(propRes.data.collaboration.status === 'Proposal Sent', 'Initial status must be Proposal Sent');
    collabId = propRes.data.collaboration.id;

    // 2. Partner tries to block Dec 19 while proposed -> rejected with 409 double-booking protection
    const conflictBlock = await apiRequest(`/partners/accounts/${newPartnerId}/venues/${newVenueId}/availability`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { date: '2026-12-19', time_slot: 'evening', status: 'unavailable' },
    });
    assert(conflictBlock.status === 409, `Blocking over proposed collab date must fail with 409, got ${conflictBlock.status}`);

    // 3. Partner suggests alternate time/comment then accepts
    const suggestRes = await apiRequest(`/partners/accounts/${newPartnerId}/collaborations/${collabId}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { action: 'suggest_date', suggested_date: '2026-12-19', suggested_time: '7:00 PM IST', message: '7 PM works better after evening rush.' },
    });
    assert(suggestRes.status === 200, `Expected 200 on suggest_date, got ${suggestRes.status}`);
    assert(suggestRes.data.collaboration.status === 'Negotiation', 'Status must move to Negotiation');

    const acceptRes = await apiRequest(`/partners/accounts/${newPartnerId}/collaborations/${collabId}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { action: 'accept', message: 'Accepted terms and schedule.' },
    });
    assert(acceptRes.status === 200, `Expected 200 on accept, got ${acceptRes.status}`);
    assert(acceptRes.data.collaboration.status === 'Approved', 'Status must move to Approved');

    // 4. Admin confirms collaboration -> creates published event & books slot
    const confirmRes = await apiRequest(`/partners/admin/collaborations/${collabId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(confirmRes.status === 200, `Expected 200 on admin confirm, got ${confirmRes.status}`);
    assert(confirmRes.data.collaboration.status === 'Scheduled', 'Collab status must be Scheduled');
    assert(!!confirmRes.data.eventId, 'Confirmed collaboration must create a real eventId');

    // 5. Event appears in partner hosted events and operational notes can be updated
    const evList = await apiRequest(`/partners/accounts/${newPartnerId}/events`, {
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
    });
    assert(evList.status === 200 && evList.data.events.length >= 1, 'Confirmed event must appear in partner events');
    const opsRes = await apiRequest(`/partners/accounts/${newPartnerId}/events/${confirmRes.data.eventId}/operations`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { partner_operational_notes: 'Ask for reception staff Kiran upon arrival at 6:15 PM.' },
    });
    assert(opsRes.status === 200, 'Partner must be able to save authorized operational notes');
  });

  await test('Promotional campaign approval gate, QR coupon verification, duplicate & expired rejection', async () => {
    // 1. Partner creates campaign submitted for approval -> must NOT be Active yet
    const campRes = await apiRequest(`/partners/accounts/${newPartnerId}/campaigns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: {
        venue_id: newVenueId,
        code: uniqueCouponCode,
        title: '25% Off Pour-Over Flights',
        description: 'Exclusive STROOM member coffee flight discount',
        offer_category: 'percentage',
        discount_value: '25%',
        min_purchase: 300,
        valid_until: '2027-12-31',
        max_redemptions: 100,
        submit_for_approval: true,
      },
    });
    assert(campRes.status === 201, `Expected 201 creating campaign, got ${campRes.status}`);
    assert(campRes.data.campaign.approval_status === 'Submitted', 'Submitted campaign must wait for admin approval');
    createdCampaignId = campRes.data.campaign.id;

    // 2. Attempting to redeem unapproved campaign must fail
    const unapprovedRedeem = await apiRequest('/partners/coupons/redeem', {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { coupon_code: uniqueCouponCode, order_amount: 500 },
    });
    assert(unapprovedRedeem.status === 400, `Unapproved campaign must not be redeemable, got ${unapprovedRedeem.status}`);

    // 3. Admin approves and activates campaign
    const reviewRes = await apiRequest(`/partners/admin/campaigns/${createdCampaignId}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { decision: 'approve', notes: 'Approved for Banjara Hills launch' },
    });
    assert(reviewRes.status === 200, `Expected 200 approving campaign, got ${reviewRes.status}`);
    assert(reviewRes.data.campaign.approval_status === 'Active', 'Approved campaign must become Active');

    // 4. Pre-flight verify checks offer without redeeming
    const verifyRes = await apiRequest('/partners/coupons/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { coupon_code: uniqueCouponCode, venue_id: newVenueId, pass_code: 'STR-HYD-9001', order_amount: 500 },
    });
    assert(verifyRes.status === 200 && verifyRes.data.valid === true, 'Pre-flight verification must succeed');
    const countBeforeRedeem = (db.prepare('SELECT actual_redemptions FROM coupons WHERE id = ?').get(createdCampaignId) as any).actual_redemptions;
    assert(countBeforeRedeem === 0, 'Pre-flight verify must NOT increment redemption count');

    // 5. Cross-partner redemption check: Pune partner tries to redeem this Hyderabad partner coupon -> 403
    const crossRedeem = await apiRequest('/partners/coupons/redeem', {
      method: 'POST',
      headers: { Authorization: `Bearer ${punePartnerToken}` },
      body: { coupon_code: uniqueCouponCode, pass_code: 'STR-HYD-9001', order_amount: 500 },
    });
    assert(crossRedeem.status === 403, `Cross-partner coupon redemption must fail with 403, got ${crossRedeem.status}`);

    // 6. Authorized partner redeems coupon with pass_code and verified purchase
    const redeemRes = await apiRequest('/partners/coupons/redeem', {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { coupon_code: uniqueCouponCode, venue_id: newVenueId, pass_code: 'STR-HYD-9001', order_amount: 540 },
    });
    assert(redeemRes.status === 200, `Expected 200 redeeming coupon, got ${redeemRes.status}`);
    assert(redeemRes.data.result.purchaseVerified === true, 'Purchase must be marked verified');

    // 7. Duplicate redemption with same pass_code is blocked
    const dupRes = await apiRequest('/partners/coupons/redeem', {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { coupon_code: uniqueCouponCode, venue_id: newVenueId, pass_code: 'STR-HYD-9001', order_amount: 540 },
    });
    assert(dupRes.status === 400, `Duplicate redemption for same pass must fail, got ${dupRes.status}`);

    // 8. Expired coupon is rejected
    db.prepare(`
      INSERT INTO coupons (id, venue_id, partner_id, code, title, description, discount_type, discount_value, status, approval_status, valid_until)
      VALUES (?, ?, ?, ?, 'Expired Offer', 'Old promo', 'percentage', '10%', 'active', 'Active', '2020-01-01')
    `).run('cpn_exp_' + Date.now(), newVenueId, newPartnerId, expiredCouponCode);
    const expRes = await apiRequest('/partners/coupons/redeem', {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { coupon_code: expiredCouponCode },
    });
    assert(expRes.status === 400 && expRes.data.error.includes('Expired'), 'Expired coupon must be rejected');
  });

  await test('Partner analytics strictly separates metrics, exports authentic CSVs, and manages communications', async () => {
    const analyticsRes = await apiRequest(`/partners/accounts/${newPartnerId}/analytics?range=30d`, {
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
    });
    assert(analyticsRes.status === 200, `Expected 200 on analytics, got ${analyticsRes.status}`);
    assert(analyticsRes.data.summary.couponRedemptions === 1, 'Should reflect exactly 1 verified redemption');
    assert(analyticsRes.data.summary.verifiedPurchaseTotal === 540, 'Should reflect verified purchase total ₹540');
    assert(analyticsRes.data.summary.actualVerifiedCheckins === 0, 'Must not fake check-ins');

    // Export CSV
    const csvRes = await apiRequest(`/partners/accounts/${newPartnerId}/reports/export?type=redemptions`, {
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
    });
    assert(csvRes.status === 200, `Expected 200 on CSV export, got ${csvRes.status}`);
    assert(csvRes.data.csv.includes(uniqueCouponCode), 'Exported CSV must contain verified redemption code');

    // Communications send & read
    const msgRes = await apiRequest(`/partners/accounts/${newPartnerId}/communications`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
      body: { subject: 'AV Setup Question', message: 'Do you need extra wireless mics?' },
    });
    assert(msgRes.status === 201, `Expected 201 sending communication, got ${msgRes.status}`);
    const listMsgs = await apiRequest(`/partners/accounts/${newPartnerId}/communications`, {
      headers: { Authorization: `Bearer ${newPartnerOwnerToken}` },
    });
    assert(listMsgs.status === 200 && listMsgs.data.communications.length >= 1, 'Communications list must include message');
  });

  // --- SUITE 14: CENTRALIZED ADMIN CONTROL CENTER & GRANULAR RBAC (PHASE 6) ---
  console.log('\n--- SUITE 14: CENTRALIZED ADMIN CONTROL CENTER & GRANULAR RBAC (PHASE 6) ---');

  let superAdminToken = '';
  let eventMgrToken = '';
  let checkinStaffToken = '';
  let phase6MemberToken = '';
  let phase6MemberId = '';
  let phase6EventId = '';
  let phase6DupEventId = '';
  let phase6PassCode = '';
  let phase6RegId = '';

  await test('Granular RBAC login scoping and backend permission enforcement', async () => {
    const saLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'superadmin@stroom.app', password: 'Admin@123' },
    });
    assert(saLogin.status === 200, `Expected 200 for superadmin login, got ${saLogin.status}`);
    superAdminToken = saLogin.data.token;

    const emLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'events@stroom.app', password: 'Staff@123' },
    });
    assert(emLogin.status === 200, `Expected 200 for event_manager login, got ${emLogin.status}`);
    eventMgrToken = emLogin.data.token;

    const csLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'checkin@stroom.app', password: 'Staff@123' },
    });
    assert(csLogin.status === 200, `Expected 200 for checkin_staff login, got ${csLogin.status}`);
    checkinStaffToken = csLogin.data.token;

    const saPerms = await apiRequest('/admin/me/permissions', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(saPerms.status === 200 && saPerms.data.allowedSections.includes('settings') && saPerms.data.allowedSections.includes('audit_logs'), 'Super Admin must see settings and audit_logs');

    const csPerms = await apiRequest('/admin/me/permissions', {
      headers: { Authorization: `Bearer ${checkinStaffToken}` },
    });
    assert(csPerms.status === 200 && csPerms.data.allowedSections.includes('checkin') && !csPerms.data.allowedSections.includes('settings'), 'Checkin staff must only have checkin/events/overview sections');

    // Regular member must be denied admin endpoints
    const memberDeny = await apiRequest('/admin/me/permissions', {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(memberDeny.status === 403, `Regular member must get 403 on admin permissions, got ${memberDeny.status}`);

    // Checkin staff cannot read settings or payments or create events
    const csSettings = await apiRequest('/admin/settings', {
      headers: { Authorization: `Bearer ${checkinStaffToken}` },
    });
    assert(csSettings.status === 403, `Checkin staff must get 403 on settings, got ${csSettings.status}`);

    // Event manager cannot assign roles or view payments
    const emPayments = await apiRequest('/admin/payments', {
      headers: { Authorization: `Bearer ${eventMgrToken}` },
    });
    assert(emPayments.status === 403, `Event manager must get 403 on payments, got ${emPayments.status}`);
  });

  await test('Privilege escalation prevention & suspended account lockout enforcement', async () => {
    const testEmail = `rbac_target_${Date.now()}@stroom.club`;
    const reg = await apiRequest('/auth/register', {
      method: 'POST',
      body: { email: testEmail, password: 'TestPassword@123', full_name: 'RBAC Target User' },
    });
    assert(reg.status === 201, `Expected 201 registering test user, got ${reg.status}`);
    phase6MemberToken = reg.data.token;
    phase6MemberId = reg.data.user.id;

    // Non-super-admin trying to assign super_admin -> 403
    const escAttempt = await apiRequest(`/admin/members/${phase6MemberId}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${eventMgrToken}` },
      body: { role: 'super_admin' },
    });
    assert(escAttempt.status === 403, `Expected 403 on privilege escalation attempt, got ${escAttempt.status}`);

    // Even standard admin (demo admin@stroom.app) cannot assign super_admin
    const adminRow = db.prepare('SELECT id, role FROM users WHERE email = ?').get('admin@stroom.app') as any;
    if (adminRow && adminRow.role === 'admin') {
      const adminEsc = await apiRequest(`/admin/members/${phase6MemberId}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { role: 'super_admin' },
      });
      assert(adminEsc.status === 403, `Non-super-admin must get 403 assigning super_admin, got ${adminEsc.status}`);
    }

    // Super Admin promotes to support_staff then back to participant
    const promoteRes = await apiRequest(`/admin/members/${phase6MemberId}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { role: 'support_staff' },
    });
    assert(promoteRes.status === 200 && promoteRes.data.role === 'support_staff', 'Super Admin should be able to assign support_staff');

    await apiRequest(`/admin/members/${phase6MemberId}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { role: 'participant' },
    });

    // Suspend user and verify login + API rejection
    const suspRes = await apiRequest(`/admin/members/${phase6MemberId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { account_status: 'suspended', reason: 'Suite 14 suspension verification' },
    });
    assert(suspRes.status === 200 && suspRes.data.account_status === 'suspended', 'Account must be marked suspended');

    const blockedMe = await apiRequest('/auth/me', {
      headers: { Authorization: `Bearer ${phase6MemberToken}` },
    });
    assert(blockedMe.status === 403, `Suspended token must be blocked with 403, got ${blockedMe.status}`);

    const blockedLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'TestPassword@123' },
    });
    assert(blockedLogin.status === 403, `Suspended user login must fail with 403, got ${blockedLogin.status}`);

    // Reactivate user for check-in tests below
    const reactRes = await apiRequest(`/admin/members/${phase6MemberId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { account_status: 'active', reason: 'Restored after RBAC test' },
    });
    assert(reactRes.status === 200 && reactRes.data.account_status === 'active', 'Account reactivation must succeed');
  });

  await test('Centralized Admin Overview, Global Search, Events CRUD/Duplicate & Cities Management', async () => {
    const ov = await apiRequest('/admin/dashboard-overview', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(ov.status === 200 && ov.data.metrics.totalMembers >= 1, 'Dashboard overview must return live member count');

    const gs = await apiRequest('/admin/global-search?q=Hyderabad', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(gs.status === 200 && gs.data.results, 'Global search must return structured results');

    // Create event as Event Manager
    const createEv = await apiRequest('/admin/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${eventMgrToken}` },
      body: {
        title: `Phase 6 Ops Mixer ${Date.now()}`,
        city_id: 'city_hyd',
        venue_id: 'ven_hyd_thirdwave',
        category: 'social',
        event_date: '2026-12-20',
        event_time: '19:00',
        seats_total: 40,
        status: 'published',
      },
    });
    assert(createEv.status === 201 && createEv.data.event.id, `Expected 201 creating event, got ${createEv.status}`);
    phase6EventId = createEv.data.event.id;

    // Duplicate event
    const dupEv = await apiRequest(`/admin/events/${phase6EventId}/duplicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${eventMgrToken}` },
    });
    assert(dupEv.status === 201 && dupEv.data.event.status === 'draft', 'Duplicated event must start in draft status');
    phase6DupEventId = dupEv.data.event.id;

    // Cities creation & update by Super Admin
    const newCityRes = await apiRequest('/admin/cities', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { name: `Bengaluru Test ${Date.now().toString().slice(-4)}`, state: 'Karnataka', status: 'coming_soon', is_featured: false },
    });
    assert(newCityRes.status === 201 && newCityRes.data.city.id, 'City creation must succeed');
  });

  await test('Communities Management & Feed Moderation workflow', async () => {
    const createComm = await apiRequest('/admin/communities', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: {
        name: `Hyd Boardgame Collective ${Date.now().toString().slice(-4)}`,
        city_id: 'city_hyd',
        category: 'Gaming',
        description: 'Weekly boardgame meetups',
      },
    });
    assert(createComm.status === 201 && createComm.data.community.id, 'Community creation must succeed');

    const postsRes = await apiRequest('/admin/moderation/posts', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(postsRes.status === 200 && postsRes.data.posts.length >= 1, 'Moderation queue should return seeded community posts');

    const targetPostId = postsRes.data.posts[0].id;
    const modAction = await apiRequest(`/admin/moderation/posts/${targetPostId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { status: 'Under Review', moderation_notes: 'Reviewed in Suite 14' },
    });
    assert(modAction.status === 200 && modAction.data.post.status === 'Under Review', 'Post moderation status must update');
  });

  await test('Door Check-in Terminal: Wrong-Event Mismatch, Valid Scan, Duplicate Rejection & Audited Override', async () => {
    // Register phase6Member for phase6EventId
    const regEv = await apiRequest(`/events/${phase6EventId}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${phase6MemberToken}` },
      body: { seat_tier: 'General', attendee_name: 'RBAC Target User' },
    });
    assert(regEv.status === 200 || regEv.status === 201, `Expected pass registration success, got ${regEv.status}`);
    phase6PassCode = regEv.data.pass.pass_code;
    phase6RegId = regEv.data.pass.id;

    // 1. Event mismatch test (pass belongs to phase6EventId, but door staff selected evt_hyd_auction_01)
    const mismatchRes = await apiRequest('/admin/checkin/scan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${checkinStaffToken}` },
      body: { code: phase6PassCode, event_id: 'evt_hyd_auction_01' },
    });
    assert(mismatchRes.status === 409 && mismatchRes.data.verificationStatus === 'Event Mismatch', `Expected 409 Event Mismatch, got ${mismatchRes.status}`);

    // 2. Valid scan on matching event
    const validScan = await apiRequest('/admin/checkin/scan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${checkinStaffToken}` },
      body: { code: phase6PassCode, event_id: phase6EventId },
    });
    assert(validScan.status === 200 && validScan.data.verificationStatus === 'Valid', `Expected 200 Valid scan, got ${validScan.status}`);

    // 3. Duplicate scan rejection
    const dupScan = await apiRequest('/admin/checkin/scan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${checkinStaffToken}` },
      body: { code: phase6PassCode, event_id: phase6EventId },
    });
    assert(dupScan.status === 409 && dupScan.data.verificationStatus === 'Already Checked In', `Expected 409 Already Checked In, got ${dupScan.status}`);

    // 4. checkin_staff lacks checkin.override permission -> 403
    const unauthOverride = await apiRequest('/admin/checkin/override', {
      method: 'POST',
      headers: { Authorization: `Bearer ${checkinStaffToken}` },
      body: { registration_id: phase6RegId, new_status: 'confirmed', reason: 'Attempt without perm' },
    });
    assert(unauthOverride.status === 403, `Expected 403 for checkin_staff override, got ${unauthOverride.status}`);

    // 5. Super Admin audited override succeeds
    const saOverride = await apiRequest('/admin/checkin/override', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { registration_id: phase6RegId, new_status: 'confirmed', reason: 'Suite 14 audited revert' },
    });
    assert(saOverride.status === 200 && saOverride.data.success === true, 'Super Admin override must succeed');
  });

  await test('Notifications Broadcast, Honest Payments Ledger, Settings Update, CSV Export & Immutable Audit Logs', async () => {
    const bcast = await apiRequest('/admin/notifications/broadcast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: {
        title: `Suite 14 Ops Update ${Date.now()}`,
        message: 'Check-in gates open 30 minutes prior.',
        target_audience: 'all_members',
        category: 'system',
      },
    });
    assert(bcast.status === 201 && bcast.data.deliveredCount >= 1, 'Announcement broadcast must deliver to active members');

    const payRes = await apiRequest('/admin/payments', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(payRes.status === 200 && payRes.data.gatewayConfigured === false, 'Payments endpoint must honestly report gatewayConfigured: false');

    const settingsGet = await apiRequest('/admin/settings', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(settingsGet.status === 200 && settingsGet.data.settings.general, 'Settings GET must return seeded categories');

    const updatedGeneral = { ...settingsGet.data.settings.general.value, defaultCity: 'Hyderabad' };
    const settingsPut = await apiRequest('/admin/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { key: 'general', value: updatedGeneral },
    });
    assert(settingsPut.status === 200 && settingsPut.data.success === true, 'Settings PUT must succeed');

    const csvRes = await apiRequest('/admin/reports/export?type=events', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(csvRes.status === 200 && csvRes.data.csv.includes('Event ID,Title'), 'CSV report export must return real header + rows');

    const analyticsRes = await apiRequest('/admin/analytics?range=30d', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(analyticsRes.status === 200 && Array.isArray(analyticsRes.data.cityActivity), 'Analytics must return cityActivity');

    // Audit Logs must record actions and reject tampering
    const auditGet = await apiRequest('/admin/audit-logs?action=PRIVILEGE_ESCALATION_BLOCKED', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(auditGet.status === 200 && auditGet.data.logs.length >= 1, 'Audit log must record blocked privilege escalation attempt');

    const tamperDelete = await apiRequest('/admin/audit-logs/any', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(tamperDelete.status === 403, `Deleting audit logs must be blocked with 403, got ${tamperDelete.status}`);
  });

  await test('Safe Event Deletion & Data Safety: dependencies, FK RESTRICT, payments/attendance preservation, idempotency, DB rollback & audit trail', async () => {
    // 1. Unauthorized direct API deletion attempts
    const unauthNoAuth = await apiRequest(`/admin/events/${phase6DupEventId}`, { method: 'DELETE' });
    assert(unauthNoAuth.status === 401, `Unauthenticated delete must return 401, got ${unauthNoAuth.status}`);

    const unauthMember = await apiRequest(`/admin/events/${phase6DupEventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${phase6MemberToken}` },
    });
    assert(unauthMember.status === 403, `Regular member delete must return 403, got ${unauthMember.status}`);

    const unauthStaff = await apiRequest(`/admin/events/${phase6DupEventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${checkinStaffToken}` },
    });
    assert(unauthStaff.status === 403, `checkin_staff delete must return 403, got ${unauthStaff.status}`);

    // 2. Unused event dependencies check & permanent deletion
    const depUnused = await apiRequest(`/admin/events/${phase6DupEventId}/dependencies`, {
      headers: { Authorization: `Bearer ${eventMgrToken}` },
    });
    assert(depUnused.status === 200 && depUnused.data.canDeletePermanently === true, 'Unused duplicate event must allow permanent deletion');

    const permDel = await apiRequest(`/admin/events/${phase6DupEventId}?mode=delete&reason=DuplicateCleanup`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${eventMgrToken}` },
    });
    assert(permDel.status === 200 && permDel.data.action === 'deleted', `Expected permanent deletion for unused event, got ${permDel.data.action}`);
    assert(!db.prepare('SELECT id FROM events WHERE id = ?').get(phase6DupEventId), 'Permanently deleted event must not exist in DB');

    // 3. Event with active registration: payment count authorization check + refusal of permanent delete + safe archive & idempotency
    const depRegEm = await apiRequest(`/admin/events/${phase6EventId}/dependencies`, {
      headers: { Authorization: `Bearer ${eventMgrToken}` },
    });
    assert(depRegEm.status === 200 && depRegEm.data.canDeletePermanently === false, 'Event with registration must forbid permanent delete');
    assert(depRegEm.data.paymentsAuthorized === false && depRegEm.data.dependencies.paymentsCount === null, 'event_manager without payments.view must not receive payment counts');

    const forceBlocked = await apiRequest(`/admin/events/${phase6EventId}?mode=delete`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(forceBlocked.status === 409, `Expected 409 refusing permanent delete on event with registrations, got ${forceBlocked.status}`);

    // Direct SQLite foreign-key RESTRICT check on event_registrations
    let fkBlockedReg = false;
    try {
      db.prepare('DELETE FROM events WHERE id = ?').run(phase6EventId);
    } catch {
      fkBlockedReg = true;
    }
    assert(fkBlockedReg, 'SQLite foreign key ON DELETE RESTRICT must physically prevent deleting an event with registrations');

    const regCountBefore = (db.prepare('SELECT COUNT(*) as c FROM event_registrations WHERE event_id = ?').get(phase6EventId) as any).c;
    const safeArchive = await apiRequest(`/admin/events/${phase6EventId}?mode=archive&reason=RetiredWithRegistrations`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${eventMgrToken}` },
    });
    assert(safeArchive.status === 200 && safeArchive.data.action === 'archived', `Expected safe archival, got ${safeArchive.data.action}`);
    assert(safeArchive.data.event.is_archived === 1 && safeArchive.data.event.status === 'cancelled', 'Safely archived event must have is_archived=1 and status=cancelled');

    const regCountAfter = (db.prepare('SELECT COUNT(*) as c FROM event_registrations WHERE event_id = ?').get(phase6EventId) as any).c;
    assert(regCountAfter === regCountBefore, 'Registration record count must remain unchanged after archival');

    // Idempotent repeat archive call
    const repeatArchive = await apiRequest(`/admin/events/${phase6EventId}?mode=archive`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${eventMgrToken}` },
    });
    assert(repeatArchive.status === 200 && repeatArchive.data.idempotent === true, 'Repeated archive request must be idempotent');

    // 4. Event with Payment, Refund & Verified Attendance Records (Passport Stamp + Check-in)
    const payEventRes = await apiRequest('/admin/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: {
        title: `Paid & Attended Safe Event ${Date.now()}`,
        city_id: 'city_hyd',
        venue_id: 'ven_hyd_thirdwave',
        category: 'cricket',
        event_date: '2026-12-22',
        event_time: '18:00',
        seats_total: 50,
        entry_fee: '₹499',
        status: 'published',
      },
    });
    assert(payEventRes.status === 201, 'Failed creating protected payment/attendance test event');
    const protectedEvtId = payEventRes.data.event.id;

    const bookRes = await apiRequest(`/events/${protectedEvtId}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${phase6MemberToken}` },
      body: { seat_tier: 'VIP', attendee_name: 'RBAC Target User' },
    });
    assert(bookRes.status === 200 || bookRes.status === 201, 'Registration for protected event must succeed');
    const protRegId = bookRes.data.pass.id;
    const protPassCode = bookRes.data.pass.pass_code;

    // Door check-in stamps attendance + passport_stamps
    const scanProt = await apiRequest('/admin/checkin/scan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${checkinStaffToken}` },
      body: { code: protPassCode, event_id: protectedEvtId },
    });
    assert(scanProt.status === 200 && scanProt.data.verificationStatus === 'Valid', 'Attendance check-in must succeed');

    // Insert real payment + partial refund record referencing protectedEvtId & protRegId
    const txId = `tx_safe_${Date.now()}`;
    db.prepare(`
      INSERT INTO payment_transactions (id, user_id, event_id, registration_id, reference_type, reference_id, amount, currency, provider, status, refund_amount, refund_reason)
      VALUES (?, ?, ?, ?, 'event_registration', ?, 499, 'INR', 'manual_desk', 'Partially Refunded', 100, 'Partial promo adjustment')
    `).run(txId, phase6MemberId, protectedEvtId, protRegId, protRegId);

    // Super admin sees authorized payment count + permanent deletion disabled
    const depProtSa = await apiRequest(`/admin/events/${protectedEvtId}/dependencies`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(depProtSa.status === 200 && depProtSa.data.paymentsAuthorized === true, 'Super Admin must see payment authorization');
    assert(depProtSa.data.dependencies.paymentsCount === 1 && depProtSa.data.dependencies.attendanceStamps === 1, 'Dependencies must count 1 payment and 1 stamp');
    assert(depProtSa.data.canDeletePermanently === false, 'Permanent delete must be disallowed with payment/attendance records');

    // Simulated DB failure rollback test via temporary trigger before cancelling
    db.exec(`CREATE TRIGGER trg_fail_event_update BEFORE UPDATE ON events WHEN NEW.id = '${protectedEvtId}' BEGIN SELECT RAISE(ABORT, 'SIMULATED_DB_FAILURE'); END;`);
    let cancelFailedRes;
    try {
      cancelFailedRes = await apiRequest(`/admin/events/${protectedEvtId}?mode=cancel`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
    } finally {
      db.exec('DROP TRIGGER IF EXISTS trg_fail_event_update');
    }
    assert(cancelFailedRes.status === 500, `Simulated DB trigger failure must return 500, got ${cancelFailedRes.status}`);
    const evtAfterFailure = db.prepare('SELECT status FROM events WHERE id = ?').get(protectedEvtId) as any;
    assert(evtAfterFailure.status === 'published', 'Failed transaction must leave event status untouched (published)');

    // Permanent delete must fail (409) & SQL FK RESTRICT must hold
    const permBlockedPay = await apiRequest(`/admin/events/${protectedEvtId}?mode=delete`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(permBlockedPay.status === 409, 'Permanent delete with payment & attendance records must fail with 409');

    // Safe Cancel Event preserves payments, refunds, registrations, check-in timestamps & passport stamps
    const safeCancelPay = await apiRequest(`/admin/events/${protectedEvtId}?mode=cancel&reason=WeatherCancellation`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(safeCancelPay.status === 200 && safeCancelPay.data.action === 'cancelled', 'Safe cancel with payments must succeed');

    const txStillIntact = db.prepare('SELECT id, event_id, registration_id, status, refund_amount FROM payment_transactions WHERE id = ?').get(txId) as any;
    assert(txStillIntact && txStillIntact.event_id === protectedEvtId && txStillIntact.refund_amount === 100 && txStillIntact.status === 'Partially Refunded', 'Payment, refund, and event FK must remain completely intact');

    const stampStillIntact = db.prepare('SELECT id, event_id, verified_at FROM passport_stamps WHERE user_id = ? AND event_id = ?').get(phase6MemberId, protectedEvtId) as any;
    const regStillIntact = db.prepare('SELECT checkin_status, checked_in_at FROM event_registrations WHERE id = ?').get(protRegId) as any;
    assert(!!stampStillIntact && regStillIntact.checkin_status === 'checked_in' && !!regStillIntact.checked_in_at, 'Attendance stamp and check-in history must remain completely intact');

    const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
    assert(Array.isArray(fkCheck) && fkCheck.length === 0, `Foreign key integrity check must return 0 violations, found ${fkCheck.length}`);

    // Verify Audit Logs recorded full lifecycle safely without secrets
    const auditDel = await apiRequest('/admin/audit-logs?action=EVENT_', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const actions = (auditDel.data.logs || []).map((l: any) => l.action);
    assert(
      actions.includes('EVENT_PERMANENTLY_DELETED') &&
      actions.includes('EVENT_SOFT_DELETED_ARCHIVED') &&
      actions.includes('EVENT_CANCELLED_SAFE') &&
      actions.includes('EVENT_PERMANENT_DELETE_BLOCKED'),
      'Audit log must record permanent delete, safe archive, safe cancel, and blocked deletion attempt'
    );
  });

  await test('Interactive Overview Analytics API: independent DB aggregate verification, empty datasets & date filters', async () => {
    // Unauthorized member gets 403
    const denyRes = await apiRequest('/admin/overview-analytics?range=30d', {
      headers: { Authorization: `Bearer ${phase6MemberToken}` },
    });
    assert(denyRes.status === 403, `Regular member must get 403 on overview-analytics, got ${denyRes.status}`);

    // Fetch 30d analytics and compare directly against independent SQLite queries
    const res30 = await apiRequest('/admin/overview-analytics?range=30d', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(res30.status === 200 && res30.data.success === true, `Expected 200 on overview-analytics, got ${res30.status}`);
    const ch = res30.data.charts;
    const { fromDate, toDate } = res30.data.period;

    const indEventsTotal = (db.prepare('SELECT COUNT(*) as c FROM events WHERE COALESCE(is_archived, 0) = 0 AND date(created_at) BETWEEN date(?) AND date(?)').get(fromDate, toDate) as any).c;
    const chartCatSum = ch.eventCategoryDistribution.reduce((s: number, r: any) => s + r.count, 0);
    assert(chartCatSum === indEventsTotal, `Category distribution sum (${chartCatSum}) must equal independent DB count (${indEventsTotal})`);

    const chartCitySum = ch.eventCityDistribution.reduce((s: number, r: any) => s + r.count, 0);
    assert(chartCitySum === indEventsTotal, `City distribution sum (${chartCitySum}) must equal independent DB count (${indEventsTotal})`);

    const indRegTotal = (db.prepare('SELECT COUNT(*) as c FROM event_registrations WHERE date(created_at) BETWEEN date(?) AND date(?)').get(fromDate, toDate) as any).c;
    const chartRegSum = ch.registrationStatusDistribution.reduce((s: number, r: any) => s + r.count, 0);
    assert(chartRegSum === indRegTotal, `Registration status sum (${chartRegSum}) must equal independent DB count (${indRegTotal})`);

    const indMemberTotal = (db.prepare('SELECT COUNT(*) as c FROM users WHERE date(created_at) BETWEEN date(?) AND date(?)').get(fromDate, toDate) as any).c;
    const chartMemSum = ch.memberGrowth.reduce((s: number, r: any) => s + r.count, 0);
    assert(chartMemSum === indMemberTotal, `Member growth sum (${chartMemSum}) must equal independent DB count (${indMemberTotal})`);

    const catPctSum = ch.eventCategoryDistribution.reduce((s: number, r: any) => s + r.percentage, 0);
    assert(Math.abs(catPctSum - 100) <= 1.0, `Category percentages must sum near 100%, got ${catPctSum}`);

    assert(Array.isArray(ch.partnerStatusDistribution) && ch.partnerStatusDistribution.length >= 1, 'Partner status distribution must exist');
    assert(Array.isArray(ch.cityEventComparison) && ch.cityEventComparison.length >= 2, 'City comparison must cover seeded cities');
    assert(Array.isArray(ch.attendanceComparison) && Array.isArray(ch.partnerPerformance), 'Attendance comparison & partner performance arrays must exist');
    assert(Array.isArray(ch.activityTimeline) && ch.activityTimeline.length >= 1, 'Activity timeline must exist');

    // Empty dataset check (far past custom range returns 0/empty arrays without fake rows)
    const emptyRes = await apiRequest('/admin/overview-analytics?range=custom&from=2015-01-01&to=2015-01-05', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(emptyRes.status === 200 && emptyRes.data.filteredSummary.eventsCreated === 0, 'Empty range must return 0 eventsCreated');
    assert(emptyRes.data.charts.eventCategoryDistribution.length === 0 && emptyRes.data.charts.activityTimeline.length === 0, 'Empty range must return empty arrays with zero fabricated data');

    // Test today, 7d, 90d, year, 12m ranges
    for (const rng of ['today', '7d', '90d', 'year', '12m']) {
      const r = await apiRequest(`/admin/overview-analytics?range=${rng}`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(r.status === 200 && r.data.period.range === rng, `Range ${rng} must succeed`);
    }

    // Invalid custom date range (from > to) rejected with 400
    const badRange = await apiRequest('/admin/overview-analytics?range=custom&from=2026-12-31&to=2026-01-01', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(badRange.status === 400, `Invalid custom date range must return 400, got ${badRange.status}`);
  });

  // --- SUITE 15: PHASE 7 SECURITY, PERFORMANCE, BACKUP & PRODUCTION READINESS ---
  console.log('\n--- SUITE 15: PHASE 7 SECURITY, PERFORMANCE, BACKUP & PRODUCTION READINESS ---');

  await test('Salted scrypt password hashing, legacy SHA-256 auto-upgrade & logout audit logging', async () => {
    const email1 = `scrypt_a_${Date.now()}@stroom.club`;
    const email2 = `scrypt_b_${Date.now()}@stroom.club`;
    const r1 = await apiRequest('/auth/register', { method: 'POST', body: { email: email1, password: 'SamePassword123', full_name: 'Salt User A' } });
    const r2 = await apiRequest('/auth/register', { method: 'POST', body: { email: email2, password: 'SamePassword123', full_name: 'Salt User B' } });
    assert(r1.status === 201 && r2.status === 201, 'Both registrations must succeed');

    const h1 = (db.prepare('SELECT password_hash FROM users WHERE email = ?').get(email1) as any).password_hash;
    const h2 = (db.prepare('SELECT password_hash FROM users WHERE email = ?').get(email2) as any).password_hash;
    assert(h1.startsWith('scrypt$') && h2.startsWith('scrypt$'), 'Password hashes must use scrypt$ format');
    assert(h1 !== h2, 'Identical passwords must produce distinct salted hashes');
    assert(verifyPassword('SamePassword123', h1).valid === true, 'verifyPassword must validate scrypt hash');

    // Simulate a legacy SHA-256 user and verify transparent scrypt upgrade on login
    const legEmail = `legacy_${Date.now()}@stroom.club`;
    const legId = 'usr_leg_' + Date.now();
    const legHash = crypto.createHash('sha256').update('LegacyPass@99' + 'stroom_vibe_salt_2026').digest('hex');
    db.prepare(`INSERT INTO users (id, email, password_hash, full_name, role, onboarding_status) VALUES (?, ?, ?, 'Legacy Member', 'participant', 'COMPLETED')`).run(legId, legEmail, legHash);

    const legLogin = await apiRequest('/auth/login', { method: 'POST', body: { email: legEmail, password: 'LegacyPass@99' } });
    assert(legLogin.status === 200, `Legacy user login must succeed, got ${legLogin.status}`);
    const upgradedHash = (db.prepare('SELECT password_hash FROM users WHERE id = ?').get(legId) as any).password_hash;
    assert(upgradedHash.startsWith('scrypt$'), 'Legacy SHA-256 hash must automatically upgrade to scrypt$ on login');

    // Admin logout logs audit record
    const logoutRes = await apiRequest('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(logoutRes.status === 200 && logoutRes.data.success === true, 'Logout endpoint must succeed');
    const logoutAudit = db.prepare("SELECT id FROM audit_logs WHERE action = 'ADMIN_LOGOUT' ORDER BY created_at DESC LIMIT 1").get();
    assert(!!logoutAudit, 'Admin logout must be recorded in audit_logs');
  });

  await test('XSS/Unsafe URL protocol rejection across registration, profile studio & admin event creation', async () => {
    const badReg = await apiRequest('/auth/register', {
      method: 'POST',
      body: { email: `xss_${Date.now()}@stroom.club`, password: 'ValidPass123', full_name: 'XSS Test', avatar_url: 'javascript:alert(1)' },
    });
    assert(badReg.status === 400, `Expected 400 blocking javascript: avatar_url on register, got ${badReg.status}`);

    const badProfile = await apiRequest('/users/me/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${phase6MemberToken}` },
      body: { cover_url: 'data:text/html,<script>alert(1)</script>' },
    });
    assert(badProfile.status === 400, `Expected 400 blocking data:text/html cover_url, got ${badProfile.status}`);

    const badEventImg = await apiRequest('/admin/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${eventMgrToken}` },
      body: {
        title: 'Bad Image Event',
        city_id: 'city_hyd',
        venue_id: 'ven_hyd_thirdwave',
        category: 'social',
        event_date: '2026-12-30',
        event_time: '19:00',
        image_url: 'javascript:eval(1)',
      },
    });
    assert(badEventImg.status === 400, `Expected 400 blocking javascript: image_url on event create, got ${badEventImg.status}`);
  });

  await test('Security headers, DB-aware health check, malformed JSON handling & rate limiter 429 enforcement', async () => {
    const rawHealth = await fetch(`${BASE_URL}/health`);
    assert(rawHealth.status === 200, `Health check must return 200, got ${rawHealth.status}`);
    assert(rawHealth.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options header missing');
    assert(rawHealth.headers.get('x-frame-options') === 'SAMEORIGIN', 'X-Frame-Options header missing');
    assert(!rawHealth.headers.get('x-powered-by'), 'X-Powered-By must be disabled');
    const healthJson = await rawHealth.json();
    assert(healthJson.database === 'connected' && healthJson.integrations.paymentGatewayConfigured === false, 'Health endpoint must verify DB connection and honest integrations');

    // Malformed JSON body must return clean 400 without crashing or exposing stack trace
    const malformedRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email": "broken',
    });
    assert(malformedRes.status === 400, `Malformed JSON must return 400, got ${malformedRes.status}`);
    const malformedBody = await malformedRes.json();
    assert(!String(malformedBody.error || '').includes('at '), 'Error response must not expose stack traces');

    // Rate limiting check (temporarily set strict auth limit = 2, trigger 429 on 3rd attempt, restore cleanly)
    const origLimit = config.authRateLimitMax;
    resetRateLimiters();
    config.authRateLimitMax = 2;
    try {
      await apiRequest('/auth/login', { method: 'POST', body: { email: 'nonexistent@stroom.club', password: 'wrong' } });
      await apiRequest('/auth/login', { method: 'POST', body: { email: 'nonexistent@stroom.club', password: 'wrong' } });
      const throttled = await apiRequest('/auth/login', { method: 'POST', body: { email: 'nonexistent@stroom.club', password: 'wrong' } });
      assert(throttled.status === 429, `Expected 429 Too Many Requests after exceeding auth rate limit, got ${throttled.status}`);
    } finally {
      config.authRateLimitMax = origLimit;
      resetRateLimiters();
    }
  });

  await test('Database atomic backup snapshot creation, integrity check & restore verification', async () => {
    const tmpBackupDir = path.resolve(process.cwd(), 'backups', 'test_suite15_tmp');
    let snapPath = '';
    try {
      snapPath = await createDatabaseBackup(tmpBackupDir, 14);
      assert(fs.existsSync(snapPath), 'Atomic SQLite backup file must be created on disk');

      const snapDb = new Database(snapPath, { readonly: true });
      const integrity = snapDb.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      const fkViolations = snapDb.prepare('PRAGMA foreign_key_check').all();
      const userCount = (snapDb.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
      snapDb.close();

      assert(integrity.integrity_check === 'ok', `Backup snapshot integrity check failed: ${JSON.stringify(integrity)}`);
      assert(Array.isArray(fkViolations) && fkViolations.length === 0, 'Backup snapshot must have zero FK violations');
      assert(userCount >= 1, 'Backup snapshot must contain persisted users');
    } finally {
      if (snapPath && fs.existsSync(snapPath)) fs.unlinkSync(snapPath);
      if (fs.existsSync(tmpBackupDir)) fs.rmSync(tmpBackupDir, { recursive: true, force: true });
    }
  });

  await test('Route-level RBAC hardening: passes check-in, event creation & legacy role escalation endpoints enforce 403', async () => {
    const selfCheckin = await apiRequest('/passes/check-in', {
      method: 'POST',
      headers: { Authorization: `Bearer ${phase6MemberToken}` },
      body: { pass_code: phase6PassCode },
    });
    assert(selfCheckin.status === 403, `Regular user must get 403 on /passes/check-in, got ${selfCheckin.status}`);

    const unauthEventPost = await apiRequest('/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${phase6MemberToken}` },
      body: {
        city_id: 'city_hyd',
        venue_id: 'ven_hyd_thirdwave',
        title: 'Unauthorized Direct Event',
        category: 'social',
        event_date: '2026-12-25',
        event_time: '19:00',
      },
    });
    assert(unauthEventPost.status === 403, `Regular user must get 403 on POST /events, got ${unauthEventPost.status}`);

    const legacyEsc = await apiRequest(`/users/admin/members/${phase6MemberId}/role`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${eventMgrToken}` },
      body: { role: 'super_admin' },
    });
    assert(legacyEsc.status === 403, `Non-super-admin must get 403 assigning super_admin on legacy PUT role endpoint, got ${legacyEsc.status}`);
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
