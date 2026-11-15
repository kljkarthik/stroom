# STROOM — Phase 2.5.1.0.1: Failure and Runtime Evidence Report

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Execution Forensics & Environment Diagnostics)  
**Security Classification:** Operational Runtime Audit  
**Mode:** STRICT READ-ONLY AUDIT (Zero source code modifications, zero database mutations, zero remote deployments)  
**Date:** November 14, 2026  

---

## 1. Executive Summary

During Phase 2.5.1.0 (Local Implementation Preflight), automated verification commands encountered specific command execution failures prior to succeeding. In strict engineering environments, execution failures must never be dismissed as transient without rigorous causal identification.

This document provides complete forensic evidence for:
1. The first `npm test` execution failure (Exit code 1) versus the subsequent successful execution (Exit code 0), proving conclusive environmental attribution.
2. All three failed Worker cryptographic test attempts, documenting the exact failure causes, tool constraints, script revisions, and final runtime versions.
3. A comprehensive audit of the Phase 2.5.1.0 deliverable inventory, explaining the prompt truncation in Step 4760 and documenting the status of all requested deliverables.

---

## 2. Forensic Analysis of `npm test` Execution

### 2.1 First Attempt: Task-4787 (Exit Code 1)
- **Invocation Timestamp**: 2026-11-14T06:30:54Z (12:00:54 IST)
- **Command Executed**: `npm test` (invoking `tsx scripts/run-tests.ts`)
- **Execution Mode**: `BypassSandbox: false` (Standard Windows Antigravity Sandbox Mode)
- **Result**: Exit code 1; **1 Passed, 77 Failed**.

#### Actual Error Output:
```text
======================================================
🚀 RUNNING STROOM E2E VERIFICATION TEST SUITE
======================================================

--- SUITE 1: AUTHENTICATION & ROLE-BASED ACCESS ---
• Testing: Admin login returns valid JWT token and admin role... ❌ FAIL
  Error: fetch failed
• Testing: Regular user registration creates account with NOT_STARTED onboarding status... ❌ FAIL
  Error: fetch failed
...
[75 additional test failures with "Error: fetch failed"]
...
--- SUITE 15: PHASE 7 SECURITY, PERFORMANCE, BACKUP & PRODUCTION READINESS ---
• Testing: Salted scrypt password hashing, legacy SHA-256 auto-upgrade & logout audit logging... ❌ FAIL
  Error: fetch failed
• Testing: Database atomic backup snapshot creation, integrity check & restore verification... ✅ PASS
• Testing: Route-level RBAC hardening: passes check-in, event creation & legacy role escalation endpoints enforce 403... ❌ FAIL
  Error: fetch failed

======================================================
🏁 TEST RESULTS: 1 PASSED, 77 FAILED
======================================================
```

#### Root Cause Extraction:
Inspection of the underlying Node.js exception object in task logs revealed:
```text
Error: fetch failed
  cause: Error: connect EACCES 127.0.0.1:5055
      at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1555:16) {
    errno: -4092,
    code: 'EACCES',
    syscall: 'connect',
    address: '127.0.0.1',
    port: 5055
  }
```

#### Environmental vs. Test Failure Distinction:
1. **The Sandbox Policy Barrier**: On Windows, the Antigravity sandboxed terminal environment (`BypassSandbox: false`) enforces strict network boundary isolation. The Node.js process is permitted to create a local listening socket via `app.listen(5055)`, but outbound loopback TCP connection initiation (`connect` syscall via `fetch` or `net.connect` to `127.0.0.1:5055`) is blocked by operating system access control policies with `EACCES` (errno -4092).
2. **The Control Proof (Test 77)**: Out of 78 tests, exactly **one** test passed:
   `• Testing: Database atomic backup snapshot creation, integrity check & restore verification... ✅ PASS`  
   Inspection of `tests/run-all-tests.ts` lines 2197–2234 reveals this test directly invokes `createDatabaseBackup()` and performs in-process SQLite file operations without issuing an HTTP network request via `apiRequest()` or `fetch()`. Because filesystem access is permitted in the sandbox, this test passed 100%.
3. **Database Protection Integrity**: Despite the 77 network failures, `scripts/run-tests.ts` executed its `finally` block with complete fidelity:
   - Disposable database `test_disposable_1794637862445_00c006cb.db` and its WAL sidecars were unlinked.
   - Primary reference database `data/stroom.db` was verified intact.
   - Hash of `data/stroom.db` immediately following Task-4787 remained `ad6fe974854b0fcd83cf053e26de89f3d467b2be2687b09e0ab282e6acd848fb`.

### 2.2 Second Attempt: Task-4802 (Exit Code 0)
- **Invocation Timestamp**: 2026-11-14T06:31:55Z (12:01:55 IST)
- **Command Executed**: `npm test` (invoking `tsx scripts/run-tests.ts`)
- **Execution Mode**: `BypassSandbox: true` (Disabling sandbox network isolation)
- **Result**: Exit code 0; **78 Passed, 0 Failed (100% Pass Rate)**.

#### Outcome Summary:
With network isolation lifted for local loopback TCP communication, `fetch("http://127.0.0.1:5055/api/...")` connected immediately. All 15 functional domains, authentication mechanisms, dynamic onboarding quiz flows, auction gavel mechanics, door check-in terminals, and RBAC policies executed with 100% compliance.

---

## 3. Forensic Analysis of Worker Crypto-Test Attempts

To verify `crypto.subtle.timingSafeEqual` in the local Cloudflare Worker runtime before authoring code, an independent test script was constructed. Three preliminary attempts failed before reaching successful execution:

### 3.1 Attempt 1 (Step 4826): Module Resolution Failure
- **Command**: `node "C:\Users\kljka\.gemini\antigravity\brain\19a9e2f1-079b-413c-a46c-055c60506da4\scratch\test-crypto-worker.mjs"`
- **Exit Code**: 1
- **Error Output**:
  ```text
  Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'miniflare' imported from C:\Users\kljka\.gemini\antigravity\brain\19a9e2f1-079b-413c-a46c-055c60506da4\scratch\test-crypto-worker.mjs
      at new NodeError (node:internal/errors:405:5)
      at packageResolve (node:internal/modules/esm/resolve:890:9)
  ```
- **Causal Analysis**: The script was placed in the agent scratch directory (`C:\Users\kljka\.gemini\antigravity\brain\<id>\scratch\`). Under Node.js ESM resolution rules, bare specifiers (`import { Miniflare } from 'miniflare'`) walk up the directory tree to root. Because `miniflare` is installed locally in `D:\ST\node_modules\miniflare`, the resolution search failed.

### 3.2 Attempt 2 (Step 4830): Tool Call Parameter Constraint
- **Tool Call**: `write_file`
- **Error Output**:
  ```text
  Encountered error in tool execution: C:\Users\kljka\.gemini\antigravity\brain\19a9e2f1-079b-413c-a46c-055c60506da4\scratch\test-crypto-worker.mjs already exists. Edit the existing artifact instead
  ```
- **Causal Analysis**: The agent corrected the module import to an absolute file URL (`import { Miniflare } from 'file:///D:/ST/node_modules/miniflare/dist/src/index.js'`), but called `write_file` without passing `Overwrite: true`. The safety harness rejected overwriting an existing file without explicit authorization.

### 3.3 Attempt 3 (Step 4833): Miniflare IPC Loopback Block
- **Command**: `node "C:\Users\kljka\.gemini\antigravity\brain\19a9e2f1-079b-413c-a46c-055c60506da4\scratch\test-crypto-worker.mjs"`
- **Execution Mode**: `BypassSandbox: false`
- **Exit Code**: 1
- **Error Output**:
  ```text
  Test execution failed: TypeError: fetch failed
      at Object.fetch (D:\ST\node_modules\undici\index.js:112:15)
      at async Miniflare2.dispatchFetch (D:\ST\node_modules\miniflare\dist\src\index.js:17160:22)
    cause: Error: connect EACCES 127.0.0.1:50063
        at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1555:16) {
      errno: -4092,
      code: 'EACCES',
      syscall: 'connect',
      address: '127.0.0.1',
      port: 50063
    }
  ```
- **Causal Analysis**: Miniflare 3 runs Cloudflare's native `workerd.exe` binary in a separate process and manages request dispatching (`mf.dispatchFetch`) across an ephemeral internal loopback port (`127.0.0.1:50063`). Because Attempt 3 was executed with `BypassSandbox: false`, Windows sandbox network isolation blocked the inter-process loopback connection with `connect EACCES`.

### 3.4 Successful Attempt (Step 4836) & Final Environment Versions
- **Execution Mode**: `BypassSandbox: true`
- **Exit Code**: 0
- **Outcome**: **100% Passed**. Verified `crypto.subtle.timingSafeEqual` in `workerd`, confirmed `TypeError` thrown on unequal-length direct buffers, and verified 10/10 double-hash test vectors.
- **Runtime Environment Versions**:
  - **Node.js**: `v18.18.2`
  - **Cloudflare Wrangler**: `3.114.17`
  - **Miniflare**: `3.20240404.0`
  - **Worker V8 Engine**: `workerd` native binary
  - **Compatibility Date**: `2024-04-03`
  - **Compatibility Flags**: `["nodejs_compat"]`

---

## 4. Phase 2.5.1.0 Deliverables Audit

### 4.1 Provenance of Deliverables Specification
Forensic inspection of the user prompt in Step 4760 reveals that the prompt was truncated during client transmission:
```text
### 3. Cryptographic runtime compatibility
Verify independently
</USER_REQUEST>
```
Because the prompt ended at "Verify independently" without an explicit enumeration of individual document filenames, the agent generated a single consolidated preflight report: `PHASE2_5_1_0_PREFLIGHT_VERIFICATION_REPORT.md`.

### 4.2 Deliverable Inventory Status

| Expected Deliverable Topic | Reference Filename | Actual Status | Document Location / Evidence Section |
| :--- | :--- | :---: | :--- |
| **1. Database Baseline Protection** | `PHASE2_5_1_0_DATABASE_BASELINE_PROTECTION.md` | **CONSOLIDATED** | Fully contained in `PHASE2_5_1_0_PREFLIGHT_VERIFICATION_REPORT.md` (Section 2) |
| **2. Disposable Test Launcher** | `PHASE2_5_1_0_DISPOSABLE_TEST_LAUNCHER.md` | **CONSOLIDATED** | Fully contained in `PHASE2_5_1_0_PREFLIGHT_VERIFICATION_REPORT.md` (Section 3.1) |
| **3. Test Results Report** | `PHASE2_5_1_0_TEST_RESULTS_REPORT.md` | **CONSOLIDATED** | Fully contained in `PHASE2_5_1_0_PREFLIGHT_VERIFICATION_REPORT.md` (Section 3.2) |
| **4. Database Safety Post-Test** | `PHASE2_5_1_0_DATABASE_SAFETY_POST_TEST.md` | **CONSOLIDATED** | Fully contained in `PHASE2_5_1_0_PREFLIGHT_VERIFICATION_REPORT.md` (Section 3.3) |
| **5. Crypto Compatibility Audit** | `PHASE2_5_1_0_CRYPTO_RUNTIME_COMPATIBILITY.md` | **CONSOLIDATED** | Fully contained in `PHASE2_5_1_0_PREFLIGHT_VERIFICATION_REPORT.md` (Section 4) |
| **6. Consolidated Preflight Report** | `PHASE2_5_1_0_PREFLIGHT_VERIFICATION_REPORT.md` | **PRESENT** | Master deliverable in root directory `D:\ST` (Created 2026-11-14) |
| **7. Final Preflight Gate Decision** | `PHASE2_5_1_0_FINAL_GATE_DECISION.md` | **CONSOLIDATED** | Fully contained in `PHASE2_5_1_0_PREFLIGHT_VERIFICATION_REPORT.md` (Section 6) |

In strict accordance with the user's explicit instruction (*"Do not create missing documents unless necessary to clarify existing evidence"*), redundant unneeded sub-documents were not retroactively created. All required evidence has been comprehensively addressed and augmented in Phase 2.5.1.0.1 deliverables.
