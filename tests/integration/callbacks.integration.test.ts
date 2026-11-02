import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../src/app.js';
import { InMemoryTestRunRepository } from '../../src/storage/in-memory-repo.js';
import { TestRun } from '../../src/types/domain.js';

describe('Verifier Webhook Callback Endpoint Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  let repo: InMemoryTestRunRepository;

  before(async () => {
    repo = new InMemoryTestRunRepository();
    const app = createApp(repo);
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  async function createTestRun(runId: string): Promise<TestRun> {
    const run: TestRun = {
      runId,
      config: {
        issuerId: 'mock-issuer',
        walletId: 'simulated-wallet',
        verifierId: 'inji-verify',
        format: 'w3c_vc_jsonld',
      },
      status: 'AWAITING_WALLET_ACTION',
      currentStage: 'AUTHORITATIVE_VERIFICATION',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stages: {
        DISCOVERY_AND_CONFIG: { id: 'DISCOVERY_AND_CONFIG', name: 'Discovery', status: 'COMPLETED' },
        OFFER_ISSUANCE: { id: 'OFFER_ISSUANCE', name: 'Offer', status: 'COMPLETED' },
        WALLET_STORAGE: { id: 'WALLET_STORAGE', name: 'Store', status: 'COMPLETED' },
        PRESENTATION_REQUEST: { id: 'PRESENTATION_REQUEST', name: 'PresReq', status: 'COMPLETED' },
        PRESENTATION_SUBMISSION: { id: 'PRESENTATION_SUBMISSION', name: 'PresSub', status: 'COMPLETED' },
        AUTHORITATIVE_VERIFICATION: { id: 'AUTHORITATIVE_VERIFICATION', name: 'Verify', status: 'IN_PROGRESS' },
        REPORT_GENERATION: { id: 'REPORT_GENERATION', name: 'Report', status: 'NOT_STARTED' },
      },
      events: [],
    };
    await repo.createRun(run);
    return run;
  }

  it('evaluates all-green verifier callback payload as PASSED', async () => {
    const runId = 'cb-test-pass-001';
    await createTestRun(runId);

    const payload = {
      state: runId,
      overallStatus: 'VALID',
      isSignatureValid: true,
      isExpired: false,
      isRevoked: false,
      isIssuerTrusted: true,
      credentialType: 'IdentityCredential',
      claims: { fullName: 'Alice Doe' },
    };

    const res = await fetch(`${baseUrl}/api/v1/callbacks/verifier/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 200);
    const body = await res.json() as { status: string; verdict: string };
    assert.equal(body.status, 'PROCESSED');
    assert.equal(body.verdict, 'PASSED');

    const updated = await repo.getRun(runId);
    assert.ok(updated);
    assert.equal(updated.status, 'COMPLETED');
    assert.equal(updated.report?.verdict, 'PASSED');
    assert.equal(updated.report?.authoritativeEvidence?.credentialType, 'IdentityCredential');
  });

  it('evaluates callback with invalid signature as FAILED (receipt alone never means PASS)', async () => {
    const runId = 'cb-test-fail-sig';
    await createTestRun(runId);

    const payload = {
      state: runId,
      overallStatus: 'INVALID',
      isSignatureValid: false,
      isExpired: false,
      isRevoked: false,
      isIssuerTrusted: true,
    };

    const res = await fetch(`${baseUrl}/api/v1/callbacks/verifier/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 200);
    const body = await res.json() as { status: string; verdict: string };
    assert.equal(body.status, 'PROCESSED');
    assert.equal(body.verdict, 'FAILED');

    const updated = await repo.getRun(runId);
    assert.ok(updated);
    assert.equal(updated.status, 'FAILED');
    assert.equal(updated.report?.verdict, 'FAILED');
  });

  it('rejects duplicate or replay callbacks with 409 Conflict', async () => {
    const runId = 'cb-test-replay';
    await createTestRun(runId);

    const payload = {
      state: runId,
      overallStatus: 'VALID',
      isSignatureValid: true,
      isExpired: false,
      isRevoked: false,
      isIssuerTrusted: true,
    };

    // First delivery
    const firstRes = await fetch(`${baseUrl}/api/v1/callbacks/verifier/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(firstRes.status, 200);

    // Second replay attempt
    const replayRes = await fetch(`${baseUrl}/api/v1/callbacks/verifier/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(replayRes.status, 409);
    const replayBody = await replayRes.json() as { error: string };
    assert.equal(replayBody.error, 'DUPLICATE_CALLBACK');
  });

  it('rejects correlation mismatch with 400 Bad Request', async () => {
    const runId = 'cb-test-correlation';
    await createTestRun(runId);

    const payload = {
      state: 'mismatched-run-id',
      overallStatus: 'VALID',
    };

    const res = await fetch(`${baseUrl}/api/v1/callbacks/verifier/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const body = await res.json() as { error: string };
    assert.equal(body.error, 'CORRELATION_MISMATCH');
  });

  it('returns 404 for non-existent run', async () => {
    const res = await fetch(`${baseUrl}/api/v1/callbacks/verifier/does-not-exist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overallStatus: 'VALID' }),
    });

    assert.equal(res.status, 404);
  });
});
