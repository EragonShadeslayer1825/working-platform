/**
 * Playground API Integration Tests
 *
 * Verifies the frontend integration routes defined in API_Contract.md and
 * consumed by the React/Next.js UI (lib/playground-api.ts).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../src/app.js';

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

async function pollPlaygroundRunUntilDone(
  runId: string,
  maxWaitMs = 3000,
  intervalMs = 100
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(`${baseUrl}/api/runs/${runId}`);
    const body = (await res.json()) as Record<string, unknown>;
    const state = body.state as string;
    if (state === 'PASS' || state === 'FAILED' || state === 'INVALID' || state === 'EXPIRED' || state === 'ERROR') {
      return body;
    }
  }
  const lastRes = await fetch(`${baseUrl}/api/runs/${runId}`);
  return (await lastRes.json()) as Record<string, unknown>;
}

test('POST /api/runs creates a run and returns initial RunRecord', async () => {
  const res = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      environment: 'collab',
      modules: {
        issuer: { id: 'mock-issuer', version: 'simulated' },
        wallet: { id: 'inji-web', version: '0.10.0' },
        verifier: { id: 'mock-verifier', version: 'simulated' },
      },
      credentialFormat: 'jsonld-vc-1.1',
    }),
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as Record<string, unknown>;
  assert.ok(body.runId);
  assert.equal(body.environment, 'collab');
  assert.equal(body.credentialFormat, 'jsonld-vc-1.1');
});

test('GET /api/runs/:runId polls and completes with authoritative PASS verdict', async () => {
  const createRes = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      environment: 'collab',
      modules: {
        issuer: { id: 'mock-issuer', version: 'simulated' },
        wallet: { id: 'simulated-wallet', version: '1.0.0' },
        verifier: { id: 'mock-verifier', version: 'simulated' },
      },
      credentialFormat: 'jsonld-vc-1.1',
    }),
  });

  const created = (await createRes.json()) as { runId: string };
  const finished = await pollPlaygroundRunUntilDone(created.runId);

  assert.equal(finished.verificationState, 'PASS');
  assert.equal(finished.state, 'PASS');

  const vResult = finished.verificationResult as {
    state: string;
    credentialType: string;
    expectedCredentialType: string;
  };
  assert.ok(vResult);
  assert.equal(vResult.state, 'PASS');
  assert.equal(vResult.credentialType, vResult.expectedCredentialType);

  const events = finished.events as Array<Record<string, unknown>>;
  assert.ok(events && events.length > 0);
  const firstEvent = events[0];
  assert.ok(firstEvent.step);
  assert.ok(firstEvent.operation);
  assert.ok(firstEvent.actor);
});

test('POST /api/runs/:runId/issuance/start and presentation/start return current run state', async () => {
  const createRes = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      environment: 'local',
      modules: {
        issuer: { id: 'mock-issuer', version: 'simulated' },
        wallet: { id: 'simulated-wallet', version: '1.0.0' },
        verifier: { id: 'mock-verifier', version: 'simulated' },
      },
      credentialFormat: 'sd-jwt-vc',
    }),
  });
  const created = (await createRes.json()) as { runId: string };

  const issuanceRes = await fetch(`${baseUrl}/api/runs/${created.runId}/issuance/start`, {
    method: 'POST',
  });
  assert.equal(issuanceRes.status, 200);
  const issuanceBody = (await issuanceRes.json()) as Record<string, unknown>;
  assert.equal(issuanceBody.runId, created.runId);

  const presRes = await fetch(`${baseUrl}/api/runs/${created.runId}/presentation/start`, {
    method: 'POST',
  });
  assert.equal(presRes.status, 200);
  const presBody = (await presRes.json()) as Record<string, unknown>;
  assert.equal(presBody.runId, created.runId);
});

test('GET /api/runs returns array of historical runs', async () => {
  const res = await fetch(`${baseUrl}/api/runs`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(body));
  assert.ok(body.length > 0);
});

test('GET /api/runs/:runId returns 404 for unknown run', async () => {
  const res = await fetch(`${baseUrl}/api/runs/non-existent-uuid`);
  assert.equal(res.status, 404);
  const body = (await res.json()) as Record<string, unknown>;
  assert.ok(body.message);
});
