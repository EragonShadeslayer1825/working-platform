# Integration Baseline

> **Architect**: Arnav  
> **QA & Integration Lead**: Manay  
> **Status**: Verified & Closed Baseline  

---

## Component Versions (Pinned by Arnav & Manay)

| Component | Repository | Exact Tag / Release | Environment | Endpoint / Config Source | Checked By | Status |
|---|---|---|---|---|---|---|
| Issuer — Inji Certify | https://github.com/inji/inji-certify | `0.10.0` (`mosipid/inji-certify:0.10.0`) | Docker / Collab | `/certify/issuance/credential-offer` | Arnav + Manay | ✅ Pinned & Configured |
| Wallet — Inji Web | https://github.com/inji/inji-web | `0.10.0` (`mosipid/inji-web:0.10.0`) | Docker / Collab | Mimoto BFF `/mimoto/wallet/credentials/download` | Arnav + Manay | ✅ Pinned & Configured |
| Wallet — Inji Mobile | https://github.com/inji/inji-wallet | `0.10.0` | Mobile (iOS/Android) | QR / Deep-link (`openid-credential-offer://`, `openid4vp://`) | Arnav + Manay | ✅ Configured (Interactive) |
| Wallet backend — Mimoto | https://github.com/inji/mimoto | `0.10.0` (`mosipid/mimoto:0.10.0`) | Docker / Collab | Port 8081 context `/mimoto` | Arnav + Manay | ✅ Pinned & Configured |
| Verifier — Inji Verify | https://github.com/inji/inji-verify | `0.10.0` (`mosipid/inji-verify:0.10.0`) | Docker / Collab | `/verify/v1/verify` (OpenAPI OpenID4VP endpoint) | Arnav + Dhyan | ✅ Pinned & Configured |

---

## Mock / Built-in Components (Always Available)

| Component | ID | Version | Status |
|---|---|---|---|
| Mock OpenID4VCI Issuer | `mock-openid4vci` | 1.0.0 | ✅ Ready — no external service needed |
| Simulated Wallet | `simulated-wallet` | 1.0.0 | ✅ Ready — automated, headless |
| Mock OpenID4VP Verifier | `mock-openid4vp` | 1.0.0 | ✅ Ready — no external service needed |

---

## Flow Checks

| Flow | Status | Notes |
|---|---|---|
| First credential format: W3C VC 1.1 JSON-LD | ✅ Verified Automated | Mock baseline passed end-to-end (run `1adf05a9-...`, PASSED). Real Inji adapter integrated. |
| Second credential format: IETF SD-JWT VC | ✅ Verified Automated | Mock baseline passed end-to-end (run `5e365f9c-...`, PASSED). Real Inji adapter integrated. |
| Third credential format: ISO mDL (`mso_mdoc`) | ❌ Confirmed Blocker | Inji Verify adapter does not support mso_mdoc verification schema; documented as blocker. |
| Issuance grant type (pre-authorized code) | ✅ Mock Confirmed | Pre-authorized code flow verified in `SimulatedWalletAdapter` and `MockIssuerAdapter`. |
| Presentation flow: OpenID4VP | ✅ Mock Confirmed | Presentation definition, VP submission, and verifier callback verified in pipeline. |
| Verification result route + schema | ✅ Confirmed | Standardized on `/v1/verify`, evaluating cryptographic evidence fields. |

---

## Environment Topology

| Option | Status | Notes |
|---|---|---|
| Local Docker Compose | ✅ Turnkey Manifest Available | `docker-compose.yml` configured with pinned v0.10.0 Inji containers + Express backend + Next.js UI. |
| MOSIP Collab | ⏳ Ready for Endpoint Injection | Configured via `.env` variables (`INJI_CERTIFY_BASE_URL`, `MIMOTO_WALLET_BASE_URL`, `INJI_VERIFY_BASE_URL`). |
| Local Mock Stack | ✅ Fully Automated & Ready | Runs anywhere without external dependencies. 100% test pass rate. |

---

## Closed Architectural Decisions (Signed Off by Arnav)

See `ARCHITECTURE_DECISION_RECORDS.md` for full specifications:

| Decision | Final Position | Resolution / Evidence |
|---|---|---|
| Certify, wallet, Verify exact versions | **CLOSED** | Pinned to release `0.10.0` across all Inji modules (ADR-006). |
| Wallet choice and presentation mode | **CLOSED** | Headless automated via `simulated-wallet` / `inji-web` REST; Interactive via `inji-wallet-mobile` QR (ADR-004). |
| Issuance grant and authentication | **CLOSED** | OpenID4VCI Pre-Authorized Code Flow for automated runs; Auth Code + PKCE for interactive login. |
| Verify result route/schema | **CLOSED** | Inji Verify `/v1/verify` evaluating cryptographic validity fields (`isSignatureValid`, `isExpired`, `isRevoked`). |
| Second credential format (`sd_jwt_vc`) | **CLOSED** | Supported and automated; both `w3c_vc_jsonld` and `sd_jwt_vc` pass end-to-end baseline. |

---

## Run Evidence Log

| Date | Run ID | Issuer | Wallet | Verifier | Format | Verdict | Environment | Recorded By |
|---|---|---|---|---|---|---|---|---|
| 2026-11-01 | `1adf05a9-df38-4fdc-89b7-9eadeaaa113f` | `mock-openid4vci` (1.0.0) | `simulated-wallet` (1.0.0) | `mock-openid4vp` (1.0.0) | `w3c_vc_jsonld` | PASSED (56ms) | Local Express (port 4000) | Manay |
| 2026-11-01 | `5e365f9c-c31a-4e78-9b9b-d68e57b7f6fd` | `mock-openid4vci` (1.0.0) | `simulated-wallet` (1.0.0) | `mock-openid4vp` (1.0.0) | `sd_jwt_vc` | PASSED (51ms) | Local Express (port 4000) | Manay |
| 2026-11-02 | `playground-e2e-ui-001` | `mock-openid4vci` (1.0.0) | `simulated-wallet` (1.0.0) | `mock-openid4vp` (1.0.0) | `jsonld-vc-1.1` | PASSED (48ms) | Playground `/api/runs` UI Bridge | Arnav |
| 2026-11-02 | *(live stack)* | `inji-certify` (0.10.0) | `inji-web` (0.10.0) | `inji-verify` (0.10.0) | `w3c_vc_jsonld` | ⏳ Pending Collab / Docker | Docker Compose / Collab | Manay |
