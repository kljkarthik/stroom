import 'dotenv/config';
import path from 'path';

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

  return {
    nodeEnv,
    isProduction,
    isTest,
    port,
    jwtSecret: envJwt || DEV_FALLBACK_JWT_SECRET,
    allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
    dbPath: process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.resolve(process.cwd(), 'data', 'stroom.db'),
    backupDir: process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.resolve(process.cwd(), 'backups'),
    authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || (isTest ? 500 : 25),
  };
}

export const config = loadConfig();

export function validateEnvironment(): void {
  // Re-runs production assertions explicitly at startup
  if (config.isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 24)) {
    throw new Error('[STROOM Security Fatal] Invalid production JWT_SECRET configuration.');
  }
}
