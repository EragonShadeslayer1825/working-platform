# QA Report — Inji Interoperability Playground

> **Lead Architect & QA Lead**: Arnav  
> **Status**: Comprehensive Engineering Audit & Quality Sign-Off  
> **Date**: 2026-11-02  

---

## 1. QA Summary & Test Execution Metrics

| Category | Suite File | Tests Written | Tests Passing | Pass Rate | Coverage & Scope |
|---|---|---|---|---|---|
| Unit (Orchestrator Lifecycle) | `tests/orchestrator.test.ts` | 5 | 5 | 100% | Mock baseline E2E, registry, sanitization, corrupted sig, INCONCLUSIVE handling |
| Unit (Wallet Data Flow) | `tests/wallet-data-flow.test.ts` | 3 | 3 | 100% | Exact credential storage, exact credential presentation, direct tampering |
| API Integration | `tests/integration/api.integration.test.ts` | 19 | 19 | 100% | All REST endpoints (health, registry, runs, events, 404, 400), all verdict branches |
| Webhook Callbacks | `tests/integration/callbacks.integration.test.ts` | 5 | 5 | 100% | Authorized callback, invalid signature rejected, correlation match, duplicate/replay 409 |
| Sanitization Policy | `tests/integration/sanitization.integration.test.ts` | 28 | 28 | 100% | Full name, DOB, address, national ID, PIN, OTP, client secret, PEM private keys, recursion |
| Evaluator Verdict Branches | `tests/integration/evaluator.integration.test.ts` | 18 | 18 | 100% | PASSED, FAILED (sig, expiry, revocation, untrusted issuer, contradictory), INCONCLUSIVE (unparseable, missing) |
| Playground UI API | `tests/integration/playground-api.integration.test.ts` | 5 | 5 | 100% | UI contract `/api/runs`, polling, issuance/presentation handoff audit events |
| **Total** | **7 test files** | **83** | **83** | **100%** | Full automated mock baseline + live adapter negative flows |

---

## 2. CI Failures Resolved

### Failure A — Property `credentialType` does not exist on type `AuthoritativeVerificationEvidence`
- **Location**: `src/routes/playground-runs.routes.ts:157`
- **Root Cause**: Backend domain interface `AuthoritativeVerificationEvidence` lacked `credentialType`. Route attempted to read nonexistent property and fell back to hardcoded string `'IdentityCredential'`, fabricating observed evidence.
- **Fix**:
  1. Added `credentialType?: string` to `AuthoritativeVerificationEvidence` in `src/types/domain.ts`.
  2. Extracted `credentialType` from actual validated credential tokens in verifier adapters (`InjiVerifyAdapter` and `MockVerifierAdapter`).
  3. Removed hardcoded fallback from `playground-runs.routes.ts`. `observedCredentialType` is set strictly from `run.report?.authoritativeEvidence?.credentialType` or omitted when unobserved.
- **Verification**: `npm run build:backend` passed with 0 errors.

### Failure B — Cannot find module `../src/registry/component-registry.js`
- **Location**: `tests/orchestrator.test.ts`
- **Root Cause**: Earlier commits omitted `tsx` dependency and failed Node.js ESM module resolution under `--import tsx/esm`.
- **Fix**: Standardized project dependencies in `package.json` with `tsx: ^4.19.0`, aligned `tsconfig.json` module resolution to `NodeNext`, and configured single npm test script.
- **Verification**: All test suites execute cleanly via `node --import tsx/esm --test`.

---

## 3. Critical Correctness Audit Resolutions

| Audit Item | File | Finding | Resolution | Test Evidence |
|---|---|---|---|---|
| **Evaluator Trust Requirement** | `src/engine/evaluator.ts` | PASS condition did not require `isIssuerTrusted === true`. | Evaluator now requires all 5 conditions: `overallStatus === 'VALID'`, `isSignatureValid === true`, `isExpired === false`, `isRevoked === false`, `isIssuerTrusted === true`. | `tests/integration/evaluator.integration.test.ts` |
| **Inji Verify False-PASS** | `src/adapters/verifier/inji-verify.adapter.ts` | Initialized overall status to `VALID` and defaulted missing status to `VALID`. | Removed dangerous defaults. Added runtime schema validation, mapped missing/unknown/unparseable statuses strictly to `INCONCLUSIVE`, and separated network 5xx errors from authoritative rejections. | `tests/integration/api.integration.test.ts` |
| **Simulated Wallet Credential Flow** | `src/adapters/wallet/simulated-wallet.adapter.ts` | Generated a brand new hardcoded credential instead of presenting the issued credential. | Wallet now receives and stores the exact issued credential, constructs presentations directly from that stored credential, and applies tampering directly to it. | `tests/wallet-data-flow.test.ts` |
| **Mobile Wallet Support** | `src/adapters/wallet/inji-mobile.adapter.ts` & `src/engine/test-runner.ts` | No dedicated mobile adapter existed; interactive pause was improperly coupled to simulated wallet. | Implemented `InjiMobileWalletAdapter` with `isInteractive = true`, generating standard QR/deep-link URIs and pausing the engine state machine with `AWAITING_WALLET_ACTION`. | `tests/orchestrator.test.ts` |
| **Verification State Mapping** | `src/routes/playground-runs.routes.ts` & `lib/playground-api.ts` | `VerificationState` lacked `INCONCLUSIVE`; mapped inconclusive reports to `ERROR`. | Added `INCONCLUSIVE` to `VerificationState` in frontend and backend. Preserved semantic distinction between credential rejection, timeout, and inconclusive outcomes. | `tests/integration/playground-api.integration.test.ts` |
| **Protocol Event Accuracy** | `src/routes/playground-runs.routes.ts` | Event formatter defaulted missing HTTP status to 200 and cloned payloads. | Separate `requestPayload` and `responsePayload` captured. Missing HTTP status remains undefined. Transport status is not invented for internal events. | `tests/integration/api.integration.test.ts` |

---

## 4. Security Audit Resolutions

1. **CORS Allowlist**: Updated Express CORS middleware in `src/app.ts` to validate against configured `config.corsOrigins` rather than open `origin: '*'`.
2. **Comprehensive Sanitization**: Expanded `EventSanitizer.SENSITIVE_KEYS` to redact full names, dates of birth, street addresses, postal codes, national IDs, OTPs, PINs, client secrets, DPoP proofs, signed credentials, and PEM private keys (`[REDACTED_PRIVATE_KEY]`).
3. **Verifier Callback Security**: Added Zod schema validation, correlation checks against active run ID, sender authentication via `CALLBACK_AUTH_SECRET`, and duplicate/replay rejection (409 Conflict). Strict evaluation ensures callback receipt never equals PASS.
4. **Environment File Protection**: Updated `.gitignore` to ignore `.env` and `.env.*` while keeping `.env.example`.
5. **Next.js TypeScript Enforcement**: Removed `ignoreBuildErrors: true` from `next.config.mjs`. Fixed all typing errors in `app/page.tsx`. Verified production build passes with strict TypeScript checks.

---

## 5. Issue Register Summary

| ID | Issue | Severity | Status | Resolution |
|---|---|---|---|---|
| QA-001 | API route prefix mismatch between `/api/runs` and `/api/v1/runs` | Medium | **Resolved** | Dual mounting architecture |
| QA-002 | Inji Certify exact endpoint path | High | **Pinned (v0.10.0)** | Pinned to release v0.10.0 |
| QA-003 | Inji Verify result schema field | High | **Resolved** | Detailed status mapping |
| QA-004 | `mso_mdoc` unsupported by Inji Verify | Low | **Documented Blocker** | Documented in compatibility report |
| QA-005 | CORS wildcard in production | Medium | **Resolved** | Configured allowlist |
| QA-006 | Interactive mobile wallet flow | Medium | **Resolved** | InjiMobileWalletAdapter + engine pause |
| QA-007 | `STAGE_TIMEOUT_MS` / `RUN_TIMEOUT_MS` not enforced | High | **Resolved** | AbortController stage and run timeouts |
| QA-008 | CI TS2339 `credentialType` error | Critical | **Resolved** | Domain evidence model updated |
| QA-009 | CI module resolution error | High | **Resolved** | Tsx / NodeNext test runner configuration |
| QA-010 | Simulated wallet fabricated presentations | High | **Resolved** | Exact issued credential preserved & presented |
| QA-011 | Inji Verify false-PASS default | Critical | **Resolved** | Removed dangerous defaults; schema validation |
| QA-012 | Evaluator PASS rule omitted `isIssuerTrusted` | High | **Resolved** | Mandatory 5-condition PASS requirement |
| QA-013 | Next.js suppressed TypeScript build errors | Medium | **Resolved** | Removed ignoreBuildErrors; fixed all types |
| QA-014 | Dual lockfiles (`pnpm-lock.yaml` vs `package-lock.json`) | Low | **Resolved** | Removed pnpm lockfile; standardized on npm |
| QA-015 | Hardcoded localhost in callback URLs | Medium | **Resolved** | Configurable `CALLBACK_BASE_URL` |
| QA-016 | Verifier webhook callback unauthenticated & prone to replay | High | **Resolved** | Schema validation, correlation, replay prevention |
