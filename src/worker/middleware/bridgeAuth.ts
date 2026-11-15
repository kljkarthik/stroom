import { MiddlewareHandler } from 'hono';
import { Env } from '../types/env';
import {
  validateBridgeSecretConfig,
  verifyBridgeSecret,
  timingSafeStringEqual,
} from '../utils/crypto';

export interface BridgeContext {
  timestamp: number;
  nonce: string;
  action: string;
  rawBodyBytes: Uint8Array;
  parsedBody: any;
  matchedSecret: string;
}

export function bridgeAuthMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: { bridgeContext: BridgeContext };
}> {
  return async (c, next) => {
    // 1. Fail-closed Worker configuration validation per request
    const configCheck = validateBridgeSecretConfig(c.env);
    if (!configCheck.valid) {
      return c.json(
        {
          error: 'Internal Server Error',
          message: 'Bridge secret configuration invalid or missing.',
        },
        500
      );
    }

    // 2. Validate presence and formats of required security headers
    const secretHeader = c.req.header('x-stroom-bridge-secret');
    const timestampHeader = c.req.header('x-stroom-timestamp');
    const nonceHeader = c.req.header('x-stroom-nonce');
    const signatureHeader = c.req.header('x-stroom-signature');

    if (!secretHeader || !timestampHeader || !nonceHeader || !signatureHeader) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Missing required bridge authentication headers.',
        },
        401
      );
    }

    // Strict nonce validation: 16-128 ASCII [A-Za-z0-9_-]
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonceHeader)) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Malformed or invalid nonce format.',
        },
        401
      );
    }

    // Strict signature format: 64 hex characters (SHA-256 HMAC)
    if (!/^[a-f0-9]{64}$/i.test(signatureHeader)) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Malformed signature format.',
        },
        401
      );
    }

    // 3. Timestamp drift validation (+/- 30 seconds)
    const timestamp = Number(timestampHeader);
    if (isNaN(timestamp) || !Number.isInteger(timestamp)) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Malformed timestamp format.',
        },
        401
      );
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > 30000) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Timestamp drift exceeded (+/- 30s tolerance window).',
        },
        401
      );
    }

    // 4. Secret authentication (primary with rotation to previous)
    const secretVerification = await verifyBridgeSecret(secretHeader, c.env);
    if (!secretVerification.authorized || !secretVerification.matchedSecret) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Invalid, expired, or non-matching bridge secret.',
        },
        401
      );
    }

    // 5. Read exact raw HTTP request body bytes (bit-for-bit wire integrity)
    let buffer: ArrayBuffer;
    try {
      buffer = await c.req.raw.arrayBuffer();
    } catch {
      return c.json({ error: 'Bad Request', message: 'Unable to read request body.' }, 400);
    }
    const rawBodyBytes = new Uint8Array(buffer);

    // Compute SHA-256 digest of exact wire bytes
    const bodyDigestBuf = await crypto.subtle.digest('SHA-256', buffer);
    const bodyHash = Array.from(new Uint8Array(bodyDigestBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Parse JSON payload safely after recording wire bytes
    let parsedBody: any;
    try {
      const decodedText = new TextDecoder('utf-8').decode(rawBodyBytes);
      parsedBody = JSON.parse(decodedText);
    } catch {
      return c.json(
        {
          error: 'Bad Request',
          message: 'Invalid JSON payload or non-UTF-8 encoding.',
        },
        400
      );
    }

    if (!parsedBody || typeof parsedBody !== 'object') {
      return c.json({ error: 'Bad Request', message: 'Payload must be a JSON object.' }, 400);
    }

    const action = c.req.header('x-stroom-action') || parsedBody.action;
    if (!action || typeof action !== 'string') {
      return c.json({ error: 'Bad Request', message: 'Missing action identifier.' }, 400);
    }

    if (
      c.req.header('x-stroom-action') &&
      parsedBody.action &&
      c.req.header('x-stroom-action') !== parsedBody.action
    ) {
      return c.json(
        {
          error: 'Bad Request',
          message: 'Action header mismatch with payload action.',
        },
        400
      );
    }

    // 6. Verify HMAC-SHA256 signature over `${timestamp}:${nonce}:${action}:${bodyHash}`
    const sigPayload = `${timestamp}:${nonceHeader}:${action}:${bodyHash}`;
    const enc = new TextEncoder();
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(secretVerification.matchedSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expectedSigBuf = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(sigPayload));
    const expectedSigHex = Array.from(new Uint8Array(expectedSigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const sigMatches = await timingSafeStringEqual(
      signatureHeader.toLowerCase(),
      expectedSigHex.toLowerCase()
    );

    if (!sigMatches) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'HMAC signature verification failed (tampering or key mismatch).',
        },
        401
      );
    }

    // 7. Store verified context for downstream atomic route handler
    c.set('bridgeContext', {
      timestamp,
      nonce: nonceHeader,
      action,
      rawBodyBytes,
      parsedBody,
      matchedSecret: secretVerification.matchedSecret,
    });

    await next();
  };
}
