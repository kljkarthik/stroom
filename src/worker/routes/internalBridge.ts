import { Hono } from 'hono';
import { Env } from '../types/env';
import { bridgeAuthMiddleware, BridgeContext } from '../middleware/bridgeAuth';

export const VALID_ROLES = [
  'super_admin',
  'admin',
  'platform_admin',
  'event_manager',
  'auctioneer',
  'auction_manager',
  'community_manager',
  'partner_manager',
  'checkin_staff',
  'support_staff',
  'venue_partner',
  'participant',
  'user',
] as const;

export const PRIVILEGED_ROLES = ['super_admin', 'admin', 'platform_admin'];

export const ALLOWED_ACTIONS = [
  'getUserForLogin',
  'createUser',
  'updatePasswordHash',
  'changePassword',
  'changeAccountStatus',
  'updateUserRole',
] as const;

export const internalBridgeRouter = new Hono<{
  Bindings: Env;
  Variables: { bridgeContext: BridgeContext };
}>();

// Mount bridge authentication guard
internalBridgeRouter.use('/internal/d1/execute', bridgeAuthMiddleware());

internalBridgeRouter.post('/internal/d1/execute', async (c) => {
  const ctx = c.get('bridgeContext');
  if (!ctx) {
    return c.json({ error: 'Unauthorized', message: 'Bridge context missing.' }, 401);
  }

  const { action, parsedBody, nonce } = ctx;
  const params = parsedBody.params || {};
  const actor = parsedBody.actor;

  // 1. Verify D1 database binding availability
  if (!c.env.DB) {
    return c.json(
      {
        error: 'Service Unavailable',
        message: 'D1 database binding unreachable. Fail-closed.',
      },
      503
    );
  }

  // 2. Strict action allowlisting
  if (!ALLOWED_ACTIONS.includes(action as any)) {
    return c.json(
      {
        error: 'Bad Request',
        message: `Unsupported or unallowlisted bridge action: ${action}`,
      },
      400
    );
  }

  const now = Date.now();
  const nonceExpiresAt = now + 60000; // 60 seconds TTL

  // Opportunistic cleanup of expired nonces (older than now - 60s)
  try {
    const prunePromise = c.env.DB.prepare(
      'DELETE FROM _internal_bridge_nonces WHERE expires_at < ?'
    )
      .bind(now - 60000)
      .run();
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(prunePromise.catch(() => {}));
    } else {
      prunePromise.catch(() => {});
    }
  } catch {
    // Non-blocking prune error
  }

  // Statement 1: Nonce insertion statement
  const nonceStmt = c.env.DB.prepare(
    'INSERT INTO _internal_bridge_nonces (nonce, created_at, expires_at) VALUES (?, ?, ?)'
  ).bind(nonce, now, nonceExpiresAt);

  try {
    switch (action) {
      case 'getUserForLogin': {
        const email = params.email;
        if (!email || typeof email !== 'string') {
          return c.json({ error: 'Bad Request', message: 'Email parameter required.' }, 400);
        }

        const normalizedEmail = email.trim().toLowerCase();
        const selectStmt = c.env.DB.prepare(
          `SELECT id, email, password_hash, full_name, avatar_url, role, account_status, onboarding_status, created_at, updated_at
           FROM users
           WHERE lower(email) = lower(?)`
        ).bind(normalizedEmail);

        // Atomic D1 batch execution: consumes nonce + executes SELECT
        const batchResults = await c.env.DB.batch([nonceStmt, selectStmt]);
        const selectResult = batchResults[1];
        const user = (selectResult.results?.[0] as any) || null;

        return c.json({
          success: true,
          action,
          user,
        });
      }

      case 'createUser': {
        const { id, email, password_hash, full_name, avatar_url } = params;
        if (!id || !email || !password_hash || !full_name) {
          return c.json(
            {
              error: 'Bad Request',
              message: 'Missing required parameters for createUser (id, email, password_hash, full_name).',
            },
            400
          );
        }

        const normalizedEmail = email.trim().toLowerCase();
        const defaultAvatar =
          avatar_url ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(full_name.trim())}`;

        const insertStmt = c.env.DB.prepare(
          `INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, onboarding_status)
           VALUES (?, ?, ?, ?, ?, 'user', 'NOT_STARTED')`
        ).bind(id, normalizedEmail, password_hash, full_name.trim(), defaultAvatar);

        try {
          await c.env.DB.batch([nonceStmt, insertStmt]);
          return c.json(
            {
              success: true,
              action,
              userId: id,
            },
            201
          );
        } catch (dbErr: any) {
          const errMsg = String(dbErr?.message || '');

          // Check if nonce replay caused the failure
          if (
            errMsg.includes('_internal_bridge_nonces') &&
            (errMsg.includes('UNIQUE') || errMsg.includes('PRIMARYKEY'))
          ) {
            return c.json(
              {
                error: 'Conflict',
                message: 'Replay detected: nonce has already been consumed.',
              },
              409
            );
          }

          // Handle duplicate user constraint & idempotent retry reconciliation
          if (errMsg.includes('users') && (errMsg.includes('UNIQUE') || errMsg.includes('constraint'))) {
            // Check if existing record matches the same registration attempt (same ID and email)
            const existing = await c.env.DB.prepare(
              'SELECT id, email FROM users WHERE lower(email) = lower(?)'
            )
              .bind(normalizedEmail)
              .first<{ id: string; email: string }>();

            if (existing && existing.id === id) {
              // Idempotent retry reconciliation: previous attempt succeeded before network timeout
              return c.json({
                success: true,
                action,
                userId: id,
                reconciled: true,
              });
            }

            return c.json(
              {
                error: 'Conflict',
                message: 'An account with this email already exists.',
                code: 'USER_EXISTS',
              },
              409
            );
          }

          throw dbErr;
        }
      }

      case 'updatePasswordHash': {
        const { id, password_hash } = params;
        if (!id || !password_hash) {
          return c.json(
            { error: 'Bad Request', message: 'Missing parameters (id, password_hash).' },
            400
          );
        }

        const updateStmt = c.env.DB.prepare(
          "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(password_hash, id);

        const batchResults = await c.env.DB.batch([nonceStmt, updateStmt]);
        const updateResult = batchResults[1];

        return c.json({
          success: true,
          action,
          rowsUpdated: updateResult.meta?.changes ?? 1,
        });
      }

      case 'changePassword': {
        const { id, password_hash } = params;
        if (!id || !password_hash) {
          return c.json(
            { error: 'Bad Request', message: 'Missing parameters (id, password_hash).' },
            400
          );
        }

        const updateStmt = c.env.DB.prepare(
          "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(password_hash, id);

        const batchResults = await c.env.DB.batch([nonceStmt, updateStmt]);
        const updateResult = batchResults[1];

        return c.json({
          success: true,
          action,
          rowsUpdated: updateResult.meta?.changes ?? 1,
        });
      }

      case 'changeAccountStatus': {
        const { id, account_status } = params;
        if (!id || !account_status) {
          return c.json(
            { error: 'Bad Request', message: 'Missing parameters (id, account_status).' },
            400
          );
        }

        if (!['active', 'suspended'].includes(account_status)) {
          return c.json(
            { error: 'Bad Request', message: 'Invalid account_status (active or suspended).' },
            400
          );
        }

        // Administrative actor authorization validation
        if (!actor || !actor.id || !actor.role) {
          return c.json(
            {
              error: 'Forbidden',
              message: 'Verified administrator actor context required for account status change.',
            },
            403
          );
        }

        // Self-modification defense
        if (actor.id === id) {
          return c.json(
            { error: 'Bad Request', message: 'Cannot modify your own administrative account status.' },
            400
          );
        }

        // Target role protection: check target user's role
        const target = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?')
          .bind(id)
          .first<{ id: string; role: string }>();

        if (!target) {
          return c.json({ error: 'Not Found', message: 'Member not found.' }, 404);
        }

        if (PRIVILEGED_ROLES.includes(target.role) && actor.role !== 'super_admin') {
          return c.json(
            {
              error: 'Forbidden',
              message: 'Only a Super Admin can suspend or reactivate privileged administrator accounts.',
            },
            403
          );
        }

        const updateStmt = c.env.DB.prepare(
          "UPDATE users SET account_status = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(account_status, id);

        const batchResults = await c.env.DB.batch([nonceStmt, updateStmt]);
        const updateResult = batchResults[1];

        return c.json({
          success: true,
          action,
          rowsUpdated: updateResult.meta?.changes ?? 1,
          memberId: id,
          account_status,
        });
      }

      case 'updateUserRole': {
        const { id, role } = params;
        if (!id || !role) {
          return c.json({ error: 'Bad Request', message: 'Missing parameters (id, role).' }, 400);
        }

        if (!VALID_ROLES.includes(role as any)) {
          return c.json(
            { error: 'Bad Request', message: `Invalid role key: ${role}. Must be one of 13 official roles.` },
            400
          );
        }

        // Administrative actor authorization validation
        if (!actor || !actor.id || !actor.role) {
          return c.json(
            {
              error: 'Forbidden',
              message: 'Verified administrator actor context required for role assignment.',
            },
            403
          );
        }

        // Self-modification defense
        if (actor.id === id) {
          return c.json(
            { error: 'Bad Request', message: 'Cannot alter your own administrative role.' },
            400
          );
        }

        // Privilege escalation prevention
        if (
          (PRIVILEGED_ROLES.includes(role) || actor.role !== 'super_admin') &&
          PRIVILEGED_ROLES.includes(role)
        ) {
          if (actor.role !== 'super_admin') {
            return c.json(
              {
                error: 'Forbidden',
                message: 'Forbidden: Only Super Admins can assign or modify privileged Admin roles.',
              },
              403
            );
          }
        }

        // Target user protection
        const target = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?')
          .bind(id)
          .first<{ id: string; role: string }>();

        if (!target) {
          return c.json({ error: 'Not Found', message: 'Member not found.' }, 404);
        }

        if (PRIVILEGED_ROLES.includes(target.role) && actor.role !== 'super_admin') {
          return c.json(
            {
              error: 'Forbidden',
              message: 'Forbidden: Only Super Admins can alter existing privileged Admin roles.',
            },
            403
          );
        }

        const updateStmt = c.env.DB.prepare(
          "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(role, id);

        const batchResults = await c.env.DB.batch([nonceStmt, updateStmt]);
        const updateResult = batchResults[1];

        return c.json({
          success: true,
          action,
          rowsUpdated: updateResult.meta?.changes ?? 1,
          memberId: id,
          role,
        });
      }

      default:
        return c.json({ error: 'Bad Request', message: `Unhandled action: ${action}` }, 400);
    }
  } catch (err: any) {
    const errMsg = String(err?.message || '');

    // Replay detection on Statement 1 constraint violation
    if (
      errMsg.includes('_internal_bridge_nonces') &&
      (errMsg.includes('UNIQUE') || errMsg.includes('PRIMARYKEY'))
    ) {
      return c.json(
        {
          error: 'Conflict',
          message: 'Replay detected: nonce has already been consumed.',
        },
        409
      );
    }

    // D1 storage / connectivity failure -> 503 fail-closed
    if (
      errMsg.includes('D1_ERROR') ||
      errMsg.includes('storage') ||
      errMsg.includes('network') ||
      errMsg.includes('timeout')
    ) {
      return c.json(
        {
          error: 'Service Unavailable',
          message: 'D1 database execution failure. Fail-closed.',
        },
        503
      );
    }

    return c.json(
      {
        error: 'Internal Server Error',
        message: 'Internal bridge execution error.',
      },
      500
    );
  }
});
