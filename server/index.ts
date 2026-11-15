import express from 'express';
import cors from 'cors';
import path from 'path';
import { config, validateEnvironment } from './config/env';
import { initDatabase } from './db/database';
import { getDatabaseAdapter, getActiveDriver } from './db/adapter';
import { securityHeaders, globalErrorHandler } from './middleware/security';
import { originProxyAuthMiddleware } from './middleware/originProxyAuth';
import authRouter from './routes/auth';
import onboardingRouter from './routes/onboarding';
import discoveryRouter from './routes/discovery';
import preferencesRouter from './routes/preferences';
import adminRouter from './routes/admin';
import eventsRouter from './routes/events';
import auctionRouter from './routes/auction';
import passesRouter from './routes/passes';
import partnersRouter from './routes/partners';
import communitiesRouter from './routes/communities';
import contactRouter from './routes/contact';
import uploadRouter from './routes/upload';

validateEnvironment();

const app = express();
const PORT = config.port;

// Security hardening headers & Express fingerprinting removal
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(securityHeaders);

// Origin-aware CORS policy
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Server-to-server, curl, native webviews
      if (!config.isProduction) return callback(null, true);
      if (config.allowedOrigins.length > 0 && config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS policy'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

// Initialize SQLite database and seed initial data (SQLite driver only)
if (getActiveDriver() === 'sqlite') {
  initDatabase();
}

// Health Check (verifies live database connectivity & operational status)
app.get('/api/health', async (req, res) => {
  try {
    const adapter = getDatabaseAdapter();
    const ok = await adapter.ping();
    if (!ok) {
      return res.status(503).json({ status: 'degraded', database: 'unreachable', timestamp: new Date().toISOString() });
    }
    return res.json({
      status: 'ok',
      app: 'STROOM Auction Hub & Social Discovery API',
      version: '2.0.0',
      environment: config.nodeEnv,
      database: 'connected',
      integrations: {
        paymentGatewayConfigured: Boolean(process.env.RAZORPAY_KEY_ID || process.env.STRIPE_SECRET_KEY),
        emailProviderConfigured: Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY),
        cloudinaryConfigured: config.isCloudinaryConfigured,
        mediaStorage: config.isCloudinaryConfigured ? 'cloudinary' : 'external_url_references',
      },
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({
      status: 'error',
      database: 'failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// API Routes
app.use('/api/auth', originProxyAuthMiddleware, authRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/discovery', discoveryRouter);
app.use('/api/users', preferencesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/events', eventsRouter);
app.use('/api/auctions', auctionRouter);
app.use('/api/passes', passesRouter);
app.use('/api/partners', partnersRouter);
app.use('/api/communities', communitiesRouter);
app.use('/api/contact', contactRouter);
app.use('/api/upload', uploadRouter);

// Serve static frontend in production
const clientDistPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('Not Found');
    }
  });
});

app.use(globalErrorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[STROOM Server] Running on http://localhost:${PORT}`);
  });
}

export default app;
