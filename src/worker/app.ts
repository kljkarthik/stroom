import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { Env } from './types/env';
import { healthRouter } from './routes/health';
import { internalBridgeRouter } from './routes/internalBridge';
import { authProxyRouter } from './routes/authProxy';
import { mediaRouter } from './routes/media';

export function createApp(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  // Global secure headers
  app.use('*', secureHeaders());

  // CORS middleware allowing frontend local and production origins
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return '*';
        const allowed = [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5173',
          'https://stroom.in',
          'https://www.stroom.in',
          'https://strangersroom.in',
          'https://www.strangersroom.in',
          'https://stroom.pages.dev',
        ];
        return allowed.includes(origin) ? origin : null;
      },
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-STROOM-Bridge-Secret', 'X-STROOM-Timestamp', 'X-STROOM-Nonce', 'X-STROOM-Signature', 'X-STROOM-Action'],
      credentials: true,
    })
  );

  // Mount API routers
  app.route('/api', healthRouter);
  app.route('/api', internalBridgeRouter);
  app.route('/api', authProxyRouter);
  app.route('/api', mediaRouter);

  // Fallback 404 handler
  app.notFound((c) => {
    return c.json({ error: 'Endpoint not found' }, 404);
  });

  // Global error handler
  app.onError((err, c) => {
    return c.json(
      {
        error: 'Internal Server Error',
        message: c.env?.NODE_ENV === 'development' ? err.message : undefined,
      },
      500
    );
  });

  return app;
}
