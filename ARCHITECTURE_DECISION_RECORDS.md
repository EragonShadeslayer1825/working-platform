# Architecture Decision Records (ADRs) — Inji Interoperability Playground

> **Author**: Arnav (System Architect & Technical Lead)  
> **Project**: MOSIP Decode Hackathon — Problem 02: Inji Interoperability Playground  
> **Status**: Approved & Enacted  

---

## Index of Architecture Decision Records

- [ADR-001: Cryptographic Authoritative Verification vs. Transport Success](#adr-001-cryptographic-authoritative-verification-vs-transport-success)
- [ADR-002: Harmonized Dual REST API Routing (`/api/runs` & `/api/v1/runs`)](#adr-002-harmonized-dual-rest-api-routing-apiruns--apiv1runs)
- [ADR-003: Multi-Format Credential Strategy: W3C VC 1.1 JSON-LD and IETF SD-JWT VC](#adr-003-multi-format-credential-strategy-w3c-vc-11-json-ld-and-ietf-sd-jwt-vc)
- [ADR-004: Dual-Mode Wallet Holding & Presentation Architecture](#adr-004-dual-mode-wallet-holding--presentation-architecture)
- [ADR-005: Zero-Leak Protocol Event Sanitization with Depth Guard](#adr-005-zero-leak-protocol-event-sanitization-with-depth-guard)
- [ADR-006: Pinned Service Topology and Local Docker Compose Delivery](#adr-006-pinned-service-topology-and-local-docker-compose-delivery)

---

## ADR-001: Cryptographic Authoritative Verification vs. Transport Success

### Status
**Approved** (2026-11-01)

### Context
In decentralized identity ecosystems (OpenID4VCI, OpenID4VP), an HTTP 200 response or a successful wallet redirect confirms only network transport delivery. It does not establish that the cryptographic signature is valid, that the issuer DID is trusted, that the credential has not expired or been revoked, or that the presentation satisfies the relying party's presentation definition.

### Decision
1. **Transport Success != Verification Pass**: The orchestrator engine and verdict evaluator must never award a `PASS` or `PASSED` status based on HTTP 200, transaction IDs, or VP submission receipts.
2. **Authoritative Evidence Requirement**: A `PASS` outcome strictly requires explicit, authoritative cryptographic evaluation evidence retrieved from Inji Verify, validating:
   - `overallStatus === 'VALID'`
   - `isSignatureValid === true`
   - `isExpired === false`
   - `isRevoked === false`
   - `isIssuerTrusted === true`
   - Matching credential type between request and presentation.
3. **Taxonomy Separation**: Differentiate between:
   - `PASS`: Authoritative cryptographic validation succeeded.
   - `INVALID`: Verifier affirmatively rejected signature, claims, or DID trust.
   - `EXPIRED`: Verifier confirmed the credential expiration date has elapsed.
   - `PENDING`: Asynchronous verification is underway.
   - `INCONCLUSIVE`: Technical transport errors (network timeout, unreachable endpoint, malformed callback).

### Consequences
- Eliminates false positive test results.
- Guarantees hackathon evaluation integrity and interoperability accuracy.

---

## ADR-002: Harmonized Dual REST API Routing (`/api/runs` & `/api/v1/runs`)

### Status
**Approved & Implemented** (2026-11-02)

### Context
The UI client developed by Namya (`lib/playground-api.ts` and `app/page.tsx`) was built against the agreed team `API_Contract.md`, which exposes `/api/runs`, `/api/runs/:runId`, `/api/runs/:runId/issuance/start`, and `/api/runs/:runId/presentation/start`. Meanwhile, the backend orchestration engine implemented by Dhyan exposed `/api/v1/runs` with internal engine DTOs. This resulted in an open integration blocker (QA-001).

### Decision
1. **Dual Router Mounting in Express**:
   - Mount `createPlaygroundRunsRouter` at `/api/runs` to serve the agreed frontend contract.
   - Retain `createRunsRouter` at `/api/v1/runs` to ensure backwards compatibility with automated test suites and internal microservices.
2. **Bridge Adapter Layer**:
   - Normalizes UI payloads (`modules`, `credentialFormat` like `jsonld-vc-1.1` and `sd-jwt-vc`, mock aliases) into internal domain types (`w3c_vc_jsonld`, `sd_jwt_vc`, `mock-openid4vci`).
   - Normalizes backend `TestRun` records and `AuthoritativeVerificationEvidence` into the unified `RunRecord` and `verificationResult` expected by the Next.js UI.
   - Synthesizes event filtering tags (`Discovery`, `Issuance`, `Presentation`, `Verification`) to power the UI Protocol Inspector.

### Consequences
- Resolves issue QA-001 completely.
- Zero breaking changes to existing unit and integration tests.
- UI connects and renders live runs, events, and reports with zero manual remapping.

---

## ADR-003: Multi-Format Credential Strategy: W3C VC 1.1 JSON-LD and IETF SD-JWT VC

### Status
**Approved** (2026-11-01)

### Context
The hackathon problem statement requires exercising interoperability across multiple credential formats. Inji Certify and Inji Verify support W3C VC 1.1 JSON-LD and IETF SD-JWT VC. In contrast, ISO/IEC 18013-5 mDL (`mso_mdoc`) is not currently supported by Inji Verify's REST API.

### Decision
1. **Primary Target**: W3C Verifiable Credentials 1.1 JSON-LD (`w3c_vc_jsonld` / `jsonld-vc-1.1`) with `Ed25519Signature2020` or `JsonWebSignature2020`.
2. **Secondary Target**: IETF SD-JWT VC (`sd_jwt_vc` / `sd-jwt-vc`) with selective disclosure hashing (`sha-256`) and `ES256` key binding.
3. **Confirmed Blocker**: ISO/IEC mDL (`mso_mdoc`) is formally documented as `UNSUPPORTED` on the Inji Verify adapter, satisfying the acceptance criterion to prove format coverage or document confirmed compatibility blockers with evidence.

### Consequences
- Delivers 2 fully automated and verifiable credential formats.
- Accurately reports standards boundaries in `COMPATIBILITY_REPORT.md`.

---

## ADR-004: Dual-Mode Wallet Holding & Presentation Architecture

### Status
**Approved** (2026-11-01)

### Context
Testing requires both unattended automated CI execution and real human-in-the-loop wallet verification (using Inji Web and Inji Mobile). Mobile wallets cannot be automated headlessly because they require camera QR scanning and biometric authorization.

### Decision
1. **Automated Headless Mode**:
   - `simulated-wallet`: Operates headlessly in CI and automated test suites. Exchanges OpenID4VCI pre-authorized codes, stores credentials in memory, and submits OpenID4VP presentations within milliseconds.
   - `inji-web`: Uses Mimoto BFF REST endpoints (`/wallet/credentials/download` and `/wallet/presentation/submit`) for browser wallet automation.
2. **Interactive Mobile Mode**:
   - `inji-wallet-mobile`: Marks `isInteractive = true`. When launched, the engine pauses after `OFFER_ISSUANCE` or `PRESENTATION_REQUEST`, updates run status to `AWAITING_WALLET_ACTION`, generates a QR payload (`credential_offer_uri` or `presentation_request_uri`), and awaits completion via callback or UI resume.

### Consequences
- Supports high-velocity automated testing without compromising real mobile wallet demonstration capabilities.
- Resolves QA-006.

---

## ADR-005: Zero-Leak Protocol Event Sanitization with Depth Guard

### Status
**Approved** (2026-11-01)

### Context
All protocol exchanges between Issuer, Wallet, and Verifier must be recorded for auditing and displayed in the UI Protocol Inspector. However, protocol payloads contain Bearer tokens, private keys, client assertions, OTPs, and personal identity data (PII).

### Decision
1. Implement `ProtocolEventBus` and `EventSanitizer` prior to persistence.
2. Redaction rules:
   - Key-based matching: `authorization`, `access_token`, `refresh_token`, `client_secret`, `client_assertion`, `private_key`, `user_pin`, `password`, `ssn`, `dpop_proof`, `national_id`.
   - Pattern-based matching: Regex scanning for `Bearer <token>` and `BEGIN PRIVATE KEY`.
   - Depth guard: Max recursion depth of 6 to prevent stack overflow or circular reference denial-of-service.
3. Apply sanitization synchronously before events are saved to `ITestRunRepository`.

### Consequences
- Zero credentials or PII leaked to logs, disk, or UI.
- Passes all 26 sanitization policy integration tests.

---

## ADR-006: Pinned Service Topology and Local Docker Compose Delivery

### Status
**Approved** (2026-11-02)

### Context
A reproducible deliverable requires pinning exact Inji container releases and network configurations so any evaluator or teammate can replicate the environment without ambient setup drift.

### Decision
1. **Pinned Release Tag**: MOSIP Inji release `0.10.0` (target Docker tag `mosipid/inji-certify:0.10.0`, `mosipid/mimoto:0.10.0`, `mosipid/inji-verify:0.10.0`).
2. **Topology**:
   - PostgreSQL (5432)
   - Inji Certify (8080, context path `/certify`)
   - Mimoto Wallet BFF (8081, context path `/mimoto`)
   - Inji Verify (8082, context path `/verify`)
   - Playground Backend Orchestrator (4000)
   - Playground Next.js UI (3000)
3. **Turnkey Manifest**: Delivered via `docker-compose.yml`, `Dockerfile.backend`, and `Dockerfile.frontend`.

### Consequences
- Teammates and hackathon judges can start the full stack with `docker compose up`.
