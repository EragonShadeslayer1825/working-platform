# Integration Baseline

Fill in a row only after checking the selected release's official docs/config and, where possible, a real run. **Never commit secrets or credentials.**

## Component Versions

| Component | Repository | Exact tag/commit | Environment | Endpoint/config source | Checked by | Status |
|---|---|---|---|---|---|---|
| Issuer — Inji Certify | https://github.com/inji/inji-certify | TBD | TBD | `/issuance/credential-offer` (confirm from release OpenAPI) | Manay | ⏳ Not checked |
| Wallet — Inji Web | https://github.com/inji/inji-web | TBD | TBD | Mimoto BFF `/wallet/credentials/download` | Anav + Manay | ⏳ First target: Inji Web via MOSIP Collab or local Compose |
| Wallet — Inji Mobile | https://github.com/inji/inji-wallet | TBD | TBD | QR / deep-link (interactive only) | Anav + Manay | ⏳ Fallback if Inji Web issuance flow is blocked |
| Wallet backend — Mimoto | https://github.com/inji/mimoto | TBD | TBD | TBD | Manay | ⏳ Not checked |
| Verifier — Inji Verify | https://github.com/inji/inji-verify | TBD | TBD | `/v1/verify` (confirm from release OpenAPI) | Dhyan + Manay | ⏳ Not checked |

## Mock / Built-in Components (Always Available)

| Component | ID | Version | Status |
|---|---|---|---|
| Mock OpenID4VCI Issuer | `mock-openid4vci` | 1.0.0 | ✅ Ready — no external service needed |
| Simulated Wallet | `simulated-wallet` | 1.0.0 | ✅ Ready — automated, headless |
| Mock OpenID4VP Verifier | `mock-openid4vp` | 1.0.0 | ✅ Ready — no external service needed |

## Flow Checks

| Flow | Status | Notes |
|---|---|---|
| First credential format: W3C VC 1.1 JSON-LD | ✅ Verified Automated | Mock baseline passed end-to-end (run `1adf05a9-...`, PASSED). Live Inji run pending endpoints. |
| Second credential format: IETF SD-JWT VC | ✅ Verified Automated | Mock baseline passed end-to-end (run `5e365f9c-...`, PASSED). |
| Issuance grant type (pre-authorized code) | ✅ Mock Confirmed | Pre-authorized code flow verified in `SimulatedWalletAdapter` and `MockIssuerAdapter`. |
| Presentation flow: OpenID4VP | ✅ Mock Confirmed | Presentation definition, VP submission, and verifier callback verified in pipeline. |
| Verification result route + schema | ⏳ TBD for Live | InjiVerifyAdapter reads `verificationStatus` — confirm exact field name from live Verify OpenAPI. |

## Environment Decision

| Option | Status | Notes |
|---|---|---|
| MOSIP Collab | ⏳ Check access with Anav | Fastest path to proof-of-life for live Inji services. |
| Local Docker Compose | ⏳ Compose file TBD | Reproducible deliverable once exact container tags are pinned with Anav. |
| Local Mock Stack | ✅ Fully Automated & Ready | Runs anywhere without external dependencies. 65/65 tests passing. |

## Decisions Still Open

| Decision | Current Position | Owner / Evidence Needed |
|---|---|---|
| Certify, wallet, Verify exact versions | Not pinned (target: v0.10.x) | Anav + Manay: record exact tag/commit and working compatibility |
| Wallet choice and presentation mode | Inji Web (primary), Inji Mobile (interactive) | Anav + Manay: confirm based on available working setup |
| Issuance grant and authentication | Release-dependent | Anav + Dhyan: confirm issuer/wallet flow and required onboarding |
| Verify result route/schema | Not pinned | Dhyan: selected release OpenAPI; Anav reviews pass semantics |
| Second credential format (sd_jwt_vc) | Automated baseline complete | Manay: verify live Inji support after first format works |

## Run Evidence Log

> Record each successful run here. Include run ID, verdict, component versions, and environment.

| Date | Run ID | Issuer | Wallet | Verifier | Format | Verdict | Environment | Recorded By |
|---|---|---|---|---|---|---|---|---|
| 2026-11-01 | `1adf05a9-df38-4fdc-89b7-9eadeaaa113f` | `mock-openid4vci` (1.0.0) | `simulated-wallet` (1.0.0) | `mock-openid4vp` (1.0.0) | `w3c_vc_jsonld` | PASSED (56ms) | Local Express (port 4000) | Manay |
| 2026-11-01 | `5e365f9c-c31a-4e78-9b9b-d68e57b7f6fd` | `mock-openid4vci` (1.0.0) | `simulated-wallet` (1.0.0) | `mock-openid4vp` (1.0.0) | `sd_jwt_vc` | PASSED (51ms) | Local Express (port 4000) | Manay |
| 2026-11-01 | *(live run)* | `inji-certify` (TBD) | `inji-web` (TBD) | `inji-verify` (TBD) | `w3c_vc_jsonld` | ⏳ Pending Collab | MOSIP Collab / Docker | Manay |