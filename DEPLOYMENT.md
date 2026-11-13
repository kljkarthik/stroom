# STROOM Production Deployment, Zero-Cost Hosting & Recovery Guide

## 1. Architecture Summary
STROOM runs as a unified Node.js + Express backend (`dist/server/index.js`) serving both `/api/*` endpoints and the compiled Vite React frontend (`dist/`) with an embedded SQLite database (`better-sqlite3` in WAL mode). Because both UI and API share a single origin on `PORT`, deployment requires **zero separate reverse proxy rules** for API calls (`/api`) and avoids split-origin cookie/CORS issues when hosted on a single Node service.

---

## 2. Hosting Options & Honest Resource Limits (Zero-Cost First)

> **Capacity Reality Check:** Zero-cost tiers are suitable for initial Hyderabad & Pune beta launch / pilot events (roughly 50–500 concurrent users). Free tiers **cannot** reliably sustain 10,000–100,000 active users without upgrading CPU, RAM, and moving SQLite to managed Postgres/LibSQL.

| Option | Tier Type | Free Allowance & Caveats | Suitability for STROOM |
|---|---|---|---|
| **Single VPS / Oracle Cloud Always Free (ARM VM)** | **Permanently Free** (account verification required) | Up to 4 ARM OCPUs / 24 GB RAM & persistent block disk on Oracle Cloud Always Free. Self-managed Linux + systemd/PM2 + Caddy/Certbot HTTPS. | **Best zero-cost production fit**: keeps SQLite file persistent cleanly on local SSD with zero cold starts. |
| **Koyeb / Fly.io (1 shared-cpu VM + persistent volume)** | **Free Tier with Strict Limits** | Small RAM (256–512 MB) and small free volume caps; excess egress/RAM triggers paid overages or suspension. | Viable for early pilot **only if** persistent disk volume is attached for `DB_PATH`! |
| **Render Free Web Service** | **Free Tier (Ephemeral Disk + Sleep)** | Spins down after 15 min idle (~30–50s cold start) and **wipes local disk on every deploy/restart** (ephemeral filesystem). | **NOT safe for SQLite without paid persistent disk** — database resets on redeploy unless `DB_PATH` points to mounted disk or external Turso/LibSQL. |
| **Vercel / Netlify (Static UI) + Separate Node API** | **Free Static Hosting** | Permanently free CDN for `dist/` SPA assets (`vite build`), requires `VITE_API_BASE` or proxy to Node API host. | Only needed if splitting static frontend from Express API. |
| **Cloudflare (DNS + SSL/TLS Proxy + DDoS)** | **Permanently Free Plan** | Free SSL/TLS certificates, edge caching for static assets, and basic DDoS/rate shielding in front of VPS. | Recommended in front of any VPS deployment. |

**DNS & HTTPS:** Point your custom domain to Cloudflare or Caddy (automatic Let's Encrypt HTTPS certificates) so TLS terminates cleanly before hitting Node on `PORT=5000`. Set `ALLOWED_ORIGINS=https://yourdomain.com`.

---

## 3. Production Startup & Environment Validation

1. Copy `.env.example` to `.env` (never commit `.env`):
   - Set `NODE_ENV=production`
   - Generate strong `JWT_SECRET` (minimum 24 chars; server refuses to boot in production if missing or using the dev fallback).
   - Set `ALLOWED_ORIGINS=https://your-domain.com`
   - Set `DB_PATH=/persistent/data/stroom.db` and `BACKUP_DIR=/persistent/backups` (never inside `dist/` or `public/`).
   - Ensure `VITE_ENABLE_DEMO_AUTH` is unset or `false` during `npm run build` so demo quick-login credentials are excluded from the UI.
2. Build & start:
   ```bash
   npm ci
   npm run build
   NODE_ENV=production npm start
   ```
3. Verify health endpoint:
   - `GET /api/health` checks SQLite connectivity (`SELECT 1`) and returns HTTP `200` (`503` if DB unreachable) alongside honest integration flags (`paymentGatewayConfigured`, `emailProviderConfigured`, `mediaStorage`).

---

## 4. Database Backup & Recovery Procedure

### Automated Atomic Snapshot
Run via cron or systemd timer (recommended: every **6 hours**, plus before every deployment/migration):
```bash
npm run db:backup
```
- **Mechanism**: Uses `better-sqlite3` `.backup()` API (online, non-blocking WAL-safe snapshot) after passing `PRAGMA integrity_check`.
- **Storage Location**: `BACKUP_DIR` (`./backups` by default — gitignored and strictly outside web-served `dist/` and `public/`).
- **Retention Policy**: Automatically retains the last **14 days** of local snapshots (`retainDays = 14` in `createDatabaseBackup`). Off-site copies should be synced encrypted to private object storage (e.g., Cloudflare R2 10 GB free tier or private S3/GCS bucket).

### Restore Procedure & Recovery Testing
1. Stop the STROOM Node process (`systemctl stop stroom` or stop daemon).
2. Preserve current corrupted DB before replacing (`mv data/stroom.db data/stroom.db.corrupt.$(date +%s)` and remove matching `-wal`/`-shm` files).
3. Copy verified snapshot back to `DB_PATH`:
   ```bash
   cp backups/stroom-backup-YYYY-MM-DDTHH-MM-SS-SSSZ.db data/stroom.db
   ```
4. Verify integrity before starting traffic:
   ```bash
   node -e "const D=require('better-sqlite3'); const db=new D('./data/stroom.db'); console.log(db.prepare('PRAGMA integrity_check').get(), db.prepare('PRAGMA foreign_key_check').all());"
   ```
5. Restart Node process (`npm start`) and verify `GET /api/health` returns `200` (`database: "connected"`).
6. **Recovery Drill Cadence**: Test full restore on a staging copy monthly to confirm snapshot readability and foreign-key integrity (`0` violations).

---

## 5. Known Integration Limitations (Honest Scope)
- **Payment Gateway**: Online UPI/card payment checkout (Razorpay/Stripe) is not connected; `payment_transactions` records manual/offline/ledger entries and accurately reports `gatewayConfigured: false`.
- **Email / SMS**: Transactional emails and SMS OTPs are not configured; notifications deliver through the persisted In-App Notification Center while honoring member notification opt-outs.
- **Media Storage**: User avatars, event covers, and venue images are stored as validated external HTTPS/HTTP/asset URLs (XSS/dangerous URL schemes rejected); no binary file upload server or cloud object bucket is currently attached.
