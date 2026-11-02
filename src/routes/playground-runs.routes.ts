import { Router, Request, Response, NextFunction } from 'express';
import { TestOrchestrationEngine } from '../engine/test-runner.js';
import { ITestRunRepository } from '../storage/repository.js';
import { CredentialFormat, StageId, TestRun, TestRunConfig } from '../types/domain.js';

type Environment = 'collab' | 'local';
type UiCredentialFormat = 'jsonld-vc-1.1' | 'sd-jwt-vc';
type VerificationState = 'NOT_STARTED' | 'PENDING' | 'PASS' | 'INVALID' | 'EXPIRED' | 'ERROR';

interface ModuleSelection {
  id: string;
  version: string;
}

interface CreatePlaygroundRunBody {
  environment?: Environment;
  modules?: {
    issuer?: ModuleSelection;
    wallet?: ModuleSelection;
    verifier?: ModuleSelection;
  };
  credentialFormat?: UiCredentialFormat | CredentialFormat;
  // Fallbacks for direct flat fields
  issuerId?: string;
  walletId?: string;
  verifierId?: string;
  format?: CredentialFormat;
  mockTamper?: {
    corruptSignature?: boolean;
    forceExpired?: boolean;
    alterClaims?: boolean;
  };
}

/**
 * Maps frontend UI module identifiers to backend registry IDs.
 */
function normalizeModuleId(type: 'issuer' | 'wallet' | 'verifier', rawId?: string): string {
  if (!rawId) {
    if (type === 'issuer') return 'mock-openid4vci';
    if (type === 'wallet') return 'simulated-wallet';
    return 'mock-openid4vp';
  }

  const id = rawId.toLowerCase().trim();
  if (type === 'issuer') {
    if (id === 'mock-issuer' || id === 'mock' || id === 'mock-openid4vci') return 'mock-openid4vci';
    if (id === 'inji-certify' || id === 'certify') return 'inji-certify';
    return id;
  }
  if (type === 'wallet') {
    if (id === 'inji-web' || id === 'web') return 'inji-web';
    if (id === 'inji-mobile' || id === 'inji-wallet-mobile' || id === 'mobile') return 'inji-wallet-mobile';
    if (id === 'simulated-wallet' || id === 'simulated' || id === 'mock') return 'simulated-wallet';
    return id;
  }
  if (type === 'verifier') {
    if (id === 'mock-verifier' || id === 'mock' || id === 'mock-openid4vp') return 'mock-openid4vp';
    if (id === 'inji-verify' || id === 'verify') return 'inji-verify';
    return id;
  }
  return rawId;
}

/**
 * Normalizes frontend credential format to domain CredentialFormat.
 */
function normalizeFormat(format?: string): CredentialFormat {
  if (!format) return 'w3c_vc_jsonld';
  const f = format.toLowerCase().trim();
  if (f === 'jsonld-vc-1.1' || f === 'w3c_vc_jsonld' || f === 'jsonld') return 'w3c_vc_jsonld';
  if (f === 'sd-jwt-vc' || f === 'sd_jwt_vc') return 'sd_jwt_vc';
  if (f === 'mso_mdoc' || f === 'mdoc') return 'mso_mdoc';
  return 'w3c_vc_jsonld';
}

/**
 * Formats a domain CredentialFormat back to UI representation.
 */
function toUiFormat(format?: CredentialFormat): UiCredentialFormat {
  if (format === 'sd_jwt_vc') return 'sd-jwt-vc';
  return 'jsonld-vc-1.1';
}

/**
 * Maps stage ID to user-facing protocol step name for UI inspector filtering.
 */
function mapStageToStep(stage?: StageId): string {
  switch (stage) {
    case 'DISCOVERY_AND_CONFIG':
      return 'Discovery';
    case 'OFFER_ISSUANCE':
    case 'WALLET_STORAGE':
      return 'Issuance';
    case 'PRESENTATION_REQUEST':
    case 'PRESENTATION_SUBMISSION':
      return 'Presentation';
    case 'AUTHORITATIVE_VERIFICATION':
    case 'REPORT_GENERATION':
      return 'Verification';
    default:
      return 'Pipeline';
  }
}

/**
 * Derives normalized verification state from TestRun.
 */
function deriveVerificationState(run: TestRun): VerificationState {
  if (run.report) {
    if (run.report.verdict === 'PASSED') return 'PASS';
    const reason = (run.report.failureReason || '').toUpperCase();
    if (reason.includes('EXPIRED')) return 'EXPIRED';
    if (reason.includes('INVALID') || reason.includes('SIGNATURE')) return 'INVALID';
    return 'ERROR';
  }

  if (run.status === 'RUNNING' || run.status === 'INITIALIZING') {
    return 'PENDING';
  }

  if (run.status === 'AWAITING_WALLET_ACTION') {
    return 'PENDING';
  }

  if (run.status === 'FAILED') {
    return 'ERROR';
  }

  return 'NOT_STARTED';
}

/**
 * Converts a backend TestRun into the frontend RunRecord contract.
 */
function formatRunRecord(run: TestRun, environment: Environment = 'collab') {
  const vState = deriveVerificationState(run);
  const uiFormat = toUiFormat(run.config.format);

  const formattedEvents = (run.events || []).map((e) => ({
    runId: e.runId,
    eventId: e.eventId,
    timestamp: e.timestamp,
    step: mapStageToStep(e.stage),
    protocolStep: e.stage,
    actor: e.source,
    direction: `${e.source} -> ${e.destination}`,
    operation: e.action,
    httpStatus: e.httpStatus ?? 200,
    status: e.httpStatus ?? 200,
    request: e.rawPayload,
    response: e.rawPayload,
    error: e.stage === 'AUTHORITATIVE_VERIFICATION' && vState !== 'PASS' ? run.report?.failureReason : undefined,
  }));

  const expectedCredentialType = 'IdentityCredential';
  const observedCredentialType = run.report?.authoritativeEvidence?.credentialType || (vState === 'PASS' ? expectedCredentialType : undefined);

  return {
    runId: run.runId,
    state: vState,
    verificationState: vState,
    verificationResult: {
      state: vState,
      credentialType: observedCredentialType,
      expectedCredentialType: expectedCredentialType,
      error: vState === 'PASS' ? undefined : run.report?.failureReason,
    },
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
    environment,
    credentialFormat: uiFormat,
    modules: {
      issuer: {
        id: run.config.issuerId,
        version: run.config.issuerId === 'inji-certify' ? '0.10.0' : '1.0.0',
      },
      wallet: {
        id: run.config.walletId,
        version: run.config.walletId.includes('inji') ? '0.10.0' : '1.0.0',
      },
      verifier: {
        id: run.config.verifierId,
        version: run.config.verifierId === 'inji-verify' ? '0.10.0' : '1.0.0',
      },
    },
    events: formattedEvents,
    nextAction:
      run.status === 'AWAITING_WALLET_ACTION'
        ? 'SCAN_QR_OR_CONFIRM_WALLET'
        : vState === 'PENDING'
        ? 'WAIT_FOR_VERIFICATION'
        : 'DONE',
    qrPayload: run.qrPayload,
    report: run.report,
  };
}

/**
 * Creates the Playground API Router mounted at /api/runs
 * Implements the contract specified in API_Contract.md and used by lib/playground-api.ts
 */
export function createPlaygroundRunsRouter(
  engine: TestOrchestrationEngine,
  repo: ITestRunRepository
): Router {
  const router = Router();

  /**
   * POST /api/runs
   * Creates a new run per the agreed API Contract.
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreatePlaygroundRunBody;
      const environment: Environment = body.environment || 'collab';

      const issuerId = normalizeModuleId('issuer', body.modules?.issuer?.id || body.issuerId);
      const walletId = normalizeModuleId('wallet', body.modules?.wallet?.id || body.walletId);
      const verifierId = normalizeModuleId('verifier', body.modules?.verifier?.id || body.verifierId);
      const format = normalizeFormat(body.credentialFormat || body.format);

      const runConfig: TestRunConfig = {
        issuerId,
        walletId,
        verifierId,
        format,
        interactiveMode: walletId === 'inji-wallet-mobile',
        mockTamper: body.mockTamper,
      };

      const run = await engine.createAndStartRun(runConfig);

      const record = formatRunRecord(run, environment);
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/runs
   * Returns list of test runs formatted as RunRecord array.
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const runs = await repo.listRuns(limit);
      const records = runs.map((r) => formatRunRecord(r));
      res.json(records);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/runs/:runId
   * Retrieves single test run details and authoritative outcome.
   */
  router.get('/:runId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { runId } = req.params;
      const run = await repo.getRun(runId);
      if (!run) {
        return res.status(404).json({
          message: `Run ${runId} not found`,
          error: `Test run ${runId} does not exist`,
        });
      }

      const record = formatRunRecord(run);
      res.json(record);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/runs/:runId/issuance/start
   * Initiates/confirms the issuance flow step.
   */
  router.post('/:runId/issuance/start', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { runId } = req.params;
      const run = await repo.getRun(runId);
      if (!run) {
        return res.status(404).json({ message: `Run ${runId} not found` });
      }

      const record = formatRunRecord(run);
      res.json(record);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/runs/:runId/presentation/start
   * Initiates/confirms the presentation flow step.
   */
  router.post('/:runId/presentation/start', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { runId } = req.params;
      const run = await repo.getRun(runId);
      if (!run) {
        return res.status(404).json({ message: `Run ${runId} not found` });
      }

      const record = formatRunRecord(run);
      res.json(record);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
