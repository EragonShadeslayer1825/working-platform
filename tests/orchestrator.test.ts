import assert from 'node:assert/strict';
import test from 'node:test';
import { ComponentRegistry } from '../src/registry/component-registry.js';
import { EventSanitizer } from '../src/engine/event-bus.js';
import { InMemoryTestRunRepository } from '../src/storage/in-memory-repo.js';
import { TestOrchestrationEngine } from '../src/engine/test-runner.js';

test('ComponentRegistry should expose issuers, wallets, verifiers, and formats', () => {
  const issuers = ComponentRegistry.getIssuers();
  const wallets = ComponentRegistry.getWallets();
  const verifiers = ComponentRegistry.getVerifiers();
  const formats = ComponentRegistry.getFormats();
  const matrix = ComponentRegistry.getCompatibilityMatrix();

  assert.ok(issuers.length >= 2, 'Should have at least 2 issuers');
  assert.ok(wallets.length >= 2, 'Should have at least 2 wallets');
  assert.ok(verifiers.length >= 2, 'Should have at least 2 verifiers');
  assert.ok(formats.length >= 2, 'Should have at least 2 credential formats');
  assert.ok(matrix.length > 0, 'Should have matrix cells');
});

test('EventSanitizer should redact tokens, secrets, and private keys', () => {
  const input = {
    authorization: 'Bearer secret_token_xyz',
    user_pin: '1234',
    client_secret: 'top_secret_val',
    nested: {
      access_token: 'jwt.token.abc',
      safeField: 'hello_world',
    },
  };

  const sanitized = EventSanitizer.sanitize(input) as Record<string, unknown>;

  assert.equal(sanitized.authorization, '[REDACTED_SENSITIVE_DATA]');
  assert.equal(sanitized.user_pin, '[REDACTED_SENSITIVE_DATA]');
  assert.equal(sanitized.client_secret, '[REDACTED_SENSITIVE_DATA]');
  const nested = sanitized.nested as Record<string, unknown>;
  assert.equal(nested.access_token, '[REDACTED_SENSITIVE_DATA]');
  assert.equal(nested.safeField, 'hello_world');
});

test('TestOrchestrationEngine should run end-to-end baseline and yield PASSED', async () => {
  const repo = new InMemoryTestRunRepository();
  const engine = new TestOrchestrationEngine(repo);

  const initial = await engine.createAndStartRun({
    issuerId: 'mock-openid4vci',
    walletId: 'simulated-wallet',
    verifierId: 'mock-openid4vp',
    format: 'w3c_vc_jsonld',
  });

  assert.equal(initial.status, 'INITIALIZING');

  // Wait for async pipeline execution
  await new Promise((resolve) => setTimeout(resolve, 250));

  const completedRun = await repo.getRun(initial.runId);
  assert.ok(completedRun, 'Run should exist in repository');
  assert.equal(completedRun.status, 'COMPLETED');
  assert.equal(completedRun.report?.verdict, 'PASSED');
  assert.equal(completedRun.stages.AUTHORITATIVE_VERIFICATION.status, 'COMPLETED');
  assert.ok(completedRun.events.length >= 5, 'Should have recorded protocol events');
});

test('TestOrchestrationEngine should evaluate corrupted signature as FAILED', async () => {
  const repo = new InMemoryTestRunRepository();
  const engine = new TestOrchestrationEngine(repo);

  const initial = await engine.createAndStartRun({
    issuerId: 'mock-openid4vci',
    walletId: 'simulated-wallet',
    verifierId: 'mock-openid4vp',
    format: 'w3c_vc_jsonld',
    mockTamper: {
      corruptSignature: true,
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 250));

  const completedRun = await repo.getRun(initial.runId);
  assert.ok(completedRun);
  assert.equal(completedRun.status, 'FAILED');
  assert.equal(completedRun.report?.verdict, 'FAILED');
  assert.ok(completedRun.report?.failureReason?.includes('INVALID'));
});

test('TestOrchestrationEngine should mark unreachable service as INCONCLUSIVE', async () => {
  const repo = new InMemoryTestRunRepository();
  const engine = new TestOrchestrationEngine(repo);

  const initial = await engine.createAndStartRun({
    issuerId: 'inji-certify', // Not running on localhost
    walletId: 'simulated-wallet',
    verifierId: 'mock-openid4vp',
    format: 'w3c_vc_jsonld',
  });

  await new Promise((resolve) => setTimeout(resolve, 250));

  const completedRun = await repo.getRun(initial.runId);
  assert.ok(completedRun);
  assert.equal(completedRun.report?.verdict, 'INCONCLUSIVE');
  assert.ok(completedRun.report?.inconclusiveReason);
});
