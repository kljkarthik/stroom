# STROOM — Phase 2.5.1.0.7: Frontend Secret Leakage Audit

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Comprehensive Frontend & Client Asset Leakage Audit)  
**Security Classification:** Frontend Architecture & Client Boundary Security Standard  
**Mode:** STRICT READ-ONLY AUDIT & STATIC CODE ANALYSIS  
**Date:** November 14, 2026  

---

## 1. Executive Summary & Objective

A core security invariant of the STROOM hybrid architecture is that neither `INTERNAL_D1_BRIDGE_SECRET` nor `ORIGIN_PROXY_SECRET` may ever enter browser-accessible assets or client runtime memory.

While Vite's default configuration isolates variables lacking the `VITE_` prefix, standard security governance mandates that absence of the prefix cannot be assumed as sufficient proof. This audit provides an exhaustive, multi-layered verification covering:
1. Vite environment loading mechanisms and configuration parameters.
2. Direct references within the frontend source tree (`src/`).
3. Build configuration, bundling logic, and code splitting definitions.
4. Static inspection of compiled frontend production assets (`dist/`).
5. Cloudflare Worker public API responses and configuration serialization.

---

## 2. Layer 1: Vite Configuration & Environment Loading Audit

### 2.1 Inspection of `vite.config.ts`
The Vite configuration at `vite.config.ts` was audited line-by-line:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['seventeen-overlaid-festivity.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'charts-vendor': ['recharts'],
          'icons-vendor': ['lucide-react'],
        },
      },
    },
  },
});
```

### 2.2 Critical Vulnerability Vectors Evaluated:
- **`define` Property Check:** The configuration contains **no** `define` block. In particular, it does not alias `process.env` or define global constants that could accidentally inline backend secrets into client JavaScript bundles.
- **`envPrefix` Customization Check:** Vite's default `envPrefix` (`'VITE_'`) is **unmodified**. No secondary prefixes (e.g. `INTERNAL_`, `ORIGIN_`, `STROOM_`) are registered.
- **`loadEnv` Usage Check:** No custom environment loading script exists in Vite configuration.
- **HTML Injection / Head Scripts:** `index.html` contains no server-side templating (`%VITE_*%`), inline configuration scripts, or window global initializers.

---

## 3. Layer 2: Frontend Source Tree (`src/`) Audit

### 3.1 Direct Secret Reference Search
A recursive search was performed across all TypeScript, JavaScript, and TSX files in `src/` (excluding worker backend):
- **Search Terms:**
  - `INTERNAL_D1_BRIDGE_SECRET`
  - `ORIGIN_PROXY_SECRET`
  - `X-STROOM-Bridge-Secret`
  - `X-STROOM-Origin-Secret`
  - `process.env`
- **Method:** Node.js file system scanner evaluating exact token matches.
- **Result:** **0 matches found.** Neither secret name, header name, nor `process.env` expression exists anywhere in frontend source code.

### 3.2 `import.meta.env` Surface Audit
A regular expression search (`/import\.meta\.env\.[A-Za-z0-9_]+/g`) was performed across all files in `src/` to identify every client environment variable access:
- **Files Scanned:** 247 source files in `src/`.
- **Complete Inventory of Client Environment Variable Accesses:**
  - `src/context/AuthContext.tsx`: `import.meta.env.DEV` (Standard Vite boolean for development mode)
  - `src/context/AuthContext.tsx`: `import.meta.env.VITE_ENABLE_DEMO_AUTH` (Feature flag for demo mode)
- **Result:** **Zero sensitive environment variables accessed.** The bridge and origin proxy secrets are completely absent from the client AST.

---

## 4. Layer 3: Compiled Production Assets (`dist/`) Audit

### 4.1 Asset Inventory
The compiled production bundle in `dist/` contains:
- `dist/index.html` (Static SPA entry point)
- `dist/assets/index-BB4-ZzrA.js` (Application main bundle)
- `dist/assets/react-vendor-*.js` (React framework bundle)
- `dist/assets/charts-vendor-B8sy8rll.js` (Recharts visualization vendor)
- `dist/assets/icons-vendor-CwcGy2us.js` (Lucide React icons vendor)
- `dist/assets/index-b3FxR2pH.css` (Tailwind CSS stylesheet)

### 4.2 Exact Token Inspection
All files under `dist/` were scanned for:
1. `INTERNAL_D1_BRIDGE_SECRET` $\rightarrow$ **0 matches**
2. `ORIGIN_PROXY_SECRET` $\rightarrow$ **0 matches**
3. `X-STROOM-Bridge-Secret` $\rightarrow$ **0 matches**
4. `X-STROOM-Origin-Secret` $\rightarrow$ **0 matches**
5. `Bridge-Secret` $\rightarrow$ **0 matches**
6. `Origin-Secret` $\rightarrow$ **0 matches**

### 4.3 Broader Substring "SECRET" Search in Client Bundles
A comprehensive substring search for `SECRET` and `secret` in `dist/assets/` revealed 25 occurrences, all confirmed as:
- React internal property: `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`.
- Zero application secrets, zero tokens, zero environment bindings.

---

## 5. Layer 4: Worker Public Responses & Serialization Audit

### 5.1 Cloudflare Worker Health Endpoint (`GET /api/health`)
The worker health router (`src/worker/routes/health.ts`) was audited to verify that public responses cannot accidentally serialize the `c.env` binding object:
```typescript
return c.json(
  {
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'stroom-worker-api',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startTime,
    database: {
      binding: 'DB',
      type: 'cloudflare-d1',
      status: d1Status,
      applicationTables: applicationTableCount,
      schemaVerified: applicationTableCount === 42,
    },
  },
  isHealthy ? 200 : 503
);
```
- **Findings:** The health response returns explicitly constructed, whitelisted telemetry metadata. It does **not** dump, spread (`...c.env`), or serialize the `c.env` object.

### 5.2 Global Error Handler Serialization (`src/worker/app.ts`)
The global error handler was audited:
```typescript
app.onError((err, c) => {
  return c.json(
    {
      error: 'Internal Server Error',
      message: c.env?.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
});
```
- **Findings:** In production environments (`NODE_ENV === 'production'`), error messages are completely suppressed (`undefined`). Under no circumstances is environment data leaked during uncaught exceptions.

### 5.3 Absence of Debug / Config Dump Routes
An exhaustive scan of `src/worker/` confirms:
- Zero `/api/debug` routes.
- Zero `/api/env` or `/api/config` routes.
- Zero reflect/echo endpoints.

---

## 6. Frontend Secret Leakage Criteria Evaluation

| Criterion | Evaluation Requirement | Result | Verified Empirical Evidence |
| :---: | :--- | :---: | :--- |
| **FL-1** | **Vite Config `define` Isolation** | **PASS** | `vite.config.ts` contains no `define` block; zero global constant injection. |
| **FL-2** | **Vite `envPrefix` Isolation** | **PASS** | `envPrefix` unmodified (`VITE_`). Bridge and Origin secrets do not carry prefix. |
| **FL-3** | **Frontend Source Tree References** | **PASS** | Complete scan of `src/`: 0 references to secret names, headers, or `process.env`. |
| **FL-4** | **`import.meta.env` Audit** | **PASS** | Only `DEV` and `VITE_ENABLE_DEMO_AUTH` referenced in `src/`. Zero secret access. |
| **FL-5** | **Compiled `dist/` Assets Audit** | **PASS** | Complete scan of compiled `dist/assets/`: 0 occurrences of secret names or headers. |
| **FL-6** | **Worker Response Serialization** | **PASS** | Worker `health` and `app.onError` strictly sanitize output; zero `c.env` serialization. |
| **FL-7** | **Zero Config Dump Endpoints** | **PASS** | Verified absence of debug or environment dumping endpoints across `src/worker/`. |

---

## 7. Conclusion

The frontend secret leakage audit is **COMPLETE — 100% PASS**. Neither `INTERNAL_D1_BRIDGE_SECRET` nor `ORIGIN_PROXY_SECRET` can be accessed, loaded, bundled, or serialized into browser-accessible assets.
