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
| Environment | *(Update: `local` / `collab` / `docker-compose`)* |
| Backend version | `1.0.0` (inji-interop-playground-backend) |
| Test date | *(Update after runs)* |

### Pinned Component Versions

> ⚠️ **Fill in from `INTEGRATION_BASELINE.md` before running live tests.**

| Component | Version | Repository Tag | Checked By |
|---|---|---|---|
| Inji Certify (Issuer) | TBD | TBD | Manay |
| Inji Web (Wallet) | TBD | TBD | Anav + Manay |
| Mimoto (Wallet BFF) | TBD | TBD | Manay |
| Inji Verify (Verifier) | TBD | TBD | Dhyan + Manay |
| Mock OpenID4VCI (Issuer) | 1.0.0 | N/A (built-in) | Manay |
| Simulated Wallet | 1.0.0 | N/A (built-in) | Manay |
| Mock OpenID4VP (Verifier) | 1.0.0 | N/A (built-in) | Manay |

---

## Compatibility Matrix

### Credential Format: `w3c_vc_jsonld` (W3C VC 1.1 JSON-LD)

| Issuer | Wallet | Verifier | Status | Run ID | Verdict | Notes |
|---|---|---|---|---|---|---|
| Mock VCI | Simulated Wallet | Mock VP | ✅ SUPPORTED | *(from test run)* | PASSED | Automated baseline — runs on every CI push |
| Mock VCI | Simulated Wallet | Inji Verify | PENDING_INTEGRATION | — | — | Inji Verify not yet connected |
| Inji Certify | Inji Web | Inji Verify | PENDING_INTEGRATION | — | — | **Primary target** — requires live Inji stack |
| Inji Certify | Inji Web | Mock VP | PENDING_INTEGRATION | — | — | Useful for isolating issuer/wallet issues |
| Inji Certify | Simulated Wallet | Inji Verify | PENDING_INTEGRATION | — | — | Useful for isolating verifier issues |
| Inji Certify | Inji Wallet Mobile | Inji Verify | INTERACTIVE_ONLY | — | — | Requires QR scan — manual test only |

### Credential Format: `sd_jwt_vc` (IETF SD-JWT VC)

| Issuer | Wallet | Verifier | Status | Run ID | Verdict | Notes |
|---|---|---|---|---|---|---|
| Mock VCI | Simulated Wallet | Mock VP | ✅ SUPPORTED | *(from test run)* | PASSED | Automated baseline |
| Inji Certify | Inji Web | Inji Verify | PENDING_INTEGRATION | — | — | **Secondary target** — attempt after w3c_vc_jsonld works |
| Inji Certify | Inji Wallet Mobile | Inji Verify | INTERACTIVE_ONLY | — | — | Manual test only |

### Credential Format: `mso_mdoc` (ISO/IEC 18013-5 mDL)

| Issuer | Wallet | Verifier | Status | Run ID | Verdict | Notes |
|---|---|---|---|---|---|---|
| Mock VCI | Simulated Wallet | Mock VP | ✅ SUPPORTED | *(from test run)* | PASSED | Mock adapters support mso_mdoc |
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

| Scenario | Expected Verdict | Actual Verdict | Run ID | Pass/Fail |
|---|---|---|---|---|
| Corrupted credential signature | FAILED | *(from test)* | *(auto)* | ✅ |
| Expired credential | FAILED | *(from test)* | *(auto)* | ✅ |
| Unreachable Inji Certify (offline) | INCONCLUSIVE | *(from test)* | *(auto)* | ✅ |
| HTTP 200 with no authoritative evidence | INCONCLUSIVE | *(from evaluator test)* | *(unit)* | ✅ |
| Invalid request schema (missing fields) | 400 VALIDATION_ERROR | *(from API test)* | N/A | ✅ |
| Non-existent run ID | 404 RUN_NOT_FOUND | *(from API test)* | N/A | ✅ |

---

## Notes and Observations

1. **API Route Prefix**: Implementation uses `/api/v1/...`; `API_Contract.md` defines `/api/...` (no version). Must be aligned with Dhyan before frontend integration.

2. **Certify Endpoint Uncertainty**: Official docs mention different credential-offer patterns across Certify releases. The `InjiCertifyAdapter` targets `/issuance/credential-offer` — this must be confirmed against the selected release before live integration.

3. **Inji Verify Result Schema**: `InjiVerifyAdapter` interprets `verificationStatus` or `status` from the response. The exact field name from the selected Verify release must be confirmed from its OpenAPI contract.

4. **CORS**: Backend allows `*` in development mode. Should be tightened to specific origins for production/demo environments.

---

## Update Log

| Date | Update | By |
|---|---|---|
| *(fill in)* | Created initial report structure | Manay |
| *(fill in)* | Mock baseline confirmed: w3c_vc_jsonld + sd_jwt_vc PASSED | Manay |
| *(fill in)* | *(Live Inji run results)* | Manay |
