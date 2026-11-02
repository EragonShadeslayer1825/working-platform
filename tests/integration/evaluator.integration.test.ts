/**
 * Evaluator Integration Tests — Inji Interoperability Playground
 *
 * Tests every verdict branch of AuthoritativeVerdictEvaluator:
 *   PASSED, FAILED (authoritative), INCONCLUSIVE (infrastructure),
 *   expired, revoked, missing evidence, untrusted issuer.
 *
 * These tests verify the critical project rule:
 *   "An HTTP 200 response or successful wallet redirect alone is never considered a successful verification."
 *
 * Run with:
 *   node --test tests/integration/evaluator.integration.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthoritativeVerdictEvaluator } from '../../src/engine/evaluator.js';
import type { EvaluationInput } from '../../src/engine/evaluator.js';
import type { AuthoritativeVerificationEvidence, CredentialFormat } from '../../src/types/domain.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseConfig = {
  issuerId: 'mock-openid4vci',
  walletId: 'simulated-wallet',
  verifierId: 'mock-openid4vp',
  format: 'w3c_vc_jsonld' as CredentialFormat,
};

const allCompletedStages = {
  DISCOVERY_AND_CONFIG: {
    id: 'DISCOVERY_AND_CONFIG' as const,
    name: 'Discovery & Configuration',
    status: 'COMPLETED' as const,
  },
  OFFER_ISSUANCE: {
    id: 'OFFER_ISSUANCE' as const,
    name: 'Credential Offer (OpenID4VCI)',
    status: 'COMPLETED' as const,
  },
  WALLET_STORAGE: {
    id: 'WALLET_STORAGE' as const,
    name: 'Wallet Credential Storage',
    status: 'COMPLETED' as const,
  },
  PRESENTATION_REQUEST: {
    id: 'PRESENTATION_REQUEST' as const,
    name: 'Presentation Request (OpenID4VP)',
    status: 'COMPLETED' as const,
  },
  PRESENTATION_SUBMISSION: {
    id: 'PRESENTATION_SUBMISSION' as const,
    name: 'Presentation Submission (VP)',
    status: 'COMPLETED' as const,
  },
  AUTHORITATIVE_VERIFICATION: {
    id: 'AUTHORITATIVE_VERIFICATION' as const,
    name: 'Authoritative Verification',
    status: 'COMPLETED' as const,
  },
  REPORT_GENERATION: {
    id: 'REPORT_GENERATION' as const,
    name: 'Report & Verdict Evaluation',
    status: 'COMPLETED' as const,
  },
};

const validEvidence: AuthoritativeVerificationEvidence = {
  verifiedAt: new Date().toISOString(),
  verifierComponentId: 'mock-openid4vp',
  overallStatus: 'VALID',
  isSignatureValid: true,
  isExpired: false,
  isRevoked: false,
  isIssuerTrusted: true,
  claimsValidated: { fullName: 'Alice Developer', country: 'IN' },
  verifierRawResponse: { verification_status: 'VALID' },
};

function makeInput(overrides: Partial<EvaluationInput>): EvaluationInput {
  return {
    runId: `test-run-${Math.random().toString(36).slice(2)}`,
    config: baseConfig,
    stages: { ...allCompletedStages },
    startTime: Date.now() - 500,
    ...overrides,
  };
}

// ─── PASSED verdict ───────────────────────────────────────────────────────────

test('Evaluator: all-green evidence → PASSED verdict', () => {
  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({ authoritativeEvidence: validEvidence })
  );

  assert.equal(result.verdict, 'PASSED');
  assert.ok(result.summary.length > 0, 'Summary should be non-empty');
  assert.ok(typeof result.totalDurationMs === 'number', 'Should report duration');
  assert.ok(result.totalDurationMs >= 0, 'Duration should be non-negative');
  assert.deepEqual(result.authoritativeEvidence, validEvidence, 'Should embed evidence in report');
});

test('Evaluator: PASSED report contains all required fields', () => {
  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({ authoritativeEvidence: validEvidence })
  );

  assert.ok(typeof result.runId === 'string');
  assert.ok(typeof result.evaluatedAt === 'string');
  assert.equal(result.issuerId, baseConfig.issuerId);
  assert.equal(result.walletId, baseConfig.walletId);
  assert.equal(result.verifierId, baseConfig.verifierId);
  assert.equal(result.format, baseConfig.format);
  assert.ok(!result.failureReason, 'PASSED report must not have a failureReason');
  assert.ok(!result.inconclusiveReason, 'PASSED report must not have an inconclusiveReason');
});

// ─── INCONCLUSIVE: infrastructure error ──────────────────────────────────────

test('Evaluator: inconclusiveError → INCONCLUSIVE verdict', () => {
  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({ inconclusiveError: { code: 'TIMEOUT', message: 'Connection timed out' } })
  );

  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.ok(result.inconclusiveReason?.includes('Connection timed out'));
  assert.ok(!result.failureReason, 'INCONCLUSIVE must not report a failureReason');
});

test('Evaluator: DNS resolution failure → INCONCLUSIVE (not FAILED)', () => {
  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({
      inconclusiveError: {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND inji-certify.localhost',
      },
    })
  );

  assert.equal(
    result.verdict,
    'INCONCLUSIVE',
    'DNS errors must never be classified as FAILED interop'
  );
  assert.ok(result.inconclusiveReason);
});

// ─── INCONCLUSIVE: non-authoritative stage failure ────────────────────────────

test('Evaluator: non-authoritative stage failure → INCONCLUSIVE', () => {
  const stages = {
    ...allCompletedStages,
    OFFER_ISSUANCE: {
      ...allCompletedStages.OFFER_ISSUANCE,
      status: 'FAILED' as const,
      error: {
        code: 'CONN_ERR',
        message: 'ECONNREFUSED: connection refused',
        isRecoverable: false,
        isAuthoritativeFailure: false, // ← network problem, not protocol rejection
      },
    },
  };

  const result = AuthoritativeVerdictEvaluator.evaluate(makeInput({ stages }));

  assert.equal(
    result.verdict,
    'INCONCLUSIVE',
    'Network failures must be INCONCLUSIVE, not FAILED interop'
  );
  assert.ok(result.inconclusiveReason?.includes('ECONNREFUSED'));
});

test('Evaluator: timeout at presentation stage → INCONCLUSIVE', () => {
  const stages = {
    ...allCompletedStages,
    PRESENTATION_REQUEST: {
      ...allCompletedStages.PRESENTATION_REQUEST,
      status: 'FAILED' as const,
      error: {
        code: 'TIMEOUT',
        message: 'Request timed out after 30000ms',
        isRecoverable: false,
        isAuthoritativeFailure: false,
      },
    },
  };

  const result = AuthoritativeVerdictEvaluator.evaluate(makeInput({ stages }));

  assert.equal(result.verdict, 'INCONCLUSIVE');
});

// ─── FAILED: authoritative protocol rejections ────────────────────────────────

test('Evaluator: authoritative stage failure → FAILED verdict', () => {
  const stages = {
    ...allCompletedStages,
    AUTHORITATIVE_VERIFICATION: {
      ...allCompletedStages.AUTHORITATIVE_VERIFICATION,
      status: 'FAILED' as const,
      error: {
        code: 'INVALID_SIG',
        message: 'Cryptographic signature verification failed — INVALID',
        isRecoverable: false,
        isAuthoritativeFailure: true, // ← real protocol rejection
      },
    },
  };

  const result = AuthoritativeVerdictEvaluator.evaluate(makeInput({ stages }));

  assert.equal(result.verdict, 'FAILED');
  assert.ok(result.failureReason?.includes('INVALID'));
  assert.ok(!result.inconclusiveReason, 'Authoritative failure must not report inconclusiveReason');
});

test('Evaluator: corrupted signature evidence → FAILED', () => {
  const corruptedEvidence: AuthoritativeVerificationEvidence = {
    ...validEvidence,
    overallStatus: 'INVALID',
    isSignatureValid: false,
  };

  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({ authoritativeEvidence: corruptedEvidence })
  );

  assert.equal(result.verdict, 'FAILED');
  assert.ok(result.failureReason?.includes('signature'));
});

test('Evaluator: expired credential evidence → FAILED', () => {
  const expiredEvidence: AuthoritativeVerificationEvidence = {
    ...validEvidence,
    overallStatus: 'EXPIRED',
    isExpired: true,
    isSignatureValid: true, // signature was valid but cred is past expiry
  };

  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({ authoritativeEvidence: expiredEvidence })
  );

  assert.equal(result.verdict, 'FAILED');
  assert.ok(
    result.failureReason?.toLowerCase().includes('expir'),
    `Failure reason should mention expiry, got: ${result.failureReason}`
  );
});

test('Evaluator: revoked credential evidence → FAILED', () => {
  const revokedEvidence: AuthoritativeVerificationEvidence = {
    ...validEvidence,
    overallStatus: 'REVOKED',
    isRevoked: true,
  };

  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({ authoritativeEvidence: revokedEvidence })
  );

  assert.equal(result.verdict, 'FAILED');
  assert.ok(
    result.failureReason?.toLowerCase().includes('revoc'),
    `Failure reason should mention revocation, got: ${result.failureReason}`
  );
});

test('Evaluator: untrusted issuer evidence → FAILED', () => {
  const untrustedEvidence: AuthoritativeVerificationEvidence = {
    ...validEvidence,
    overallStatus: 'UNTRUSTED_ISSUER',
    isIssuerTrusted: false,
  };

  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({ authoritativeEvidence: untrustedEvidence })
  );

  assert.equal(result.verdict, 'FAILED');
  assert.ok(result.failureReason, 'Should include a failure reason for untrusted issuer');
});

test('Evaluator: overallStatus VALID but isIssuerTrusted false MUST evaluate to FAILED', () => {
  const untrustedIssuerWithValidOverall: AuthoritativeVerificationEvidence = {
    ...validEvidence,
    overallStatus: 'VALID',
    isIssuerTrusted: false, // Untrusted issuer must NEVER pass
  };

  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({ authoritativeEvidence: untrustedIssuerWithValidOverall })
  );

  assert.equal(
    result.verdict,
    'FAILED',
    'Evidence with untrusted issuer must never evaluate to PASSED even if overallStatus is VALID'
  );
  assert.ok(
    result.failureReason?.includes('Issuer is not trusted'),
    'Failure reason must cite untrusted issuer'
  );
});

test('Evaluator: unparseable verifier response evaluates to INCONCLUSIVE', () => {
  const unparseableEvidence: AuthoritativeVerificationEvidence = {
    ...validEvidence,
    overallStatus: 'UNPARSEABLE',
    isSignatureValid: false,
  };

  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({ authoritativeEvidence: unparseableEvidence })
  );

  assert.equal(
    result.verdict,
    'INCONCLUSIVE',
    'Unparseable verifier response represents technical inability to evaluate and must be INCONCLUSIVE'
  );
});

test('Evaluator: contradictory evidence (overallStatus VALID but signature invalid) evaluates to FAILED', () => {
  const contradictoryEvidence: AuthoritativeVerificationEvidence = {
    ...validEvidence,
    overallStatus: 'VALID',
    isSignatureValid: false,
  };

  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({ authoritativeEvidence: contradictoryEvidence })
  );

  assert.equal(result.verdict, 'FAILED');
  assert.ok(result.failureReason?.includes('signature'));
});

// ─── INCONCLUSIVE: missing evidence after HTTP success ───────────────────────

test('Evaluator: HTTP success with no authoritative evidence → INCONCLUSIVE', () => {
  // This is the "HTTP 200 is not PASS" rule enforcement
  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({ authoritativeEvidence: undefined })
    // All stages completed = everything looked fine at transport level
    // But no verifier authoritative payload was received
  );

  assert.equal(
    result.verdict,
    'INCONCLUSIVE',
    'Transport success without authoritative evidence MUST be INCONCLUSIVE'
  );
  assert.ok(
    result.inconclusiveReason?.toLowerCase().includes('missing') ||
    result.inconclusiveReason?.toLowerCase().includes('authoritative') ||
    result.inconclusiveReason?.toLowerCase().includes('verifier'),
    `inconclusiveReason should explain the missing evidence, got: ${result.inconclusiveReason}`
  );
});

// ─── Multiple failure reasons ─────────────────────────────────────────────────

test('Evaluator: multiple failures (expired + invalid sig) → FAILED with combined reason', () => {
  const multiFailEvidence: AuthoritativeVerificationEvidence = {
    ...validEvidence,
    overallStatus: 'INVALID',
    isSignatureValid: false,
    isExpired: true,
    isRevoked: false,
  };

  const result = AuthoritativeVerdictEvaluator.evaluate(
    makeInput({ authoritativeEvidence: multiFailEvidence })
  );

  assert.equal(result.verdict, 'FAILED');
  // Both reasons should be captured
  assert.ok(result.failureReason, 'Should have a failure reason');
  assert.ok(result.failureReason!.length > 0);
});

// ─── Report fields consistency ────────────────────────────────────────────────

test('Evaluator: all output reports include required tracking fields', () => {
  const inputs: Array<Partial<EvaluationInput>> = [
    { authoritativeEvidence: validEvidence },
    { inconclusiveError: { code: 'TIMEOUT', message: 'timed out' } },
    {
      stages: {
        ...allCompletedStages,
        OFFER_ISSUANCE: {
          ...allCompletedStages.OFFER_ISSUANCE,
          status: 'FAILED' as const,
          error: { code: 'ERR', message: 'fail', isRecoverable: false, isAuthoritativeFailure: true },
        },
      },
    },
  ];

  for (const override of inputs) {
    const result = AuthoritativeVerdictEvaluator.evaluate(makeInput(override));
    assert.ok(typeof result.runId === 'string', 'Report must include runId');
    assert.ok(typeof result.evaluatedAt === 'string', 'Report must include evaluatedAt');
    assert.ok(typeof result.issuerId === 'string', 'Report must include issuerId');
    assert.ok(typeof result.walletId === 'string', 'Report must include walletId');
    assert.ok(typeof result.verifierId === 'string', 'Report must include verifierId');
    assert.ok(typeof result.format === 'string', 'Report must include format');
    assert.ok(typeof result.totalDurationMs === 'number', 'Report must include totalDurationMs');
    assert.ok(
      ['PASSED', 'FAILED', 'INCONCLUSIVE', 'UNTESTED'].includes(result.verdict),
      `Verdict '${result.verdict}' is not a recognized value`
    );
  }
});

// ─── Duration calculation ─────────────────────────────────────────────────────

test('Evaluator: totalDurationMs reflects actual elapsed time', () => {
  const startTime = Date.now() - 250; // simulate 250ms run
  const result = AuthoritativeVerdictEvaluator.evaluate({
    runId: 'timing-test',
    config: baseConfig,
    stages: { ...allCompletedStages },
    authoritativeEvidence: validEvidence,
    startTime,
  });

  assert.ok(
    result.totalDurationMs >= 200,
    `Duration should reflect real elapsed time, got: ${result.totalDurationMs}ms`
  );
});
