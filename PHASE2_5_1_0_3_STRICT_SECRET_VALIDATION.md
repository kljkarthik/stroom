# STROOM — Phase 2.5.1.0.3: Strict Secret Validation Specification

**Project:** `D:\ST`  
**Branch:** `feature/stroom-production-launch`  
**Approved Baseline Commit:** `19c4176`  
**Document Version:** 1.0.0 (Deterministic Character Validation Standard)  
**Security Classification:** Cryptographic Architecture & Secret Validation  
**Mode:** STRICT READ-ONLY SPECIFICATION (Zero code changes, zero database mutations)  
**Date:** November 14, 2026  

---

## 1. Executive Summary & The Regex `$` Vulnerability

In Phase 2.5.1.0.2, secret format validation utilized the regular expression:
```javascript
/^[A-Za-z0-9_-]{32,128}$/
```
In formal security reviews, regular expression end-anchors (`$`) present subtle security risks:
1. **Trailing Line-Terminator Acceptance**: In several regex implementations and specifications (and whenever the multiline flag `/m` is inadvertently applied or headers contain line feeds), `$` matches immediately before a terminating newline (`\n` or `\r\n`). This could allow an attacker or misconfigured client to pass `secret\n` or `secret\r\n`, which would pass regex inspection but fail strict byte equality or corrupt downstream HMAC signatures.
2. **Backtracking and Engine Overhead**: While bounded regexes are fast, regular expression engines involve parsing overhead and potential engine-specific quirks across heterogeneous JavaScript runtimes (V8 in Node.js vs. `workerd` V8 isolates).

To establish mathematical certainty and eliminate regex anchor vulnerabilities, this specification replaces regex-based validation with **Deterministic Character-Code Iteration**.

---

## 2. Deterministic Character Code Allowlist Specification

Validation inspects every individual 16-bit code unit using `String.prototype.charCodeAt(i)`. The character code must fall strictly within the 7-bit ASCII URL-safe Base64URL set:

$$\text{ValidCode}(c) = \begin{cases} 
\text{true} & \text{if } c \in [65, 90] & (\text{ASCII 'A'–'Z'}) \\
\text{true} & \text{if } c \in [97, 122] & (\text{ASCII 'a'–'z'}) \\
\text{true} & \text{if } c \in [48, 57] & (\text{ASCII '0'–'9'}) \\
\text{true} & \text{if } c = 95 & (\text{ASCII '\_'}) \\
\text{true} & \text{if } c = 45 & (\text{ASCII '\-'}) \\
\text{false} & \text{otherwise}
\end{cases}$$

### Strict Rejection Matrix
Any character outside these 64 allowed code points is immediately rejected:
- **Line Terminators**: Newline (`\n`, code 10), carriage return (`\r`, code 13), CRLF (`\r\n`).
- **Unicode Line Breaks**: Line separator (`\u2028`, code 8232), paragraph separator (`\u2029`, code 8233).
- **Whitespace & Control**: Space (`0x20`, code 32), horizontal tab (`\t`, code 9), null byte (`\0`, code 0).
- **Non-URL-Safe Base64**: Plus (`+`, code 43), slash (`/`, code 47), padding equals (`=`, code 61).
- **Punctuation & Symbols**: `!`, `@`, `#`, `$`, `%`, `^`, `&`, `*`, `(`, `)`, `:`, `;`, `"`, `'`.
- **Surrogates**: High surrogates (`0xD800`–`0xDBFF`, 55296–56319), low surrogates (`0xDC00`–`0xDFFF`, 56320–57343).
- **Non-ASCII Unicode**: Accented Latin, CJK, Cyrillic, Arabic, Hebrew, and Unicode emojis.

---

## 3. Strict Input Length & DoS Defense

The generation contract mandates unpadded Base64URL encoding of 32 CSPRNG bytes, which produces **exactly 43 ASCII characters**.

### Input Length Bounds
- `EXPECTED_SECRET_LENGTH = 43`
- If `secret.length !== 43`:
  - **Rejection in $O(1)$ Time**: The function exits immediately without entering the character-code loop, without regex execution, and without cryptographic hashing.
  - **Hash DoS Neutralization**: An attacker submitting 100,000 characters in `X-STROOM-Bridge-Secret` is rejected in less than 50 nanoseconds, protecting the CPU from exhaustion.
- **Strict Prohibition on Transformation**:
  - Secrets are **never** trimmed (`.trim()`).
  - Secrets are **never** normalized (`.normalize()`).
  - Secrets are **never** converted to lowercase or silently modified.
  - Any leading, trailing, or embedded space or newline causes immediate rejection.

---

## 4. Dual-Phase Validation Architecture

Validation operates across two distinct operational boundaries:

### 4.1 Startup Configuration Validation (`validateConfiguredSecret`)
- **Execution**: Invoked once during process/isolate boot (`server/index.ts` and `src/worker/app.ts`).
- **Target**: Environment variables `INTERNAL_D1_BRIDGE_SECRET` and `ORIGIN_PROXY_SECRET`.
- **Behavior on Failure**: **THROWS FATAL STARTUP ERROR** (`[STROOM Config Fatal]`). Halts server boot immediately.
- **Rules Enforced**: Must be string, must be exactly 43 characters, must pass character code allowlist, and must match UTF-8 byte length.

### 4.2 Runtime Request Validation (`isStrictBase64UrlString`)
- **Execution**: Invoked per incoming HTTP request on authorization headers.
- **Target**: `X-STROOM-Bridge-Secret` and `X-STROOM-Origin-Secret`.
- **Behavior on Failure**: **FAILS CLOSED (RETURNS `false`) IN $O(1)$ TIME**. Never throws unhandled exceptions; returns `401 Unauthorized` / `403 Forbidden`.
- **Rules Enforced**: If input is not a string or `length !== 43`, returns `false`. If any character fails character-code allowlist, returns `false`.

---

## 5. Constant-Time Invariant

> **Notice**: The entire comparison function IS NOT constant-time.  
> 1. **Validation Phase (Variable-Time)**: Validating parameter types, length (43), and ASCII characters executes in variable time ($O(1)$ to $O(43)$). Early exit is secure because malformed protocol shapes leak zero entropy regarding secret values.  
> 2. **Digest Comparison Phase (Strictly Constant-Time)**: Validated 43-character secrets are hashed with SHA-256 into guaranteed 32-byte buffers. `crypto.timingSafeEqual` (Node.js) and `crypto.subtle.timingSafeEqual` (Workers) compare all 32 bytes using bitwise accumulator logic without early termination.
