/**
 * API Integration Tests — Inji Interoperability Playground
 *
 * Spins up the Express orchestration backend on a random port and exercises
 * the full HTTP API surface. Uses only the mock adapter stack so no live
 * Inji services are required.
 *
 * Run with:
 *   node --test tests/integration/api.integration.test.ts
 *   (requires tsx for TypeScript transform — see package.json test script)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../src/app.js';

// ─── Server bootstrap ───────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

test.before(
  () =>
    new Promise<void>((resolve, reject) => {
      const app = createApp();
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
      server.on('error', reject);
    })
);

test.after(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    })
);

// ─── Helper ──────────────────────────────────────────────────────────────────

async function pollRunUntilDone(
  runId: string,
  maxWaitMs = 3000,
  intervalMs = 150
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
    const body = (await res.json()) as Record<string, unknown>;
    const status = body.status as string;
    if (status === 'COMPLETED' || status === 'FAILED' || status === 'ABORTED') {
      return body;
    }
  }
  throw new Error(`Run ${runId} did not finish within ${maxWaitMs}ms`);
}

// ─── Health ──────────────────────────────────────────────────────────────────

test('GET /health returns HEALTHY status', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200, 'Should return HTTP 200');

  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.status, 'HEALTHY', 'Service status should be HEALTHY');
  assert.ok(typeof body.timestamp === 'string', 'Should include a timestamp');
  assert.ok(typeof body.version === 'string', 'Should include a version string');
});

// ─── Component Registry ──────────────────────────────────────────────────────

test('GET /api/v1/registry/components returns all component categories', async () => {
  const res = await fetch(`${baseUrl}/api/v1/registry/components`);
  assert.equal(res.status, 200);

  const body = (await res.json()) as Record<string, unknown[]>;
  assert.ok(Array.isArray(body.issuers), 'issuers should be an array');
  assert.ok(Array.isArray(body.wallets), 'wallets should be an array');
  assert.ok(Array.isArray(body.verifiers), 'verifiers should be an array');
  assert.ok(Array.isArray(body.formats), 'formats should be an array');

  assert.ok((body.issuers as unknown[]).length >= 2, 'Should have at least 2 issuers (1 real + 1 mock)');
  assert.ok((body.wallets as unknown[]).length >= 2, 'Should have at least 2 wallets');
  assert.ok((body.verifiers as unknown[]).length >= 2, 'Should have at least 2 verifiers');
  assert.ok((body.formats as unknown[]).length >= 2, 'Should have at least 2 credential formats');
});

test('GET /api/v1/registry/components includes expected component IDs', async () => {
  const res = await fetch(`${baseUrl}/api/v1/registry/components`);
  const body = (await res.json()) as {
    issuers: Array<{ id: string }>;
    wallets: Array<{ id: string }>;
    verifiers: Array<{ id: string }>;
  };

  const issuerIds = body.issuers.map((i) => i.id);
  const walletIds = body.wallets.map((w) => w.id);
  const verifierIds = body.verifiers.map((v) => v.id);

  assert.ok(issuerIds.includes('mock-openid4vci'), 'Should include mock issuer');
  assert.ok(issuerIds.includes('inji-certify'), 'Should include Inji Certify issuer');
  assert.ok(walletIds.includes('simulated-wallet'), 'Should include simulated wallet');
  assert.ok(walletIds.includes('inji-web'), 'Should include Inji Web wallet');
  assert.ok(verifierIds.includes('mock-openid4vp'), 'Should include mock verifier');
  assert.ok(verifierIds.includes('inji-verify'), 'Should include Inji Verify verifier');
});

test('GET /api/v1/registry/matrix returns compatibility matrix cells', async () => {
  const res = await fetch(`${baseUrl}/api/v1/registry/matrix`);
  assert.equal(res.status, 200);

  const body = (await res.json()) as { matrix: Array<Record<string, unknown>> };
  assert.ok(Array.isArray(body.matrix), 'matrix should be an array');
  assert.ok(body.matrix.length > 0, 'Should have at least one matrix cell');

  // Validate cell shape
  const firstCell = body.matrix[0];
  assert.ok(typeof firstCell.issuerId === 'string', 'Cell should have issuerId');
  assert.ok(typeof firstCell.walletId === 'string', 'Cell should have walletId');
  assert.ok(typeof firstCell.verifierId === 'string', 'Cell should have verifierId');
  assert.ok(typeof firstCell.format === 'string', 'Cell should have format');
  assert.ok(
    ['SUPPORTED', 'PENDING_INTEGRATION', 'UNSUPPORTED'].includes(firstCell.status as string),
    'Cell status should be a known value'
  );
});

test('GET /api/v1/registry/matrix includes SUPPORTED cells for mock stack', async () => {
  const res = await fetch(`${baseUrl}/api/v1/registry/matrix`);
  const body = (await res.json()) as {
    matrix: Array<{ issuerId: string; walletId: string; verifierId: string; status: string }>;
  };

  const mockCell = body.matrix.find(
    (c) =>
      c.issuerId === 'mock-openid4vci' &&
      c.walletId === 'simulated-wallet' &&
      c.verifierId === 'mock-openid4vp'
  );
  assert.ok(mockCell, 'Should have a cell for the full mock stack');
  assert.equal(mockCell?.status, 'SUPPORTED', 'Full mock stack should be SUPPORTED');
});

// ─── Run Validation ───────────────────────────────────────────────────────────

test('POST /api/v1/runs returns 400 when required fields are missing', async () => {
  const res = await fetch(`${baseUrl}/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issuerId: 'mock-openid4vci' }), // missing walletId, verifierId, format
  });

  assert.equal(res.status, 400, 'Should return HTTP 400 for validation error');
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error?.code, 'VALIDATION_ERROR', 'Error code should be VALIDATION_ERROR');
});

test('POST /api/v1/runs returns 400 for invalid credential format', async () => {
  const res = await fetch(`${baseUrl}/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issuerId: 'mock-openid4vci',
      walletId: 'simulated-wallet',
      verifierId: 'mock-openid4vp',
      format: 'not_a_real_format', // invalid enum value
    }),
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error?.code, 'VALIDATION_ERROR');
});

// ─── Mock Baseline Flow ───────────────────────────────────────────────────────

test('Mock baseline (w3c_vc_jsonld): run reaches COMPLETED with PASSED verdict', async () => {
  const createRes = await fetch(`${baseUrl}/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issuerId: 'mock-openid4vci',
      walletId: 'simulated-wallet',
      verifierId: 'mock-openid4vp',
      format: 'w3c_vc_jsonld',
    }),
  });

  assert.equal(createRes.status, 201, 'Run creation should return HTTP 201');
  const created = (await createRes.json()) as { runId: string; status: string };
  assert.ok(typeof created.runId === 'string', 'Should return a runId');
  assert.equal(created.status, 'INITIALIZING', 'Initial status should be INITIALIZING');

  const run = await pollRunUntilDone(created.runId);

  assert.equal(run.status, 'COMPLETED', 'Run should reach COMPLETED status');
  const report = run.report as Record<string, unknown>;
  assert.equal(report?.verdict, 'PASSED', 'Verdict should be PASSED');
  assert.ok(typeof report?.totalDurationMs === 'number', 'Report should include duration');
  assert.ok(typeof report?.summary === 'string', 'Report should include a summary');
  assert.ok(typeof report?.evaluatedAt === 'string', 'Report should include evaluatedAt timestamp');
});

test('Mock baseline (sd_jwt_vc): run reaches COMPLETED with PASSED verdict', async () => {
  const createRes = await fetch(`${baseUrl}/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issuerId: 'mock-openid4vci',
      walletId: 'simulated-wallet',
      verifierId: 'mock-openid4vp',
      format: 'sd_jwt_vc',
    }),
  });

  assert.equal(createRes.status, 201);
  const { runId } = (await createRes.json()) as { runId: string };
  const run = await pollRunUntilDone(runId);

  assert.equal(run.status, 'COMPLETED');
  assert.equal((run.report as Record<string, unknown>)?.verdict, 'PASSED');
});

// ─── Verdict Taxonomy ─────────────────────────────────────────────────────────

test('Corrupted signature: run reaches FAILED with FAILED verdict', async () => {
  const createRes = await fetch(`${baseUrl}/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issuerId: 'mock-openid4vci',
      walletId: 'simulated-wallet',
      verifierId: 'mock-openid4vp',
      format: 'w3c_vc_jsonld',
      mockTamper: { corruptSignature: true },
    }),
  });

  assert.equal(createRes.status, 201);
  const { runId } = (await createRes.json()) as { runId: string };
  const run = await pollRunUntilDone(runId);

  assert.equal(run.status, 'FAILED', 'Run should reach FAILED status');
  const report = run.report as Record<string, unknown>;
  assert.equal(report?.verdict, 'FAILED', 'Verdict should be FAILED (not INCONCLUSIVE)');
  assert.ok(typeof report?.failureReason === 'string', 'Should include a failure reason');
  assert.ok(
    (report?.failureReason as string).includes('INVALID'),
    'Failure reason should mention INVALID signature'
  );
});

test('Expired credential: run reaches FAILED with expiry failure reason', async () => {
  const createRes = await fetch(`${baseUrl}/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issuerId: 'mock-openid4vci',
      walletId: 'simulated-wallet',
      verifierId: 'mock-openid4vp',
      format: 'w3c_vc_jsonld',
      mockTamper: { forceExpired: true },
    }),
  });

  assert.equal(createRes.status, 201);
  const { runId } = (await createRes.json()) as { runId: string };
  const run = await pollRunUntilDone(runId);

  assert.equal(run.status, 'FAILED');
  const report = run.report as Record<string, unknown>;
  assert.equal(report?.verdict, 'FAILED');
  assert.ok(typeof report?.failureReason === 'string');
  assert.ok(
    (report?.failureReason as string).toLowerCase().includes('expir'),
    'Failure reason should mention expiry'
  );
});

test('Unreachable issuer (inji-certify offline): run reaches INCONCLUSIVE verdict', async () => {
  const createRes = await fetch(`${baseUrl}/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issuerId: 'inji-certify', // real adapter → connect error since no service is running
      walletId: 'simulated-wallet',
      verifierId: 'mock-openid4vp',
      format: 'w3c_vc_jsonld',
    }),
  });

  assert.equal(createRes.status, 201);
  const { runId } = (await createRes.json()) as { runId: string };
  const run = await pollRunUntilDone(runId, 5000);

  const report = run.report as Record<string, unknown>;
  assert.equal(
    report?.verdict,
    'INCONCLUSIVE',
    'Infrastructure errors must never be classified as FAILED interop'
  );
  assert.ok(
    typeof report?.inconclusiveReason === 'string',
    'Should include an inconclusiveReason'
  );
  assert.ok(
    (report?.inconclusiveReason as string).length > 0,
    'inconclusiveReason should not be empty'
  );
});

// ─── Stage Tracking ──────────────────────────────────────────────────────────

test('Completed run includes all 7 stage results', async () => {
  const createRes = await fetch(`${baseUrl}/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issuerId: 'mock-openid4vci',
      walletId: 'simulated-wallet',
      verifierId: 'mock-openid4vp',
      format: 'w3c_vc_jsonld',
    }),
  });

  const { runId } = (await createRes.json()) as { runId: string };
  const run = await pollRunUntilDone(runId);

  const stages = run.stages as Record<string, Record<string, unknown>>;
  const expectedStages = [
    'DISCOVERY_AND_CONFIG',
    'OFFER_ISSUANCE',
    'WALLET_STORAGE',
    'PRESENTATION_REQUEST',
    'PRESENTATION_SUBMISSION',
    'AUTHORITATIVE_VERIFICATION',
    'REPORT_GENERATION',
  ];

  for (const stageId of expectedStages) {
    assert.ok(stages[stageId], `Stage ${stageId} should exist in run result`);
    assert.equal(
      stages[stageId].status,
      'COMPLETED',
      `Stage ${stageId} should be COMPLETED for PASSED run`
    );
  }
});

// ─── Protocol Events ─────────────────────────────────────────────────────────

test('GET /api/v1/runs/:id/events returns sanitized protocol events', async () => {
  const createRes = await fetch(`${baseUrl}/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issuerId: 'mock-openid4vci',
      walletId: 'simulated-wallet',
      verifierId: 'mock-openid4vp',
      format: 'w3c_vc_jsonld',
    }),
  });

  const { runId } = (await createRes.json()) as { runId: string };
  await pollRunUntilDone(runId);

  const eventsRes = await fetch(`${baseUrl}/api/v1/runs/${runId}/events`);
  assert.equal(eventsRes.status, 200);

  const body = (await eventsRes.json()) as {
    runId: string;
    totalEvents: number;
    events: Array<Record<string, unknown>>;
  };

  assert.equal(body.runId, runId, 'Events response should reference the correct runId');
  assert.ok(body.totalEvents >= 5, 'Should have at least 5 protocol events');
  assert.ok(Array.isArray(body.events), 'events should be an array');

  // Verify event shape
  const firstEvent = body.events[0];
  assert.ok(typeof firstEvent.eventId === 'string', 'Event should have eventId');
  assert.ok(typeof firstEvent.timestamp === 'string', 'Event should have timestamp');
  assert.ok(typeof firstEvent.stage === 'string', 'Event should have stage');
  assert.ok(typeof firstEvent.action === 'string', 'Event should have action');
});

test('Protocol events contain no raw sensitive data (sanitization audit)', async () => {
  const createRes = await fetch(`${baseUrl}/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issuerId: 'mock-openid4vci',
      walletId: 'simulated-wallet',
      verifierId: 'mock-openid4vp',
      format: 'w3c_vc_jsonld',
    }),
  });

  const { runId } = (await createRes.json()) as { runId: string };
  await pollRunUntilDone(runId);

  const eventsRes = await fetch(`${baseUrl}/api/v1/runs/${runId}/events`);
  const eventsBody = await eventsRes.json();
  const eventStr = JSON.stringify(eventsBody);

  // These patterns must never appear in sanitized event output
  assert.ok(!eventStr.includes('BEGIN PRIVATE KEY'), 'Private key content must not appear in events');
  assert.ok(!eventStr.includes('BEGIN RSA PRIVATE'), 'RSA key content must not appear in events');
  assert.ok(!eventStr.match(/Bearer [a-zA-Z0-9_\-.]{10,}/), 'Raw Bearer tokens must be redacted');
});

// ─── Run History ─────────────────────────────────────────────────────────────

test('GET /api/v1/runs returns run history list', async () => {
  const res = await fetch(`${baseUrl}/api/v1/runs`);
  assert.equal(res.status, 200);

  const body = (await res.json()) as { total: number; runs: unknown[] };
  assert.ok(typeof body.total === 'number', 'Should include total count');
  assert.ok(Array.isArray(body.runs), 'runs should be an array');
});

test('GET /api/v1/runs includes recently created run in history', async () => {
  // Create a run first
  const createRes = await fetch(`${baseUrl}/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issuerId: 'mock-openid4vci',
      walletId: 'simulated-wallet',
      verifierId: 'mock-openid4vp',
      format: 'w3c_vc_jsonld',
    }),
  });

  const { runId } = (await createRes.json()) as { runId: string };

  const listRes = await fetch(`${baseUrl}/api/v1/runs`);
  const listBody = (await listRes.json()) as { runs: Array<{ runId: string }> };

  const found = listBody.runs.find((r) => r.runId === runId);
  assert.ok(found, 'Recently created run should appear in history');
});

// ─── Error Handling ───────────────────────────────────────────────────────────

test('GET /api/v1/runs/:id returns 404 for non-existent run', async () => {
  const res = await fetch(`${baseUrl}/api/v1/runs/run-does-not-exist-99999`);
  assert.equal(res.status, 404, 'Non-existent run should return HTTP 404');

  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error?.code, 'RUN_NOT_FOUND', 'Error code should be RUN_NOT_FOUND');
});

test('GET /api/v1/runs/:id/events returns 404 for non-existent run', async () => {
  const res = await fetch(`${baseUrl}/api/v1/runs/run-does-not-exist-events/events`);
  assert.equal(res.status, 404);

  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error?.code, 'RUN_NOT_FOUND');
});
