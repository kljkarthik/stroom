# STROOM — Phase 2.4.2: Revocation & Cache Contract Specification

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4.2 Revocation Contract)  
**Security Classification:** Critical Access Control Specification  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

---

## 1. Executive Summary & Resolution of Ambiguity

Phase 2.4.1 introduced both a 30-second in-isolate cache and a 60-second outage grace period. This document formally eliminates ambiguity between these two durations by establishing an exact, deterministic cache evaluation contract.

### Architectural Ground Truth: Per-Isolate Memory vs Global State
In Cloudflare Workers, in-isolate memory (a JavaScript `Map`) is **strictly local to a single V8 execution isolate**:
- Cloudflare operates over 300 data centers worldwide, with multiple isolates per location.
- **There is zero shared memory between isolates or data centers.**
- An in-isolate cache entry only exists for requests processed by that exact running isolate.
- When a request hits a cold isolate or a different data center, it triggers an immediate **cache miss**, reading live status from D1 with **0 seconds delay**.

---

## 2. Exact Cache Data Structure & Timestamps

```ts
export interface CachedUserEntry {
  id: string;             // User primary key (usr_...)
  role: string;           // Live RBAC role ('super_admin', 'user', etc.)
  account_status: string; // 'active' | 'suspended' | 'deactivated'
  verifiedAt: number;     // Unix epoch timestamp (ms) of last successful D1 query
  expiresAt: number;      // verifiedAt + 30,000 ms (Normal TTL)
}

// In-isolate memory store
const userStatusCache = new Map<string, CachedUserEntry>();
const NORMAL_TTL_MS = 30 * 1000;         // 30 Seconds Normal Cache TTL
const MAX_STALE_GRACE_MS = 60 * 1000;    // 60 Seconds Emergency Outage Limit (Member only)
const MAX_CACHE_ENTRIES = 5000;          // Bounded memory cap to prevent isolate OOM
```

---

## 3. Cache Lifecycle & Stale Evaluation Rules

```
                      [Incoming Authenticated Request]
                                     │
                                     ▼
                     1. WebCrypto HS256 Token Verify
                        ├── Invalid / Expired? ──────► 401 Unauthorized
                                     │
                                     ▼ Valid Signature
                     2. Inspect userStatusCache.get(payload.id)
                                     │
             ┌───────────────────────┴───────────────────────┐
             │ Cache Hit                                     │ Cache Miss (Missing or
             ▼ (now <= entry.expiresAt)                      ▼  now > entry.expiresAt)
   ┌────────────────────┐                          ┌────────────────────┐
   │ Use Cached Status  │                          │ Query Live D1 DB   │
   │ Latency: < 0.2 ms  │                          │ SELECT id, role... │
   │ D1 Reads: 0        │                          └─────────┬──────────┘
   └─────────┬──────────┘                                    │
             │                                ┌──────────────┴──────────────┐
             │                                │ D1 Query Succeeds           │ D1 Query Fails
             │                                ▼                             ▼
             │                      ┌────────────────────┐        ┌────────────────────┐
             │                      │ Refresh Cache      │        │ Evaluate Outage    │
             │                      │ entry.verifiedAt=now        │ Policy (Sec. 3.2)  │
             │                      └─────────┬──────────┘        └─────────┬──────────┘
             │                                │                             │
             └────────────────────────────────┼─────────────────────────────┘
                                              ▼
                                 3. Evaluate Account State
                                    ├── Deleted? ────► 401 Unauthorized
                                    ├── Suspended? ──► 403 Forbidden
                                    └── Role Change? ► Enforce Live Role
                                              │
                                              ▼
                                 4. Enforce Permission Check
                                    ├── Missing? ────► 403 Forbidden
                                    └── OK ──────────► Proceed to Handler
```

### 3.1 Normal Operation (D1 Accessible)
- **Normal TTL:** Exactly **30 seconds** ($30,000\text{ ms}$ from `verifiedAt`).
- **While `now <= expiresAt`:** The cached record is used directly. Zero D1 read queries are executed.
- **When `now > expiresAt`:** The cache entry is stale. A background or inline read queries D1. Upon success, `verifiedAt` is refreshed to `Date.now()` and `expiresAt` is extended by 30 seconds.

---

### 3.2 D1 Outage Policy: Reconciling the 30s vs 60s Window

If a cache miss occurs (because the entry is missing or `now > expiresAt`) and the D1 database is unreachable:

| Route Classification | Applicable Policy | Max Permitted Stale Age | Outage Action | Rationale |
| :--- | :--- | :---: | :--- | :--- |
| **Administrative & Staff Routes**<br/>(`ADMIN_STAFF_ROLES`, 54 granular RBAC routes) | **Strict Fail-Closed** | **0 ms beyond TTL**<br/>(Strictly $\le 30\text{s}$ from `verifiedAt`) | **Reject with `503 Service Unavailable`** | Administrative access must never rely on stale authorization during database degradation. |
| **General Member Read-Only Routes**<br/>(`user`, `participant` on catalog/feed) | **Bounded Emergency Grace** | **30s beyond TTL**<br/>(Max $60\text{s}$ from `verifiedAt`) | **Allow read-only request** if previous status was `'active'`. Log edge alert. | Prevents transient database hiccups from disrupting end-user event browsing. |
| **All Routes after 60 seconds** | **Absolute Expiration** | **$> 60\text{s}$ from `verifiedAt`** | **Strictly Fail-Closed (`503`)** | After 60 seconds, all cached state is permanently discarded. |

---

## 4. Stale-Authorization Window Guarantees

Under the laws of distributed systems without global coordination:
- **Under Normal Conditions:** The maximum possible stale-authorization window on a warm isolate is **exactly 30 seconds**. On cold isolates or new PoPs, it is **0 seconds**.
- **Under D1 Outage Conditions:** The maximum possible stale-authorization window is **30 seconds for staff** and **60 seconds for general members**.
- **Explicit Architectural Statement:** A hard global maximum revocation delay of zero seconds cannot be guaranteed without querying the database on every single request. An in-isolate cache provides a deterministic bound of $\le 30$ seconds while reducing database load by over 90%.

---

## 5. Behavior on Specific Security Events

1. **User Suspended in Admin Hub:**  
   Admin writes `account_status = 'suspended'` to D1. Any isolate processing a request after TTL expiry ($\le 30$s) queries D1, detects suspension, and terminates the session with `403 Forbidden`. Fresh isolates terminate it immediately.
2. **User Deleted in Admin Hub:**  
   D1 query returns `null`. Cache entry is evicted; Worker returns `401 Unauthorized` (`"User account no longer exists"`).
3. **Role Demoted (e.g. Admin demoted to User):**  
   Worker enforces the live database role from D1, ignoring the `role` claim in the JWT. The user is rejected with `403 Forbidden` on admin endpoints within $\le 30$s.
4. **Password Changed:**  
   User re-authenticates and receives a fresh JWT. Old tokens expire naturally or are invalidated if `token_version` is checked.

---

## 6. Optional Authentication Contract

To ensure optional-authentication endpoints (`GET /api/discovery/feed`, `GET /api/events`, `GET /api/events/:id`) do not accidentally degrade security:

| Request Header State | Token Validity | Database Lookup | Final Handler State | HTTP Response Status |
| :--- | :--- | :--- | :--- | :---: |
| **No `Authorization` Header** | N/A | None (0 D1 reads) | `user = undefined` (Guest Mode) | **`200 OK` (Public Catalog)** |
| **Malformed Header** (Not Bearer, invalid base64, JSON parse error) | Malformed | None | Rejected at middleware | **`401 Unauthorized`** |
| **Expired Token** (`exp < now`) | Expired | None | Rejected at middleware | **`401 Unauthorized`** |
| **Invalid Signature** | Cryptographically invalid | None | Rejected at middleware | **`401 Unauthorized`** |
| **Valid Token, Active User** | Valid | Verified active | `user = liveUser` (Member Mode) | **`200 OK` (Personalized Feed)** |

> [!CAUTION]
> **Strict Rule:** An expired or malformed token sent to an optional-authentication endpoint must **NEVER silently degrade to guest access**. It must return `401 Unauthorized` so the frontend client knows its session has expired and prompts the user to re-authenticate, rather than silently displaying an empty guest feed.
