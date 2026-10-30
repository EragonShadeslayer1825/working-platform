import {
  AuthoritativeVerificationEvidence,
  CredentialFormat,
  ProofType,
  StageResult,
  TestReport,
  TestRunConfig,
  Verdict,
} from '../types/domain.js';

export interface EvaluationInput {
  runId: string;
  config: TestRunConfig;
  stages: Record<string, StageResult>;
  authoritativeEvidence?: AuthoritativeVerificationEvidence;
  inconclusiveError?: {
    code: string;
    message: string;
  };
  startTime: number;
}

export class AuthoritativeVerdictEvaluator {
  /**
   * Evaluates the outcome based strictly on authoritative cryptographic evidence,
   * distinguishing true protocol/credential failures from transport/timeout inconclusive events.
   */
  public static evaluate(input: EvaluationInput): TestReport {
    const { runId, config, stages, authoritativeEvidence, inconclusiveError, startTime } = input;
    const totalDurationMs = Date.now() - startTime;
    const nowIso = new Date().toISOString();

    // 1. Check if the test was aborted or timed out due to environmental/network conditions
    if (inconclusiveError) {
      return {
        runId,
        verdict: 'INCONCLUSIVE',
        summary: `Test run was inconclusive due to an infrastructure or timeout event: ${inconclusiveError.message}`,
        evaluatedAt: nowIso,
        issuerId: config.issuerId,
        walletId: config.walletId,
        verifierId: config.verifierId,
        format: config.format,
        proofType: config.proofType,
        inconclusiveReason: inconclusiveError.message,
        totalDurationMs,
      };
    }

    // 2. Check for stage-level non-authoritative interruptions
    const failedStageEntry = Object.entries(stages).find(
      ([, res]) => res.status === 'FAILED'
    );

    if (failedStageEntry) {
      const [stageName, stageRes] = failedStageEntry;
      const error = stageRes.error;

      // If the error is NOT marked as an authoritative protocol failure (e.g., DNS error, timeout, offline component)
      if (error && !error.isAuthoritativeFailure) {
        return {
          runId,
          verdict: 'INCONCLUSIVE',
          summary: `Stage ${stageName} aborted prematurely due to environment/communication problem: ${error.message}`,
          evaluatedAt: nowIso,
          issuerId: config.issuerId,
          walletId: config.walletId,
          verifierId: config.verifierId,
          format: config.format,
          proofType: config.proofType,
          inconclusiveReason: `Stage ${stageName} failed with non-authoritative error: ${error.message}`,
          totalDurationMs,
        };
      }

      // If it IS an authoritative failure (e.g. issuer rejected format, wallet rejected signature schema)
      return {
        runId,
        verdict: 'FAILED',
        summary: `Interop failure at stage ${stageName}: ${error?.message || 'Protocol rejection'}`,
        evaluatedAt: nowIso,
        issuerId: config.issuerId,
        walletId: config.walletId,
        verifierId: config.verifierId,
        format: config.format,
        proofType: config.proofType,
        failureReason: error?.message || 'Stage execution failed',
        totalDurationMs,
      };
    }

    // 3. Rule: Authoritative verification must be provided by the actual verifier
    if (!authoritativeEvidence) {
      return {
        runId,
        verdict: 'INCONCLUSIVE',
        summary: 'Submission succeeded over HTTP, but no authoritative verification response was received from the verifier.',
        evaluatedAt: nowIso,
        issuerId: config.issuerId,
        walletId: config.walletId,
        verifierId: config.verifierId,
        format: config.format,
        proofType: config.proofType,
        inconclusiveReason: 'Missing verifier authoritative evaluation payload.',
        totalDurationMs,
      };
    }

    // 4. Scrutinize the cryptographic and policy checks in authoritative evidence
    if (authoritativeEvidence.overallStatus === 'VALID' && authoritativeEvidence.isSignatureValid && !authoritativeEvidence.isExpired && !authoritativeEvidence.isRevoked) {
      return {
        runId,
        verdict: 'PASSED',
        summary: `End-to-end verification succeeded. Verifier confirmed cryptographically valid signature, active status, and schema compliance for format ${config.format}.`,
        evaluatedAt: nowIso,
        issuerId: config.issuerId,
        walletId: config.walletId,
        verifierId: config.verifierId,
        format: config.format,
        proofType: config.proofType,
        authoritativeEvidence,
        totalDurationMs,
      };
    }

    // 5. Verification failure reasons
    const reasons: string[] = [];
    if (!authoritativeEvidence.isSignatureValid) reasons.push('Invalid cryptographic signature');
    if (authoritativeEvidence.isExpired) reasons.push('Credential has expired');
    if (authoritativeEvidence.isRevoked) reasons.push('Credential revocation check failed');
    if (!authoritativeEvidence.isIssuerTrusted) reasons.push('Issuer DID / certificate not trusted by verifier');
    if (authoritativeEvidence.overallStatus !== 'VALID') reasons.push(`Verifier status: ${authoritativeEvidence.overallStatus}`);

    return {
      runId,
      verdict: 'FAILED',
      summary: `Verification rejected by verifier: ${reasons.join('; ')}`,
      evaluatedAt: nowIso,
      issuerId: config.issuerId,
      walletId: config.walletId,
      verifierId: config.verifierId,
      format: config.format,
      proofType: config.proofType,
      authoritativeEvidence,
      failureReason: reasons.join('; '),
      totalDurationMs,
    };
  }
}
