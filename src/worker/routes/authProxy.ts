import { Hono } from 'hono';
import { Env } from '../types/env';
import { isCanonicalBase64Url32Worker } from '../utils/crypto';

export const authProxyRouter = new Hono<{ Bindings: Env }>();

authProxyRouter.all('/auth/*', async (c) => {
  const originSecret = c.env.ORIGIN_PROXY_SECRET;
  if (!originSecret || !isCanonicalBase64Url32Worker(originSecret)) {
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'Origin proxy secret configuration invalid or missing.',
      },
      500
    );
  }

  const originUrl = c.env.ORIGIN_URL || 'http://127.0.0.1:5000';
  const url = new URL(c.req.url);
  // Match path after /api/auth or /auth
  const targetPath = url.pathname.replace(/^\/api\/auth/, '/api/auth').replace(/^\/auth/, '/api/auth');
  const targetUrl = new URL(targetPath + url.search, originUrl);

  // Clone headers and strictly strip internal headers
  const forwardedHeaders = new Headers();
  c.req.raw.headers.forEach((val, key) => {
    const lowerKey = key.toLowerCase();
    // Ingress sanitization: strip spoofed client internal headers
    if (lowerKey === 'x-stroom-origin-secret' || lowerKey === 'x-stroom-bridge-secret') {
      return;
    }
    // Do not forward host header
    if (lowerKey === 'host') {
      return;
    }
    forwardedHeaders.set(key, val);
  });

  // Inject trusted origin secret server-side
  forwardedHeaders.set('X-STROOM-Origin-Secret', originSecret);

  // Forward body if method permits
  let body: ArrayBuffer | undefined = undefined;
  if (!['GET', 'HEAD'].includes(c.req.method.toUpperCase())) {
    try {
      body = await c.req.raw.arrayBuffer();
    } catch {
      // Body may be empty
    }
  }

  try {
    const originResponse = await fetch(targetUrl.toString(), {
      method: c.req.method,
      headers: forwardedHeaders,
      body,
    });

    const responseHeaders = new Headers(originResponse.headers);
    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return c.json(
      {
        error: 'Bad Gateway',
        message: 'Origin backend unreachable.',
      },
      502
    );
  }
});
