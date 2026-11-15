# STROOM — Phase 2.4.2: JWT Issuer Cutover & Key Lifecycle Plan

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4.2 JWT Lifecycle Specification)  
**Security Classification:** Cryptographic Key Management Plan  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

---

## 1. Executive Summary & Problem Definition

In the existing STROOM backend ([`server/middleware/auth.ts:14-20`](file:///D:/ST/server/middleware/auth.ts#L14-L20)), JWT tokens are signed without `iss` (Issuer) or `aud` (Audience) claims:

```json
{
  "id": "usr_admin_001",
  "email": "admin@stroom.app",
  "role": "super_admin",
  "iat": 1794565604,
  "exp": 1795170404
}
```

To elevate platform security, modern standards require explicit `iss: "stroom-api"` and `aud: "stroom-client"` claims to prevent token reuse across other systems.

However, **waiting 7 days is only valid if the issuer has already stopped generating legacy tokens**. If Express continues issuing legacy tokens, the legacy window never closes. This document establishes the coordinated, multi-stage cutover plan.

---

## 2. Coordinated Four-Stage Cutover Schedule

```
[Stage 1: Hono Dual-Acceptance Ready]
  │   • Worker deployed accepting BOTH:
  │     - Modern tokens (with iss: 'stroom-api', aud: 'stroom-client')
  │     - Legacy tokens (missing iss/aud)
  ▼
[Stage 2: Express Issuer Cutover (Timestamp T0)]
  │   • Express code deployed: generateToken() strictly includes iss & aud
  │   • LEGACY TOKEN ISSUANCE CEASES PERMANENTLY AT T0
  ▼
[Stage 3: 7-Day Bounded Deprecation Window (T0 to T0 + 7d + 60s)]
  │   • All pre-T0 legacy tokens countdown to natural expiration (max 7 days)
  │   • All new logins receive modern tokens with iss & aud
  ▼
[Stage 4: Mathematical Verification & Strict Rejection (T0 + 7d + 60s)]
      • Verification: Every pre-T0 token is mathematically expired (exp < now)
      • Worker switches to strict rejection: any token missing iss/aud -> 401 Unauthorized
```

---

## 3. Stage-by-Stage Implementation Protocol

### 3.1 Stage 1: Hono Dual-Acceptance Verifier Deployment
Before Express begins issuing new tokens, Hono must be deployed with dual-acceptance logic:

```ts
// In Hono Worker auth middleware
export async function verifyHybridToken(token: string, secret: string) {
  const payload = await verify(token, secret, 'HS256');

  // If modern token: validate issuer and audience
  if (payload.iss || payload.aud) {
    if (payload.iss !== 'stroom-api' || payload.aud !== 'stroom-client') {
      throw new Error('Invalid token issuer or audience');
    }
  }

  // Legacy tokens (missing iss/aud) are accepted during transition window
  return payload;
}
```

---

### 3.2 Stage 2: Express Issuer Cutover (Timestamp $T_0$)
At a recorded deployment timestamp $T_0$ (e.g. `2026-11-20T00:00:00Z`), the updated Express `generateToken()` function is activated:

```ts
// Updated Express Token Generator
export function generateToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      iss: 'stroom-api',
      aud: 'stroom-client',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
```

**Guaranteed Fact:** From $T_0$ onward, zero legacy-format tokens are created. The newest possible legacy token in circulation was issued at $T_0 - 1\text{ second}$ and expires at $T_0 + 7\text{ days} - 1\text{ second}$.

---

### 3.3 Stage 3: The Bounded 7-Day Deprecation Window
The transition period runs for exactly **7 days plus 60 seconds of clock-skew leeway**:
$$\text{Window End} = T_0 + (7 \times 86400) + 60\text{ seconds}$$

During this window:
- Users logging in or registering receive modern tokens.
- Users with active sessions from before $T_0$ continue browsing seamlessly without being forced to re-authenticate.

---

### 3.4 Stage 4: Strict Rejection Gate
At $T_0 + 7\text{ days} + 60\text{s}$:
1. **Mathematical Proof:** Any token lacking `iss` or `aud` must have been issued prior to $T_0$. Because $\text{lifetime} \le 7\text{ days}$, its expiration timestamp satisfies $\text{exp} < \text{now}$. It is therefore expired.
2. **Strict Enforcement Policy:** Hono updates verification to mandate `iss: 'stroom-api'` and `aud: 'stroom-client'`. Any token missing these claims is rejected with:
   ```json
   {
     "error": "Invalid or expired token. Modern issuer required.",
     "code": "LEGACY_TOKEN_REJECTED"
   }
   ```

---

## 4. Secret Key Rotation Protocol

If `JWT_SECRET` must be rotated (e.g. annual key rotation or suspected leak), the system supports zero-downtime dual-key verification:

```
[Key Rotation Triggered]
  │
  ├── 1. Generate NEW_SECRET (32+ bytes cryptographic random)
  ├── 2. Deploy Worker supporting:
  │      - PRIMARY_SECRET = NEW_SECRET
  │      - PREVIOUS_SECRET = OLD_SECRET
  │
  ├── 3. Deploy Express: signs new tokens using NEW_SECRET
  ├── 4. Wait 7 days (all OLD_SECRET tokens naturally expire)
  └── 5. Retire PREVIOUS_SECRET from Worker environment
```

---

## 5. Rollback Procedures

### 5.1 Scenario 1: Express New Issuer Fails Upon Deployment (Stage 2 Rollback)
- **Action:** Revert Express code to legacy `generateToken()` without `iss`/`aud`.
- **Impact:** Zero. Hono is already in dual-acceptance mode and accepts legacy tokens.
- **Clock Reset:** The 7-day transition clock is cancelled until a fixed deployment is re-issued.

### 5.2 Scenario 2: Strict Rejection Causes Unexpected 401 Spikes (Stage 4 Rollback)
- **Action:** Toggle Hono back to dual-acceptance mode for an additional 48 hours.
- **Audit:** Inspect client logs to identify any third-party integration or stale tab holding un-refreshed tokens.
