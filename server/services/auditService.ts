import crypto from 'crypto';
import { getDatabaseAdapter } from '../db/adapter';

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'api_key',
  'apiKey',
  'authorization',
]);

export function sanitizeForAudit(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForAudit);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k) || k.toLowerCase().includes('password') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('token')) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = sanitizeForAudit(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface AuditLogInput {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: any;
  afterData?: any;
  details?: any;
  result?: 'success' | 'denied' | 'error';
  source?: string;
  throwOnError?: boolean;
}

export async function recordAuditLog(input: AuditLogInput): Promise<string | null> {
  try {
    const id = 'aud_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const detailsPayload = input.details ? sanitizeForAudit(input.details) : null;
    const beforePayload = input.beforeData !== undefined ? sanitizeForAudit(input.beforeData) : null;
    const afterPayload = input.afterData !== undefined ? sanitizeForAudit(input.afterData) : null;

    const adapter = getDatabaseAdapter();
    await adapter.execute(`
      INSERT INTO audit_logs (
        id, user_id, actor_name, actor_role, action, entity_type, entity_id,
        details_json, before_json, after_json, result, source, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      id,
      input.actorId || null,
      input.actorName || 'System',
      input.actorRole || 'system',
      input.action,
      input.entityType,
      input.entityId || null,
      detailsPayload ? JSON.stringify(detailsPayload) : null,
      beforePayload ? JSON.stringify(beforePayload) : null,
      afterPayload ? JSON.stringify(afterPayload) : null,
      input.result || 'success',
      input.source || 'admin_api'
    ]);
    return id;
  } catch (err) {
    console.warn('[auditService.recordAuditLog]', err);
    if (input.throwOnError) throw err;
    return null;
  }
}
