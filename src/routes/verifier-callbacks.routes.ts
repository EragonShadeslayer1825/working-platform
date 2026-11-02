import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ITestRunRepository } from '../storage/repository.js';
import { ProtocolEventBus } from '../engine/event-bus.js';
import { AuthoritativeVerdictEvaluator } from '../engine/evaluator.js';
import { AuthoritativeVerificationEvidence, TestReport, StageResult } from '../types/domain.js';

export const VerifierCallbackPayloadSchema = z.object({
  state: z.string().min(1).optional(),
  transactionId: z.string().min(1).optional(),
  txnId: z.string().min(1).optional(),
  verificationStatus: z.string().optional(),
  status: z.string().optional(),
  overallStatus: z.enum(['VALID', 'INVALID', 'EXPIRED', 'REVOKED', 'UNTRUSTED_ISSUER', 'UNPARSEABLE']).optional(),
  isSignatureValid: z.boolean().optional(),
  isExpired: z.boolean().optional(),
  isRevoked: z.boolean().optional(),
  isIssuerTrusted: z.boolean().optional(),
  credentialType: z.string().optional(),
  claims: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  nonce: z.string().optional(),
}).passthrough();

export type VerifierCallbackPayload = z.infer<typeof VerifierCallbackPayloadSchema>;

export function createCallbacksRouter(repo: ITestRunRepository): Router {
  const router = Router();

  /**
   * POST /api/v1/callbacks/verifier/:runId
   * Webhook callback receiver for Inji Verify or external verifiers.
   */
  router.post('/verifier/:runId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { runId } = req.params;

      // 1. Secret authentication if configured
      const configuredSecret = process.env.CALLBACK_AUTH_SECRET;
      if (configuredSecret) {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'] || req.headers['x-callback-token'];
        const isAuthorized =
          (authHeader && authHeader === `Bearer ${configuredSecret}`) ||
          apiKey === configuredSecret;

        if (!isAuthorized) {
          return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Invalid or missing callback authorization credential',
          });
        }
      }

      // 2. Validate payload schema
      const parseResult = VerifierCallbackPayloadSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'INVALID_PAYLOAD',
          message: 'Callback payload failed schema validation',
          details: parseResult.error.issues,
        });
      }
      const payload = parseResult.data;

      // 3. Verify target run existence
      const run = await repo.getRun(runId);
      if (!run) {
        return res.status(404).json({ error: 'RUN_NOT_FOUND', message: `Run ${runId} does not exist` });
      }

      // 4. Verify correlation state if provided
      if (payload.state && payload.state !== runId) {
        return res.status(400).json({
          error: 'CORRELATION_MISMATCH',
          message: `Callback state '${payload.state}' does not match expected run ID '${runId}'`,
        });
      }

      // 5. Duplicate and replay prevention
      const existingCallbackEvent = run.events.find(
        (e) => e.action === 'VERIFIER_WEBHOOK_RECEIVED' || e.action === 'AUTHORITATIVE_VERIFICATION_RECORDED'
      );
      if (existingCallbackEvent || run.status === 'COMPLETED' || run.status === 'FAILED') {
        return res.status(409).json({
          error: 'DUPLICATE_CALLBACK',
          message: `Authoritative callback has already been processed for run ${runId}`,
        });
      }

      // 6. Map and evaluate authoritative evidence
      let overallStatus: 'VALID' | 'INVALID' | 'EXPIRED' | 'REVOKED' | 'UNTRUSTED_ISSUER' | 'UNPARSEABLE' = 'UNPARSEABLE';
      const rawStatusStr = (payload.overallStatus || payload.status || payload.verificationStatus || '').toUpperCase();

      if (rawStatusStr === 'VALID' || rawStatusStr === 'SUCCESS') {
        overallStatus = 'VALID';
      } else if (rawStatusStr === 'EXPIRED') {
        overallStatus = 'EXPIRED';
      } else if (rawStatusStr === 'REVOKED') {
        overallStatus = 'REVOKED';
      } else if (rawStatusStr === 'UNTRUSTED_ISSUER') {
        overallStatus = 'UNTRUSTED_ISSUER';
      } else if (rawStatusStr === 'INVALID' || rawStatusStr === 'FAILED') {
        overallStatus = 'INVALID';
      } else {
        overallStatus = 'UNPARSEABLE';
      }

      const evidence: AuthoritativeVerificationEvidence = {
        verifiedAt: new Date().toISOString(),
        verifierComponentId: run.config.verifierId,
        overallStatus,
        isSignatureValid: Boolean(payload.isSignatureValid),
        isExpired: Boolean(payload.isExpired || overallStatus === 'EXPIRED'),
        isRevoked: Boolean(payload.isRevoked || overallStatus === 'REVOKED'),
        isIssuerTrusted: Boolean(payload.isIssuerTrusted && overallStatus !== 'UNTRUSTED_ISSUER'),
        credentialType: payload.credentialType,
        claimsValidated: payload.claims ?? {},
        verifierRawResponse: payload,
      };

      // Strict evaluation: callback receipt alone NEVER establishes PASS
      const report = AuthoritativeVerdictEvaluator.evaluate({
        runId,
        config: run.config,
        stages: run.stages,
        authoritativeEvidence: evidence,
        startTime: new Date(run.createdAt).getTime(),
      });
      const verdict = report.verdict;
      const evaluatedAt = report.evaluatedAt;

      const updatedStage: StageResult = {
        ...run.stages.AUTHORITATIVE_VERIFICATION,
        status: verdict === 'PASSED' ? 'COMPLETED' : 'FAILED',
        completedAt: evaluatedAt,
        data: { evidence, verdict },
      };

      const updatedStatus = verdict === 'PASSED' ? 'COMPLETED' : 'FAILED';

      await repo.updateRun(runId, {
        report,
        status: updatedStatus,
        completedAt: evaluatedAt,
        stages: {
          ...run.stages,
          AUTHORITATIVE_VERIFICATION: updatedStage,
        },
      });

      const event = ProtocolEventBus.createEvent({
        runId,
        stage: 'AUTHORITATIVE_VERIFICATION',
        protocol: 'OPENID4VP',
        source: 'VERIFIER',
        destination: 'ORCHESTRATOR',
        action: 'VERIFIER_WEBHOOK_RECEIVED',
        payloadSummary: `Authoritative callback received: status=${overallStatus}, verdict=${verdict}`,
        rawPayload: payload,
        requestPayload: payload,
        httpStatus: 200,
      });

      await repo.appendEvents(runId, [event]);

      return res.status(200).json({
        status: 'PROCESSED',
        runId,
        verdict,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
