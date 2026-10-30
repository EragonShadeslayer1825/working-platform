import { v4 as uuidv4 } from 'uuid';
import {
  AuthoritativeVerificationEvidence,
  ProtocolEvent,
  StageId,
  StageResult,
  TestRun,
  TestRunConfig,
} from '../types/domain.js';
import { IIssuerAdapter, IWalletAdapter, IVerifierAdapter } from '../types/adapters.js';
import { ComponentRegistry } from '../registry/component-registry.js';
import { MockIssuerAdapter } from '../adapters/issuer/mock-issuer.adapter.js';
import { InjiCertifyAdapter } from '../adapters/issuer/inji-certify.adapter.js';
import { SimulatedWalletAdapter } from '../adapters/wallet/simulated-wallet.adapter.js';
import { InjiWebAdapter } from '../adapters/wallet/inji-web.adapter.js';
import { MockVerifierAdapter } from '../adapters/verifier/mock-verifier.adapter.js';
import { InjiVerifyAdapter } from '../adapters/verifier/inji-verify.adapter.js';
import { AuthoritativeVerdictEvaluator } from './evaluator.js';
import { ProtocolEventBus } from './event-bus.js';
import { ITestRunRepository } from '../storage/repository.js';
import { config } from '../config/env.js';

export class TestOrchestrationEngine {
  constructor(private repo: ITestRunRepository) {}

  public async createAndStartRun(runConfig: TestRunConfig): Promise<TestRun> {
    const runId = uuidv4();
    const nowIso = new Date().toISOString();

    const stages: Record<StageId, StageResult> = {
      DISCOVERY_AND_CONFIG: { id: 'DISCOVERY_AND_CONFIG', name: 'Discovery & Configuration', status: 'NOT_STARTED' },
      OFFER_ISSUANCE: { id: 'OFFER_ISSUANCE', name: 'Credential Offer (OpenID4VCI)', status: 'NOT_STARTED' },
      WALLET_STORAGE: { id: 'WALLET_STORAGE', name: 'Wallet Credential Storage', status: 'NOT_STARTED' },
      PRESENTATION_REQUEST: { id: 'PRESENTATION_REQUEST', name: 'Presentation Request (OpenID4VP)', status: 'NOT_STARTED' },
      PRESENTATION_SUBMISSION: { id: 'PRESENTATION_SUBMISSION', name: 'Presentation Submission (VP)', status: 'NOT_STARTED' },
      AUTHORITATIVE_VERIFICATION: { id: 'AUTHORITATIVE_VERIFICATION', name: 'Authoritative Verification', status: 'NOT_STARTED' },
      REPORT_GENERATION: { id: 'REPORT_GENERATION', name: 'Report & Verdict Evaluation', status: 'NOT_STARTED' },
    };

    const initialRun: TestRun = {
      runId,
      config: runConfig,
      status: 'INITIALIZING',
      currentStage: 'DISCOVERY_AND_CONFIG',
      createdAt: nowIso,
      updatedAt: nowIso,
      stages,
      events: [],
    };

    await this.repo.createRun(initialRun);

    // Asynchronously kick off the test execution pipeline
    this.executePipeline(runId, runConfig).catch((err) => {
      console.error(`[TestEngine] Fatal execution pipeline error for run ${runId}:`, err);
    });

    return initialRun;
  }

  private resolveAdapters(runConfig: TestRunConfig): {
    issuer: IIssuerAdapter;
    wallet: IWalletAdapter;
    verifier: IVerifierAdapter;
  } {
    // 1. Resolve Issuer
    let issuer: IIssuerAdapter;
    if (runConfig.issuerId === 'inji-certify') {
      issuer = new InjiCertifyAdapter(config.injiCertifyBaseUrl);
    } else {
      issuer = new MockIssuerAdapter();
    }

    // 2. Resolve Wallet
    let wallet: IWalletAdapter;
    if (runConfig.walletId === 'inji-web') {
      wallet = new InjiWebAdapter(config.mimotoWalletBaseUrl);
    } else {
      wallet = new SimulatedWalletAdapter();
    }

    // 3. Resolve Verifier
    let verifier: IVerifierAdapter;
    if (runConfig.verifierId === 'inji-verify') {
      verifier = new InjiVerifyAdapter(config.injiVerifyBaseUrl);
    } else {
      verifier = new MockVerifierAdapter();
    }

    return { issuer, wallet, verifier };
  }

  private async executePipeline(runId: string, runConfig: TestRunConfig): Promise<void> {
    const startTime = Date.now();
    let currentRun = await this.repo.getRun(runId);
    if (!currentRun) return;

    const { issuer, wallet, verifier } = this.resolveAdapters(runConfig);
    let authoritativeEvidence: AuthoritativeVerificationEvidence | undefined;

    const logAndSaveEvents = async (events: ProtocolEvent[]) => {
      await this.repo.appendEvents(runId, events);
    };

    try {
      // -------------------------------------------------------------
      // STAGE 1: DISCOVERY_AND_CONFIG
      // -------------------------------------------------------------
      await this.updateStageStatus(runId, 'DISCOVERY_AND_CONFIG', 'IN_PROGRESS');
      
      const issuerMeta = ComponentRegistry.getIssuer(runConfig.issuerId);
      const walletMeta = ComponentRegistry.getWallet(runConfig.walletId);
      const verifierMeta = ComponentRegistry.getVerifier(runConfig.verifierId);

      if (!issuerMeta || !walletMeta || !verifierMeta) {
        throw new Error('One or more selected components not recognized in registry');
      }

      const initEvent = ProtocolEventBus.createEvent({
        runId,
        stage: 'DISCOVERY_AND_CONFIG',
        protocol: 'INTERNAL',
        source: 'ORCHESTRATOR',
        destination: 'ORCHESTRATOR',
        action: 'PIPELINE_INITIALIZED',
        payloadSummary: `Testing Issuer: ${issuerMeta.name}, Wallet: ${walletMeta.name}, Verifier: ${verifierMeta.name}, Format: ${runConfig.format}`,
        rawPayload: {
          issuer: issuerMeta,
          wallet: walletMeta,
          verifier: verifierMeta,
          format: runConfig.format,
        },
      });
      await logAndSaveEvents([initEvent]);
      await this.updateStageStatus(runId, 'DISCOVERY_AND_CONFIG', 'COMPLETED');

      // -------------------------------------------------------------
      // STAGE 2: OFFER_ISSUANCE (OpenID4VCI)
      // -------------------------------------------------------------
      await this.updateStageStatus(runId, 'OFFER_ISSUANCE', 'IN_PROGRESS');
      const offerResult = await issuer.initiateIssuance({
        runId,
        format: runConfig.format,
        proofType: runConfig.proofType,
      });

      const offerEvents = offerResult.protocolEvents.map((e) => ({
        ...e,
        eventId: uuidv4(),
        runId,
        timestamp: new Date().toISOString(),
      }));
      await logAndSaveEvents(offerEvents);

      // If interactive wallet mode is required (e.g. Inji mobile app scan)
      if (runConfig.interactiveMode && wallet.isInteractive) {
        await this.repo.updateRun(runId, {
          status: 'AWAITING_WALLET_ACTION',
          qrPayload: {
            type: 'credential_offer_uri',
            uri: offerResult.offerUri,
          },
        });
        // Interactive pause point - wait for external resume via API
        return;
      }

      await this.updateStageStatus(runId, 'OFFER_ISSUANCE', 'COMPLETED', {
        offerUri: offerResult.offerUri,
      });

      // -------------------------------------------------------------
      // STAGE 3: WALLET_STORAGE (Ingest Credential)
      // -------------------------------------------------------------
      await this.updateStageStatus(runId, 'WALLET_STORAGE', 'IN_PROGRESS');
      const holdingResult = await wallet.acceptOffer({
        runId,
        offerResult,
        format: runConfig.format,
      });

      const walletEvents = holdingResult.protocolEvents.map((e) => ({
        ...e,
        eventId: uuidv4(),
        runId,
        timestamp: new Date().toISOString(),
      }));
      await logAndSaveEvents(walletEvents);
      await this.updateStageStatus(runId, 'WALLET_STORAGE', 'COMPLETED', {
        storedCredentialId: holdingResult.storedCredentialId,
      });

      // -------------------------------------------------------------
      // STAGE 4: PRESENTATION_REQUEST (OpenID4VP)
      // -------------------------------------------------------------
      await this.updateStageStatus(runId, 'PRESENTATION_REQUEST', 'IN_PROGRESS');
      const callbackUrl = `http://localhost:${config.port}/api/v1/callbacks/verifier/${runId}`;
      const presentationRequest = await verifier.createPresentationRequest({
        runId,
        format: runConfig.format,
        callbackUrl,
      });

      const presReqEvents = presentationRequest.protocolEvents.map((e) => ({
        ...e,
        eventId: uuidv4(),
        runId,
        timestamp: new Date().toISOString(),
      }));
      await logAndSaveEvents(presReqEvents);
      await this.updateStageStatus(runId, 'PRESENTATION_REQUEST', 'COMPLETED', {
        requestUri: presentationRequest.requestUri,
      });

      // -------------------------------------------------------------
      // STAGE 5: PRESENTATION_SUBMISSION (VP Token)
      // -------------------------------------------------------------
      await this.updateStageStatus(runId, 'PRESENTATION_SUBMISSION', 'IN_PROGRESS');
      const submissionResult = await wallet.generatePresentation({
        runId,
        presentationRequestUri: presentationRequest.requestUri,
        presentationDefinition: presentationRequest.presentationDefinition,
        tamper: runConfig.mockTamper,
      });

      const presSubEvents = submissionResult.protocolEvents.map((e) => ({
        ...e,
        eventId: uuidv4(),
        runId,
        timestamp: new Date().toISOString(),
      }));
      await logAndSaveEvents(presSubEvents);
      await this.updateStageStatus(runId, 'PRESENTATION_SUBMISSION', 'COMPLETED');

      // -------------------------------------------------------------
      // STAGE 6: AUTHORITATIVE_VERIFICATION
      // -------------------------------------------------------------
      await this.updateStageStatus(runId, 'AUTHORITATIVE_VERIFICATION', 'IN_PROGRESS');
      
      // Authoritative evaluation rule: query the actual verifier adapter
      authoritativeEvidence = await verifier.evaluateAuthoritativeResult({
        runId,
        vpToken: submissionResult.vpToken,
        presentationSubmission: submissionResult.presentationSubmission,
        nonce: presentationRequest.nonce,
      });

      const verifierEvent = ProtocolEventBus.createEvent({
        runId,
        stage: 'AUTHORITATIVE_VERIFICATION',
        protocol: 'OPENID4VP',
        source: 'VERIFIER',
        destination: 'ORCHESTRATOR',
        action: 'VERIFICATION_RESULT_EVALUATED',
        payloadSummary: `Authoritative result: ${authoritativeEvidence.overallStatus} (Signature valid: ${authoritativeEvidence.isSignatureValid})`,
        rawPayload: {
          authoritativeEvidence,
        },
        httpStatus: 200,
      });
      await logAndSaveEvents([verifierEvent]);

      if (authoritativeEvidence.overallStatus === 'VALID') {
        await this.updateStageStatus(runId, 'AUTHORITATIVE_VERIFICATION', 'COMPLETED');
      } else {
        await this.updateStageStatus(runId, 'AUTHORITATIVE_VERIFICATION', 'FAILED', undefined, {
          code: 'VERIFICATION_INVALID',
          message: `Verifier determined credential is ${authoritativeEvidence.overallStatus}`,
          isRecoverable: false,
          isAuthoritativeFailure: true,
        });
      }

      // -------------------------------------------------------------
      // STAGE 7: REPORT_GENERATION
      // -------------------------------------------------------------
      await this.updateStageStatus(runId, 'REPORT_GENERATION', 'IN_PROGRESS');
      currentRun = (await this.repo.getRun(runId))!;

      const report = AuthoritativeVerdictEvaluator.evaluate({
        runId,
        config: runConfig,
        stages: currentRun.stages,
        authoritativeEvidence,
        startTime,
      });

      await this.updateStageStatus(runId, 'REPORT_GENERATION', 'COMPLETED');

      await this.repo.updateRun(runId, {
        status: report.verdict === 'PASSED' ? 'COMPLETED' : 'FAILED',
        completedAt: new Date().toISOString(),
        report,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isAuthoritative = (err as { isAuthoritativeFailure?: boolean })?.isAuthoritativeFailure ?? false;

      currentRun = (await this.repo.getRun(runId))!;
      const activeStage = currentRun.currentStage;

      await this.updateStageStatus(runId, activeStage, 'FAILED', undefined, {
        code: 'STAGE_EXECUTION_ERROR',
        message: errorMsg,
        isRecoverable: false,
        isAuthoritativeFailure: isAuthoritative,
      });

      currentRun = (await this.repo.getRun(runId))!;

      const report = AuthoritativeVerdictEvaluator.evaluate({
        runId,
        config: runConfig,
        stages: currentRun.stages,
        authoritativeEvidence,
        inconclusiveError: isAuthoritative ? undefined : { code: 'EXECUTION_ERROR', message: errorMsg },
        startTime,
      });

      await this.repo.updateRun(runId, {
        status: 'FAILED',
        completedAt: new Date().toISOString(),
        report,
      });
    }
  }

  private async updateStageStatus(
    runId: string,
    stageId: StageId,
    status: StageResult['status'],
    data?: Record<string, unknown>,
    error?: StageResult['error']
  ): Promise<void> {
    const currentRun = await this.repo.getRun(runId);
    if (!currentRun) return;

    const stage = currentRun.stages[stageId];
    const nowIso = new Date().toISOString();

    if (status === 'IN_PROGRESS' && !stage.startedAt) {
      stage.startedAt = nowIso;
    } else if (status === 'COMPLETED' || status === 'FAILED') {
      stage.completedAt = nowIso;
      if (stage.startedAt) {
        stage.durationMs = new Date(nowIso).getTime() - new Date(stage.startedAt).getTime();
      }
    }

    stage.status = status;
    if (data) stage.data = data;
    if (error) stage.error = error;

    currentRun.stages[stageId] = stage;
    currentRun.currentStage = stageId;
    if (status === 'IN_PROGRESS') {
      currentRun.status = 'RUNNING';
    }

    await this.repo.updateRun(runId, currentRun);
  }
}
