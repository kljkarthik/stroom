import 'dotenv/config';
import path from 'path';
import { isCanonicalBase64Url32Node } from '../utils/crypto';

export const DEV_FALLBACK_JWT_SECRET = 'stroom_jwt_super_secret_vibe_key_2026';

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  isTest: boolean;
  port: number;
  jwtSecret: string;
  allowedOrigins: string[];
  dbPath: string;
  backupDir: string;
  authRateLimitMax: number;

  // Phase 2.5.1.1: Express -> Worker -> D1 Bridge
  useD1AuthBridge: boolean;
  internalD1BridgeSecret: string;
  internalD1BridgeSecretPrevious?: string;
  internalD1BridgeSecretPreviousExpiresAt?: number;
  d1BridgeUrl: string;

  // Phase 2.5.1.1: Worker -> Express Origin Proxy Guard
  originProxySecret: string;
  originProxySecretPrevious?: string;
  originProxySecretPreviousExpiresAt?: number;
  requireOriginProxyAuth: boolean;
}

function parseOrigins(raw?: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';
  const port = Number(process.env.PORT) || 5000;
  const envJwt = process.env.JWT_SECRET?.trim();

  if (isProduction) {
    if (!envJwt || envJwt === DEV_FALLBACK_JWT_SECRET || envJwt.length < 24) {
      throw new Error(
        '[STROOM Security Fatal] JWT_SECRET must be set in production to a random secret of at least 24 characters and must not use the development default.'
      );
    }
  } else if (!envJwt && !isTest) {
    console.warn('[STROOM Config Warning] JWT_SECRET not set in environment; using development fallback secret.');
  }

  let resolvedDbPath: string;
  const primaryDbPath = path.resolve(process.cwd(), 'data', 'stroom.db');
  const backupDirPath = path.resolve(process.cwd(), 'backups');

  if (isTest) {
    if (!process.env.DB_PATH || !process.env.DB_PATH.trim()) {
      throw new Error(
        '[STROOM Safety Fatal] Automated tests cannot start without an explicit process.env.DB_PATH configured. Silent fallback to the production database (data/stroom.db) is strictly prohibited.'
      );
    }
    resolvedDbPath = path.resolve(process.env.DB_PATH.trim());
    if (resolvedDbPath.toLowerCase() === primaryDbPath.toLowerCase()) {
      throw new Error(
        '[STROOM Safety Fatal] Attempted to use protected primary database (data/stroom.db) as a test database. This is strictly prohibited.'
      );
    }
    if (resolvedDbPath.toLowerCase().startsWith(backupDirPath.toLowerCase())) {
      throw new Error(
        '[STROOM Safety Fatal] Attempted to use protected backup directory as a test database target. This is strictly prohibited.'
      );
    }
  } else {
    resolvedDbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : primaryDbPath;
  }

  const useD1AuthBridge = process.env.ENABLE_D1_AUTH_BRIDGE === 'true';
  const internalD1BridgeSecret = process.env.INTERNAL_D1_BRIDGE_SECRET?.trim() || '';
  const internalD1BridgeSecretPrevious = process.env.INTERNAL_D1_BRIDGE_SECRET_PREVIOUS?.trim();
  const internalD1BridgeSecretPreviousExpiresAt = process.env.INTERNAL_D1_BRIDGE_SECRET_PREVIOUS_EXPIRES_AT
    ? Number(process.env.INTERNAL_D1_BRIDGE_SECRET_PREVIOUS_EXPIRES_AT)
    : undefined;
  const d1BridgeUrl = (process.env.D1_BRIDGE_URL?.trim() || 'http://127.0.0.1:8787').replace(/\/+$/, '');

  const originProxySecret = process.env.ORIGIN_PROXY_SECRET?.trim() || '';
  const originProxySecretPrevious = process.env.ORIGIN_PROXY_SECRET_PREVIOUS?.trim();
  const originProxySecretPreviousExpiresAt = process.env.ORIGIN_PROXY_SECRET_PREVIOUS_EXPIRES_AT
    ? Number(process.env.ORIGIN_PROXY_SECRET_PREVIOUS_EXPIRES_AT)
    : undefined;
  const requireOriginProxyAuth = process.env.REQUIRE_ORIGIN_PROXY_AUTH === 'true';

  return {
    nodeEnv,
    isProduction,
    isTest,
    port,
    jwtSecret: envJwt || DEV_FALLBACK_JWT_SECRET,
    allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
    dbPath: resolvedDbPath,
    backupDir: process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : backupDirPath,
    authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || (isTest ? 500 : 25),

    useD1AuthBridge,
    internalD1BridgeSecret,
    internalD1BridgeSecretPrevious,
    internalD1BridgeSecretPreviousExpiresAt,
    d1BridgeUrl,

    originProxySecret,
    originProxySecretPrevious,
    originProxySecretPreviousExpiresAt,
    requireOriginProxyAuth,
  };
}

export const config = loadConfig();

export function validateEnvironment(): void {
  // Re-runs production assertions explicitly at startup
  if (config.isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 24)) {
    throw new Error('[STROOM Security Fatal] Invalid production JWT_SECRET configuration.');
  }

  // Fail-closed startup checks for D1 bridge when feature flag is enabled
  if (config.useD1AuthBridge) {
    if (!config.internalD1BridgeSecret || !isCanonicalBase64Url32Node(config.internalD1BridgeSecret)) {
      throw new Error(
        '[STROOM Config Fatal] ENABLE_D1_AUTH_BRIDGE is true but INTERNAL_D1_BRIDGE_SECRET is missing or non-canonical 43-character Base64URL.'
      );
    }
    if (!config.d1BridgeUrl) {
      throw new Error(
        '[STROOM Config Fatal] ENABLE_D1_AUTH_BRIDGE is true but D1_BRIDGE_URL is not configured.'
      );
    }
  }

  // Fail-closed startup checks for Origin Proxy Auth when required
  if (config.requireOriginProxyAuth) {
    if (!config.originProxySecret || !isCanonicalBase64Url32Node(config.originProxySecret)) {
      throw new Error(
        '[STROOM Config Fatal] REQUIRE_ORIGIN_PROXY_AUTH is true but ORIGIN_PROXY_SECRET is missing or non-canonical 43-character Base64URL.'
      );
    }
  }
}
