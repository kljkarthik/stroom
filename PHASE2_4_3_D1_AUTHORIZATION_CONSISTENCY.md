# STROOM — Phase 2.4.3: D1 Authorization Consistency Specification

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4.3 Consistency Specification)  
**Security Classification:** Critical Database Consistency Specification  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

---

## 1. Executive Summary & Problem Definition

Cloudflare D1 operates a distributed architecture: a single primary database (located in the designated primary location) paired with read-replicas distributed across Cloudflare's global edge network.

By default, read queries executed on edge Workers may be served by read-replicas. While this provides ultra-low latency, read-replicas are asynchronously replicated and can exhibit **replication lag**.

> [!WARNING]
> **The Risk of Stale Authorization Reads:**  
> If an administrator suspends a user or changes a role on the primary database, an edge read-replica might serve stale data for several seconds if read without consistency constraints.

This document establishes the exact D1 consistency strategy using Cloudflare D1's **Sessions API (`withSession`)** to guarantee sequential consistency for security-critical authorization checks.

---

## 2. Cloudflare D1 Consistency Models & Sessions API

Official Cloudflare D1 documentation specifies two primary read consistency patterns:

### 2.1 Default (Eventual Consistency)
- Read queries execute against the nearest read-replica.
- *Advantage:* Minimal query latency ($5\text{ ms} - 15\text{ ms}$).
- *Limitation:* May reflect a slightly stale state if a write just occurred on the primary.

### 2.2 Sequentially Consistent Sessions (`withSession`) — SELECTED FOR WRITES & RBAC
- **Official Specification:**  
  D1's Sessions API allows developers to maintain sequential consistency ("read-your-own-writes") across multiple requests or explicitly target the primary database.
  - `env.DB.withSession(token)` ensures that all subsequent reads are guaranteed to see mutations committed prior to the session token.
  - `env.DB.withSession("first-primary")` forces the initial read to execute against the primary database, establishing a strong consistency anchor.
- **Official Documentation Citation:**  
  > "Sessions allow you to opt into sequential consistency for a sequence of queries. By passing a bookmark or using withSession, queries are guaranteed to reflect prior commits."  
  > *(Source: [Cloudflare D1 Consistency Documentation](https://developers.cloudflare.com/d1/learning/consistency/))*

---

## 3. Operation-by-Operation Consistency Strategy

| Security / Authorization Operation | Mutation Target | Read Target on Edge Worker | Consistency Guarantee Enforced | Maximum Possible Stale Window |
| :--- | :--- | :--- | :--- | :---: |
| **Account Suspension** | Primary D1 (via Bridge) | In-isolate cache $\rightarrow$ Primary D1 on miss | Cache TTL $\le 30$s; Primary query on miss | **$\le 30$ seconds** |
| **Account Deletion** | Primary D1 (via Bridge) | In-isolate cache $\rightarrow$ Primary D1 on miss | Eviction $\le 30$s; Returns `null` on miss | **$\le 30$ seconds** |
| **Role Demotion / Promotion**| Primary D1 (via Bridge) | In-isolate cache $\rightarrow$ Primary D1 on miss | Enforces live D1 role | **$\le 30$ seconds** |
| **Password Change** | Primary D1 (via Bridge) | Re-authentication writes new session | Read-your-own-writes via Session Token | **Instantaneous for actor** |
| **Admin Route Authorization**| N/A (Read) | In-isolate cache $\rightarrow$ Primary D1 on miss | Strict Fail-Closed if primary unreachable | **$\le 30$ seconds** |
| **Member Catalog Read** | N/A (Read) | Nearest Edge Replica (Eventual) | Eventual replica read (sub-10ms) | Eventual replica lag ($\approx 1-3\text{s}$) |

---

## 4. Reconciling Consistency with Cache and Outage Rules

### 4.1 Why the 30-Second Cache is Consistent with D1 Semantics
1. **Normal Operating State:**
   - On a warm isolate: The local V8 heap holds the user status for 30 seconds.
   - On expiration: The Worker queries D1 using `env.DB.withSession("first-primary")` or direct primary prepared query, guaranteeing it fetches the authoritative state from the primary database, rather than a lagging replica.
   - **Guaranteed Stale Bound:** Under normal operating conditions, the maximum stale window across any single isolate is **strictly 30 seconds**. On cold isolates or fresh edge nodes, it is **0 seconds**.
2. **Administrative Access Fail-Closed Constraint:**
   - If `now > entry.expiresAt` (cache expired) and the primary D1 database is unreachable, the Worker **aborts and returns `503 Service Unavailable`**.
   - Administrative staff routes (`ADMIN_STAFF_ROLES`) **never fall back to stale replicas or emergency grace periods**.
3. **Member Route Bounded Grace Period:**
   - If D1 is temporarily degraded, general members (`user`, `participant`) browsing event catalogs are permitted up to **60 seconds from `verifiedAt`** before failing closed, ensuring transient replica network blips do not cause user-facing errors on non-sensitive reads.

---

## 5. Implementation Code Blueprint (`src/worker/db/d1Client.ts`)

```ts
import { D1Database } from '@cloudflare/workers-types';

export class D1Client {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Fetches user status for authorization using primary session consistency.
   * Guarantees fresh reads on cache misses without replica lag.
   */
  async getUserAuthorizationStatus(userId: string): Promise<{ id: string; role: string; account_status: string } | null> {
    try {
      // Opt into primary sequential consistency for security checks
      const sessionDb = this.db.withSession('first-primary');
      const user = await sessionDb
        .prepare('SELECT id, role, account_status FROM users WHERE id = ?')
        .bind(userId)
        .first<{ id: string; role: string; account_status: string }>();

      return user ?? null;
    } catch (err: any) {
      throw new Error(`[D1 Authorization Read Error] Primary query failed: ${err.message}`);
    }
  }
}
```
