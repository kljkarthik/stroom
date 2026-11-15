# STROOM — Environment Variables & Secrets Reference Template

**Document Version:** 1.0.0
**Scope:** Production Configuration for Cloudflare Pages (Frontend) & Render (Backend)

---

## 1. Quick Classification Matrix

| Variable Name | Component | Sensitivity | Where Configured | Default / Recommended Value |
| :--- | :--- | :---: | :--- | :--- |
| `NODE_ENV` | Backend (Render) | Public | Render Environment | `production` |
| `PORT` | Backend (Render) | Public | Render System | *(Automatically assigned by Render)* |
| `DATABASE_DRIVER` | Backend (Render) | Public | Render Environment | `postgres` |
| `DATABASE_URL` | Backend (Render) | **SECRET** | Render Environment | `postgresql://user:pass@host-pooler.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Backend (Render) | **SECRET** | Render Environment | *(>= 32-byte cryptographically random string)* |
| `ALLOWED_ORIGINS` | Backend (Render) | Public | Render Environment | `https://stroom.pages.dev,https://<custom-domain>` |
| `ENABLE_D1_AUTH_BRIDGE`| Backend (Render) | Public | Render Environment | `false` |
| `AUTH_RATE_LIMIT_MAX` | Backend (Render) | Public | Render Environment | `25` (requests / 15 min window) |
| `NODE_VERSION` | Frontend (Pages) | Public | Cloudflare Pages Env | `22` (or `24`) |
| `VITE_API_URL` | Frontend (Pages) | Public | Cloudflare Pages Env | *(Leave blank if using proxy; or `https://stroom-backend.onrender.com`)* |
| `VITE_ENABLE_DEMO_AUTH`| Frontend (Pages) | Public | Cloudflare Pages Env | `false` |

---

## 2. Backend Environment Variables (Render Web Service)

Configure these in the **Render Dashboard** under your service's **Environment** tab:

### Required Production Variables

#### `NODE_ENV`
- **Type:** String
- **Sensitivity:** Public
- **Value:** `production`
- **Description:** Enables Express production optimizations, disables verbose stack traces in HTTP responses, and enforces strict security guards.

#### `DATABASE_DRIVER`
- **Type:** String
- **Sensitivity:** Public
- **Value:** `postgres`
- **Description:** Directs `getDatabaseAdapter()` to initialize the high-performance PostgreSQL connection pool instead of local SQLite.

#### `DATABASE_URL`
- **Type:** Connection URI
- **Sensitivity:** **CRITICAL SECRET**
- **Example Value:**
  ```
  postgresql://stroom_owner:npg_SecretPass123@ep-cool-water-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
  ```
- **Description:** The connection string for your **Neon Production Database**.
- **Important:** Always use the connection string containing `-pooler` (Transaction Pooling mode) to handle serverless connections efficiently.

#### `JWT_SECRET`
- **Type:** String (Base64URL or Hex)
- **Sensitivity:** **CRITICAL SECRET**
- **Requirement:** Must be at least 24 characters (32+ bytes recommended). In production, the server will **fail to start** if this is missing or uses the development fallback secret.
- **How to generate a secure secret:**
  ```bash
  # Run in terminal:
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```

#### `ALLOWED_ORIGINS`
- **Type:** Comma-separated URLs
- **Sensitivity:** Public
- **Example Value:**
  ```
  https://stroom.pages.dev,https://stroom.in
  ```
- **Description:** Whitelisted origins permitted to make cross-origin API calls with credentials. If you are using Cloudflare Pages proxying, also include your Pages domain here.

#### `ENABLE_D1_AUTH_BRIDGE`
- **Type:** Boolean
- **Sensitivity:** Public
- **Value:** `false`
- **Description:** Feature flag for Cloudflare D1 authentication bridge. Must remain `false` for standalone Render + Neon PostgreSQL deployment.

---

### Optional Integration Secrets (When Enabled in Future)

Configure these only when integrating live third-party services:

```ini
# Payment Processing (Razorpay / Stripe)
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret_key
STRIPE_SECRET_KEY=your_stripe_secret_key_here

# Transactional Email (Resend or SMTP)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_smtp_password
```

---

## 3. Frontend Environment Variables (Cloudflare Pages)

Configure these in the **Cloudflare Dashboard** under **Workers & Pages** -> your project -> **Settings** -> **Environment variables**:

> [!WARNING]
> Any variable prefixed with `VITE_` is baked into the public JavaScript bundle at build time. **NEVER put database passwords, private API keys, or JWT secrets in Cloudflare Pages variables.**

#### `NODE_VERSION`
- **Value:** `22` (or `24`)
- **Description:** Tells the Cloudflare Pages build container to use Node.js 22+ for the Vite build.

#### `VITE_API_URL` (Optional)
- **Value:** `https://stroom-backend.onrender.com` (leave blank if using `_redirects` proxy)
- **Description:** The public base URL of the Render backend. If left blank or unset, the frontend defaults to relative `/api`, which works seamlessly with the Cloudflare Pages proxy rule.

#### `VITE_ENABLE_DEMO_AUTH`
- **Value:** `false`
- **Description:** When set to `false`, hides development demo login buttons from the public landing page.

---

## 4. Local Development Template (`.env`)

For running locally against SQLite or a local test database, create a `.env` file in `D:\ST`:

```ini
# Core Configuration
NODE_ENV=development
PORT=5000
DATABASE_DRIVER=sqlite
DB_PATH=./data/stroom.db
JWT_SECRET=stroom_jwt_super_secret_vibe_key_2026
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
ENABLE_D1_AUTH_BRIDGE=false
AUTH_RATE_LIMIT_MAX=100
VITE_ENABLE_DEMO_AUTH=true
```
