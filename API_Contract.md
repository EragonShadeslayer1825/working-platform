# Playground API Contract — Version 1.0 (Final Approved)

> **Architect & Owner**: Arnav  
> **Status**: Approved & Enacted across Frontend (Namya) and Backend (Dhyan)  
> **Base Port**: Express Server `:4000`  

These routes belong to our Playground Node/Express application. They are internal playground orchestration APIs, not Inji's internal service endpoints.

---

## 1. Dual Route Architecture

To guarantee total compatibility between the React/Next.js frontend UI and automated test runners, the backend provides two coordinated route surfaces:

1. **Frontend UI Contract (`/api/runs`)**:
   Designed specifically for the Playground UI client (`lib/playground-api.ts`), returning UI-friendly normalized records (`RunRecord`) with synthesized protocol step categories, live verification results, and module metadata.
2. **Core Orchestration Contract (`/api/v1/runs`)**:
   Designed for headless microservice orchestration and integration test suites, returning low-level pipeline execution stages and telemetry.

---

## 2. Frontend Contract Endpoints (`/api/runs`)

### 2.1 Create a Run

**Method & Path**: `POST /api/runs`

**Request Payload**:
```json
{
  "environment": "collab",
  "modules": {
    "issuer": { "id": "inji-certify", "version": "0.10.0" },
    "wallet": { "id": "inji-web", "version": "0.10.0" },
    "verifier": { "id": "inji-verify", "version": "0.10.0" }
  },
  "credentialFormat": "jsonld-vc-1.1"
}
```

*Notes on input fields:*
- `environment`: `'collab'` | `'local'`
- `modules.issuer.id`: `'inji-certify'` | `'mock-issuer'` | `'mock-openid4vci'`
- `modules.wallet.id`: `'inji-web'` | `'inji-mobile'` | `'simulated-wallet'`
- `modules.verifier.id`: `'inji-verify'` | `'mock-verifier'` | `'mock-openid4vp'`
- `credentialFormat`: `'jsonld-vc-1.1'` (W3C VC 1.1 JSON-LD) | `'sd-jwt-vc'` (IETF SD-JWT VC)

**Response (HTTP 201 Created)**:
```json
{
  "runId": "1adf05a9-df38-4fdc-89b7-9eadeaaa113f",
  "state": "PENDING",
  "verificationState": "PENDING",
  "verificationResult": {
    "state": "PENDING",
    "expectedCredentialType": "IdentityCredential"
  },
  "createdAt": "2026-11-02T12:00:00.000Z",
  "environment": "collab",
  "credentialFormat": "jsonld-vc-1.1",
  "modules": {
    "issuer": { "id": "inji-certify", "version": "0.10.0" },
    "wallet": { "id": "inji-web", "version": "0.10.0" },
    "verifier": { "id": "inji-verify", "version": "0.10.0" }
  },
  "events": [],
  "nextAction": "WAIT_FOR_VERIFICATION"
}
```

---

### 2.2 Get Run Status and Authoritative Outcome

**Method & Path**: `GET /api/runs/:runId`

**Response (HTTP 200 OK — Completed Run Example)**:
```json
{
  "runId": "1adf05a9-df38-4fdc-89b7-9eadeaaa113f",
  "state": "PASS",
  "verificationState": "PASS",
  "verificationResult": {
    "state": "PASS",
    "credentialType": "IdentityCredential",
    "expectedCredentialType": "IdentityCredential"
  },
  "createdAt": "2026-11-02T12:00:00.000Z",
  "completedAt": "2026-11-02T12:00:01.200Z",
  "environment": "collab",
  "credentialFormat": "jsonld-vc-1.1",
  "modules": {
    "issuer": { "id": "mock-openid4vci", "version": "1.0.0" },
    "wallet": { "id": "simulated-wallet", "version": "1.0.0" },
    "verifier": { "id": "mock-openid4vp", "version": "1.0.0" }
  },
  "events": [
    {
      "runId": "1adf05a9-df38-4fdc-89b7-9eadeaaa113f",
      "eventId": "evt-001",
      "timestamp": "2026-11-02T12:00:00.100Z",
      "step": "Issuance",
      "protocolStep": "OFFER_ISSUANCE",
      "actor": "ISSUER",
      "direction": "ISSUER -> WALLET",
      "operation": "CREDENTIAL_OFFER",
      "httpStatus": 200,
      "status": 200,
      "request": { "credential_type": "IdentityCredential" },
      "response": { "offer_uri": "openid-credential-offer://..." }
    }
  ],
  "nextAction": "DONE"
}
```

---

### 2.3 Start Flows (Handoff Confirmation)

- `POST /api/runs/:runId/issuance/start`
- `POST /api/runs/:runId/presentation/start`

Returns the updated `RunRecord`.

---

## 3. Core Orchestration Endpoints (`/api/v1/runs`)

- `POST /api/v1/runs`: Accepts `{ issuerId, walletId, verifierId, format, mockTamper }`.
- `GET /api/v1/runs`: Returns array of test runs with timing and stage status.
- `GET /api/v1/runs/:id`: Returns full pipeline stage breakdown (`stages` record) and report.
- `GET /api/v1/runs/:id/events`: Returns sanitized event list.
- `POST /api/v1/callbacks/verifier/:runId`: Webhook receiver for Inji Verify callback payloads.

---

## 4. Verification States and Outcomes

| State | Definition | Authoritative Rule |
|---|---|---|
| `NOT_STARTED` | Run initialized, pipeline not yet triggered | Default state |
| `PENDING` | Pipeline is executing or awaiting async callback / QR action | Verification in flight |
| `PASS` | Authoritative cryptographic verification succeeded | `isSignatureValid === true`, `isExpired === false`, `isRevoked === false`, `isIssuerTrusted === true`, and matching `credentialType` |
| `INVALID` | Credential signature or payload tampered/rejected | Cryptographically rejected by Inji Verify |
| `EXPIRED` | Credential validity period has passed | Confirmed past `expirationDate` |
| `ERROR` | System transport failure or unhandled exception | Network timeout, service offline, malformed payload |

> **Architectural Guardrail**: An HTTP 200 or transaction receipt from a wallet submission NEVER sets `PASS`.

---

## 5. Security and Event Sanitization Policy

All events returned by `/api/runs` and `/api/v1/runs/:id/events` are pre-sanitized by the backend before persistence:
- Bearer tokens, private keys, client assertions, OTPs, passwords, and sensitive identity attributes (SSN, national IDs) are replaced with `[REDACTED_SENSITIVE_DATA]`.
- Recursion depth is capped at 6.
