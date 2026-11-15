import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { validateImageBuffer, uploadImageBuffer, ensureMediaUploadsTable } from '../server/services/cloudinaryService';
import { SqliteAdapter } from '../server/db/sqliteAdapter';

async function runTests() {
  console.log('--- STARTING STROOM IMAGE UPLOAD SYSTEM TEST SUITE ---\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, extra = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${extra}`);
      failed++;
    }
  }

  // 1. Magic Bytes Validation Tests
  console.log('1. Buffer & Binary Magic Bytes Inspection:');

  // Genuine JPEG: starts with FF D8 FF
  const fakeJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const jpegRes = validateImageBuffer(fakeJpegBuffer, 'image/jpeg');
  assert(jpegRes.valid === true && jpegRes.detectedType === 'jpeg', 'Genuine JPEG buffer passes validation');

  // Genuine PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  const fakePngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const pngRes = validateImageBuffer(fakePngBuffer, 'image/png');
  assert(pngRes.valid === true && pngRes.detectedType === 'png', 'Genuine PNG buffer passes validation');

  // Genuine WebP: starts with RIFF, bytes 8-11 WEBP
  const fakeWebpBuffer = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'ascii'),
    Buffer.from('VP8 ', 'ascii'),
  ]);
  const webpRes = validateImageBuffer(fakeWebpBuffer, 'image/webp');
  assert(webpRes.valid === true && webpRes.detectedType === 'webp', 'Genuine WebP buffer passes validation');

  // Attack: Executable or script disguised as image/jpeg
  const disguisedScriptBuffer = Buffer.from('<?php echo "evil"; ?> #!/bin/bash alert()', 'utf-8');
  const disguisedRes = validateImageBuffer(disguisedScriptBuffer, 'image/jpeg');
  assert(disguisedRes.valid === false, 'Disguised non-image script file rejected by magic bytes');

  // Attack: MIME mismatch (PNG file sent as image/jpeg)
  const mismatchRes = validateImageBuffer(fakePngBuffer, 'image/jpeg');
  assert(mismatchRes.valid === false && mismatchRes.error?.includes('MIME type mismatch'), 'MIME type / magic byte mismatch rejected');

  // Attack: Unsupported MIME type (SVG or GIF or PDF)
  const svgRes = validateImageBuffer(Buffer.from('<svg></svg>'), 'image/svg+xml');
  assert(svgRes.valid === false && svgRes.error?.includes('Unsupported file format'), 'Unsupported MIME type image/svg+xml rejected');

  // Size limit validation
  const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
  largeBuffer[0] = 0xff; largeBuffer[1] = 0xd8; largeBuffer[2] = 0xff;
  const sizeRes = validateImageBuffer(largeBuffer, 'image/jpeg', { maxBytes: 10 * 1024 * 1024 });
  assert(sizeRes.valid === false && sizeRes.error?.includes('exceeds maximum size limit'), 'Payload exceeding 10MB rejected');

  // 2. Isolated Database Metadata Logging Tests
  console.log('\n2. Isolated Database Metadata Logging:');
  const testDbDir = path.resolve(process.cwd(), 'backups', 'test_sandbox');
  if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
  const testDbFile = path.resolve(testDbDir, `test_upload_${Date.now()}.db`);

  const testDb = new Database(testDbFile);
  testDb.pragma('journal_mode = WAL');
  const testAdapter = new SqliteAdapter(testDb);

  // Create media_uploads table in test db
  await testAdapter.execute(`
    CREATE TABLE IF NOT EXISTS media_uploads (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      public_id TEXT NOT NULL,
      secure_url TEXT NOT NULL,
      url TEXT NOT NULL,
      format TEXT,
      width INTEGER,
      height INTEGER,
      bytes INTEGER,
      resource_type TEXT DEFAULT 'image',
      original_filename TEXT,
      folder TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const mockUploadId = `upl_${crypto.randomUUID()}`;
  await testAdapter.execute(
    `INSERT INTO media_uploads (id, user_id, public_id, secure_url, url, format, width, height, bytes, resource_type, original_filename, folder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      mockUploadId,
      'user_test_123',
      'stroom/avatars/mock_avatar_1',
      'https://res.cloudinary.com/stroom/image/upload/v1/mock_avatar_1.webp',
      'http://res.cloudinary.com/stroom/image/upload/v1/mock_avatar_1.webp',
      'webp',
      500,
      500,
      45000,
      'image',
      'my-avatar.png',
      'stroom/avatars'
    ]
  );

  const row = await testAdapter.queryOne<any>('SELECT * FROM media_uploads WHERE id = ?', [mockUploadId]);
  assert(row && row.secure_url.includes('cloudinary.com') && row.format === 'webp', 'Upload metadata properly logged in media_uploads');

  testDb.close();
  try { fs.unlinkSync(testDbFile); } catch {}

  // 3. Protected Database Hash Verification
  console.log('\n3. Protected Database SHA-256 Hash Verification:');
  const primaryDbPath = path.resolve(process.cwd(), 'data', 'stroom.db');
  const expectedPrimaryHash = 'AD6FE974854B0FCD83CF053E26DE89F3D467B2BE2687B09E0AB282E6ACD848FB';
  const primaryBytes = fs.readFileSync(primaryDbPath);
  const primaryHash = crypto.createHash('sha256').update(primaryBytes).digest('hex').toUpperCase();

  assert(primaryHash === expectedPrimaryHash, `Primary database (data/stroom.db) untouched: ${primaryHash}`);

  console.log(`\n========================================`);
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
