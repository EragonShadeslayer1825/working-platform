# Inji Interoperability Compatibility Report

> **Lead Architect & QA Lead**: Arnav  
> **Status**: Living document — updated with complete test run evidence  
> **Date**: 2026-11-02  

---

## 1. How to Read This Report

- **SUPPORTED** — Confirmed by an automated end-to-end test run with recorded run ID and authoritative `PASSED` verdict.
- **PENDING_INTEGRATION / NOT VERIFIED** — Implemented according to official Inji specifications; real cluster verification pending deployment of MOSIP identity provider (eSignet/Keycloak).
- **UNSUPPORTED** — Confirmed incompatible by component specification or verifier rejection.
- **EXPERIMENTAL** — Requires interactive user action (QR scan / deep link). Cannot be automated zero-touch.

---

## 2. Inji Component API Compatibility Analysis (v0.10.0)

| Component | Target Version | Expected Official API | Implemented API in Adapter | Compatible? | Evidence / Notes |
|---|---|---|---|---|---|
| **Inji Certify** (Issuer) | `0.10.0` (OpenID4VCI Draft 13) | `POST /issuance/credential-offer`<br>`POST /oauth/token`<br>`POST /issuance/credential` | `POST /issuance/credential-offer`<br>`POST /oauth/token`<br>`POST /issuance/credential` | **PENDING_INTEGRATION** (NOT VERIFIED on live cluster) | Adapter implements complete OID4VCI protocol with DPoP and pre-authorized code. When external service is offline, reports `INCONCLUSIVE` (ECONNREFUSED) without crash. |
| **Inji Web / Mimoto** (Wallet) | `0.10.0` (BFF) | `POST /wallet/credentials/download`<br>`POST /wallet/presentation/submit` | `POST /wallet/credentials/download`<br>`POST /wallet/presentation/submit` | **PENDING_INTEGRATION** (NOT VERIFIED on live cluster) | Requires active user session in Mimoto. Headless automated tests utilize `SimulatedWalletAdapter` with exact credential preservation. |
| **Inji Verify** (Verifier) | `0.10.0` (OpenID4VP Draft 21) | `POST /v1/presentation-request`<br>`POST /v1/verify` or callback redirect | `POST /v1/presentation-request`<br>`POST /v1/verify` & `POST /api/v1/callbacks/verifier/:runId` | **PENDING_INTEGRATION** (NOT VERIFIED on live cluster) | Adapter maps official Inji Verify response schema (`verificationStatus`, `isSignatureValid`, `isExpired`, `isRevoked`, `isIssuerTrusted`). Missing or unparseable statuses map strictly to `INCONCLUSIVE`. |
| **Inji Wallet Mobile** | `0.10.0` (React Native) | Deep link / QR Code scan | QR/Deep-link URI generation & interactive pause | **EXPERIMENTAL** (Interactive Only) | Requires manual scan on physical mobile device. Orchestrator provides QR/deep-link payloads and awaits manual callback. |
| **Mock OpenID4VCI** | `1.0.0` (Reference Issuer) | OpenID4VCI Draft 13 compliant mock | Full simulated issuer with W3C VC JSON-LD and SD-JWT | **SUPPORTED** | Automated baseline passes in 50ms. |
| **Simulated Wallet** | `1.0.0` (Automated Holder) | Exact credential store & presentation | Stores exact issued credential, constructs VP | **SUPPORTED** | Tested in `tests/wallet-data-flow.test.ts` (exact ID & claims preserved). |
| **Mock OpenID4VP** | `1.0.0` (Reference Verifier) | OpenID4VP Draft 21 compliant mock | Evaluates signatures, revocation, expiration, trust | **SUPPORTED** | Tested in orchestrator test suites. |

---

## 3. Credential Format Compatibility Matrix

### 3.1 Credential Format: `w3c_vc_jsonld` (W3C VC 1.1 JSON-LD)

| Issuer | Wallet | Verifier | Status | Evidence / Run ID | Verdict | Notes |
|---|---|---|---|---|---|---|
| Mock VCI | Simulated Wallet | Mock VP | ✅ **SUPPORTED** | `eff0585b-4d3c-43fd-8363-39c3b7477dac` | **PASSED** | Automated baseline — 7/7 stages COMPLETED, 192ms duration |
| Inji Certify | Inji Web | Inji Verify | 🔄 **PENDING_INTEGRATION** | Offline test yields `INCONCLUSIVE` | — | Primary live target. Adapter implements official v0.10.0 contracts. |
| Inji Certify | Simulated Wallet | Inji Verify | 🔄 **PENDING_INTEGRATION** | Offline test yields `INCONCLUSIVE` | — | Useful for isolating verifier connectivity |
| Inji Certify | Inji Wallet Mobile | Inji Verify | ⚠️ **EXPERIMENTAL** | Interactive pause | — | Requires manual QR scan on mobile device |

### 3.2 Credential Format: `sd_jwt_vc` (IETF SD-JWT VC)

| Issuer | Wallet | Verifier | Status | Evidence / Run ID | Verdict | Notes |
|---|---|---|---|---|---|---|
| Mock VCI | Simulated Wallet | Mock VP | ✅ **SUPPORTED** | `9c8163a4-6c7d-45b7-9cc2-c8d2cd7809f6` | **PASSED** | Automated baseline — 7/7 stages COMPLETED, 261ms duration |
| Inji Certify | Inji Web | Inji Verify | 🔄 **PENDING_INTEGRATION** | Offline test yields `INCONCLUSIVE` | — | Secondary target |

### 3.3 Credential Format: `mso_mdoc` (ISO/IEC 18013-5 mDL)

| Issuer | Wallet | Verifier | Status | Evidence / Notes |
|---|---|---|---|---|
| Inji Certify | Inji Web | Inji Verify | ❌ **UNSUPPORTED** | Inji Verify v0.10.0 does not list `mso_mdoc` in supported verification profiles. Confirmed blocker. |

---

## 4. Negative Path and Boundary Verification Results

All negative paths have been validated by automated integration tests:

| Test Scenario | Expected Outcome | Observed Outcome | Evidence File | Status |
|---|---|---|---|---|
| Corrupted signature evidence | `FAILED` verdict | `FAILED` (`Invalid cryptographic signature`) | `tests/integration/api.integration.test.ts` | ✅ **PASS** |
| Expired credential evidence | `FAILED` verdict | `FAILED` (`Credential has expired`) | `tests/integration/api.integration.test.ts` | ✅ **PASS** |
| Untrusted issuer with `overallStatus: VALID` | `FAILED` verdict | `FAILED` (`Issuer is not trusted by verifier`) | `tests/integration/evaluator.integration.test.ts` | ✅ **PASS** |
| Revoked credential evidence | `FAILED` verdict | `FAILED` (`Credential revocation check failed`) | `tests/integration/evaluator.integration.test.ts` | ✅ **PASS** |
| Unparseable verifier response | `INCONCLUSIVE` verdict | `INCONCLUSIVE` (`Verifier response was unparseable`) | `tests/integration/evaluator.integration.test.ts` | ✅ **PASS** |
| Missing verifier authoritative payload | `INCONCLUSIVE` verdict | `INCONCLUSIVE` (`Missing verifier authoritative payload`) | `tests/integration/evaluator.integration.test.ts` | ✅ **PASS** |
| Service offline (Inji Certify unreachable) | `INCONCLUSIVE` verdict | `INCONCLUSIVE` (Network infrastructure timeout) | `tests/integration/api.integration.test.ts` | ✅ **PASS** |
| Duplicate / Replay Callback | HTTP 409 Conflict | HTTP 409 (`DUPLICATE_CALLBACK`) | `tests/integration/callbacks.integration.test.ts` | ✅ **PASS** |
| Callback correlation mismatch | HTTP 400 Bad Request | HTTP 400 (`CORRELATION_MISMATCH`) | `tests/integration/callbacks.integration.test.ts` | ✅ **PASS** |
| Malformed callback payload | HTTP 400 Bad Request | HTTP 400 (`INVALID_PAYLOAD`) | `tests/integration/callbacks.integration.test.ts` | ✅ **PASS** |
| Missing run ID on callback | HTTP 404 Not Found | HTTP 404 (`RUN_NOT_FOUND`) | `tests/integration/callbacks.integration.test.ts` | ✅ **PASS** |
| Exact credential preservation in wallet | Stored == Presented | Exact matching credential ID and payload | `tests/wallet-data-flow.test.ts` | ✅ **PASS** |
| Token / PII sanitization | Sensitive data redacted | Tokens, keys, DOB, addresses, names redacted | `tests/integration/sanitization.integration.test.ts` | ✅ **PASS** |

---

## 5. Summary of Automated Test Execution

- **Total Automated Tests**: 83
- **Passed**: 83 (100%)
- **Failed**: 0
- **Duration**: ~2.5 seconds
