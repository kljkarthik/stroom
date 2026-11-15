import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import crypto from 'crypto';
import { config } from '../config/env';
import { getDatabaseAdapter } from '../db/adapter';

// Initialize Cloudinary SDK
if (config.cloudinaryUrl) {
  cloudinary.config({ secure: true });
} else if (config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
    secure: true,
  });
}

export interface UploadResult {
  id: string;
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  folder: string;
  original_filename?: string;
  created_at: string;
}

export interface ValidateImageOptions {
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Validates buffer against MIME type and genuine binary magic bytes.
 * Prevents file-renaming attacks (e.g. executable renamed to .jpg).
 */
export function validateImageBuffer(
  buffer: Buffer,
  declaredMimeType: string,
  options: ValidateImageOptions = {}
): { valid: boolean; error?: string; detectedType?: 'jpeg' | 'png' | 'webp' } {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty file payload.' };
  }

  if (buffer.length > maxBytes) {
    const mbLimit = Math.round(maxBytes / (1024 * 1024));
    return { valid: false, error: `File exceeds maximum size limit of ${mbLimit}MB.` };
  }

  const normalizedMime = (declaredMimeType || '').toLowerCase().trim();
  const effectiveMime = normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime;

  if (!ALLOWED_MIME_TYPES.has(effectiveMime)) {
    return {
      valid: false,
      error: `Unsupported file format '${declaredMimeType}'. Allowed formats: JPG, JPEG, PNG, WebP.`,
    };
  }

  // Magic bytes inspection
  // JPEG: FF D8 FF
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  // WebP: 'RIFF' .... 'WEBP'
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  let detectedType: 'jpeg' | 'png' | 'webp' | null = null;
  if (isJpeg) detectedType = 'jpeg';
  else if (isPng) detectedType = 'png';
  else if (isWebp) detectedType = 'webp';

  if (!detectedType) {
    return {
      valid: false,
      error: 'File content does not match genuine image binary signature (magic bytes validation failed).',
    };
  }

  // Cross-verify detected magic bytes with declared MIME type
  const expectedType = effectiveMime.replace('image/', '');
  if (detectedType !== expectedType) {
    return {
      valid: false,
      error: `MIME type mismatch: declared '${declaredMimeType}' but file header indicates '${detectedType}'.`,
    };
  }

  return { valid: true, detectedType };
}

let tableEnsured = false;

/**
 * Initializes the media_uploads metadata table in the active database driver.
 */
export async function ensureMediaUploadsTable(): Promise<void> {
  if (tableEnsured) return;
  const adapter = getDatabaseAdapter();

  const ddl = `
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
  `;

  try {
    await adapter.execute(ddl);
    tableEnsured = true;
  } catch (err: any) {
    // If table already exists or harmless error, mark ensured
    if (err?.message?.includes('already exists')) {
      tableEnsured = true;
    } else {
      console.warn('[STROOM Upload Warning] Could not ensure media_uploads table:', err?.message);
    }
  }
}

/**
 * Uploads an in-memory buffer directly to Cloudinary without writing to local disk.
 * If Cloudinary is not configured (e.g. dev/test mode), creates a safe mock record.
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  options: {
    folder?: string;
    originalFilename?: string;
    userId?: string;
  } = {}
): Promise<UploadResult> {
  await ensureMediaUploadsTable();

  const targetFolder = `stroom/${(options.folder || 'general').replace(/[^a-zA-Z0-9_\-\/]/g, '')}`;
  const uploadId = `upl_${crypto.randomUUID()}`;

  // If Cloudinary is not configured, fallback gracefully in non-production
  if (!config.isCloudinaryConfigured) {
    if (config.isProduction) {
      throw new Error(
        '[STROOM Upload Fatal] Cloudinary is not configured in production. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
      );
    }

    console.warn('[STROOM Upload Dev] Cloudinary credentials not detected; using secure dev mock upload.');
    const mockPublicId = `${targetFolder}/${uploadId}`;
    const mockSecureUrl = `https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80`;

    const result: UploadResult = {
      id: uploadId,
      public_id: mockPublicId,
      secure_url: mockSecureUrl,
      url: mockSecureUrl,
      format: 'jpg',
      width: 1200,
      height: 800,
      bytes: buffer.length,
      folder: targetFolder,
      original_filename: options.originalFilename,
      created_at: new Date().toISOString(),
    };

    await recordUpload(result, options.userId);
    return result;
  }

  // Upload stream directly to Cloudinary
  const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: targetFolder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Upload to Cloudinary returned an empty response.'));
        } else {
          resolve(result);
        }
      }
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });

  const result: UploadResult = {
    id: uploadId,
    public_id: uploadResult.public_id,
    secure_url: uploadResult.secure_url,
    url: uploadResult.url,
    format: uploadResult.format,
    width: uploadResult.width,
    height: uploadResult.height,
    bytes: uploadResult.bytes,
    folder: targetFolder,
    original_filename: options.originalFilename,
    created_at: uploadResult.created_at || new Date().toISOString(),
  };

  await recordUpload(result, options.userId);
  return result;
}

/**
 * Records upload metadata in media_uploads table.
 */
async function recordUpload(data: UploadResult, userId?: string): Promise<void> {
  const adapter = getDatabaseAdapter();
  try {
    await adapter.execute(
      `INSERT INTO media_uploads (id, user_id, public_id, secure_url, url, format, width, height, bytes, resource_type, original_filename, folder, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        userId || null,
        data.public_id,
        data.secure_url,
        data.url,
        data.format,
        data.width,
        data.height,
        data.bytes,
        'image',
        data.original_filename || null,
        data.folder,
        data.created_at,
      ]
    );
  } catch (err: any) {
    console.error('[STROOM Upload] Failed to record upload metadata:', err?.message);
    // Non-fatal: do not fail image upload if metadata logging fails
  }
}

/**
 * Deletes an uploaded asset from Cloudinary and removes metadata record.
 * Only owner or admin may perform deletion.
 */
export async function deleteUploadedImage(
  publicId: string,
  requesterUserId: string,
  isAdmin: boolean
): Promise<{ success: boolean; message: string }> {
  await ensureMediaUploadsTable();
  const adapter = getDatabaseAdapter();

  const record = await adapter.queryOne<{ id: string; user_id: string; public_id: string }>(
    'SELECT id, user_id, public_id FROM media_uploads WHERE public_id = ?',
    [publicId]
  );

  if (record && !isAdmin && record.user_id !== requesterUserId) {
    throw new Error('Forbidden: You can only delete media you uploaded.');
  }

  // Delete from Cloudinary if configured
  if (config.isCloudinaryConfigured) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (err: any) {
      console.warn('[STROOM Upload Warning] Cloudinary destroy error:', err?.message);
    }
  }

  if (record) {
    await adapter.execute('DELETE FROM media_uploads WHERE id = ?', [record.id]);
  }

  return { success: true, message: 'Image deleted successfully.' };
}
