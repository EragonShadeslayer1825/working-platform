# Architecture and integration boundaries

Status: proposed working design. Anav owns this note and the cross-component decisions. Confirm a decision with the relevant owner before changing an interface other people depend on.

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

- **Anav — architecture:** owns this system design, requirements-to-acceptance mapping, technical decisions, protocol compatibility review, and cross-team interface approval. Does not replace Dhyan's backend or Namya's UI ownership.
- **Dhyan — backend:** owns Node/Express routes, run state, documented Inji adapters, event persistence, redaction, and authoritative Verify-result retrieval.
- **Namya — frontend/demo:** owns React screens, selectors, run progress, QR/deep-link presentation, timeline and outcome display, and demo script.
- **Manay — integration/quality:** owns environment setup notes, executing the real flows, negative-path evidence, compatibility matrix, and confirmed-gap report; pairs with Anav on integration findings.

Change the shared contract through a short discussion and pull request. The backend owns implementation; the architect approves the boundary; the frontend consumes the agreed response shape.

## Playground API boundary (proposed)

These are internal playground routes, not Inji endpoints:

- POST /api/runs — create a run and return runId plus initial state.
- GET /api/runs/:runId — return run metadata, state, sanitized events, and result when available.
- POST /api/runs/:runId/issuance/start — initiate the selected documented issuance flow.
- POST /api/runs/:runId/presentation/start — initiate the selected documented verifier flow and return its wallet request data.

Use one shared event shape: runId, eventId, timestamp, actor, protocol step, direction, endpoint/operation, redacted request/response, HTTP status, and error detail. Define the exact JSON fields with Dhyan before Namya builds against them. Keep transaction IDs for correlation; never log access tokens, OTPs, private keys, or personal credential data.

## Integration constraints

- Protocol intent: OpenID4VCI for issuance and OpenID4VP for presentation. Pin exact module releases and their supported spec versions; do not assume drafts or formats match across releases.
- First format target: W3C VC 1.1 JSON-LD, pending compatibility confirmation across the selected issuer, wallet, and verifier. Add another format after the first real flow works.
- Environment: use Collab for a fast proof-of-life if access is ready; keep a documented local Compose path as the reproducible deliverable. Record which environment each run used.
- Do not hardcode guessed external endpoints, credentials, auth parameters, request bodies, or verification-result paths. Dhyan and Anav record each from the selected release's official documentation/configuration before implementation.
- Certify documentation has differing statements about credential-offer availability. Confirm the selected release and working issuer flow before relying on pre-authorized offers.
- Verify's SDK guide documents a service base at /v1/verify and distinguishes a received transaction ID from processed verification. Confirm exact route and schema from the selected version's OpenAPI contract.

## Decisions to close before adapters

| Decision | Current position | Owner / evidence needed |
|---|---|---|
| Certify, wallet, Verify versions | Not pinned | Anav + Manay: record exact tag/commit and working compatibility |
| Wallet choice and presentation mode | Inji Mobile or Inji Web; QR/deep link to confirm | Anav + Manay: choose based on available working setup |
| Issuance grant and authentication | Release-dependent; do not assume | Anav + Dhyan: confirm issuer/wallet flow and required onboarding |
| Verify result route/schema | Not pinned | Dhyan: selected release OpenAPI; Anav reviews pass semantics |
| Run persistence and event transport | Minimal implementation TBD | Dhyan proposes; Namya confirms UI needs; Anav resolves boundary |
| Second credential format | Required by project acceptance; choice TBD after baseline | Manay verifies an actual supported combination |

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
