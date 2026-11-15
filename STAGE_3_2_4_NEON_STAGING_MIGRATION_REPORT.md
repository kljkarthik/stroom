# STROOM — Stage 3.2.4: Neon Disposable PostgreSQL Provisioning & Staging Migration Report

**Date:** November 14, 2026  
**Auditor / Specialist:** Senior Database Migration Architect & Lead Backend Systems Engineer  
**Project:** STROOM (Strangers Room) — `D:\ST`  
**Git Branch:** `feature/stroom-production-launch`  
**Git HEAD Commit:** `19c4176b87094a6ba7b81ffec7a01b72796c08ec`  
**Active Production Driver:** SQLite (`DATABASE_DRIVER=sqlite` — Untouched)  
**D1 Authentication Bridge:** Disabled (`ENABLE_D1_AUTH_BRIDGE=false` — Untouched)  
**Stage 3.2.4 Verdict:** **PASSED / COMPLETE**

---

## 1. Executive Summary

Stage 3.2.4 of the STROOM PostgreSQL Migration Roadmap has been executed and verified in complete adherence to strict database safety and environment isolation boundaries.

The operator authorized the provisioning and use of a disposable free-tier Neon PostgreSQL staging instance (`empty-morning-17229913` in AWS `us-east-2`) solely for isolated schema validation, batch data migration, parity auditing, and rollback verification.

### Key Outcomes:
1. **Protected Databases Pristine:** The primary SQLite database (`data/stroom.db`) and historical checkpoint backup (`backups/stroom-checkpoint-phase0-2026-11-13T08-10-02-441Z.db`) were NEVER accessed, modified, or targeted by any write operation. Their SHA-256 hashes remain byte-for-byte identical to their preflight baselines.
2. **Credential Safety:** Database credentials were NEVER written to `.env.test`, `.env`, or any file tracked by Git. All credentials were provided exclusively in-memory via process environment variables (`$env:TARGET_DATABASE_URL`) and are fully masked in all logs and reports.
3. **DDL Schema Application:** Applied `migrations/postgres/0001_postgres_schema.sql` (36,993 bytes) to Neon PostgreSQL 18.7. Exactly **42 tables**, **49 indexes**, and appropriate `NUMERIC(12, 2)` currency constraints were successfully created.
4. **Optimized Batch Migration:** Executed `scripts/migrate-sqlite-to-postgres.ts` using multi-row batch inserts (`INSERT INTO ... VALUES (...) ... ON CONFLICT DO NOTHING`) with 500 rows/batch. All **42 tables** and all **10,160 rows** migrated from a verified disposable SQLite snapshot to Neon PostgreSQL with **0 errors** in **43.3 seconds**.
5. **Deterministic Parity Audit:** Executed `scripts/verify-postgres-parity.ts` against the live Neon staging instance. Confirmed **100% row count match (10,160 / 10,160)** and **100% deterministic SHA-256 composite table hash match across all 42 tables (42 / 42 matching, 0 mismatches)**.
6. **Isolated Rollback Teardown & Re-Migration:** Executed `scripts/rollback-postgres-migration.ts --confirm` against the Neon staging instance. Verified that all 42 tables were dropped in reverse topological order with `CASCADE`, leaving exactly **0 tables** in the Neon public schema. Re-applied schema DDL and re-migrated data to leave the disposable staging environment in a fully primed, verified state for subsequent testing.
7. **Zero Regression:** All existing SQLite unit tests (87/87 assertions) and full end-to-end regression suites (81/81 tests) passed with zero regressions.

---

## 2. Safety Preflight & Baseline Verification

Before initiating any remote network connections, preflight checks recorded the integrity of the protected databases and local workspace.

### 2.1 Protected Database SHA-256 Hashes
| File Path | Baseline SHA-256 Hash | Post-Execution SHA-256 Hash | Status |
| :--- | :--- | :--- | :--- |
| `data/stroom.db` | `AD6FE974854B0FCD83CF053E26DE89F3D467B2BE2687B09E0AB282E6ACD848FB` | `AD6FE974854B0FCD83CF053E26DE89F3D467B2BE2687B09E0AB282E6ACD848FB` | **PRISTINE (100% MATCH)** |
| `backups/stroom-checkpoint-phase0-2026-11-13T08-10-02-441Z.db` | `2129266EF6555C90C74B9166E696A2E39AA8B2A87E483EB79A20F9A292BE4571` | `2129266EF6555C90C74B9166E696A2E39AA8B2A87E483EB79A20F9A292BE4571` | **PRISTINE (100% MATCH)** |

### 2.2 Disposable Migration Source Isolation
To guarantee complete isolation from `data/stroom.db`:
- A byte-for-byte read-only copy was generated: `data/test_disposable_stage324_source.db` (SHA-256 matching primary `AD6FE974...`).
- SQLite integrity check: `PRAGMA integrity_check = ok`, `PRAGMA foreign_key_check = 0 errors`.
- All migration scripts read strictly from `--source data/test_disposable_stage324_source.db`.
- Upon successful parity audit, `data/test_disposable_stage324_source.db` was permanently deleted.

### 2.3 Sidecar Status
- `data/stroom.db-wal`: 0 bytes (cleanly checkpointed).
- `data/stroom.db-shm`: 32,768 bytes.
- Zero orphaned or lock sidecars generated.

---

## 3. Disposable Neon PostgreSQL Environment Identification

| Attribute | Specification |
| :--- | :--- |
| **Provider** | Neon Serverless PostgreSQL (Free Tier) |
| **Project Name / ID** | `empty-morning-17229913` |
| **Branch Name / ID** | `br-gentle-rice-bd2ilfw8` |
| **PostgreSQL Version** | 18.7 (AWS `us-east-2` Ohio) |
| **Primary Hostname** | `ep-ancient-water-bdpcn0w7.c-8.us-east-2.aws.neon.tech` |
| **Connection URL Mask** | `postgresql://neondb_owner:***@ep-ancient-water-bdpcn0w7.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| **Credential Storage** | In-memory `$env:TARGET_DATABASE_URL` process variable only. |
| **Network & TLS Config** | Direct TLS with SNI servername validation (`ep-ancient-water-bdpcn0w7.c-8.us-east-2.aws.neon.tech`). |

---

## 4. PostgreSQL DDL Schema Application & Validation

Schema DDL was applied directly to the disposable Neon database via `scratch/apply-neon-schema.ts`.

### 4.1 Schema DDL Verification Metrics
- **DDL File:** `migrations/postgres/0001_postgres_schema.sql` (36,993 bytes).
- **CREATE TABLE Statements:** Exactly 42 statements executed.
- **Tables Created in Neon:** **42 / 42 verified**.
- **Explicit Indexes Created:** **49 verified** (including composite foreign keys and uniqueness constraints).
- **Currency Columns Verified:**
  - `bids.amount`: `INTEGER`
  - `coupons.min_purchase`: `NUMERIC(12, 2)`
  - `coupon_redemptions.order_amount`: `NUMERIC(12, 2)`
  - `payment_transactions.amount`: `NUMERIC(12, 2)`
  - `payment_transactions.refund_amount`: `NUMERIC(12, 2)`
- **Dialect Parity:** Zero SQLite-specific constructs (`datetime('now')`, `INTEGER PRIMARY KEY AUTOINCREMENT`) present in PostgreSQL schema.

---

## 5. Live Batch Data Migration Execution

The migration script (`scripts/migrate-sqlite-to-postgres.ts`) was executed against the disposable Neon target.

### 5.1 Migration Execution Log Summary
```
================================================================
🚀 STROOM SQLITE TO POSTGRESQL MIGRATION PIPELINE
================================================================
Source SQLite Database: D:\ST\data\test_disposable_stage324_source.db
Execution Mode        : LIVE EXECUTION
Batch Size            : 500 rows/batch
Target PostgreSQL     : postgresql://neondb_owner:***@ep-ancient-water-bdpcn0w7.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require
----------------------------------------------------------------

[TABLE] achievements_master       | Rows:      7 | Status: Processing... [SUCCESS in 2343ms]
[TABLE] cities                    | Rows:     14 | Status: Processing... [SUCCESS in 732ms]
[TABLE] discovery_items           | Rows:     11 | Status: Processing... [SUCCESS in 723ms]
[TABLE] platform_settings         | Rows:      6 | Status: Processing... [SUCCESS in 723ms]
[TABLE] quizzes                   | Rows:      1 | Status: Processing... [SUCCESS in 726ms]
[TABLE] users                     | Rows:    188 | Status: Processing... [SUCCESS in 1214ms]
[TABLE] communities               | Rows:     18 | Status: Processing... [SUCCESS in 749ms]
[TABLE] quiz_versions             | Rows:     43 | Status: Processing... [SUCCESS in 718ms]
[TABLE] activity_logs             | Rows:    230 | Status: Processing... [SUCCESS in 735ms]
[TABLE] admin_announcements       | Rows:     11 | Status: Processing... [SUCCESS in 732ms]
[TABLE] audit_logs                | Rows:    325 | Status: Processing... [SUCCESS in 744ms]
[TABLE] contact_inquiries         | Rows:     27 | Status: Processing... [SUCCESS in 804ms]
[TABLE] notifications             | Rows:   1757 | Status: Processing... [SUCCESS in 2998ms]
[TABLE] partner_accounts          | Rows:     17 | Status: Processing... [SUCCESS in 737ms]
[TABLE] user_achievements         | Rows:    101 | Status: Processing... [SUCCESS in 723ms]
[TABLE] user_preferences          | Rows:    210 | Status: Processing... [SUCCESS in 731ms]
[TABLE] community_members         | Rows:      1 | Status: Processing... [SUCCESS in 757ms]
[TABLE] community_posts           | Rows:      2 | Status: Processing... [SUCCESS in 725ms]
[TABLE] partner_audit_logs        | Rows:    243 | Status: Processing... [SUCCESS in 731ms]
[TABLE] partner_users             | Rows:     17 | Status: Processing... [SUCCESS in 723ms]
[TABLE] questions                 | Rows:   1028 | Status: Processing... [SUCCESS in 2211ms]
[TABLE] quiz_sessions             | Rows:     85 | Status: Processing... [SUCCESS in 742ms]
[TABLE] venues                    | Rows:     34 | Status: Processing... [SUCCESS in 1039ms]
[TABLE] coupons                   | Rows:     31 | Status: Processing... [SUCCESS in 724ms]
[TABLE] events                    | Rows:     44 | Status: Processing... [SUCCESS in 723ms]
[TABLE] partner_proposals         | Rows:     33 | Status: Processing... [SUCCESS in 752ms]
[TABLE] options                   | Rows:   3385 | Status: Processing... [SUCCESS in 5465ms]
[TABLE] responses                 | Rows:    904 | Status: Processing... [SUCCESS in 1600ms]
[TABLE] passport_stamps           | Rows:     50 | Status: Processing... [SUCCESS in 735ms]
[TABLE] venue_availability        | Rows:     32 | Status: Processing... [SUCCESS in 732ms]
[TABLE] auction_rooms             | Rows:      6 | Status: Processing... [SUCCESS in 719ms]
[TABLE] event_registrations       | Rows:     34 | Status: Processing... [SUCCESS in 724ms]
[TABLE] partner_collaborations    | Rows:     16 | Status: Processing... [SUCCESS in 724ms]
[TABLE] response_options          | Rows:    905 | Status: Processing... [SUCCESS in 1487ms]
[TABLE] auction_teams             | Rows:     22 | Status: Processing... [SUCCESS in 732ms]
[TABLE] collaboration_comments    | Rows:     27 | Status: Processing... [SUCCESS in 728ms]
[TABLE] partner_communications    | Rows:     90 | Status: Processing... [SUCCESS in 724ms]
[TABLE] coupon_redemptions        | Rows:     48 | Status: Processing... [SUCCESS in 735ms]
[TABLE] payment_transactions      | Rows:      7 | Status: Processing... [SUCCESS in 723ms]
[TABLE] auction_players           | Rows:     60 | Status: Processing... [SUCCESS in 741ms]
[TABLE] auction_registrations     | Rows:     23 | Status: Processing... [SUCCESS in 724ms]
[TABLE] bids                      | Rows:     67 | Status: Processing... [SUCCESS in 729ms]

================================================================
📊 MIGRATION SUMMARY
================================================================
Execution Mode    : LIVE MIGRATION
Tables Processed  : 42 / 42
Total Rows Read   : 10160
Total Rows Copied : 10160
Total Duration    : 43315 ms
================================================================
```

---

## 6. Table-by-Table Parity Audit & Reconciliation

The verification tool `scripts/verify-postgres-parity.ts` audited all 42 tables, computing deterministic SHA-256 composite table hashes and reconciling row counts between SQLite and PostgreSQL.

### 6.1 Reconciliation Matrix (42 Tables)

| # | Table Name | Topological Level | SQLite Rows | PostgreSQL Rows | Row Count Match | SHA-256 Hash Match | Final Status |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `achievements_master` | Level 1 | 7 | 7 | YES | YES (`b50575c340f255f0...`) | **MATCH** |
| 2 | `cities` | Level 1 | 14 | 14 | YES | YES (`acb30e765c8ea064...`) | **MATCH** |
| 3 | `discovery_items` | Level 1 | 11 | 11 | YES | YES (`9fb9635bc65a04f9...`) | **MATCH** |
| 4 | `platform_settings` | Level 1 | 6 | 6 | YES | YES (`f5e1742948d00d5b...`) | **MATCH** |
| 5 | `quizzes` | Level 1 | 1 | 1 | YES | YES (`729dc09a8bf17744...`) | **MATCH** |
| 6 | `users` | Level 2 | 188 | 188 | YES | YES (`a45a902bf041e281...`) | **MATCH** |
| 7 | `communities` | Level 3 | 18 | 18 | YES | YES (`c072f8a680d591f0...`) | **MATCH** |
| 8 | `quiz_versions` | Level 3 | 43 | 43 | YES | YES (`fbff622b507da165...`) | **MATCH** |
| 9 | `activity_logs` | Level 3 | 230 | 230 | YES | YES (`01ee04e6a83f5c4d...`) | **MATCH** |
| 10 | `admin_announcements` | Level 3 | 11 | 11 | YES | YES (`8d404d96fec383b0...`) | **MATCH** |
| 11 | `audit_logs` | Level 3 | 325 | 325 | YES | YES (`1f40359eaad8f5e8...`) | **MATCH** |
| 12 | `contact_inquiries` | Level 3 | 27 | 27 | YES | YES (`c448e0a1f313f8f5...`) | **MATCH** |
| 13 | `notifications` | Level 3 | 1,757 | 1,757 | YES | YES (`57354eccabda21f5...`) | **MATCH** |
| 14 | `partner_accounts` | Level 3 | 17 | 17 | YES | YES (`dd05d183900f3821...`) | **MATCH** |
| 15 | `user_achievements` | Level 3 | 101 | 101 | YES | YES (`85f24c82f15f7310...`) | **MATCH** |
| 16 | `user_preferences` | Level 3 | 210 | 210 | YES | YES (`c386f5f53ad1bddd...`) | **MATCH** |
| 17 | `community_members` | Level 4 | 1 | 1 | YES | YES (`757b9cbe72b31089...`) | **MATCH** |
| 18 | `community_posts` | Level 4 | 2 | 2 | YES | YES (`5233e55bcdcf7204...`) | **MATCH** |
| 19 | `partner_audit_logs` | Level 4 | 243 | 243 | YES | YES (`a5c769279ade4f61...`) | **MATCH** |
| 20 | `partner_users` | Level 4 | 17 | 17 | YES | YES (`cf302606eea7b626...`) | **MATCH** |
| 21 | `questions` | Level 4 | 1,028 | 1,028 | YES | YES (`a5b5b2dd23c1daa9...`) | **MATCH** |
| 22 | `quiz_sessions` | Level 4 | 85 | 85 | YES | YES (`a94fca5ad0d7d467...`) | **MATCH** |
| 23 | `venues` | Level 4 | 34 | 34 | YES | YES (`4a3c3d7e0f8d71f0...`) | **MATCH** |
| 24 | `coupons` | Level 4 | 31 | 31 | YES | YES (`edd49124a1852623...`) | **MATCH** |
| 25 | `events` | Level 5 | 44 | 44 | YES | YES (`dc7019e55f4c4182...`) | **MATCH** |
| 26 | `partner_proposals` | Level 5 | 33 | 33 | YES | YES (`e455adb82bb66e88...`) | **MATCH** |
| 27 | `options` | Level 5 | 3,385 | 3,385 | YES | YES (`2962f32eb537566f...`) | **MATCH** |
| 28 | `responses` | Level 5 | 904 | 904 | YES | YES (`49f42b93c35066e3...`) | **MATCH** |
| 29 | `passport_stamps` | Level 5 | 50 | 50 | YES | YES (`c46581d44f8d5b79...`) | **MATCH** |
| 30 | `venue_availability` | Level 5 | 32 | 32 | YES | YES (`23b259249c979b2d...`) | **MATCH** |
| 31 | `auction_rooms` | Level 5 | 6 | 6 | YES | YES (`775fe5ca2b836feb...`) | **MATCH** |
| 32 | `event_registrations` | Level 6 | 34 | 34 | YES | YES (`5a764f3b875ec388...`) | **MATCH** |
| 33 | `partner_collaborations` | Level 6 | 16 | 16 | YES | YES (`f554725df934d524...`) | **MATCH** |
| 34 | `response_options` | Level 6 | 905 | 905 | YES | YES (`2ba21e2c85962796...`) | **MATCH** |
| 35 | `auction_teams` | Level 6 | 22 | 22 | YES | YES (`5711969abee40cc9...`) | **MATCH** |
| 36 | `collaboration_comments` | Level 7 | 27 | 27 | YES | YES (`f979d812c97a6322...`) | **MATCH** |
| 37 | `partner_communications` | Level 7 | 90 | 90 | YES | YES (`92d02b2c2f827b6b...`) | **MATCH** |
| 38 | `coupon_redemptions` | Level 7 | 48 | 48 | YES | YES (`4d56deecf26d37be...`) | **MATCH** |
| 39 | `payment_transactions` | Level 7 | 7 | 7 | YES | YES (`b2470e88b89d6aff...`) | **MATCH** |
| 40 | `auction_players` | Level 7 | 60 | 60 | YES | YES (`c54da5da6ad18a7e...`) | **MATCH** |
| 41 | `auction_registrations` | Level 8 | 23 | 23 | YES | YES (`414586f0347294b8...`) | **MATCH** |
| 42 | `bids` | Level 8 | 67 | 67 | YES | YES (`ba54008d15672aa6...`) | **MATCH** |
| **TOTAL** | **42 Tables** | — | **10,160** | **10,160** | **100% MATCH** | **100% MATCH** | **ALL MATCH** |

### 6.2 Parity Audit Details: Numeric Type Handling
- In SQLite, monetary fields were stored as `INTEGER` or `REAL` numbers (e.g. `850`, `0`, `499`).
- In PostgreSQL, they are modeled as `NUMERIC(12, 2)`. The Node.js PostgreSQL driver (`pg`) returns `NUMERIC` values as strings (e.g. `"850.00"`, `"0.00"`, `"499.00"`) to protect arbitrary precision beyond JavaScript IEEE-754 64-bit float limits.
- `scripts/verify-postgres-parity.ts` canonicalizes decimal strings into equivalent numbers prior to SHA-256 digest creation (`Number("850.00") === 850`). This ensured true mathematical data parity without masking real discrepancies.

---

## 7. Isolated Target Rollback Teardown & Re-Migration Verification

A migration solution cannot be declared production-ready without verifying its reverse teardown (rollback) path.

### 7.1 Rollback Execution
- Tool: `scripts/rollback-postgres-migration.ts --confirm`
- Scope: Reverse topological order (Level 8 down to Level 1) with `CASCADE` on PostgreSQL target.
- Target: Neon PostgreSQL disposable staging instance.
- SQLite Source: **100% untouched and unread**.

### 7.2 Post-Rollback Verification
A direct inspection query was executed against the Neon database:
```sql
SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public';
```
- **Result:** Exactly **0 tables remaining** in the public schema.
- All 42 tables, composite foreign keys, sequences, and indexes were dropped cleanly without orphaned locks or constraint violations.

### 7.3 Re-Migration for Continued Staging Readiness
To leave the staging environment fully available for future testing:
1. Re-applied DDL schema: `scratch/apply-neon-schema.ts` (42 tables recreated).
2. Re-migrated data: `scripts/migrate-sqlite-to-postgres.ts` (10,160 rows migrated in 43.3 seconds).
3. Final parity verification: `scripts/verify-postgres-parity.ts` (42/42 matching tables, 10,160/10,160 rows matching).

---

## 8. Workspace & Environment Safety Conformance

| Safety Requirement | Verification Evidence | Status |
| :--- | :--- | :--- |
| **No Modification to Primary DB** | SHA-256 `AD6FE974854B0FCD83CF053E26DE89F3D467B2BE2687B09E0AB282E6ACD848FB` confirmed byte-for-byte identical. | **PASS** |
| **No Modification to Backup** | SHA-256 `2129266EF6555C90C74B9166E696A2E39AA8B2A87E483EB79A20F9A292BE4571` confirmed byte-for-byte identical. | **PASS** |
| **No Production Deployment** | Zero Cloudflare Wrangler commands or production migrations executed. | **PASS** |
| **No Git History Modification** | Git branch remains `feature/stroom-production-launch` at commit `19c4176b87094a6ba7b81ffec7a01b72796c08ec`. | **PASS** |
| **No Credential Leakage** | Database URL strictly passed via in-memory process environment variable; masked as `***` in all logs. | **PASS** |
| **Driver Isolation** | Default driver remains SQLite; D1 authentication bridge remains disabled (`ENABLE_D1_AUTH_BRIDGE=false`). | **PASS** |
| **No Regressions** | 87/87 assertions passed in Stage 3.2 suite; 81/81 tests passed in full E2E verification suite. | **PASS** |

---

## 9. Final Stage 3.2.4 Verdict & Next Step Roadmap

### Verdict: **STAGE 3.2.4 IS COMPLETE AND FULLY PASSED**

The end-to-end migration pipeline from SQLite to hosted Neon PostgreSQL is validated, performant (43.3s for 10,160 rows), accurate (100% parity across 42 tables), and safe (tested rollback and re-migration).

### Subsequent Stages (Strictly Pending Separate Authorization):
- **Stage 3.2.5 — Backend Async Refactoring & Verification:** Refactor synchronous backend queries (`db.prepare(...)`) across server routes to use asynchronous adapter interfaces (`await adapter.query(...)` / `await adapter.execute(...)`) with continuous SQLite regression protection.
- **Stage 3.3 — Production PostgreSQL Migration & Cutover:** Production database provisioning, live data migration, DNS cutover, and dual-driver verification.

*Stopping Rule Enforced: No work on Stage 3.2.5 or Stage 3.3 has commenced.*
