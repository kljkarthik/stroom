import { Hono } from 'hono';
import { Env } from '../types/env';
import { createD1Client } from '../db/d1Client';

export const healthRouter = new Hono<{ Bindings: Env }>();

healthRouter.get('/health', async (c) => {
  const startTime = Date.now();
  let d1Status = 'disconnected';
  let d1ProbeOk = false;
  let applicationTableCount = 0;

  if (c.env?.DB) {
    try {
      const d1 = createD1Client(c.env.DB);
      const probe = await d1.probeHealth();
      d1ProbeOk = probe.ok;
      applicationTableCount = await d1.getApplicationTableCount();
      d1Status = probe.ok ? 'connected' : 'degraded';
    } catch {
      d1Status = 'error';
    }
  } else {
    d1Status = 'unconfigured';
  }

  const isHealthy = d1ProbeOk && applicationTableCount === 42;

  return c.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'stroom-worker-api',
      runtime: 'cloudflare-workers',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      database: {
        binding: 'DB',
        type: 'cloudflare-d1',
        status: d1Status,
        applicationTables: applicationTableCount,
        schemaVerified: applicationTableCount === 42,
      },
    },
    isHealthy ? 200 : 503
  );
});
