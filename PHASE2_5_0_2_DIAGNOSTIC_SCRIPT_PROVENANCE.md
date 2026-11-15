# STROOM — Phase 2.5.0.2: Diagnostic Script Provenance & Audit

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Diagnostic Script Provenance)  
**Security Classification:** File & Environment Provenance  
**Mode:** STRICT READ-ONLY AUDIT (Zero database, code, or infrastructure mutations)

---

## 1. Executive Summary

This report establishes the location, physical properties, Git status, and execution history for the temporary diagnostic script `inspect-new-rows.js`.

A filesystem search confirmed that **exactly one copy** of `inspect-new-rows.js` exists on the host machine. It resides exclusively within the secure Antigravity conversation scratch directory and does not exist inside the Git working tree.

---

## 2. Inventory & Forensic Properties

| Property | Value / Verification Detail |
| :--- | :--- |
| **Filename** | `inspect-new-rows.js` |
| **Exact Absolute Path** | `C:\Users\kljka\.gemini\antigravity\brain\19a9e2f1-079b-413c-a46c-055c60506da4\scratch\inspect-new-rows.js` |
| **Location Relative to Workspace** | Outside workspace (`brain/19a9.../scratch/`), zero copies in `D:\ST`. |
| **Git Status** | **NOT TRACKED / OUTSIDE REPOSITORY** (Git status in `D:\ST` does not see this file). |
| **File Size** | `699 bytes` |
| **SHA-256 Checksum** | `f46b6484cfe0ee147d878e0f3eeaf2f738fda47911c215368e8d0099c9dc5363` |
| **Creation Step & Timestamp** | Step 4547 at `2026-11-13T11:52:47Z` (17:22:47 IST). |
| **Target Database Opened** | `D:/ST/data/stroom.db` |
| **Access Mode** | **`{ readonly: true }`** (Strict read-only handle; zero mutations). |
| **Access to Checkpoint Backup?** | **NO.** Does not reference or attach `backups/`. |
| **Execution Step & Timestamp** | Step 4549 at `2026-11-13T11:52:53Z` (17:22:53 IST). |
| **Exact Execution Command** | `node "C:\Users\kljka\.gemini\antigravity\brain\19a9e2f1-079b-413c-a46c-055c60506da4\scratch\inspect-new-rows.js"` |
| **Execution Outcome** | Exited with code `0`; output JSON of top 5 records from 4 tables. |

---

## 3. Complete Source Code Listing

The exact 16-line script is preserved verbatim below:

```javascript
const Database = require('D:/ST/node_modules/better-sqlite3');
const db = new Database('D:/ST/data/stroom.db', { readonly: true });

console.log('--- activity_logs (last 5) ---');
console.log(db.prepare('SELECT * FROM activity_logs ORDER BY rowid DESC LIMIT 5').all());

console.log('--- audit_logs (last 5) ---');
console.log(db.prepare('SELECT * FROM audit_logs ORDER BY rowid DESC LIMIT 5').all());

console.log('--- notifications (last 5) ---');
console.log(db.prepare('SELECT * FROM notifications ORDER BY rowid DESC LIMIT 5').all());

console.log('--- user_achievements (last 5) ---');
console.log(db.prepare('SELECT * FROM user_achievements ORDER BY rowid DESC LIMIT 5').all());

db.close();
```

---

## 4. Governance & Safety Recommendation

1. **Do Not Delete:** The script is part of the persistent forensic transcript record in the conversation scratch directory. Deleting it would break historical trajectory traceability.
2. **Do Not Move to Workspace:** The script must remain in `<appDataDir>/brain/<conversation-id>/scratch/` to prevent polluting the clean Git working tree of `D:\ST`.
3. **Immutability Confirmed:** The script opens the database strictly in read-only mode (`{ readonly: true }`) and terminates with `db.close()`, guaranteeing complete database safety.
