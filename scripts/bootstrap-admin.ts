import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import Database from 'better-sqlite3';
import { hashPassword } from '../server/db/database';

function promptInput(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hidden && process.stdin.isTTY) {
      // Simple hidden prompt for interactive terminal
      process.stdout.write(question);
      let pass = '';
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.on('data', (chunk) => {
        const char = chunk.toString();
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode?.(false);
          process.stdout.write('\n');
          rl.close();
          resolve(pass);
        } else if (char === '\u0003') {
          process.exit(1);
        } else if (char === '\b' || char === '\x7f') {
          pass = pass.slice(0, -1);
        } else {
          pass += char;
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function main() {
  console.log('======================================================');
  console.log('👑  STROOM PRIMARY ADMINISTRATOR SECURE BOOTSTRAP');
  console.log('======================================================\n');

  const dbPath = process.env.DB_PATH 
    ? path.resolve(process.env.DB_PATH) 
    : path.resolve(process.cwd(), 'data', 'stroom.db');

  if (!fs.existsSync(dbPath)) {
    console.error(`[FATAL] Database not found at: ${dbPath}`);
    process.exit(1);
  }

  const db = new Database(dbPath);

  // Security Check: Verify if bootstrap process is already locked
  const lockRow = db.prepare("SELECT value_json FROM platform_settings WHERE key = 'admin_bootstrap_lock'").get() as any;
  if (lockRow) {
    try {
      const lockData = JSON.parse(lockRow.value_json);
      if (lockData.locked && process.env.FORCE_BOOTSTRAP !== 'true') {
        console.error('[SECURITY BLOCKED] Admin bootstrap process is permanently locked.');
        console.error(`Dedicated Super Admin is already established: ${lockData.superadmin_email}`);
        console.error('To manage administrators, sign in directly via the Admin Console (/admin).');
        process.exit(1);
      }
    } catch {}
  }

  // 1. Determine Email
  let email = process.env.ADMIN_EMAIL?.trim();
  if (!email) {
    const argEmailIdx = process.argv.indexOf('--email');
    if (argEmailIdx !== -1 && process.argv[argEmailIdx + 1]) {
      email = process.argv[argEmailIdx + 1].trim();
    }
  }
  if (!email) {
    email = await promptInput('Enter Primary Administrator Email: ');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('[ERROR] A valid email address is required.');
    process.exit(1);
  }

  // 2. Determine Name
  let name = process.env.ADMIN_NAME?.trim();
  if (!name) {
    const argNameIdx = process.argv.indexOf('--name');
    if (argNameIdx !== -1 && process.argv[argNameIdx + 1]) {
      name = process.argv[argNameIdx + 1].trim();
    }
  }
  if (!name) {
    name = (await promptInput('Enter Administrator Full Name (default: STROOM Admin): ')) || 'STROOM Admin';
  }

  // 3. Determine Password
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const argPassIdx = process.argv.indexOf('--password');
    if (argPassIdx !== -1 && process.argv[argPassIdx + 1]) {
      password = process.argv[argPassIdx + 1];
    }
  }
  if (!password) {
    password = await promptInput('Enter Secure Administrator Password (min 8 characters): ');
  }

  if (!password || password.length < 8) {
    console.error('[ERROR] Password must be at least 8 characters long.');
    process.exit(1);
  }

  console.log('\n[1/3] Hashing password with cryptographic salted scrypt...');
  const passwordHash = hashPassword(password);

  console.log(`[2/3] Connecting to SQLite database at: ${dbPath}...`);
  const existingUser = db.prepare('SELECT id, email, role, full_name FROM users WHERE LOWER(email) = LOWER(?)').get(email) as any;

  const now = new Date().toISOString();
  let adminId: string;

  if (existingUser) {
    console.log(`User ${email} already exists (${existingUser.role}). Promoting to super_admin and updating credentials...`);
    adminId = existingUser.id;
    db.prepare(`
      UPDATE users 
      SET role = 'super_admin',
          password_hash = ?,
          full_name = COALESCE(?, full_name),
          display_name = COALESCE(?, display_name),
          onboarding_status = 'COMPLETED',
          is_active = 1,
          updated_at = ?
      WHERE id = ?
    `).run(passwordHash, name, name, now, adminId);
  } else {
    console.log(`Creating new primary super_admin account for ${email}...`);
    adminId = `usr_admin_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const memberId = `STR-ADM-${crypto.randomInt(1000, 9999)}`;
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0] || 'Admin';
    const lastName = parts.slice(1).join(' ') || '';

    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, full_name, display_name, first_name, last_name,
        role, member_id, city, is_active, onboarding_status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        'super_admin', ?, 'Hyderabad', 1, 'COMPLETED', ?, ?
      )
    `).run(adminId, email, passwordHash, name, name, firstName, lastName, memberId, now, now);
  }

  // 4. Audit Log entry
  const auditId = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_values_json, created_at)
    VALUES (?, ?, 'ADMIN_BOOTSTRAP', 'users', ?, ?, ?)
  `).run(
    auditId,
    adminId,
    adminId,
    JSON.stringify({ email, role: 'super_admin', action: 'Designated as primary administrator' }),
    now
  );

  console.log('[3/3] Administrator successfully established in database!');
  console.log('\n======================================================');
  console.log('✅ PRIMARY ADMINISTRATOR READY');
  console.log(` - Admin Email:  ${email}`);
  console.log(` - Role:         super_admin (Full Admin Console privileges)`);
  console.log(` - User ID:      ${adminId}`);
  console.log(` - Security:     Salted scrypt hash stored. Zero plaintext persisted.`);
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('[FATAL] Admin bootstrap failed:', err);
  process.exit(1);
});
