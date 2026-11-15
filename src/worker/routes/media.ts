import { Hono } from 'hono';
import { Env } from '../types/env';
import { verifyWorkerJwt, verifyMediaSecret, WorkerJwtPayload } from '../utils/crypto';

export const mediaRouter = new Hono<{ Bindings: Env }>();

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates the file signature (magic bytes) to ensure the payload matches its declared MIME type.
 * Explicitly rejects SVG, HTML, scripts, or executables.
 */
export function validateMagicBytes(
  buffer: ArrayBuffer,
  mimeType: string
): { valid: boolean; reason?: string } {
  const normalizedMime = mimeType.toLowerCase();
  if (
    normalizedMime.includes('svg') ||
    normalizedMime.includes('html') ||
    normalizedMime.includes('xml') ||
    normalizedMime.includes('javascript') ||
    normalizedMime.includes('octet-stream')
  ) {
    return {
      valid: false,
      reason: 'SVG, HTML, XML, script, and raw binary uploads are strictly prohibited for security.',
    };
  }

  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) {
    return {
      valid: false,
      reason: 'Payload is too small to contain valid image file headers.',
    };
  }

  if (normalizedMime === 'image/jpeg') {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: 'File signature (magic bytes) does not match JPEG format (expected FF D8 FF).',
    };
  }

  if (normalizedMime === 'image/png') {
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: 'File signature (magic bytes) does not match PNG format (expected 89 50 4E 47...).',
    };
  }

  if (normalizedMime === 'image/gif') {
    if (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) &&
      bytes[5] === 0x61
    ) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: 'File signature (magic bytes) does not match GIF format (expected GIF87a or GIF89a).',
    };
  }

  if (normalizedMime === 'image/webp') {
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: 'File signature (magic bytes) does not match WebP RIFF/WEBP format.',
    };
  }

  return { valid: false, reason: `Unsupported media type: ${mimeType}` };
}

/**
 * Enforces user JWT authentication for public client-facing media endpoints.
 * Explicitly rejects bridge secrets when supplied as user credentials.
 */
async function authenticateUserJwt(
  c: any
): Promise<{ authenticated: boolean; user?: WorkerJwtPayload; reason?: string }> {
  // Reject internal service credential substitution on public client endpoints
  const serviceHeader =
    c.req.header('x-stroom-media-secret') ||
    c.req.header('x-stroom-bridge-secret') ||
    c.req.header('x-stroom-origin-secret');
  if (serviceHeader) {
    return {
      authenticated: false,
      reason: 'Internal service credentials cannot be used as user authentication on public media endpoints.',
    };
  }

  const authHeader = c.req.header('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      reason: 'Authentication required. Please provide a valid Bearer token.',
    };
  }

  const token = authHeader.substring(7).trim();
  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    return { authenticated: false, reason: 'JWT authentication not configured on Worker.' };
  }

  const result = await verifyWorkerJwt(token, jwtSecret);
  if (result.valid && result.payload) {
    return { authenticated: true, user: result.payload };
  }

  return { authenticated: false, reason: result.reason || 'Invalid JWT token.' };
}

/**
 * Authenticates internal service-to-service requests using dedicated internal media credential.
 * Strictly isolates media operations from D1 bridge credentials and origin proxy credentials.
 */
async function authenticateInternalMediaService(
  c: any
): Promise<{ authorized: boolean; reason?: string }> {
  // 1. Reject browser/user JWT credentials on internal endpoint
  const authHeader = c.req.header('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      reason: 'Browser or user credentials cannot invoke internal media endpoints.',
    };
  }

  // 2. Reject D1 bridge credential cross-substitution
  const bridgeHeader = c.req.header('x-stroom-bridge-secret');
  if (bridgeHeader) {
    return {
      authorized: false,
      reason: 'D1 bridge credentials cannot be used for internal media operations. Dedicated internal media credential required.',
    };
  }

  // 3. Reject origin proxy credential cross-substitution
  const originHeader = c.req.header('x-stroom-origin-secret');
  if (originHeader) {
    return {
      authorized: false,
      reason: 'Origin proxy credentials cannot be used for internal media operations. Dedicated internal media credential required.',
    };
  }

  // 4. Require dedicated X-STROOM-Media-Secret
  const mediaSecret = c.req.header('x-stroom-media-secret');
  if (!mediaSecret) {
    return { authorized: false, reason: 'Missing X-STROOM-Media-Secret header.' };
  }

  const result = await verifyMediaSecret(mediaSecret, c.env);
  if (result.authorized) {
    return { authorized: true };
  }

  return { authorized: false, reason: result.reason || 'Invalid internal media credential.' };
}

/**
 * POST /api/media/upload (Public Client Route)
 * Requires verified user JWT.
 * Strictly rejects bridge secrets as user credentials.
 * Enforces magic-byte verification, 5MB limits, and public vs private object policy.
 */
mediaRouter.post('/media/upload', async (c) => {
  if (!c.env.MEDIA_BUCKET) {
    return c.json(
      {
        error: 'Service Unavailable',
        message: 'Cloudflare R2 Media Bucket is not configured or unavailable.',
      },
      503
    );
  }

  // 1. Enforce verified user JWT
  const auth = await authenticateUserJwt(c);
  if (!auth.authenticated || !auth.user) {
    return c.json(
      {
        error: 'Unauthorized',
        message: auth.reason || 'Authentication required to upload media.',
      },
      401
    );
  }

  const contentType = c.req.header('content-type') || '';
  let fileBuffer: ArrayBuffer | null = null;
  let mimeType = '';
  let visibility = (
    c.req.query('visibility') ||
    c.req.header('x-media-visibility') ||
    'public'
  ).toLowerCase();

  if (visibility !== 'public' && visibility !== 'private') {
    visibility = 'public';
  }

  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await c.req.parseBody();
      const file = formData['file'];
      if (!file || !(file instanceof File)) {
        return c.json(
          {
            error: 'Bad Request',
            message: 'No valid file found in multipart form-data (field "file").',
          },
          400
        );
      }
      fileBuffer = await file.arrayBuffer();
      mimeType = file.type || 'application/octet-stream';
      if (formData['visibility'] && typeof formData['visibility'] === 'string') {
        const formVis = formData['visibility'].toLowerCase();
        if (formVis === 'public' || formVis === 'private') {
          visibility = formVis;
        }
      }
    } catch {
      return c.json(
        { error: 'Bad Request', message: 'Failed to parse multipart form-data.' },
        400
      );
    }
  } else {
    mimeType = contentType.split(';')[0].trim().toLowerCase();
    try {
      fileBuffer = await c.req.raw.arrayBuffer();
    } catch {
      return c.json(
        { error: 'Bad Request', message: 'Failed to read request body.' },
        400
      );
    }
  }

  if (!fileBuffer || fileBuffer.byteLength === 0) {
    return c.json({ error: 'Bad Request', message: 'Empty file payload.' }, 400);
  }

  // 2. Enforce 5MB File Size Limit
  if (fileBuffer.byteLength > MAX_FILE_SIZE) {
    return c.json(
      {
        error: 'Payload Too Large',
        message: `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
      },
      413
    );
  }

  // 3. Enforce Allowed MIME Types
  const ext = ALLOWED_MIME_TYPES[mimeType];
  if (!ext) {
    return c.json(
      {
        error: 'Unsupported Media Type',
        message: 'Only JPEG, PNG, WebP, and GIF images are permitted.',
      },
      415
    );
  }

  // 4. Enforce Magic-Byte (File Signature) Verification
  const magicValidation = validateMagicBytes(fileBuffer, mimeType);
  if (!magicValidation.valid) {
    return c.json(
      {
        error: 'Bad Request',
        message: magicValidation.reason || 'File magic bytes do not match declared MIME type.',
      },
      400
    );
  }

  // 5. Generate Object Key and Metadata based on User Identity and Policy
  const uuid = crypto.randomUUID().replace(/-/g, '');
  const fileKey =
    visibility === 'private'
      ? `priv_${auth.user.id}_${uuid}.${ext}`
      : `pub_${uuid}.${ext}`;

  try {
    await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
      httpMetadata: {
        contentType: mimeType,
      },
      customMetadata: {
        visibility,
        ownerId: auth.user.id,
        uploaderRole: auth.user.role,
        uploadedAt: new Date().toISOString(),
      },
    });

    return c.json(
      {
        success: true,
        key: fileKey,
        url: `/api/media/${fileKey}`,
        visibility,
        ownerId: auth.user.id,
        sizeBytes: fileBuffer.byteLength,
        contentType: mimeType,
      },
      201
    );
  } catch {
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to store file in R2 storage.',
      },
      500
    );
  }
});

/**
 * POST /api/internal/media/upload (Internal Service-to-Service Route)
 * Strictly isolated behind internal bridge authentication.
 * Does not accept user JWTs. Used exclusively for backend service operations.
 */
mediaRouter.post('/internal/media/upload', async (c) => {
  if (!c.env.MEDIA_BUCKET) {
    return c.json(
      {
        error: 'Service Unavailable',
        message: 'Cloudflare R2 Media Bucket is not configured or unavailable.',
      },
      503
    );
  }

  // Enforce internal media service authentication
  const internalAuth = await authenticateInternalMediaService(c);
  if (!internalAuth.authorized) {
    return c.json(
      {
        error: 'Unauthorized',
        message: internalAuth.reason || 'Invalid internal media credential.',
      },
      401
    );
  }

  const contentType = c.req.header('content-type') || '';
  const mimeType = contentType.split(';')[0].trim().toLowerCase();

  let fileBuffer: ArrayBuffer | null = null;
  try {
    fileBuffer = await c.req.raw.arrayBuffer();
  } catch {
    return c.json({ error: 'Bad Request', message: 'Failed to read request body.' }, 400);
  }

  if (!fileBuffer || fileBuffer.byteLength === 0) {
    return c.json({ error: 'Bad Request', message: 'Empty file payload.' }, 400);
  }

  if (fileBuffer.byteLength > MAX_FILE_SIZE) {
    return c.json(
      {
        error: 'Payload Too Large',
        message: `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
      },
      413
    );
  }

  const ext = ALLOWED_MIME_TYPES[mimeType];
  if (!ext) {
    return c.json(
      {
        error: 'Unsupported Media Type',
        message: 'Only JPEG, PNG, WebP, and GIF images are permitted.',
      },
      415
    );
  }

  const magicValidation = validateMagicBytes(fileBuffer, mimeType);
  if (!magicValidation.valid) {
    return c.json(
      {
        error: 'Bad Request',
        message: magicValidation.reason || 'File magic bytes do not match declared MIME type.',
      },
      400
    );
  }

  const uuid = crypto.randomUUID().replace(/-/g, '');
  const fileKey = `internal_${uuid}.${ext}`;

  try {
    await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
      httpMetadata: { contentType: mimeType },
      customMetadata: {
        visibility: 'internal',
        serviceUpload: 'true',
        uploadedBy: 'internal_media_service',
        uploadedAt: new Date().toISOString(),
      },
    });

    return c.json(
      {
        success: true,
        key: fileKey,
        url: `/api/media/${fileKey}`,
        visibility: 'internal',
        sizeBytes: fileBuffer.byteLength,
        contentType: mimeType,
      },
      201
    );
  } catch {
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to store file in R2 storage.' },
      500
    );
  }
});

/**
 * GET /api/media/:key
 * Path traversal protected.
 * Enforces Public vs Private object policy:
 * - Public objects: cached publicly with immutable cache header and nosniff.
 * - Private objects: requires verified user JWT. Bridge secrets are strictly rejected.
 *   User must be the owner or an administrator.
 * - Never serves raw HTML/SVG scripts.
 */
mediaRouter.get('/media/:key', async (c) => {
  if (!c.env.MEDIA_BUCKET) {
    return c.json(
      {
        error: 'Service Unavailable',
        message: 'Cloudflare R2 Media Bucket is not configured or unavailable.',
      },
      503
    );
  }

  const key = c.req.param('key');

  if (!/^[a-zA-Z0-9_\-\.]+$/.test(key) || key.includes('..') || key.includes('/') || key.includes('\\')) {
    return c.json({ error: 'Bad Request', message: 'Invalid media key format.' }, 400);
  }

  try {
    const object = await c.env.MEDIA_BUCKET.get(key);
    if (!object) {
      return c.json({ error: 'Not Found', message: 'Media object not found.' }, 404);
    }

    const isPrivate =
      key.startsWith('priv_') ||
      object.customMetadata?.visibility === 'private';

    if (isPrivate) {
      // Enforce verified user JWT
      const auth = await authenticateUserJwt(c);
      if (!auth.authenticated || !auth.user) {
        return c.json(
          {
            error: 'Unauthorized',
            message: auth.reason || 'Authentication required to access private media object.',
          },
          401
        );
      }

      const ownerId = object.customMetadata?.ownerId;
      const isOwner =
        (ownerId && ownerId === auth.user.id) ||
        key.startsWith(`priv_${auth.user.id}_`);
      const isAdmin =
        auth.user.role === 'admin' ||
        auth.user.role === 'super_admin';

      if (!isOwner && !isAdmin) {
        return c.json(
          {
            error: 'Forbidden',
            message: 'You do not have permission to access this private media object.',
          },
          403
        );
      }

      let contentType = object.httpMetadata?.contentType || 'application/octet-stream';
      if (
        contentType.includes('html') ||
        contentType.includes('svg') ||
        contentType.includes('xml')
      ) {
        contentType = 'application/octet-stream';
      }

      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Content-Security-Policy', "default-src 'none'; sandbox");

      return new Response(object.body as any, {
        status: 200,
        headers,
      });
    }

    // Public Media Object
    let contentType = object.httpMetadata?.contentType || 'application/octet-stream';
    if (
      contentType.includes('html') ||
      contentType.includes('svg') ||
      contentType.includes('xml')
    ) {
      contentType = 'application/octet-stream';
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
    if (object.httpEtag) {
      headers.set('ETag', object.httpEtag);
    }

    return new Response(object.body as any, {
      status: 200,
      headers,
    });
  } catch {
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to retrieve media object.' },
      500
    );
  }
});
