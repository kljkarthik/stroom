# STROOM — Fast Public Deployment Guide (Free Hosting Architecture)

**Project:** STROOM (Strangers Room) — Premium Social Discovery & Auction Platform
**Target Environment:** 100% Free-Tier Production Architecture
**Document Version:** 1.0.0 (Stage 3.2.6 Production Readiness)

---

## 1. Production Architecture Overview

STROOM is deployed using a decoupled, highly scalable, zero-cost production stack:

```
                            ┌─────────────────────────────────────────┐
                            │             Public Internet             │
                            └────────────────────┬────────────────────┘
                                                 │
                                                 ▼
       ┌───────────────────────────────────────────────────────────────────────────────────┐
       │                  Cloudflare Edge CDN (Cloudflare Pages)                           │
       │                                                                                   │
       │  • Static Assets & SPA Router (dist/index.html, dist/assets/*)                    │
       │  • Sub-10ms Global Edge Latency                                                   │
       │  • API Reverse-Proxy via _redirects: /api/* -> Render Backend                     │
       │  • Security Headers & Strict CSP via _headers                                     │
       └─────────────────────────┬─────────────────────────────────────────────────────────┘
                                 │
                                 ▼ (HTTPS / TLS 1.3)
       ┌───────────────────────────────────────────────────────────────────────────────────┐
       │                  Render Web Service (Node.js Express Backend)                     │
       │                                                                                   │
       │  • Runtime: Node.js 22+ (Linux Container)                                         │
       │  • Location: Ohio, USA (AWS us-east-2 — co-located with Neon)                      │
       │  • Health Check: GET /api/health                                                  │
       │  • Live Real-Time Feeds: Server-Sent Events (SSE) for Auction Arena               │
       │  • Driver: DATABASE_DRIVER=postgres (Asynchronous Adapter Layer)                  │
       └─────────────────────────┬─────────────────────────────────────────────────────────┘
                                 │
                                 ▼ (Direct TLS / Port 5432)
       ┌───────────────────────────────────────────────────────────────────────────────────┐
       │                  Neon Serverless PostgreSQL (Production Project)                  │
       │                                                                                   │
       │  • Region: AWS us-east-2 (Ohio)                                                   │
       │  • Engine: PostgreSQL 18.7                                                        │
       │  • Connection Pooling: Transaction Pooler Endpoint (-pooler)                      │
       │  • Autoscaling: 0.25 CU (Scale-to-zero when idle)                                 │
       │  • Capacity: 42 Tables, 49 Indexes, Strict Foreign Keys, NUMERIC Currency         │
       └───────────────────────────────────────────────────────────────────────────────────┘
```

### Why this stack works best for STROOM:
1. **Zero Hosting Cost:** Cloudflare Pages (free unlimited bandwidth), Render (free 750 monthly compute hours), and Neon (free 0.5 GB storage + 100 compute hours) allow full public operation with zero infrastructure cost.
2. **Minimal Latency (<5ms):** Both Render and Neon are provisioned in AWS Ohio (`us-east-2`), ensuring database queries between backend and PostgreSQL execute with virtually zero cross-cloud latency.
3. **Seamless SPA Routing & CORS Freedom:** Cloudflare Pages proxies `/api/*` requests directly to Render through `_redirects`, eliminating browser CORS issues, preflight latency, and cross-site cookie or storage restrictions.

---

## 2. Prerequisites

Ensure you have free accounts on the following platforms:
- **GitHub:** Account with access to push your STROOM repository.
- **Neon:** [https://neon.tech](https://neon.tech) (PostgreSQL provider).
- **Render:** [https://render.com](https://render.com) (Node.js backend host).
- **Cloudflare:** [https://dash.cloudflare.com](https://dash.cloudflare.com) (Frontend Pages host).

---

## 3. Step-by-Step Deployment Walkthrough

### STEP 1: Provision the Neon Production PostgreSQL Database

> [!IMPORTANT]
> **SAFETY RULE:** Do NOT reuse your disposable staging database for public production users. Create a fresh, dedicated Neon project.

1. Log into your [Neon Console](https://console.neon.tech).
2. Click **New Project**:
   - **Project Name:** `stroom-production`
   - **Region:** `AWS us-east-2 (Ohio)` *(Crucial: matches Render Ohio region)*
   - **Postgres Version:** `16` or `17` or `18`
3. Click **Create Project**.
4. In the Project Dashboard, locate the **Connection Details** card:
   - Select the **Connection Pooling** checkbox (or select the **Pooled connection** string containing `-pooler`).
   - Copy your connection URI. It will look like:
     ```
     postgresql://stroom_owner:<PASSWORD>@ep-xyz-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
   - Store this password in your password manager. **Never commit it to Git.**

---

### STEP 2: Initialize Schema & Migrate Data to Production

From your local developer terminal in `D:\ST`:

1. Apply the production schema DDL to your new Neon production database:
   ```powershell
   # In PowerShell (replace with your new Neon production URL):
   $env:TARGET_DATABASE_URL = "postgresql://stroom_owner:<PASSWORD>@ep-xyz-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

   # Apply schema DDL (creates 42 tables, indexes, constraints)
   npx tsx -e "
     import fs from 'fs';
     import { Pool } from 'pg';
     import { parseDatabaseConfig } from './server/db/postgresAdapter';
     const ddl = fs.readFileSync('migrations/postgres/0001_postgres_schema.sql', 'utf8');
     const pool = new Pool(parseDatabaseConfig(process.env.TARGET_DATABASE_URL));
     pool.query(ddl).then(() => { console.log('✅ Schema applied successfully!'); pool.end(); });
   "
   ```

2. Migrate your initial dataset (users, cities, quizzes, venues, events, communities):
   ```powershell
   # Run the production migration pipeline (multi-row batch mode)
   npx tsx scripts/migrate-sqlite-to-postgres.ts --target $env:TARGET_DATABASE_URL
   ```

3. Verify bit-for-bit data parity:
   ```powershell
   npx tsx scripts/verify-postgres-parity.ts --target $env:TARGET_DATABASE_URL
   ```
   *Expected result: 42 / 42 matching tables, 10,160 rows.*

---

### STEP 3: Deploy the Backend to Render

You can deploy using Render's automated Blueprint or manual Web Service creation:

#### Method A: Render Blueprint (Easiest & Fastest — 1 Click)
Because `render.yaml` is pre-configured in your repository root, Render can auto-configure the service:
1. Log into [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Connect your STROOM GitHub repository.
4. Render will read `render.yaml` and prompt you to input the two un-synced variables:
   - `DATABASE_URL`: Paste your Neon production pooled connection string.
   - `ALLOWED_ORIGINS`: Enter your future Cloudflare Pages URL (e.g. `https://stroom.pages.dev`).
5. Click **Apply**. Render will automatically build and start the service!

#### Method B: Manual Web Service Setup (Step-by-Step)
If setting up manually via the Render UI:
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Select **Build and deploy from a Git repository** and connect your STROOM repo.
3. Configure the service settings:
   - **Name:** `stroom-backend`
   - **Region:** `Ohio (US East)` *(Matches Neon)*
   - **Branch:** `main` (or your deployment branch)
   - **Root Directory:** *(leave blank)*
   - **Runtime:** `Node`
   - **Build Command:** `npm install --include=dev && npm run build:server`
   - **Start Command:** `node dist/server/index.js`
   - **Instance Type:** `Free`
4. Expand **Advanced** and set:
   - **Health Check Path:** `/api/health`
   - **Auto-Deploy:** `Yes`
5. In the **Environment Variables** section, add:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Enables production optimizations & guards |
   | `DATABASE_DRIVER` | `postgres` | Instructs adapter layer to use PostgreSQL |
   | `DATABASE_URL` | `postgresql://stroom_owner:...` | Neon production pooled URI |
   | `JWT_SECRET` | *(64-character random string)* | At least 32 bytes random hex/base64url |
   | `ALLOWED_ORIGINS` | `https://stroom.pages.dev,https://<your-project>.pages.dev` | Allowed frontend domains |
   | `ENABLE_D1_AUTH_BRIDGE` | `false` | Cloudflare D1 bridge remains disabled |
6. Click **Create Web Service**.
7. Once deployed, note your Render URL: `https://stroom-backend.onrender.com`.
8. Verify in your terminal:
   ```bash
   curl https://stroom-backend.onrender.com/api/health
   # Expected response: {"status":"ok","app":"STROOM...","database":"connected",...}
   ```

---

### STEP 4: Deploy the Frontend to Cloudflare Pages

1. Log into the [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Navigate to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Select your STROOM GitHub repository and click **Begin setup**.
4. Configure the build settings:
   - **Project Name:** `stroom` (your site will be at `stroom.pages.dev`)
   - **Production Branch:** `main` (or your deployment branch)
   - **Framework Preset:** `Vite` (or None)
   - **Build Command:** `npm run build:client`
   - **Build Output Directory:** `dist`
   - **Root Directory:** `/` *(leave blank/default)*
5. Expand **Environment variables (production)**:
   - Add variable: `NODE_VERSION` = `22` (or `24`)
   - Optional: `VITE_API_URL` = `https://stroom-backend.onrender.com` (only if not using proxy rewrites)
6. Click **Save and Deploy**.

#### Setting up Seamless API Proxying (Recommended):
To avoid CORS configuration and simplify browser routing:
1. In `public/_redirects`, add your Render URL on line 4:
   ```
   /api/*  https://stroom-backend.onrender.com/api/:splat  200
   /*      /index.html                                     200
   ```
2. Commit and push this change. Cloudflare Pages edge will transparently forward `/api/*` requests to Render, making your frontend 100% same-origin!

---

## 4. Verification & Smoke Test Checklist

Once both services report green:

1. **Backend Health Check:**
   - Open `https://<your-render-app>.onrender.com/api/health` in your browser.
   - Confirm status is `"ok"` and database is `"connected"`.
2. **Frontend Load & Routing:**
   - Navigate to `https://<your-project>.pages.dev`.
   - Verify that the landing page renders cleanly, CSS/fonts load without CSP violations, and deep links work (e.g. `/about`, `/discover`).
3. **Authentication:**
   - Log into the admin portal (`/admin`) using your seeded administrator credentials (`admin@stroom.app` / `Admin@123`).
   - Confirm that the admin dashboard loads stats, users, quizzes, and audit logs.
4. **Events & Booking:**
   - Browse events at `/discover`.
   - Confirm event cards render venue details, dates, and remaining seat counts.
5. **Real-Time Auction Arena:**
   - Navigate to `/auctions`.
   - Open an active auction room and confirm the SSE stream connects (`Live Stream Connected`).

---

## 5. Free-Tier Operational Notes & Best Practices

### Handling Render Free-Tier Cold Starts:
- **Behavior:** On the free tier, Render spins down web services after 15 minutes of inactivity. When a new request arrives, it takes approximately 30 to 50 seconds to boot the container.
- **Solution:** You can set up a free uptime monitor (e.g. [UptimeRobot](https://uptimerobot.com) or [BetterStack](https://betterstack.com)) to ping `https://stroom-backend.onrender.com/api/health` once every 10 minutes. This keeps the backend warm and responsive 24/7 without exceeding free-tier limits.

### Neon Database Auto-Suspend:
- Neon automatically suspends compute endpoints after 5 minutes of inactivity on the free tier.
- When an API request arrives, Neon resumes automatically in **<500 milliseconds**.
- Using the `-pooler` connection string ensures connection pooling handles rapid reconnects smoothly.

### Custom Domains (Optional):
- Both Cloudflare Pages and Render support free custom domains (e.g. `stroom.in` for Pages and `api.stroom.in` for Render) with automated zero-configuration SSL certificates.
