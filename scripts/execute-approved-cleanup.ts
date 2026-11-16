import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { hashPassword, verifyPassword } from '../server/db/database';
import { generateToken } from '../server/middleware/auth';
import { ROLE_PERMISSIONS } from '../server/services/rbacService';

async function runCleanup() {
  console.log('======================================================');
  console.log('🛡️  STROOM APPROVED PRODUCTION DATABASE CLEANUP');
  console.log('======================================================\n');

  const dbPath = path.resolve(process.cwd(), 'data', 'stroom.db');
  const backupPath = path.resolve(process.cwd(), 'backups', 'stroom-backup-2026-11-16T13-44-03-979Z.db');

  // 1. Verify backup
  console.log('[1/7] Verifying database backup snapshot...');
  if (!fs.existsSync(backupPath)) {
    throw new Error(`[FATAL] Required backup file not found at: ${backupPath}`);
  }
  const backupDb = new Database(backupPath);
  const backupCheck = backupDb.prepare('PRAGMA integrity_check').all() as any[];
  if (backupCheck[0]?.integrity_check !== 'ok') {
    throw new Error('[FATAL] Backup integrity check failed!');
  }
  backupDb.close();
  console.log(`✓ Backup verified and intact at: ${backupPath}`);

  // 2. Open active database
  const db = new Database(dbPath);

  // Verify genuine users are present
  const genuine1 = db.prepare("SELECT id, email FROM users WHERE LOWER(email) = 'kljkarthik4@gmail.com'").get() as any;
  const genuine2 = db.prepare("SELECT id, email FROM users WHERE LOWER(email) = 'karan@stroom.club'").get() as any;

  if (!genuine1 || !genuine2) {
    throw new Error('[FATAL] Genuine accounts missing from database!');
  }
  console.log(`✓ Confirmed genuine users present: ${genuine1.email} (${genuine1.id}), ${genuine2.email} (${genuine2.id})`);

  // 3. Identify all demo and test users
  const demoEmails = [
    'admin@stroom.app',
    'user@stroom.app',
    'superadmin@stroom.app',
    'checkin@stroom.app',
    'events@stroom.app',
    'partner@stroom.app',
    'partner.pune@stroom.app'
  ];

  const allUsers = db.prepare('SELECT id, email FROM users').all() as any[];
  const demoUsersToDelete = allUsers.filter(u => demoEmails.includes(u.email.toLowerCase()));
  const testUsersToDelete = allUsers.filter(u => 
    !demoEmails.includes(u.email.toLowerCase()) &&
    u.id !== genuine1.id &&
    u.id !== genuine2.id &&
    (
      u.email.startsWith('test_') ||
      u.email.startsWith('intruder_') ||
      u.email.startsWith('skip_user_') ||
      u.email.startsWith('attacker') ||
      u.email.startsWith('disposable') ||
      u.email.startsWith('e2e_') ||
      u.email.startsWith('phase') ||
      u.email.startsWith('rbac_target_') ||
      u.email.startsWith('partner_owner_') ||
      u.email.startsWith('scrypt_') ||
      u.email.startsWith('legacy_')
    )
  );

  const usersToDelete = [...demoUsersToDelete, ...testUsersToDelete];
  const userIdsToDelete = usersToDelete.map(u => u.id);

  console.log(`\n[2/7] Identified records to clean:`);
  console.log(` - Verified Demo Accounts: ${demoUsersToDelete.length}`);
  console.log(` - Verified Test Accounts: ${testUsersToDelete.length}`);
  console.log(` - Total User Accounts to Remove: ${usersToDelete.length}`);

  if (userIdsToDelete.includes(genuine1.id) || userIdsToDelete.includes(genuine2.id)) {
    throw new Error('[CRITICAL SAFETY FATAL] Genuine account in delete queue! Aborting!');
  }

  // Events: keep 13 verified community & auction-linked events, delete test duplicates
  const allEvents = db.prepare('SELECT id, title FROM events').all() as any[];
  const keepEventIds = [
    'evt_hyd_sports_03',
    'evt_pune_cafe_04',
    'evt_hyd_cinema_05',
    'evt_pune_trek_06',
    'evt_blr_futsal_07',
    'evt_mum_acoustic_08',
    'evt_hyd_founders_09',
    'evt_hyd_past_10',
    'evt_hyd_auction_01',
    'evt_pune_draft_02',
    'evt_90ecaa064eac4b',
    'evt_0c60a236b34b4a0d',
    'evt_79dc1916bb254db6'
  ];
  const eventsToDelete = allEvents.filter(e => !keepEventIds.includes(e.id)).map(e => e.id);
  console.log(` - Test/Duplicate Events to Remove: ${eventsToDelete.length}`);

  // Test communities to delete
  const allCommunities = db.prepare('SELECT id, name FROM communities').all() as any[];
  const communitiesToDelete = allCommunities.filter(c => c.id.startsWith('comm_') && c.id.length > 15).map(c => c.id);
  console.log(` - Test Communities to Remove: ${communitiesToDelete.length}`);

  // Venues: keep 6 flagship venues, delete 28 test venues
  const flagshipVenueIds = [
    'ven_hyd_thirdwave',
    'ven_hyd_onegolf',
    'ven_pune_social',
    'ven_pune_vohuman',
    'ven_blr_indiranagar',
    'ven_mum_bandra'
  ];
  const allVenues = db.prepare('SELECT id FROM venues').all() as any[];
  const venuesToDelete = allVenues.filter(v => !flagshipVenueIds.includes(v.id)).map(v => v.id);
  console.log(` - Test Venues to Remove: ${venuesToDelete.length}`);

  // Partners: keep 3 flagship partners, delete 14 test duplicate partners
  const flagshipPartnerIds = ['ptr_thirdwave_hyd', 'ptr_onegolf_hyd', 'ptr_social_pune'];
  const allPartners = db.prepare('SELECT id, owner_user_id FROM partner_accounts').all() as any[];
  const partnersToDelete = allPartners.filter(p => !flagshipPartnerIds.includes(p.id)).map(p => p.id);
  console.log(` - Test Partner Accounts to Remove: ${partnersToDelete.length}`);

  // Setup credentials for dedicated Super Admin
  const superAdminEmail = 'superadmin@strangersroom.in';
  const superAdminId = 'usr_superadmin_master';
  const memberId = 'STR-ADM-0001';
  const now = new Date().toISOString();

  // Generate cryptographically strong password
  const rawBytes = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, 'X');
  const generatedPassword = `Stroom#${rawBytes.slice(0, 8)}!9`;
  const superAdminHash = hashPassword(generatedPassword);

  // 7. Execute transactional cleanup
  console.log('\n[3/7] Executing transactional database cleanup...');
  
  db.pragma('foreign_keys = OFF');
  const cleanupTx = db.transaction(() => {
    const inUserPlaceholders = userIdsToDelete.map(() => '?').join(',');
    const vPlaceholders = venuesToDelete.length > 0 ? venuesToDelete.map(() => '?').join(',') : null;
    const pPlaceholders = partnersToDelete.length > 0 ? partnersToDelete.map(() => '?').join(',') : null;
    const ePlaceholders = eventsToDelete.length > 0 ? eventsToDelete.map(() => '?').join(',') : null;
    const cPlaceholders = communitiesToDelete.length > 0 ? communitiesToDelete.map(() => '?').join(',') : null;

    // Step A: Insert dedicated Super Admin
    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, full_name, display_name, first_name, last_name,
        role, member_id, city, account_status, onboarding_status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, 'STROOM Super Admin', 'Super Admin', 'Super', 'Admin',
        'super_admin', ?, 'Hyderabad', 'active', 'COMPLETED', ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        password_hash = excluded.password_hash,
        role = 'super_admin',
        account_status = 'active',
        onboarding_status = 'COMPLETED',
        updated_at = excluded.updated_at
    `).run(superAdminId, superAdminEmail, superAdminHash, memberId, now, now);

    // Step B: Reassign flagship entities to Super Admin
    db.prepare(`UPDATE events SET venue_id = 'ven_hyd_thirdwave' WHERE id = 'evt_90ecaa064eac4b'`).run();
    db.prepare(`UPDATE events SET created_by = ? WHERE created_by IS NOT NULL`).run(superAdminId);
    db.prepare(`UPDATE partner_accounts SET owner_user_id = ? WHERE id IN ('ptr_thirdwave_hyd', 'ptr_onegolf_hyd', 'ptr_social_pune')`).run(superAdminId);
    db.prepare(`UPDATE admin_announcements SET created_by = ? WHERE created_by IS NOT NULL`).run(superAdminId);
    db.prepare(`UPDATE bids SET bidder_user_id = ? WHERE bidder_user_id IS NOT NULL`).run(superAdminId);
    db.prepare(`UPDATE audit_logs SET user_id = ? WHERE user_id IN (${inUserPlaceholders})`).run(superAdminId, ...userIdsToDelete);
    db.prepare(`UPDATE passport_stamps SET verified_by = ? WHERE verified_by IS NOT NULL`).run(superAdminId);
    db.prepare(`UPDATE event_registrations SET checked_in_by = ? WHERE checked_in_by IS NOT NULL`).run(superAdminId);
    db.prepare(`UPDATE coupon_redemptions SET verified_by_user_id = ? WHERE verified_by_user_id IS NOT NULL`).run(superAdminId);
    db.prepare(`UPDATE coupon_redemptions SET user_id = ? WHERE user_id IN (${inUserPlaceholders})`).run(superAdminId, ...userIdsToDelete);
    db.prepare(`UPDATE payment_transactions SET refunded_by = ? WHERE refunded_by IS NOT NULL`).run(superAdminId);

    // Step C: Delete leaf payments & stamps
    if (ePlaceholders) {
      db.prepare(`DELETE FROM payment_transactions WHERE event_id IN (${ePlaceholders}) OR user_id IN (${inUserPlaceholders})`).run(...eventsToDelete, ...userIdsToDelete);
      db.prepare(`DELETE FROM passport_stamps WHERE event_id IN (${ePlaceholders}) OR user_id IN (${inUserPlaceholders})`).run(...eventsToDelete, ...userIdsToDelete);
      db.prepare(`DELETE FROM event_registrations WHERE event_id IN (${ePlaceholders}) OR user_id IN (${inUserPlaceholders})`).run(...eventsToDelete, ...userIdsToDelete);
    } else {
      db.prepare(`DELETE FROM payment_transactions WHERE user_id IN (${inUserPlaceholders})`).run(...userIdsToDelete);
      db.prepare(`DELETE FROM passport_stamps WHERE user_id IN (${inUserPlaceholders})`).run(...userIdsToDelete);
      db.prepare(`DELETE FROM event_registrations WHERE user_id IN (${inUserPlaceholders})`).run(...userIdsToDelete);
    }

    // Step D: Delete partner leaves
    if (pPlaceholders) {
      db.prepare(`DELETE FROM collaboration_comments WHERE collaboration_id IN (SELECT id FROM partner_collaborations WHERE partner_id IN (${pPlaceholders})) OR user_id IN (${inUserPlaceholders})`).run(...partnersToDelete, ...userIdsToDelete);
      db.prepare(`DELETE FROM partner_communications WHERE partner_id IN (${pPlaceholders}) OR sender_user_id IN (${inUserPlaceholders})`).run(...partnersToDelete, ...userIdsToDelete);
      db.prepare(`DELETE FROM partner_collaborations WHERE partner_id IN (${pPlaceholders}) OR organizer_user_id IN (${inUserPlaceholders})`).run(...partnersToDelete, ...userIdsToDelete);
      db.prepare(`DELETE FROM partner_audit_logs WHERE partner_id IN (${pPlaceholders}) OR user_id IN (${inUserPlaceholders})`).run(...partnersToDelete, ...userIdsToDelete);
      db.prepare(`DELETE FROM partner_users WHERE user_id IN (${inUserPlaceholders})`).run(...userIdsToDelete);
    }

    // Step E: Delete venue leaves
    if (vPlaceholders) {
      db.prepare(`DELETE FROM coupon_redemptions WHERE venue_id IN (${vPlaceholders})`).run(...venuesToDelete);
      db.prepare(`DELETE FROM coupons WHERE venue_id IN (${vPlaceholders})`).run(...venuesToDelete);
      if (ePlaceholders) {
        db.prepare(`DELETE FROM venue_availability WHERE venue_id IN (${vPlaceholders}) OR event_id IN (${ePlaceholders})`).run(...venuesToDelete, ...eventsToDelete);
      } else {
        db.prepare(`DELETE FROM venue_availability WHERE venue_id IN (${vPlaceholders})`).run(...venuesToDelete);
      }
      db.prepare(`DELETE FROM partner_proposals WHERE venue_id IN (${vPlaceholders})`).run(...venuesToDelete);
    }

    // Step F: Delete test events, venues, partners
    if (ePlaceholders) {
      db.prepare(`DELETE FROM events WHERE id IN (${ePlaceholders})`).run(...eventsToDelete);
    }
    if (vPlaceholders) {
      db.prepare(`DELETE FROM venues WHERE id IN (${vPlaceholders})`).run(...venuesToDelete);
    }
    if (pPlaceholders) {
      db.prepare(`DELETE FROM partner_accounts WHERE id IN (${pPlaceholders})`).run(...partnersToDelete);
    }

    // Flagship partner user records
    db.prepare(`INSERT OR REPLACE INTO partner_users (id, partner_id, user_id, partner_role) VALUES ('pu_sa_01', 'ptr_thirdwave_hyd', ?, 'owner')`).run(superAdminId);
    db.prepare(`INSERT OR REPLACE INTO partner_users (id, partner_id, user_id, partner_role) VALUES ('pu_sa_02', 'ptr_onegolf_hyd', ?, 'owner')`).run(superAdminId);
    db.prepare(`INSERT OR REPLACE INTO partner_users (id, partner_id, user_id, partner_role) VALUES ('pu_sa_03', 'ptr_social_pune', ?, 'owner')`).run(superAdminId);

    // Step G: Quiz sessions, responses, response options
    db.prepare(`DELETE FROM response_options WHERE response_id IN (SELECT id FROM responses WHERE session_id IN (SELECT id FROM quiz_sessions WHERE user_id IN (${inUserPlaceholders})))`).run(...userIdsToDelete);
    db.prepare(`DELETE FROM responses WHERE session_id IN (SELECT id FROM quiz_sessions WHERE user_id IN (${inUserPlaceholders}))`).run(...userIdsToDelete);
    db.prepare(`DELETE FROM quiz_sessions WHERE user_id IN (${inUserPlaceholders})`).run(...userIdsToDelete);

    // Step H: Other user child records
    db.prepare(`DELETE FROM user_preferences WHERE user_id IN (${inUserPlaceholders})`).run(...userIdsToDelete);
    db.prepare(`DELETE FROM activity_logs WHERE user_id IN (${inUserPlaceholders})`).run(...userIdsToDelete);
    db.prepare(`DELETE FROM notifications WHERE user_id IN (${inUserPlaceholders})`).run(...userIdsToDelete);
    db.prepare(`DELETE FROM user_achievements WHERE user_id IN (${inUserPlaceholders})`).run(...userIdsToDelete);
    db.prepare(`DELETE FROM auction_registrations WHERE user_id IN (${inUserPlaceholders})`).run(...userIdsToDelete);

    // Step I: Communities
    if (cPlaceholders) {
      db.prepare(`DELETE FROM community_members WHERE community_id IN (${cPlaceholders}) OR user_id IN (${inUserPlaceholders})`).run(...communitiesToDelete, ...userIdsToDelete);
      db.prepare(`DELETE FROM community_posts WHERE community_id IN (${cPlaceholders}) OR author_user_id IN (${inUserPlaceholders})`).run(...communitiesToDelete, ...userIdsToDelete);
      db.prepare(`DELETE FROM communities WHERE id IN (${cPlaceholders})`).run(...communitiesToDelete);
    }

    // Step J: Delete users
    db.prepare(`DELETE FROM users WHERE id IN (${inUserPlaceholders})`).run(...userIdsToDelete);

    // Step K: Audit Log entry
    const auditId = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details_json, created_at, actor_name, actor_role, result, source)
      VALUES (?, ?, 'ADMIN_BOOTSTRAP', 'users', ?, ?, ?, 'Super Admin', 'super_admin', 'SUCCESS', 'admin_bootstrap')
    `).run(
      auditId,
      superAdminId,
      superAdminId,
      JSON.stringify({
        email: superAdminEmail,
        role: 'super_admin',
        action: 'Dedicated Super Admin established and verified'
      }),
      now
    );

    // Step L: Lock bootstrap process in platform_settings
    db.prepare(`
      INSERT INTO platform_settings (key, category, value_json, description, updated_by, updated_at)
      VALUES ('admin_bootstrap_lock', 'security', ?, 'Locks initial admin bootstrap once dedicated super admin is created', ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `).run(
      JSON.stringify({ locked: true, superadmin_email: superAdminEmail, bootstrapped_at: now }),
      superAdminId,
      now
    );
  });

  cleanupTx();
  db.pragma('foreign_keys = ON');
  console.log('✓ Cleanup transaction committed successfully.');

  // Write one-time handover credentials locally in private backup folder (NEVER IN GIT)
  const handoverDir = path.resolve(process.cwd(), 'backups');
  const handoverFile = path.resolve(handoverDir, 'SUPERADMIN_INITIAL_CREDENTIALS.txt');
  fs.writeFileSync(
    handoverFile,
    `STROOM DEDICATED SUPER ADMIN INITIAL CREDENTIALS\n` +
    `================================================\n` +
    `Email:    ${superAdminEmail}\n` +
    `Password: ${generatedPassword}\n` +
    `Role:     super_admin\n` +
    `Created:  ${now}\n` +
    `Notice:   Please sign in and change your password upon initial login.\n` +
    `          Store these credentials in a secure password manager.\n`
  );
  console.log(`\n[4/7] Dedicated Super Admin established: ${superAdminEmail}`);
  console.log(`✓ Handover credentials saved to private file: ${handoverFile}`);

  // Verify Database Integrity & Foreign Keys
  console.log('\n[5/7] Verifying database integrity and foreign key constraints...');
  const fkViolations = db.prepare('PRAGMA foreign_key_check').all() as any[];
  if (fkViolations.length > 0) {
    throw new Error(`[FATAL] Foreign key violations found: ${JSON.stringify(fkViolations)}`);
  }
  console.log('✓ Foreign key check passed: ZERO violations (100% valid)');

  const integrity = db.prepare('PRAGMA integrity_check').all() as any[];
  if (integrity[0]?.integrity_check !== 'ok') {
    throw new Error('[FATAL] Database integrity check failed after cleanup!');
  }
  console.log('✓ Database integrity check passed: 100% OK');

  // Audit Remaining Counts
  console.log('\n[6/7] Final Database Inventory:');
  const remainingUsers = db.prepare('SELECT id, email, role, full_name FROM users ORDER BY created_at ASC').all() as any[];
  console.log(` - Remaining Users (${remainingUsers.length}):`);
  remainingUsers.forEach(u => console.log(`   • ${u.id.padEnd(25)} | ${u.email.padEnd(32)} | Role: ${u.role.padEnd(12)} | Name: ${u.full_name || 'N/A'}`));

  const remainingEvents = db.prepare('SELECT count(*) as c FROM events').get().c;
  const remainingVenues = db.prepare('SELECT count(*) as c FROM venues').get().c;
  const remainingCommunities = db.prepare('SELECT count(*) as c FROM communities').get().c;
  const remainingRegistrations = db.prepare('SELECT count(*) as c FROM event_registrations').get().c;
  const remainingPayments = db.prepare('SELECT count(*) as c FROM payment_transactions').get().c;
  const remainingSubmissions = db.prepare('SELECT count(*) as c FROM event_submissions').get().c;

  console.log(` - Remaining Events:        ${remainingEvents}`);
  console.log(` - Remaining Venues:        ${remainingVenues}`);
  console.log(` - Remaining Communities:   ${remainingCommunities}`);
  console.log(` - Remaining Registrations: ${remainingRegistrations}`);
  console.log(` - Remaining Payments:      ${remainingPayments}`);
  console.log(` - Remaining Submissions:   ${remainingSubmissions}`);

  // Test Super Admin Authentication & Permissions
  console.log('\n[7/7] Testing Super Admin authentication and RBAC permissions...');
  const superAdminRow = db.prepare('SELECT * FROM users WHERE email = ?').get(superAdminEmail) as any;
  const authVerify = verifyPassword(generatedPassword, superAdminRow.password_hash);
  if (!authVerify.valid) {
    throw new Error('[FATAL] Super Admin password verification failed!');
  }
  console.log('✓ Password verification against salted scrypt hash: VALID');

  const superAdminToken = generateToken({
    id: superAdminRow.id,
    email: superAdminRow.email,
    role: superAdminRow.role
  });
  if (!superAdminToken) {
    throw new Error('[FATAL] JWT token generation failed!');
  }
  console.log('✓ JWT Token generation: SUCCESS');

  const superAdminPerms = ROLE_PERMISSIONS['super_admin'];
  console.log(`✓ Super Admin granted all ${superAdminPerms.length} granular admin permissions:`);
  console.log(`   [${superAdminPerms.join(', ')}]`);

  // Verify normal user cannot access admin permissions
  const normalUserPerms = ROLE_PERMISSIONS['user'] || [];
  if (normalUserPerms.length > 0) {
    throw new Error('[FATAL] Regular user role has unauthorized admin permissions!');
  }
  console.log('✓ Regular user role admin permissions: 0 (access strictly restricted)');

  db.close();

  console.log('\n======================================================');
  console.log('🎉 STROOM APPROVED CLEANUP & SUPER ADMIN COMPLETED');
  console.log('======================================================\n');
}

runCleanup().catch(err => {
  console.error('\n[FATAL ERROR]:', err);
  process.exit(1);
});
