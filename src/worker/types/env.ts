import { D1Database, R2Bucket } from '@cloudflare/workers-types';

export interface Env {
  // Cloudflare D1 Database binding configured in wrangler.jsonc
  DB: D1Database;

  // Cloudflare R2 Media Bucket binding
  MEDIA_BUCKET?: R2Bucket;

  // Environment variables and secrets
  NODE_ENV?: 'development' | 'production' | 'test';
  PLATFORM_NAME?: string;
  DEFAULT_CITY?: string;
  AUTH_RATE_LIMIT_MAX?: string;
  JWT_SECRET?: string;
  ALLOWED_ORIGINS?: string;

  // Trust Path A: Express -> Worker -> D1
  INTERNAL_D1_BRIDGE_SECRET?: string;
  INTERNAL_D1_BRIDGE_SECRET_PREVIOUS?: string;
  INTERNAL_D1_BRIDGE_SECRET_PREVIOUS_EXPIRES_AT?: string;

  // Trust Path B: Worker -> Express
  ORIGIN_PROXY_SECRET?: string;
  ORIGIN_PROXY_SECRET_PREVIOUS?: string;
  ORIGIN_PROXY_SECRET_PREVIOUS_EXPIRES_AT?: string;
  ORIGIN_URL?: string;

  // Dedicated Internal Media Service Credential (Server-to-Server)
  INTERNAL_MEDIA_SECRET?: string;
  INTERNAL_MEDIA_SECRET_PREVIOUS?: string;
  INTERNAL_MEDIA_SECRET_PREVIOUS_EXPIRES_AT?: string;
}
