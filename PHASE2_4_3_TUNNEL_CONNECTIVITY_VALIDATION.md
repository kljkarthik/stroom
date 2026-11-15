# STROOM — Phase 2.4.3: Cloudflare Tunnel & Origin Connectivity Validation

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Phase 2.4.3 Tunnel Architecture Specification)  
**Security Classification:** Critical Infrastructure Topology  
**Phase Status:** **APPROVED FOR PHASE 2.5 IMPLEMENTATION PLANNING**

---

## 1. Executive Summary & Routing Flow

This document validates the complete network path connecting the client browser, Cloudflare Pages Advanced Mode Worker, and the external Node.js / Express origin backend via **Cloudflare Tunnel (`cloudflared`)**.

### The Production Network Path

```
[Browser SPA] 
      │ HTTPS (stroom.club)
      ▼
[Cloudflare Edge Anycast CDN]
      │ Invokes
      ▼
[Pages Advanced Mode Worker (_worker.js)]
      │ URL is /api/auth/login?
      │ fetch("https://auth-origin.stroom.club/api/auth/login")
      │ Injects: X-STROOM-Origin-Secret
      ▼
[Cloudflare Edge Tunnel Ingress]
      │ Encrypted WireGuard / QUIC Tunnel
      ▼
[cloudflared Daemon on Express Host]
      │ Forwards over localhost
      ▼
[Express Server (Node.js on 127.0.0.1:5000)]
      │ Verifies X-STROOM-Origin-Secret
      │ Verifies scrypt password hash
      │ Issues 7-day HS256 JWT
```

---

## 2. Hostname Mappings & Routing Loop Prevention

A primary risk in reverse proxy designs is accidental recursive routing loops (where a Worker forwards a request back to itself).

### 2.1 Hostname Partitioning Contract

| Domain / Hostname | Cloudflare Product Target | Destination Behind Cloudflare | Worker Invocation? |
| :--- | :--- | :--- | :---: |
| **`stroom.club`** | Cloudflare Pages Project | Static assets + `_worker.js` | **YES** (Every request enters `_worker.js`) |
| **`auth-origin.stroom.club`** | Cloudflare Tunnel Hostname | `http://127.0.0.1:5000` (Express host) | **NO** (Bypasses Worker; terminates at Tunnel) |

### 2.2 Why Routing Loops Are Impossible
1. When a client requests `https://stroom.club/api/auth/login`, Cloudflare matches `stroom.club` and invokes `_worker.js`.
2. Inside `_worker.js`, Hono rewrites the target URL to **`https://auth-origin.stroom.club/api/auth/login`**.
3. The Worker calls `fetch("https://auth-origin.stroom.club/api/auth/login", ...)`.
4. In Cloudflare's edge DNS, `auth-origin.stroom.club` is bound directly to the **Cloudflare Tunnel UUID**, not the Pages project!
5. Cloudflare edge routes the subrequest through the tunnel daemon to the Express host.
6. The request never re-enters `_worker.js`. **Routing loop probability is zero.**

---

## 3. Origin Shielding & Port Exposure Prevention

To guarantee that the Express backend cannot be attacked or probed directly over the public internet:

### 3.1 Network Level Shielding (Cloudflare Tunnel)
- The Express host firewall (e.g. `ufw` on Linux or Windows Defender Firewall) **closes all inbound ports** (ports 80, 443, and 5000 are blocked to external IPs).
- The `cloudflared` daemon runs as a local system service and initiates an **outbound-only connection** to Cloudflare's nearest edge data center.
- There is no public IP address or open port for an attacker to scan.

### 3.2 Application Level Shielding (Shared Secret Header)
- As a secondary defense-in-depth perimeter, the Worker injects a private cryptographic header:
  `X-STROOM-Origin-Secret: <64-character-hex-secret>`
- Express middleware verifies the header using constant-time comparison before processing any auth route.
- If missing or invalid: returns `403 Forbidden` (`"Direct origin access prohibited"`).

---

## 4. Distinct Cryptographic Secrets Contract

To prevent privilege escalation and credential confusion:

```
[Cloudflare Edge Worker]
      │
      ├── 1. Origin Proxying (Worker -> Express):
      │      Injects: X-STROOM-Origin-Secret = ORIGIN_PROXY_SECRET
      │      Express verifies: req.headers['x-stroom-origin-secret']
      │
      └── 2. D1 Internal Bridge (Express -> Worker):
             Injects: X-Internal-Bridge-Secret = INTERNAL_D1_BRIDGE_SECRET
             Worker verifies: c.req.header('x-internal-bridge-secret')
```

- `ORIGIN_PROXY_SECRET` and `INTERNAL_D1_BRIDGE_SECRET` are generated independently with 256 bits of cryptographic entropy.
- They are stored separately in Express `.env` and Cloudflare Secrets (`wrangler secret put`).

---

## 5. Local Development Equivalent

In local development, no Cloudflare Tunnel or remote DNS is needed:

| Component | Production Network Target | Local Development Target |
| :--- | :--- | :--- |
| **Client SPA** | `https://stroom.club` | `http://localhost:3000` (Vite) |
| **Hono Edge Worker** | Pages Advanced Mode (`dist/_worker.js`) | `http://localhost:8787` (`wrangler dev`) |
| **Express Backend** | Behind Cloudflare Tunnel (`auth-origin...`) | `http://localhost:5000` (`tsx server/index.ts`) |
| **Worker Forwarding** | `fetch('https://auth-origin.stroom.club/...')`| `fetch('http://localhost:5000/...')` |
| **D1 Database** | Remote Cloudflare D1 | Local Miniflare SQLite (`.wrangler/state/...`) |
