import crypto from 'node:crypto';
import { config } from '../config/env';

export interface BridgeActorContext {
  id: string;
  role: string;
}

export interface D1BridgeRequestPayload {
  action: string;
  params: Record<string, any>;
  actor?: BridgeActorContext;
}

export interface D1BridgeResponse<T = any> {
  success: boolean;
  action?: string;
  data?: T;
  error?: string;
  code?: string;
  status: number;
}

export class D1BridgeClient {
  private bridgeUrl: string;
  private secret: string;

  constructor(bridgeUrl?: string, secret?: string) {
    this.bridgeUrl = (bridgeUrl || config.d1BridgeUrl || 'http://127.0.0.1:8787').replace(/\/+$/, '');
    this.secret = secret || config.internalD1BridgeSecret || '';
  }

  /**
   * Dispatches an authenticated request to the Cloudflare Worker D1 Bridge endpoint.
   * Computes exact raw wire-byte SHA-256 hash and HMAC-SHA256 signature.
   */
  async execute<T = any>(
    action: string,
    params: Record<string, any>,
    actor?: BridgeActorContext,
    customSecret?: string
  ): Promise<D1BridgeResponse<T>> {
    const activeSecret = customSecret || this.secret;
    if (!activeSecret) {
      throw new Error('[D1 Bridge Client Fatal] Bridge secret is not configured.');
    }

    const payload: D1BridgeRequestPayload = {
      action,
      params,
    };
    if (actor) {
      payload.actor = { id: actor.id, role: actor.role };
    }

    // Exact raw wire bytes serialization
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');

    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex'); // 32 hex chars

    const sigPayload = `${timestamp}:${nonce}:${action}:${bodyHash}`;
    const signature = crypto.createHmac('sha256', activeSecret).update(sigPayload).digest('hex');

    const url = `${this.bridgeUrl}/api/internal/d1/execute`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-STROOM-Bridge-Secret': activeSecret,
          'X-STROOM-Timestamp': String(timestamp),
          'X-STROOM-Nonce': nonce,
          'X-STROOM-Signature': signature,
          'X-STROOM-Action': action,
        },
        body: rawBody,
      });

      let responseJson: any = null;
      try {
        responseJson = await response.json();
      } catch {
        // Response was not JSON
      }

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          error: responseJson?.message || responseJson?.error || `Bridge returned HTTP ${response.status}`,
          code: responseJson?.code,
        };
      }

      return {
        success: true,
        action,
        status: response.status,
        data: responseJson,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 503,
        error: `Bridge connectivity failure: ${err?.message || 'Network error'}`,
        code: 'BRIDGE_UNREACHABLE',
      };
    }
  }

  // --- 1. getUserForLogin ---
  async getUserForLogin(email: string): Promise<{ success: boolean; user: any | null; error?: string }> {
    const res = await this.execute('getUserForLogin', { email });
    if (!res.success) {
      return { success: false, user: null, error: res.error };
    }
    return { success: true, user: res.data?.user ?? null };
  }

  // --- 2. createUser ---
  async createUser(params: {
    id: string;
    email: string;
    password_hash: string;
    full_name: string;
    avatar_url?: string;
  }): Promise<{ success: boolean; userId?: string; reconciled?: boolean; error?: string; code?: string }> {
    const res = await this.execute('createUser', params);
    if (!res.success) {
      return { success: false, error: res.error, code: res.code };
    }
    return {
      success: true,
      userId: res.data?.userId,
      reconciled: Boolean(res.data?.reconciled),
    };
  }

  // --- 3. updatePasswordHash ---
  async updatePasswordHash(id: string, password_hash: string): Promise<{ success: boolean; rowsUpdated?: number; error?: string }> {
    const res = await this.execute('updatePasswordHash', { id, password_hash });
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true, rowsUpdated: res.data?.rowsUpdated };
  }

  // --- 4. changePassword ---
  async changePassword(id: string, password_hash: string): Promise<{ success: boolean; rowsUpdated?: number; error?: string }> {
    const res = await this.execute('changePassword', { id, password_hash });
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true, rowsUpdated: res.data?.rowsUpdated };
  }

  // --- 5. changeAccountStatus ---
  async changeAccountStatus(
    id: string,
    account_status: 'active' | 'suspended',
    actor: BridgeActorContext
  ): Promise<{ success: boolean; memberId?: string; account_status?: string; error?: string }> {
    const res = await this.execute('changeAccountStatus', { id, account_status }, actor);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return {
      success: true,
      memberId: res.data?.memberId,
      account_status: res.data?.account_status,
    };
  }

  // --- 6. updateUserRole ---
  async updateUserRole(
    id: string,
    role: string,
    actor: BridgeActorContext
  ): Promise<{ success: boolean; memberId?: string; role?: string; error?: string }> {
    const res = await this.execute('updateUserRole', { id, role }, actor);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return {
      success: true,
      memberId: res.data?.memberId,
      role: res.data?.role,
    };
  }
}

export const d1BridgeClient = new D1BridgeClient();
