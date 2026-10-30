# Playground API Contract — Draft v0

These routes belong to our Node/Express app. They are not Inji endpoints.
Dhyan implements them; Namya builds against them; Anav approves changes.

## Create a run

POST /api/runs

Request:

{
  "environment": "collab",
  "modules": {
    "issuer": { "id": "inji-certify", "version": "TBD" },
    "wallet": { "id": "inji-web", "version": "TBD" },
    "verifier": { "id": "inji-verify", "version": "TBD" }
  },
  "credentialFormat": "jsonld-vc-1.1"
}

Response:

{
  "runId": "generated-id",
  "state": "READY",
  "createdAt": "ISO-8601 timestamp"
}

## Start a flow

POST /api/runs/:runId/issuance/start  
POST /api/runs/:runId/presentation/start

Return the current run state and the next user action. The exact handoff data depends on the selected, verified Inji flow.

## Get run status

GET /api/runs/:runId

Return the selected modules and versions, current state, event timeline, and verification result when available.

## Event record

Each event includes:

- runId, eventId, timestamp
- protocol step, actor, direction, operation
- sanitized request and response, when available
- HTTP status and error details, when available

## Verification states

Use: NOT_STARTED, PENDING, PASS, INVALID, EXPIRED, ERROR.

A received VP or HTTP 200 is not PASS. Set PASS only after retrieving the authoritative Inji Verify result and checking the expected credential/type.

## Safety and evidence

Never log access tokens, OTPs, private keys, or personal credential data. Keep technical errors distinct from invalid or expired credentials. External Inji URLs, payloads, and authentication must be confirmed from the selected release’s official docs before implementation.