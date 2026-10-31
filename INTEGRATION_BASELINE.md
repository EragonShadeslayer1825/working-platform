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
| First credential format: W3C VC 1.1 JSON-LD | ⏳ Pending live run | Mock baseline ✅ automated. Live run requires Inji stack access. |
| Second credential format: IETF SD-JWT VC | ⏳ Pending live run | Attempt after first format works end-to-end. |
| Issuance grant type (pre-authorized code) | ⏳ Confirm from selected Certify release | Certify docs have conflicting statements across versions. |
| Presentation flow: OpenID4VP | ⏳ Confirm exact draft version | Adapter targets Draft 21 — confirm from selected Verify release. |
| Verification result route + schema | ⏳ TBD | `InjiVerifyAdapter` reads `verificationStatus` field — confirm field name from Verify OpenAPI. |

## Environment Decision

| Option | Status | Notes |
|---|---|---|
| MOSIP Collab | ⏳ Check access with Anav | Fastest path to proof-of-life. |
| Local Docker Compose | ⏳ Compose file TBD | Reproducible deliverable. Set up after Collab flow is proven. |

## Decisions Still Open

| Decision | Current Position | Owner / Evidence Needed |
|---|---|---|
| Certify, wallet, Verify exact versions | Not pinned | Anav + Manay: record exact tag/commit and working compatibility |
| Wallet choice and presentation mode | Inji Web (primary), Inji Mobile (fallback) | Anav + Manay: confirm based on available working setup |
| Issuance grant and authentication | Release-dependent | Anav + Dhyan: confirm issuer/wallet flow and required onboarding |
| Verify result route/schema | Not pinned | Dhyan: selected release OpenAPI; Anav reviews pass semantics |
| Second credential format (sd_jwt_vc) | Required by acceptance criteria | Manay: verify actual supported combination after first format works |

## Run Evidence Log

> Record each successful live run here. Include run ID, verdict, component versions, and environment.

| Date | Run ID | Issuer | Wallet | Verifier | Format | Verdict | Environment | Recorded By |
|---|---|---|---|---|---|---|---|---|
| *(fill after live run)* | *(run UUID)* | *(version)* | *(version)* | *(version)* | *(format)* | *(verdict)* | *(env)* | Manay |