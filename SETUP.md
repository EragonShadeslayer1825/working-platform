# Inji Interoperability Playground — Setup Guide

> **Manay's Owner Document** — Reproducible environment setup for the MOSIP Decode Hackathon Interoperability Playground.
> A teammate should be able to follow this document from scratch and reach a running, testable system.

---

## Prerequisites

| Tool | Minimum Version | Notes |
|---|---|---|
| Node.js | 20+ (22 LTS recommended) | `node --version` to check |
| npm | 10+ | Bundled with Node 22 |
| Git | Any recent version | For cloning |
| Docker + Docker Compose | 24+ (optional) | Required only for local Inji services |

---

## 1. Clone and Initial Configuration

```bash
# Clone the repository
git clone <repository-url>
cd working-platform

# Set up environment file
cp .env.example .env
```

**Edit `.env`** based on your target environment:

- **Mock-only runs** (no Inji services needed): the defaults in `.env.example` are fine.
- **Live Inji Certify**: update `INJI_CERTIFY_BASE_URL` to the confirmed endpoint.
- **Live Inji Web/Mimoto**: update `MIMOTO_WALLET_BASE_URL`.
- **Live Inji Verify**: update `INJI_VERIFY_BASE_URL`.

> **Never commit `.env` files or credentials to Git.**

---

## 2. Backend Setup (Express / TypeScript Orchestrator)

The backend orchestration engine lives in `src/`.

```bash
# Install all backend + frontend dependencies
npm install

# Run the automated test suite (65 tests across unit, API, sanitization, evaluator)
npm test

# Start the backend server in development mode (port 4000)
npm run dev:backend
```

**Verify the backend is running:**

```bash
curl http://localhost:4000/health
# Expected: {"status":"HEALTHY","service":"inji-interop-playground-backend","version":"1.0.0",...}
```

The default server port is **4000** (configurable via `PORT` in `.env`).

### Backend Scripts Reference

| Script | Command | Purpose |
|---|---|---|
| Run tests (all 83) | `npm test` | Runs orchestrator + wallet data flow + 5 integration suites |
| Unit tests only | `npm run test:unit` | Orchestrator domain tests + exact wallet data flow |
| All integration tests | `npm run test:integration` | API HTTP + sanitization + evaluator + playground API + callbacks suites |
| Wallet data flow tests | `node --import tsx/esm --test tests/wallet-data-flow.test.ts` | Exact credential preservation in wallet (3 tests) |
| Webhook callback tests | `node --import tsx/esm --test tests/integration/callbacks.integration.test.ts` | Callback security, schema, and replay prevention (5 tests) |
| API integration tests | `node --import tsx/esm --test tests/integration/api.integration.test.ts` | HTTP endpoint integration (19 tests) |
| Sanitization tests | `node --import tsx/esm --test tests/integration/sanitization.integration.test.ts` | Event redaction policy (28 tests) |
| Evaluator tests | `node --import tsx/esm --test tests/integration/evaluator.integration.test.ts` | Verdict logic branches (18 tests) |
| Playground API tests | `node --import tsx/esm --test tests/integration/playground-api.integration.test.ts` | Next.js UI dual-route contract (5 tests) |
| Start dev backend | `npm run dev:backend` | Express server with hot reload (`tsx watch`) |
| Build TypeScript backend | `npm run build:backend` | Compiles to `dist/` via `tsconfig.server.json` |
| Start production backend | `npm run start:backend` | Runs compiled `dist/index.js` |

---

## 3. Frontend Setup (Next.js Playground UI)

The Playground UI is a Next.js application at the root directory.

```bash
# Install dependencies (already installed via root npm install)
npm ci

# Start the Next.js development server
npm run dev
```

The frontend starts on **http://localhost:3000** (or 3001 if 3000 is in use).

> Ensure the backend is running on port 4000 before launching the frontend.

---

## 4. Quick Smoke Test (Mock Stack)

These commands test the full issue → hold → present → verify flow using the built-in mock adapters. **No live Inji services required.**

```bash
# Step 1: Launch a mock interoperability test run
curl -X POST http://localhost:4000/api/v1/runs \
  -H "Content-Type: application/json" \
  -d '{
    "issuerId": "mock-openid4vci",
    "walletId": "simulated-wallet",
    "verifierId": "mock-openid4vp",
    "format": "w3c_vc_jsonld"
  }'
# → Returns {"runId": "<uuid>", "status": "INITIALIZING", ...}

# Step 2: Poll for result (replace <runId> with the returned UUID)
curl http://localhost:4000/api/v1/runs/<runId>
# → Run reaches COMPLETED with verdict: "PASSED"

# Step 3: Inspect sanitized protocol events
curl http://localhost:4000/api/v1/runs/<runId>/events
# → Returns array of sanitized protocol events (no tokens or secrets)

# Step 4: Browse the registry
curl http://localhost:4000/api/v1/registry/components
curl http://localhost:4000/api/v1/registry/matrix
```

---

## 5. Live Inji Services Setup

> **Important**: Before configuring live Inji services, confirm all component versions with Anav and record them in `INTEGRATION_BASELINE.md`.

### Option A: MOSIP Collab Environment

If your team has been granted access to the MOSIP Collab environment:

1. Obtain the Collab environment endpoint URLs from Anav.
2. Update `.env`:
   ```env
   INJI_CERTIFY_BASE_URL=<collab-certify-url>
   MIMOTO_WALLET_BASE_URL=<collab-mimoto-url>
   INJI_VERIFY_BASE_URL=<collab-verify-url>
   ```
3. Restart the backend: `npm run dev`
4. Run the live integration smoke test:
   ```bash
   curl -X POST http://localhost:4000/api/v1/runs \
     -H "Content-Type: application/json" \
     -d '{
       "issuerId": "inji-certify",
       "walletId": "inji-web",
       "verifierId": "inji-verify",
       "format": "w3c_vc_jsonld"
     }'
   ```

### Option B: Local Docker Compose

> Requires confirmed Inji component versions (see `INTEGRATION_BASELINE.md`).
> Docker Compose configuration to be added once component versions and working configurations are pinned.

**Planned service ports (update with confirmed values):**

| Service | URL | Port |
|---|---|---|
| Inji Certify | `http://localhost:8080/certify` | 8080 |
| Mimoto (Wallet BFF) | `http://localhost:8081/mimoto` | 8081 |
| Inji Verify | `http://localhost:8082/verify` | 8082 |

---

## 6. Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Backend HTTP server port |
| `NODE_ENV` | `development` | Node environment |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:3000` | Allowed frontend origins |
| `INJI_CERTIFY_BASE_URL` | `http://localhost:8080/certify` | Inji Certify base URL |
| `MIMOTO_WALLET_BASE_URL` | `http://localhost:8081/mimoto` | Mimoto wallet BFF base URL |
| `INJI_VERIFY_BASE_URL` | `http://localhost:8082/verify` | Inji Verify base URL |
| `STAGE_TIMEOUT_MS` | `30000` | Per-stage timeout in milliseconds |
| `RUN_TIMEOUT_MS` | `120000` | Total run timeout in milliseconds |

---

## 7. Architecture Summary

```
Playground UI (Next.js :3000)
        │
        │ REST API
        ▼
Orchestration Engine (Express :4000)
        │
   ┌────┴────┐────────────┐
   │         │            │
Issuer    Wallet      Verifier
Adapter   Adapter     Adapter
   │         │            │
Inji      Inji Web    Inji
Certify   / Mimoto    Verify
(real or mock)     (real or mock)
```

**Key principle**: HTTP 200 ≠ PASS. Only an authoritative cryptographic result from Inji Verify can produce a PASSED verdict.

---

## 8. Troubleshooting

| Symptom | Likely Cause | Resolution |
|---|---|---|
| `ECONNREFUSED` on run with real adapters | Inji service not running | Check service URLs in `.env`, ensure services are up |
| Run verdict is `INCONCLUSIVE` with real adapters | Network error or service offline | Check `inconclusiveReason` in run report for details |
| `VALIDATION_ERROR` on POST /api/v1/runs | Missing or invalid request fields | Check required fields: `issuerId`, `walletId`, `verifierId`, `format` |
| Tests fail with TypeScript errors | Missing types or tsx not available | Run `npm install` first, then `npm test` |
| `npm run dev` not found | No `dev` script in backend package.json | Run `npx tsx src/index.ts` directly |
| CORS errors in browser | Frontend origin not in CORS_ORIGIN | Add frontend URL to `CORS_ORIGIN` in `.env` |

---

## 9. Known Limitations

| Limitation | Detail | Workaround |
|---|---|---|
| Inji Mobile wallet requires interactive mode | QR scan/deep link cannot be automated headlessly | Use `simulated-wallet` for automated tests; test mobile flows manually |
| `mso_mdoc` format has no live Inji adapter | Inji Certify support for mDL is not yet confirmed | Document as compatibility blocker in `COMPATIBILITY_REPORT.md` |
| API route prefix | Implementation uses `/api/v1/...`; `API_Contract.md` shows `/api/...` | All tests and frontend use `/api/v1/` — align with Dhyan |
| Inji Certify endpoint path | Release-dependent; may differ from adapter implementation | Confirm from selected release's official OpenAPI docs |

---

## 10. Reference Links

| Resource | URL |
|---|---|
| Inji Certify Docs | https://docs.inji.io/inji-certify/build-and-deploy/local-setup |
| Inji Web Docs | https://docs.inji.io/inji-wallet/inji-web/build-and-deploy/local-setup |
| Inji Verify Docs | https://docs.inji.io/inji-verify/build-and-deploy/local-setup |
| OpenID4VP Integration Guide | https://docs.inji.io/inji-verify/technical-overview/integration-guides/openid4vp-vp-verification-integration-guide |
| OpenID4VCI Spec | https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html |
| W3C VC Data Model | https://www.w3.org/TR/vc-data-model-2.0/ |
