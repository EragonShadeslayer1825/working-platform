# Working Platform — Inji Interoperability Playground

A hackathon project for exercising real Verifiable Credential issuance, wallet holding, presentation, and verification across Inji modules. The playground must show actual protocol activity and the verifier's authoritative result. An HTTP 200 response or successful wallet redirect alone is never a pass.

## Goal and first milestone

Deliver one repeatable end-to-end run: issue a credential from Inji Certify using documented OpenID4VCI; hold it in an Inji wallet; present it to Inji Verify using OpenID4VP; and show the authoritative verification outcome, diagnostics, and sanitized protocol timeline.

The project requirements ask for at least two credential formats. First make one format work end to end, then add a second and label every run. The first format is planned as W3C VC 1.1 JSON-LD, subject to compatibility checks against the exact selected issuer, wallet, and verifier versions.

## Team and ownership

| Owner | Main responsibility | Deliverable |
|---|---|---|
| Anav — Architect and designer | Owns system architecture, technical decisions, protocol/flow design, acceptance criteria, cross-team coordination, and integration review. Keeps interfaces aligned and records decisions. | Agreed architecture and contracts; reviewed end-to-end flow and demo story. |
| Dhyan — Backend | Owns the Node/Express playground engine, internal API, run lifecycle, service adapters, sanitized event capture, and retrieval of the verifier's authoritative result. Uses documented external APIs only. | Backend routes and run/event/result data contract consumed by the frontend. |
| Namya — Frontend and demo | Owns the React/TypeScript playground experience, issuer-wallet-verifier selectors, run controls, protocol timeline/result display, and demo walkthrough. | Working UI that shows real run state, exchanges, errors, and verification outcome. |
| Manay — Integration and quality | Owns repeatable setup notes, integration execution, positive and negative flow checks, compatibility matrix, and confirmed issue/limitation write-up. Pairs with Anav on integration decisions and evidence. | Reproducible run evidence and pass/fail interoperability report. |

Each owner works on a named branch and opens a pull request to main. Coordinate before changing shared contracts or the same files. Anav reviews cross-component decisions; owners review changes in their areas. Keep main runnable.

## Planned architecture

React/TypeScript UI → Node/Express playground engine → documented Inji service interfaces. The wallet remains a real user-controlled flow: the user reviews and consents where required. Mimoto is used where required by the selected Inji Wallet/Web setup. Inji Verify's result, not the browser callback, determines verification status.

The playground engine may coordinate and record the flow, but must not fabricate issuer/verifier responses or bypass wallet consent. Exact external URLs, authentication, request bodies, and response fields must come from the selected release's official configuration and OpenAPI/source documentation and be recorded before implementation.

## Proposed internal API contract

These are playground-owned routes, not Inji endpoints. Dhyan implements them; Anav confirms the contract; Namya consumes it. Keep the contract small and version it if it changes.

- POST /api/runs — create a run from selected module IDs, pinned versions, and credential format; return a run ID and initial state.
- GET /api/runs/:runId — return run summary, current state, sanitized timeline, and verification outcome when available.
- POST /api/runs/:runId/issuance/start — start the selected documented issuance flow and return the next UI action.
- POST /api/runs/:runId/presentation/start — start the documented OpenID4VP verifier flow and return the QR/deep-link/request data needed by the UI.

Each exchange event should include run ID, timestamp, protocol step, actor, direction, endpoint/operation, sanitized request/response when available, HTTP status, and error details. Redact tokens, OTPs, private keys, and personal credential data. Do not store them in logs.

Suggested normalized outcomes: PASS, INVALID, EXPIRED, PENDING, and ERROR. Keep transport/API errors distinct from verifier rejection. VP receipt or a transaction ID is intermediate; mark PASS only after retrieving the matching authoritative verifier result and checking the expected credential/type.

## Integration decisions and checks

- Verify and record the exact tag/branch, commit, Compose instructions, and configuration for each module before setup. Avoid floating latest versions.
- For an early proof-of-life, try MOSIP Collab if team access is ready. For a reproducible deliverable, bring up the smallest documented local Compose setup that supports the selected flow. If one path blocks progress, switch to the other and record the change.
- Pin the chosen issuer, wallet, verifier, and format together before building adapters. Include their versions in each run report.
- Certify docs differ on credential-offer availability. Confirm the chosen release's working issuance flow before selecting pre-authorized or authorization-code issuance.
- Inji Verify documents a service base under /v1/verify and distinguishes VP receipt (transaction ID) from a processed result. Confirm the selected version's OpenAPI contract and exact result-retrieval route before the backend implements its adapter.
- Add a second format only after the first full flow works. Treat mDoc/mDL as optional unless the selected versions demonstrably support it.

## Four-day plan

- Day 1: confirm access, versions, environment, first format, and API contracts; obtain one real issuer-to-wallet proof-of-life.
- Day 2: connect the Node engine to the documented flow and capture sanitized run events; connect the frontend to the internal contract.
- Day 3: complete OpenID4VP to Inji Verify and show the authoritative result; test invalid/expired/error paths where supported.
- Day 4: attempt the second format, finish the compatibility report and setup notes, then rehearse the demo with the protocol inspector visible.

## Definition of done

- One documented, repeatable issue → hold → present → verify run completes with the selected real modules.
- The report records module versions, credential format, actual exchanges/errors (sanitized), and authoritative verification response.
- A successful submission is never confused with successful verification.
- The UI distinguishes PASS, INVALID, EXPIRED, PENDING, and ERROR as supported by the selected verifier.
- A second format is tested or its confirmed compatibility blocker is documented; no untested combination is claimed.
- Another teammate can follow the setup and demo notes from a clean checkout.

## Official references

- [Inji Certify repository](https://github.com/inji/inji-certify) · [Certify local setup](https://docs.inji.io/inji-certify/build-and-deploy/local-setup)
- [Inji Web repository](https://github.com/inji/inji-web) · [Inji Web local setup](https://docs.inji.io/inji-wallet/inji-web/build-and-deploy/local-setup)
- [Inji Mobile wallet guide](https://docs.inji.io/inji-wallet/inji-mobile/functional-overview/end-user-guide)
- [Inji Verify repository](https://github.com/inji/inji-verify) · [Verify local setup](https://docs.inji.io/inji-verify/build-and-deploy/local-setup)
- [OpenID4VP Verify integration guide](https://docs.inji.io/inji-verify/technical-overview/integration-guides/openid4vp-vp-verification-integration-guide)
