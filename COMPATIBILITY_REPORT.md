# Inji Interoperability Compatibility Report

> **Owner**: Manay  
> **Project**: MOSIP Decode Hackathon — Problem 02: Inji Interoperability Playground  
> **Status**: Living document — updated with each confirmed run

---

## How to Read This Report

- **SUPPORTED** — Confirmed by an actual end-to-end test run with recorded run ID and authoritative PASSED verdict.
- **PENDING_INTEGRATION** — Theoretically supported by all component capabilities; real run not yet executed.
- **UNSUPPORTED** — Confirmed incompatible. Evidence attached below.
- **BLOCKED** — Integration could not be completed. Root cause and evidence documented.
- **INTERACTIVE_ONLY** — Component requires manual user action (QR scan / deep link). Cannot be automated.

---

## Environment Used

| Field | Value |
|---|---|
| Tested by | Manay |
| Environment | `local` (Express 4.21 + Node 24 + tsx test runner) |
| Backend version | `1.0.0` (inji-interop-playground-backend) |
| Test date | `2026-11-01` |

### Pinned Component Versions

| Component | Version | Repository Tag | Checked By | Status |
|---|---|---|---|---|
| Inji Certify (Issuer) | 0.10.0 | `mosipid/inji-certify:0.10.0` | Arnav + Manay | ✅ Pinned (ADR-006) |
| Inji Web (Wallet) | 0.10.0 | `mosipid/inji-web:0.10.0` | Arnav + Manay | ✅ Pinned (ADR-006) |
| Mimoto (Wallet BFF) | 0.10.0 | `mosipid/mimoto:0.10.0` | Arnav + Manay | ✅ Pinned (ADR-006) |
| Inji Verify (Verifier) | 0.10.0 | `mosipid/inji-verify:0.10.0` | Arnav + Dhyan | ✅ Pinned (ADR-006) |
| Mock OpenID4VCI (Issuer) | 1.0.0 | N/A (built-in) | Manay | ✅ Verified & automated |
| Simulated Wallet | 1.0.0 | N/A (built-in) | Manay | ✅ Verified & automated |
| Mock OpenID4VP (Verifier) | 1.0.0 | N/A (built-in) | Manay | ✅ Verified & automated |

---

## Compatibility Matrix

### Credential Format: `w3c_vc_jsonld` (W3C VC 1.1 JSON-LD)

| Issuer | Wallet | Verifier | Status | Run ID | Verdict | Notes |
|---|---|---|---|---|---|---|
| Mock VCI | Simulated Wallet | Mock VP | ✅ SUPPORTED | `1adf05a9-df38-4fdc-89b7-9eadeaaa113f` | PASSED | Automated baseline — 7/7 stages COMPLETED, 56ms duration |
| Mock VCI | Simulated Wallet | Inji Verify | PENDING_INTEGRATION | — | — | Inji Verify not yet connected |
| Inji Certify | Inji Web | Inji Verify | PENDING_INTEGRATION | — | — | **Primary target** — requires live Inji stack |
| Inji Certify | Inji Web | Mock VP | PENDING_INTEGRATION | — | — | Useful for isolating issuer/wallet issues |
| Inji Certify | Simulated Wallet | Inji Verify | PENDING_INTEGRATION | — | — | Useful for isolating verifier issues |
| Inji Certify | Inji Wallet Mobile | Inji Verify | INTERACTIVE_ONLY | — | — | Requires QR scan — manual test only |

### Credential Format: `sd_jwt_vc` (IETF SD-JWT VC)

| Issuer | Wallet | Verifier | Status | Run ID | Verdict | Notes |
|---|---|---|---|---|---|---|
| Mock VCI | Simulated Wallet | Mock VP | ✅ SUPPORTED | `5e365f9c-c31a-4e78-9b9b-d68e57b7f6fd` | PASSED | Automated baseline — 7/7 stages COMPLETED, 51ms duration |
| Inji Certify | Inji Web | Inji Verify | PENDING_INTEGRATION | — | — | **Secondary target** — attempt after w3c_vc_jsonld works |
| Inji Certify | Inji Wallet Mobile | Inji Verify | INTERACTIVE_ONLY | — | — | Manual test only |

### Credential Format: `mso_mdoc` (ISO/IEC 18013-5 mDL)

| Issuer | Wallet | Verifier | Status | Run ID | Verdict | Notes |
|---|---|---|---|---|---|---|
| Mock VCI | Simulated Wallet | Mock VP | ✅ SUPPORTED | Automated (test suite) | PASSED | Mock adapters support mso_mdoc schema |
| Inji Certify | Inji Web | Inji Verify | UNSUPPORTED | — | — | Inji Verify does not list mso_mdoc in supported formats |
| Inji Certify | Inji Wallet Mobile | Inji Verify | PENDING_INTEGRATION | — | — | Mobile may support via PixelPass-QR — unconfirmed |

---

## Confirmed Compatibility Blockers

| # | Combination | Blocker | Evidence | Severity |
|---|---|---|---|---|
| 1 | Any / Any / Any (`mso_mdoc`) | `InjiVerifyAdapter` only returns `VALID`/`INVALID` for known formats — mso_mdoc not in Inji Verify supported list | Registry matrix shows `UNSUPPORTED` | Medium |
| 2 | Any / Inji Wallet Mobile / Any | Mobile wallet requires interactive QR scan — cannot be automated by the orchestrator | `isInteractive` property not implemented in engine pause/resume | Low (documented) |
| 3 | *(TBD after live run)* | *(Record blocker here after attempting real Inji stack)* | *(Attach run ID or error log)* | TBD |

---

## Format Coverage Summary

| Format | Mock Stack | Real Stack (Inji) | Status |
|---|---|---|---|
| W3C VC 1.1 JSON-LD (`w3c_vc_jsonld`) | ✅ Automated tests pass | 🔄 Pending live run | **Primary target** |
| IETF SD-JWT VC (`sd_jwt_vc`) | ✅ Automated tests pass | 🔄 Pending live run | **Secondary target** |
| ISO/IEC mDL (`mso_mdoc`) | ✅ Mock passes | ❌ No live Inji adapter | **Blocker documented** |

> **Acceptance criterion**: At least one complete live flow for `w3c_vc_jsonld`. Second format (`sd_jwt_vc`) tested or blocker documented.

---

## Protocol Coverage

| Protocol | Status | Evidence |
|---|---|---|
| OpenID4VCI Draft 13 (Issuance) | ✅ Implemented (mock + real adapter) | `InjiCertifyAdapter.initiateIssuance()` |
| OpenID4VP Draft 21 (Presentation) | ✅ Implemented (mock + real adapter) | `InjiVerifyAdapter.createPresentationRequest()` |
| Pre-authorized Code Flow | ✅ Mock confirmed | `SimulatedWalletAdapter.acceptOffer()` |
| Authorization Code Flow | ⚠️ Not implemented | Would require user authentication step |

---

## Negative Path Results

> Evidence of correctly handled failure cases (distinct from interoperability failures).

| Scenario | Expected Verdict | Actual Verdict | Evidence / Error | Pass/Fail |
|---|---|---|---|---|
| Corrupted credential signature | FAILED | FAILED | `INVALID_AUTHORITATIVE_VERIFICATION`: Verifier rejected signature | ✅ Passed |
| Expired credential | FAILED | FAILED | `EXPIRED`: Verifier confirmed credential expirationDate is past | ✅ Passed |
| Unreachable Inji Certify (offline) | INCONCLUSIVE | INCONCLUSIVE | `ISSUER_OFFLINE`: `fetch failed` ECONNREFUSED | ✅ Passed |
| HTTP 200 with no authoritative evidence | INCONCLUSIVE | INCONCLUSIVE | `INCONCLUSIVE_VERDICT`: Missing verifier authoritative payload | ✅ Passed |
| Invalid request schema (missing fields) | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | Zod: `walletId: Required`, `verifierId: Required` | ✅ Passed |
| Non-existent run ID | 404 RUN_NOT_FOUND | 404 RUN_NOT_FOUND | Error: `Run run-does-not-exist-xyz not found` | ✅ Passed |
| Invalid format enum | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | Zod: `Invalid enum value` | ✅ Passed |

---

## Notes and Observations

1. **API Route Harmonization (QA-001 — RESOLVED)**: The backend orchestrator implements dual-route mounting: `/api/runs` serves the Next.js UI contract defined in `API_Contract.md`, while `/api/v1/runs` serves internal microservice test suites. Both work concurrently without conflict.

2. **Certify Endpoint Uncertainty**: Official docs mention different credential-offer patterns across Certify releases. In release 0.10.0, the `InjiCertifyAdapter` targets `/certify/issuance/credential-offer` (or mock-openid4vci).

3. **Inji Verify Result Schema**: `InjiVerifyAdapter` evaluates `/v1/verify` for cryptographic status (`VALID`, `isSignatureValid`, `isExpired`, `isRevoked`).

4. **CORS**: Backend allows `*` in development mode. Configured via `CORS_ORIGIN` in `.env` for production.

---

## Update Log

| Date | Update | By |
|---|---|---|
| 2026-11-01 | Created initial report structure | Manay |
| 2026-11-01 | Mock baseline confirmed: `w3c_vc_jsonld` (run `1adf05a9-...`) and `sd_jwt_vc` (run `5e365f9c-...`) PASSED | Manay |
| 2026-11-01 | Negative paths verified: corrupted signature, expired, unreachable service, missing evidence | Manay |
| 2026-11-01 | Live Inji Certify offline fallback confirmed: yields INCONCLUSIVE verdict with network error | Manay |
| 2026-11-02 | QA-001 resolved via `/api/runs` dual routing; component versions pinned to 0.10.0; ADRs signed off | Arnav |
