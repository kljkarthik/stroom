import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './db/database';
import authRouter from './routes/auth';
import onboardingRouter from './routes/onboarding';
import discoveryRouter from './routes/discovery';
import preferencesRouter from './routes/preferences';
import adminRouter from './routes/admin';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite database and seed initial data
initDatabase();

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Stroom Social Discovery API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/discovery', discoveryRouter);
app.use('/api/users', preferencesRouter);
app.use('/api/admin', adminRouter);

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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Stroom Server] Running on http://localhost:${PORT}`);
  });
}

export default app;
