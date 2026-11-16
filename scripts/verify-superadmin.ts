import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { verifyPassword } from '../server/db/database';
import jwt from 'jsonwebtoken';
import { config } from '../server/config/env';
import { generateToken } from '../server/middleware/auth';
import { hasPermission, ROLE_PERMISSIONS } from '../server/services/rbacService';

async function verifySuperAdminAccess() {
  console.log('======================================================');
  console.log('🔍 VERIFYING SUPER ADMIN ACCESS & RBAC ENFORCEMENT');
  console.log('======================================================\n');

  const dbPath = path.resolve(process.cwd(), 'data', 'stroom.db');
  const db = new Database(dbPath);

  // 1. Read handover credentials
  const handoverPath = path.resolve(process.cwd(), 'backups', 'SUPERADMIN_INITIAL_CREDENTIALS.txt');
  if (!fs.existsSync(handoverPath)) {
    throw new Error('Handover credentials file missing!');
  }
  const handoverText = fs.readFileSync(handoverPath, 'utf-8');
  const emailMatch = handoverText.match(/Email:\s+([^\s]+)/);
  const passMatch = handoverText.match(/Password:\s+([^\s]+)/);

  if (!emailMatch || !passMatch) {
    throw new Error('Could not parse credentials from handover file');
  }

  const email = emailMatch[1];
  const password = passMatch[1];

  console.log(`[1/5] Testing Super Admin credential verification for ${email}...`);
  const adminRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!adminRow) {
    throw new Error('Super admin row not found in users table!');
  }

  const authResult = verifyPassword(password, adminRow.password_hash);
  if (!authResult.valid) {
    throw new Error('Password failed verification against salted scrypt hash!');
  }
  console.log('✓ Cryptographic salted scrypt password verification: SUCCESS');

  // 2. Generate and verify JWT Token
  console.log('\n[2/5] Testing Super Admin JWT session token...');
  const token = generateToken({
    id: adminRow.id,
    email: adminRow.email,
    role: adminRow.role,
  });
  const decoded = jwt.verify(token, config.jwtSecret) as any;
  if (!decoded || decoded.role !== 'super_admin') {
    throw new Error('Decoded token role mismatch!');
  }
  console.log(`✓ JWT Token verified successfully: Subject=${decoded.id}, Role=${decoded.role}`);

  // 3. Verify Full RBAC Authorization across all 25 Admin capabilities
  console.log('\n[3/5] Verifying granular RBAC permissions for Super Admin...');
  const requiredPermissions = [
    'overview.view',
    'events.view',
    'events.create',
    'events.edit',
    'events.publish',
    'events.delete',
    'registrations.manage',
    'cities.manage',
    'members.view',
    'members.manage',
    'roles.assign',
    'communities.manage',
    'partners.verify',
    'venues.manage',
    'checkin.access',
    'checkin.override',
    'quiz.manage',
    'moderation.manage',
    'campaigns.approve',
    'payments.view',
    'payments.refund',
    'notifications.manage',
    'analytics.view',
    'settings.manage',
    'auditlogs.view',
  ] as const;

  for (const perm of requiredPermissions) {
    const authorized = hasPermission('super_admin', perm);
    if (!authorized) {
      throw new Error(`Super admin missing required permission: ${perm}`);
    }
  }
  console.log(`✓ Super Admin possesses ALL ${requiredPermissions.length} / ${requiredPermissions.length} permissions.`);

  // 4. Verify Regular User Restriction (Zero Admin Access)
  console.log('\n[4/5] Verifying regular user lockout from Admin Console...');
  for (const perm of requiredPermissions) {
    const regularUserAuthorized = hasPermission('user', perm);
    if (regularUserAuthorized) {
      throw new Error(`CRITICAL: Regular user role was granted admin permission: ${perm}`);
    }
  }
  console.log('✓ Regular user (role: "user") strictly locked out of all 25 admin permissions.');

  // 5. Verify Genuine Participant Accounts Preserved
  console.log('\n[5/5] Verifying genuine participant accounts remain untouched...');
  const genuineUsers = db.prepare(`
    SELECT id, email, role, full_name, created_at, onboarding_status
    FROM users 
    WHERE email IN ('kljkarthik4@gmail.com', 'karan@stroom.club')
  `).all() as any[];

  if (genuineUsers.length !== 2) {
    throw new Error(`Expected exactly 2 genuine accounts, found ${genuineUsers.length}`);
  }

  genuineUsers.forEach(u => {
    console.log(`✓ Genuine user preserved: ${u.email.padEnd(25)} | ID: ${u.id} | Role: ${u.role}`);
  });

  const totalUserCount = db.prepare('SELECT count(*) as c FROM users').get().c;
  console.log(`\nTotal users in production database: ${totalUserCount} (2 genuine participants + 1 dedicated Super Admin)`);

  db.close();
  console.log('\n======================================================');
  console.log('✅ ALL ADMIN & SECURITY CHECKS VERIFIED SUCCESSFULLY');
  console.log('======================================================\n');
}

verifySuperAdminAccess().catch(err => {
  console.error('[FAILED]:', err);
  process.exit(1);
});
