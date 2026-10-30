import {
  ComponentMetadata,
  CredentialFormat,
  ProofType,
  ProtocolEvent,
  StageId,
  StageResult,
  TestReport,
  TestRunConfig,
  TestRun,
  RunStatus,
} from './domain.js';

export interface CreateTestRunRequest {
  issuerId: string;
  walletId: string;
  verifierId: string;
  format: CredentialFormat;
  proofType?: ProofType;
  interactiveMode?: boolean;
  mockTamper?: {
    corruptSignature?: boolean;
    forceExpired?: boolean;
    alterClaims?: boolean;
  };
}

export interface CreateTestRunResponse {
  runId: string;
  status: RunStatus;
  currentStage: StageId;
  createdAt: string;
  message: string;
}

export interface GetTestRunResponse {
  runId: string;
  status: RunStatus;
  currentStage: StageId;
  config: TestRunConfig;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  stages: Record<StageId, StageResult>;
  eventsCount: number;
  qrPayload?: {
    type: 'credential_offer_uri' | 'presentation_request_uri';
    uri: string;
  };
  report?: TestReport;
}

export interface GetProtocolEventsResponse {
  runId: string;
  totalEvents: number;
  events: ProtocolEvent[];
}

export interface GetTestRunsResponse {
  total: number;
  runs: Array<{
    runId: string;
    status: RunStatus;
    currentStage: StageId;
    config: TestRunConfig;
    createdAt: string;
    completedAt?: string;
    verdict?: string;
    durationMs?: number;
  }>;
}

export interface ComponentRegistryResponse {
  issuers: ComponentMetadata[];
  wallets: ComponentMetadata[];
  verifiers: ComponentMetadata[];
  formats: {
    id: CredentialFormat;
    name: string;
    description: string;
    standardsRef: string;
  }[];
}

export interface MatrixCell {
  issuerId: string;
  walletId: string;
  verifierId: string;
  format: CredentialFormat;
  status: 'SUPPORTED' | 'EXPERIMENTAL' | 'UNSUPPORTED' | 'PENDING_INTEGRATION';
  notes: string;
}

export interface CompatibilityMatrixResponse {
  cells: MatrixCell[];
  lastUpdated: string;
}

export interface ResumeTestRunRequest {
  action: 'WALLET_OFFER_ACCEPTED' | 'WALLET_PRESENTATION_SUBMITTED' | 'ABORT';
  payload?: Record<string, unknown>;
}

export interface VerifierCallbackPayload {
  runId: string;
  verificationId: string;
  status: 'SUCCESS' | 'FAILED' | 'EXPIRED';
  claims?: Record<string, unknown>;
  error?: string;
  rawDetails?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}
