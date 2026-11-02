# Architecture and integration boundaries

Status: Approved Architecture & Technical Specification. Arnav owns this system architecture and cross-component decisions.

## Goal

Run real issuance → wallet holding → presentation → verification with Inji components, and show actual exchanges, errors, and the verifier's authoritative outcome. HTTP success, a redirect, or VP receipt is not a verification pass.

## System shape

`React + TypeScript playground UI` → `Node/Express playground engine` → documented Inji service interfaces.

The human uses the selected wallet and consents to credential sharing. Mimoto is included when required by the selected wallet setup. Inji Certify is the issuer; Inji Verify is the relying-party verifier. The engine coordinates the playground run and captures redacted evidence; it must not impersonate the wallet or invent responses.

## End-to-end sequence

1. The UI asks the engine to create a run with module IDs, exact module versions, and a credential format.
2. The engine records the run and starts the documented issuer flow. The user completes any required authentication and wallet consent. The wallet stores the credential.
3. The UI asks the engine to start a verifier request. Inji Verify creates the documented OpenID4VP request; the wallet receives it by the selected QR or deep-link flow and the user chooses what to share.
4. The verifier receives the VP. The engine records the submission/transaction identifier as pending, then fetches or receives the authoritative verification result using the selected Verify release's documented contract.
5. The UI shows the final outcome, selected modules/versions, credential format, sanitized exchange timeline, and diagnostics.

Only the selected Verify release's final result can produce PASS, after expected credential/type checks. Record INVALID, EXPIRED, PENDING, and technical ERROR separately.

## Component ownership and handoff

- **Arnav — architecture:** owns this system design, requirements-to-acceptance mapping, technical decisions, protocol compatibility review, and cross-team interface approval. Does not replace Dhyan's backend or Namya's UI ownership.
- **Dhyan — backend:** owns Node/Express routes, run state, documented Inji adapters, event persistence, redaction, and authoritative Verify-result retrieval.
- **Namya — frontend/demo:** owns React screens, selectors, run progress, QR/deep-link presentation, timeline and outcome display, and demo script.
- **Manay — integration/quality:** owns environment setup notes, executing the real flows, negative-path evidence, compatibility matrix, and confirmed-gap report; pairs with Arnav on integration findings.

Change the shared contract through a short discussion and pull request. The backend owns implementation; the architect approves the boundary; the frontend consumes the agreed response shape.

## Playground API boundary (Approved Architecture)

The backend provides dual API routing to ensure full interoperability between frontend and engine:

1. **Frontend Contract (`/api/runs`):**
   - `POST /api/runs` — create a run and return `runId` plus initial state, mapped to UI `RunRecord`.
   - `GET /api/runs` — retrieve historical runs in `RunRecord` format.
   - `GET /api/runs/:runId` — return run metadata, state, sanitized events, and verification result when available.
   - `POST /api/runs/:runId/issuance/start` — initiate/confirm issuance step.
   - `POST /api/runs/:runId/presentation/start` — initiate/confirm presentation step.

2. **Core Orchestration Contract (`/api/v1/runs`):**
   - `POST /api/v1/runs` — internal headless test execution pipeline.
   - `GET /api/v1/runs/:id` — internal domain test run details.
   - `GET /api/v1/runs/:id/events` — raw sanitized event history.
   - `POST /api/v1/callbacks/verifier/:runId` — webhook receiver for verifier callbacks.

Shared event shape: `runId`, `eventId`, `timestamp`, `actor`, `protocolStep`, `direction`, `operation`, `sanitized request/response`, `httpStatus`, and `error detail`. Sensitive tokens, OTPs, private keys, and personal credential data are strictly redacted by policy.

## Integration constraints

- Protocol intent: OpenID4VCI for issuance and OpenID4VP for presentation.
- Primary format target: W3C VC 1.1 JSON-LD (`w3c_vc_jsonld`).
- Secondary format target: IETF SD-JWT VC (`sd_jwt_vc`).
- Environment: Local Docker Compose deliverable provided via `docker-compose.yml`; MOSIP Collab as target remote environment.
- Verifier authoritative result route: `/v1/verify` checking cryptographic validation fields.

## Closed Architecture Decisions (Signed Off by Arnav)

See `ARCHITECTURE_DECISION_RECORDS.md` for full context and specifications.

| Decision | Status & Resolved Position | Approved By / Implementation |
|---|---|---|
| Certify, wallet, Verify versions | **CLOSED**: Pinned to MOSIP Inji release `0.10.0` (tags `mosipid/inji-certify:0.10.0`, `mosipid/mimoto:0.10.0`, `mosipid/inji-verify:0.10.0`); Mock stack `1.0.0` | Arnav (ADR-006) |
| Wallet choice and presentation mode | **CLOSED**: Automated headless runs use `simulated-wallet` / `inji-web` via Mimoto REST; Interactive mobile runs use `inji-wallet-mobile` with QR Code / Deep Link | Arnav (ADR-004) |
| Issuance grant and authentication | **CLOSED**: Pre-authorized code flow (`urn:ietf:params:oauth:grant-type:pre-authorized_code`) for zero-touch automated tests; Auth Code with PKCE for interactive login | Arnav (ADR-004) |
| Verify result route/schema | **CLOSED**: Standardized on Inji Verify `/v1/verify`. PASS requires all-green cryptographic validation: valid signature, untampered claims, unexpired, trusted DID | Arnav (ADR-001) |
| Run persistence and event transport | **CLOSED**: Dual API routing (`/api/runs` and `/api/v1/runs`) with normalized `RunRecord` and strict recursive `EventSanitizer` (depth 6) | Arnav (ADR-002, ADR-005) |
| Second credential format | **CLOSED**: Format 1 = W3C VC 1.1 JSON-LD; Format 2 = IETF SD-JWT VC. ISO mDL (`mso_mdoc`) confirmed and documented as unsupported blocker | Arnav (ADR-003) |

## Acceptance checks for the architecture

- One real issuance, wallet hold, VP presentation, and authoritative Verify result are correlated by run ID/transaction ID.
- A 200 response or VP-received callback cannot set PASS.
- Each report names the exact modules, versions, format, environment, final result, and sanitized evidence.
- A failed or incompatible combination is shown as a failure with evidence, not silently converted into a pass.

## Official references

- [Inji Certify repository](https://github.com/inji/inji-certify) · [Certify local setup](https://docs.inji.io/inji-certify/build-and-deploy/local-setup)
- [Inji Web local setup](https://docs.inji.io/inji-wallet/inji-web/build-and-deploy/local-setup)
- [Inji Mobile end-user guide](https://docs.inji.io/inji-wallet/inji-mobile/functional-overview/end-user-guide)
- [Inji Verify local setup](https://docs.inji.io/inji-verify/build-and-deploy/local-setup)
- [OpenID4VP Verify integration guide](https://docs.inji.io/inji-verify/technical-overview/integration-guides/openid4vp-vp-verification-integration-guide)
