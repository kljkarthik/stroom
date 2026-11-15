import { Router, Response } from 'express';
import multer from 'multer';
import { requireAuth, AuthRequest } from '../middleware/auth';
import {
  validateImageBuffer,
  uploadImageBuffer,
  deleteUploadedImage,
  ensureMediaUploadsTable,
} from '../services/cloudinaryService';
import { hasAnyAdminAccess } from '../services/rbacService';
import { getDatabaseAdapter } from '../db/adapter';
import { sendSafeServerError } from '../services/securityService';

const router = Router();

// Multer in-memory storage only — never write to local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
});

// Middleware for Multer error handling (e.g., file size limit)
const uploadSingleImage = (fieldName: string) => {
  const handler = upload.single(fieldName);
  return (req: any, res: Response, next: any) => {
    handler(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds the 10MB limit.' });
        }
        return res.status(400).json({ error: `File upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message || 'File upload failed.' });
      }
      next();
    });
  };
};

/**
 * POST /api/upload/image
 * Uploads an image buffer directly to Cloudinary and returns the secure URL and metadata.
 */
router.post(
  '/image',
  requireAuth,
  uploadSingleImage('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No image file provided in request.' });
      }

      // MIME & Magic Bytes Validation
      const validation = validateImageBuffer(file.buffer, file.mimetype, {
        maxBytes: 10 * 1024 * 1024,
      });

      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Sanitized target folder
      const rawFolder = (req.body.folder || req.query.folder || 'general').toString();
      const folder = rawFolder.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 50) || 'general';

      const result = await uploadImageBuffer(file.buffer, {
        folder,
        originalFilename: file.originalname,
        userId: req.user?.id,
      });

      return res.status(201).json({
        success: true,
        url: result.secure_url,
        secure_url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      });
    } catch (err: any) {
      return sendSafeServerError(res, err, 'Failed to process image upload.');
    }
  }
);

/**
 * GET /api/upload/my-uploads
 * Lists uploaded images for the authenticated user.
 */
router.get('/my-uploads', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureMediaUploadsTable();
    const adapter = getDatabaseAdapter();
    const userId = req.user?.id;

    const uploads = await adapter.query<any>(
      `SELECT id, public_id, secure_url, format, width, height, bytes, folder, created_at
       FROM media_uploads
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.json({ uploads });
  } catch (err: any) {
    return sendSafeServerError(res, err, 'Failed to fetch uploaded media.');
  }
});

/**
 * DELETE /api/upload
 * Deletes an uploaded image by public_id (passed in query or body).
 * Only the owner or an admin may delete the image.
 */
router.delete('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const publicId = (req.body.public_id || req.query.public_id || '').toString().trim();
    if (!publicId) {
      return res.status(400).json({ error: 'public_id is required to delete an image.' });
    }

    const isAdmin = hasAnyAdminAccess(req.user?.role || '');
    const result = await deleteUploadedImage(publicId, req.user!.id, isAdmin);

    return res.json(result);
  } catch (err: any) {
    if (err?.message?.startsWith('Forbidden')) {
      return res.status(403).json({ error: err.message });
    }
    return sendSafeServerError(res, err, 'Failed to delete image.');
  }
});

export default router;
