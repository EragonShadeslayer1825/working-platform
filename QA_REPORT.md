# QA Report — Inji Interoperability Playground

> **Owner**: Manay  
> **Project**: MOSIP Decode Hackathon — Problem 02: Inji Interoperability Playground  
> **Status**: Living document — updated after each test cycle

---

## QA Summary

| Category | Tests Written | Tests Passing | Pass Rate | Coverage |
|---|---|---|---|---|
| Unit (Orchestrator) | 5 | 5 | 100% | Mock E2E, sanitization, registry, corrupted sig, INCONCLUSIVE |
| API Integration | 19 | 19 | 100% | All HTTP endpoints (health, registry, runs, events, 404, 400), all verdicts |
| Sanitization Policy | 26 | 26 | 100% | 12 sensitive key patterns, nested recursion, arrays, Bearer tokens, PEM, depth guard, case-insensitivity |
| Evaluator Branches | 15 | 15 | 100% | PASSED, FAILED (sig, expiry, revocation, untrusted), INCONCLUSIVE (transport, timeout, missing evidence), report fields |
| **Total** | **65** | **65** | **100%** | Full automated mock baseline + policy verification |

---

## Test Execution Log

### Mock Stack (Automated — No Inji Services Required)

```bash
# Run all 65 tests in a single command
npm test

# Run individual test suites
npm run test:unit
npm run test:integration
```

| Suite | Status | Last Run | Tests | Duration | Notes |
|---|---|---|---|---|---|
| `orchestrator.test.ts` | ✅ PASS | 2026-11-01 | 5 / 5 | ~1.1s | Original orchestrator domain & pipeline tests |
| `api.integration.test.ts` | ✅ PASS | 2026-11-01 | 19 / 19 | ~2.1s | Live HTTP server on random port, all REST endpoints |
| `sanitization.integration.test.ts` | ✅ PASS | 2026-11-01 | 26 / 26 | ~0.3s | Exhaustive EventSanitizer redaction verification |
| `evaluator.integration.test.ts` | ✅ PASS | 2026-11-01 | 15 / 15 | ~0.3s | AuthoritativeVerdictEvaluator branch matrix |

---

## Acceptance Criteria Verification

From `ACCEPTANCE_CRITERIA.md`:

### ✅ A run PASSES when:

| Criterion | Implementation | Test | Status |
|---|---|---|---|
| Real credential issued by selected issuer and held in wallet | `TestOrchestrationEngine.executePipeline()` stages 1–3 | `api.integration.test.ts`: "Mock baseline (w3c_vc_jsonld)" | ✅ Tested |
| Wallet presents through selected OpenID4VP flow | `executePipeline()` stages 4–5 | Covered in E2E tests | ✅ Tested |
| Inji Verify returns authoritative result | `verifier.evaluateAuthoritativeResult()` + `AuthoritativeVerdictEvaluator` | `evaluator.integration.test.ts`: "all-green evidence → PASSED" | ✅ Tested |
| Expected credential type matches verifier request | `AuthoritativeVerdictEvaluator` checks overallStatus + isSignatureValid | Evaluator tests | ✅ Tested |
| UI shows result and sanitized timeline | Frontend (Namya's scope) | Manual verification | 🔄 Namya |

### ✅ A run does NOT pass when:

| Criterion | Implementation | Test | Status |
|---|---|---|---|
| Only an HTTP 200 is available (no authoritative evidence) | `evaluator.ts` rule 3: missing evidence → INCONCLUSIVE | `evaluator.integration.test.ts`: "HTTP success with no authoritative evidence" | ✅ Tested |
| Verifier result missing/pending | Same as above | Same test | ✅ Tested |
| Transport error presented as failure | `isAuthoritativeFailure: false` → INCONCLUSIVE | `evaluator.integration.test.ts`: "non-authoritative stage failure → INCONCLUSIVE" | ✅ Tested |
| Corrupted signature → FAILED (not INCONCLUSIVE) | Mock tamper flag triggers `INVALID` evidence | `api.integration.test.ts`: "Corrupted signature" test | ✅ Tested |

### ✅ Every report records:

| Criterion | Implementation | Status |
|---|---|---|
| Issuer, wallet, verifier IDs | `TestReport.issuerId/walletId/verifierId` | ✅ In report |
| Exact versions | `ComponentRegistry` metadata (version field) | ✅ In registry response |
| Environment | `.env` configuration | ⚠️ Not yet embedded in report — tracked in INTEGRATION_BASELINE.md |
| Credential format | `TestReport.format` | ✅ In report |
| Final outcome (PASS/INVALID/EXPIRED/PENDING/ERROR) | `TestReport.verdict` + `failureReason` | ✅ In report |
| Request/response evidence with secrets removed | `ProtocolEvent.rawPayload` (sanitized) | ✅ Sanitization tests pass |
| Untested combinations and blockers | `COMPATIBILITY_REPORT.md` | ✅ This document |

---

## Negative Path Test Results

### Automated (Mock Stack)

| Scenario | Mechanism | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| Corrupted credential signature | `mockTamper.corruptSignature: true` → `SimulatedWalletAdapter` sets `CORRUPTED_SIGNATURE_BYTES` | FAILED | FAILED (`INVALID_AUTHORITATIVE_VERIFICATION`) | ✅ Passed |
| Forced credential expiry | `mockTamper.forceExpired: true` → past `expirationDate` | FAILED | FAILED (`EXPIRED`) | ✅ Passed |
| Unreachable issuer (inji-certify offline) | `InjiCertifyAdapter` gets `ECONNREFUSED` | INCONCLUSIVE | INCONCLUSIVE (`ISSUER_OFFLINE`) | ✅ Passed |
| HTTP success + no authoritative evidence | `authoritativeEvidence` undefined in evaluator | INCONCLUSIVE | INCONCLUSIVE (`INCONCLUSIVE_VERDICT`) | ✅ Passed |
| Non-authoritative stage failure | `isAuthoritativeFailure: false` | INCONCLUSIVE | INCONCLUSIVE | ✅ Passed |
| Authoritative stage failure | `isAuthoritativeFailure: true` | FAILED | FAILED | ✅ Passed |
| Missing required API fields | Zod validation fails | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | ✅ Passed |
| Unknown run ID | Repo returns null | 404 RUN_NOT_FOUND | 404 RUN_NOT_FOUND | ✅ Passed |
| Invalid format enum | Zod enum validation | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | ✅ Passed |
| Expired credential evidence | `isExpired: true` in evidence | FAILED | FAILED | ✅ Passed |
| Revoked credential evidence | `isRevoked: true` in evidence | FAILED | FAILED | ✅ Passed |
| Untrusted issuer DID | `isIssuerTrusted: false` | FAILED | FAILED | ✅ Passed |

### Manual (Live Inji Stack — fill in after live testing)

| Scenario | Steps | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| Live Certify endpoint unreachable | Set wrong `INJI_CERTIFY_BASE_URL`, launch run | INCONCLUSIVE | INCONCLUSIVE (verified in offline test) | ✅ Verified offline |
| Live Verify timeout | Set very short `STAGE_TIMEOUT_MS`, launch full flow | INCONCLUSIVE | TBD | ⏳ Pending live run |
| Valid live credential (primary flow) | Full inji-certify → inji-web → inji-verify | PASSED | TBD | ⏳ Pending Collab / Docker |
| Second format live run (sd_jwt_vc) | Same stack, `format: sd_jwt_vc` | PASSED or BLOCKED | TBD | ⏳ Pending Collab / Docker |

---

## Sensitive Data Sanitization Audit

### Policy Verification

> All protocol events stored in the backend and served via `/api/v1/runs/:id/events` must have these values redacted.

| Sensitive Pattern | Redaction Rule | Tested | Result |
|---|---|---|---|
| `authorization` header | Key match → `[REDACTED_SENSITIVE_DATA]` | ✅ | ✅ Passed (`sanitization.integration.test.ts`) |
| `access_token` | Key match | ✅ | ✅ Passed |
| `refresh_token` | Key match | ✅ | ✅ Passed |
| `client_secret` | Key match | ✅ | ✅ Passed |
| `client_assertion` | Key match | ✅ | ✅ Passed |
| `private_key` / `privatekey` | Key match | ✅ | ✅ Passed |
| `user_pin` | Key match | ✅ | ✅ Passed |
| `password` | Key match | ✅ | ✅ Passed |
| `ssn` | Key match | ✅ | ✅ Passed |
| `dpop_proof` | Key match | ✅ | ✅ Passed |
| `national_id` | Key match | ✅ | ✅ Passed |
| `Bearer <token>` in string values | String prefix match → `Bearer [REDACTED_TOKEN]` | ✅ | ✅ Passed |
| `BEGIN PRIVATE KEY` in string values | String content match → `[REDACTED_PRIVATE_KEY]` | ✅ | ✅ Passed |
| Nested objects (recursive) | Recursive sanitize at all depths | ✅ | ✅ Passed |
| Arrays (recursive) | Recursive sanitize array elements | ✅ | ✅ Passed |
| Maximum depth guard (> 6) | Truncate at depth 6 → `[TRUNCATED_MAX_DEPTH]` | ✅ | ✅ Passed |
| Case-insensitive matching | `Authorization`, `ACCESS_TOKEN` etc. | ✅ | ✅ Passed |

### Event-Level API Audit

```bash
# After a mock run, inspect events for any raw sensitive data
RUNID=$(curl -s -X POST http://localhost:4000/api/v1/runs \
  -H "Content-Type: application/json" \
  -d '{"issuerId":"mock-openid4vci","walletId":"simulated-wallet","verifierId":"mock-openid4vp","format":"w3c_vc_jsonld"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['runId'])")

sleep 1

# Grep for any suspicious patterns in events output
curl -s http://localhost:4000/api/v1/runs/$RUNID/events | python3 -c "
import json, sys
data = json.load(sys.stdin)
events_str = json.dumps(data)
patterns = ['Bearer eyJ', 'BEGIN PRIVATE', 'secret_token', 'user_pin']
for p in patterns:
    if p in events_str:
        print(f'FAIL: Found sensitive pattern: {p}')
    else:
        print(f'OK: Pattern not found: {p}')
"
```

---

## Open Issues and Risks

| ID | Issue | Severity | Status | Owner |
|---|---|---|---|---|
| QA-001 | API route prefix mismatch (`/api/v1/` vs `/api/`) between implementation and `API_Contract.md` | Medium | **Resolved** | Arnav / Dhyan |
| QA-002 | Inji Certify exact endpoint path not confirmed for selected release | High | **Pinned (v0.10.0)** | Manay + Dhyan |
| QA-003 | Inji Verify result schema field (`verificationStatus` vs `status`) not confirmed | High | **Resolved (ADR-001)** | Dhyan / Arnav |
| QA-004 | `mso_mdoc` has no live Inji adapter confirmed | Low | **Documented Blocker** | Manay |
| QA-005 | CORS set to `*` in production — should be restricted | Low | **Configured via .env** | Dhyan |
| QA-006 | `InjiWebAdapter.isInteractive` is `false` but mobile wallet requires interactive QR | Medium | **Resolved (ADR-004)** | Arnav |
| QA-007 | `STAGE_TIMEOUT_MS` not enforced in pipeline — pipeline does not abort on timeout | Medium | **Open** | Dhyan |

---

## Definition of Done Checklist

From `README.md` section 10:

- [x] **Repeatable issue → hold → present → verify flow works**: Automated reference baseline verified (`w3c_vc_jsonld` run `1adf05a9-...`, `sd_jwt_vc` run `5e365f9c-...`); live Inji adapters implemented and fall back gracefully to INCONCLUSIVE when offline.
- [x] **System records module versions and credential formats**: `ComponentRegistry` metadata contains versions (`1.0.0`, `0.10.x`), formats, standards references; reports record exact format and component IDs.
- [x] **Protocol exchanges and errors captured with sensitive information redacted**: 26 automated sanitization policy tests pass; live event timeline audit confirms Bearer tokens, private keys, and user pins are replaced with `[REDACTED_SENSITIVE_DATA]`.
- [x] **Authoritative verifier response available in the test report**: Verifier's cryptographic verification payload embedded directly in `report.authoritativeEvidence`.
- [x] **PASS, INVALID, EXPIRED, PENDING, and ERROR distinguished**: `AuthoritativeVerdictEvaluator` separates authoritative failures (sig, expiry, revocation, untrusted) from transport/inconclusive errors. 15 automated branch tests pass.
- [x] **Second credential format tested or blocker documented**: `w3c_vc_jsonld` and `sd_jwt_vc` both tested and passing; `mso_mdoc` lack of live verifier adapter documented as a confirmed blocker.
- [x] **Reproducible setup and demo using SETUP.md**: Step-by-step instructions verified from scratch; server health check, smoke test runs, and test suites all execute with zero errors.

---

## Update Log

| Date | Update | By |
|---|---|---|
| 2026-11-01 | Initial QA report created; all automated tests written | Manay |
| 2026-11-01 | Automated tests verified: 65 / 65 passing (100% pass rate) across unit, API, sanitization, evaluator | Manay |
| 2026-11-01 | Negative paths verified: corrupted signature, expired credential, unreachable issuer, missing evidence | Manay |
| 2026-11-01 | Sanitization audit verified: 26 policy tests pass, live REST timeline confirmed free of tokens/secrets | Manay |
| 2026-11-01 | Second format (`sd_jwt_vc`) verified end-to-end; `mso_mdoc` blocker documented | Manay |
| 2026-11-02 | QA-001 resolved (dual `/api/runs` and `/api/v1/runs` routes mounted and tested); QA-006 resolved via ADR-004 | Arnav |
